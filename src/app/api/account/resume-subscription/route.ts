import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import {
  getAuthenticatedUser,
  getCustomerForUser,
  supabaseAdmin,
} from "@/lib/server/customer-account";
import { renderBrandedEmail, sendTransactionalEmail } from "@/lib/server/email";
import { getStripeSubscriptionEntitlement } from "@/lib/server/subscription-entitlements";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

type LocalSubscription = {
  id: string;
  order_number: string | null;
  status: string | null;
  stripe_subscription_id: string | null;
};

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function customerResumeSyncErrorResponse() {
  return NextResponse.json(
    {
      error:
        "Stripe accepterade återaktiveringen, men Screenia kunde inte uppdatera all lokal status. Screenia har notifierats.",
    },
    { status: 500 },
  );
}

async function recordCustomerResumeSyncFailure({
  customerId,
  stripeSubscriptionIds,
  syncTarget,
  syncError,
  request,
}: {
  customerId: string;
  stripeSubscriptionIds: string[];
  syncTarget: string;
  syncError: string;
  request: Request;
}) {
  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId,
        actorType: "customer",
        eventType: "customer_resume_sync_failed",
        eventDescription:
          "Stripe accepted a customer reactivation, but Screenia could not fully sync the local active state.",
        metadata: {
          stripeSubscriptionIds,
          syncTarget,
          syncError,
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );
    await createAdminNotification(
      supabaseAdmin,
      {
        customerId,
        eventType: "customer_resume_sync_failed",
        title: "Customer reactivation sync failed",
        message:
          "A customer reactivated billing in Stripe, but Screenia could not fully update local subscription/access state. Review the customer before considering the reactivation complete.",
        priority: "urgent",
        metadata: {
          stripeSubscriptionIds,
          syncTarget,
          syncError,
        },
      },
      { throwOnError: true },
    );
    return null;
  } catch (evidenceError) {
    console.error("Customer reactivation sync failure evidence error:", evidenceError);
    return NextResponse.json(
      {
        error:
          "Stripe accepterade återaktiveringen, men Screenia kunde inte spara kontrollinformationen. Kontakta support.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  const customer = await getCustomerForUser(user);

  if (!user || !customer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const reason =
    String(body.reason || "").trim().slice(0, 300) ||
    "Customer requested subscription reactivation.";

  const { data: localSubscriptions, error: subscriptionLookupError } =
    await supabaseAdmin
      .from("customer_subscriptions")
      .select("id, order_number, status, stripe_subscription_id")
      .eq("customer_id", customer.id)
      .not("stripe_subscription_id", "is", null)
      .in("status", ["paused"])
      .order("created_at", { ascending: false });

  if (subscriptionLookupError) {
    return NextResponse.json(
      { error: "Kunde inte hämta abonnemanget." },
      { status: 500 },
    );
  }

  const stripeSubscriptionIds = uniqueValues([
    customer.stripe_subscription_id,
    ...((localSubscriptions || []) as LocalSubscription[]).map(
      (subscription) => subscription.stripe_subscription_id,
    ),
  ]);

  if (stripeSubscriptionIds.length === 0) {
    return NextResponse.json(
      { error: "Inget pausat Stripe-abonnemang är kopplat till kontot." },
      { status: 400 },
    );
  }

  const resumedSubscriptions: Stripe.Subscription[] = [];

  for (const subscriptionId of stripeSubscriptionIds) {
    const currentSubscription = await stripe.subscriptions.retrieve(subscriptionId);

    if (currentSubscription.status === "canceled") continue;

    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
      pause_collection: "",
    } as Stripe.SubscriptionUpdateParams);

    resumedSubscriptions.push(subscription);
  }

  if (resumedSubscriptions.length === 0) {
    return NextResponse.json(
      { error: "Det finns inget pausat abonnemang som kan återaktiveras." },
      { status: 400 },
    );
  }

  const entitlement = getStripeSubscriptionEntitlement(resumedSubscriptions[0]);
  const localSubscriptionUpdate = {
    status: "active",
    fulfillment_status: "active",
    stripe_payment_status: resumedSubscriptions[0].status,
    stripe_current_period_start: entitlement.currentPeriodStart,
    stripe_current_period_end: entitlement.currentPeriodEnd,
    cancel_at_period_end: false,
    cancellation_effective_at: null,
    pause_started_at: null,
    pause_resumes_at: null,
    pause_reason: null,
  };

  const { error: subscriptionSyncError } = await supabaseAdmin
    .from("customer_subscriptions")
    .update(localSubscriptionUpdate)
    .in(
      "stripe_subscription_id",
      resumedSubscriptions.map((subscription) => subscription.id),
    );

  if (subscriptionSyncError) {
    const evidenceFailureResponse = await recordCustomerResumeSyncFailure({
      customerId: customer.id,
      stripeSubscriptionIds: resumedSubscriptions.map((subscription) => subscription.id),
      syncTarget: "customer_subscriptions",
      syncError: subscriptionSyncError.message,
      request,
    });
    if (evidenceFailureResponse) return evidenceFailureResponse;
    return customerResumeSyncErrorResponse();
  }

  const customerResumeUpdate = {
    status: "active",
    payment_status: "paid",
    service_access_status: entitlement.serviceAccessStatus,
    service_access_until: entitlement.serviceAccessUntil,
    inactive_reason: null,
    cancellation_reason: null,
    cancellation_details: null,
    cancellation_source: null,
    cancelled_at: null,
  };

  const { error: customerSyncError } = await supabaseAdmin
    .from("customers")
    .update(customerResumeUpdate)
    .eq("id", customer.id);

  if (customerSyncError) {
    const evidenceFailureResponse = await recordCustomerResumeSyncFailure({
      customerId: customer.id,
      stripeSubscriptionIds: resumedSubscriptions.map((subscription) => subscription.id),
      syncTarget: "customers",
      syncError: customerSyncError.message,
      request,
    });
    if (evidenceFailureResponse) return evidenceFailureResponse;
    return customerResumeSyncErrorResponse();
  }

  const orderNumbers = ((localSubscriptions || []) as LocalSubscription[])
    .filter((subscription) =>
      resumedSubscriptions.some(
        (resumedSubscription) =>
          resumedSubscription.id === subscription.stripe_subscription_id,
      ),
    )
    .map((subscription) => subscription.order_number)
    .filter(Boolean);

  const emailResult = await sendTransactionalEmail({
    to: customer.email,
    subject: "Bekräftelse: abonnemanget är återaktiverat",
    text: [
      `Hej ${customer.name},`,
      "",
      "Vi bekräftar att abonnemanget har återaktiverats enligt begäran.",
      "Skärmtjänsten och kommande abonnemangsdebiteringar är aktiva igen.",
      "",
      orderNumbers.length ? `Berörda beställningar: ${orderNumbers.join(", ")}` : "",
      `Notering: ${reason}`,
      "",
      "Kontakta service@screenia.se om något inte fungerar som förväntat.",
    ]
      .filter(Boolean)
      .join("\n"),
    html: renderBrandedEmail({
      eyebrow: "Abonnemang",
      title: "Abonnemanget är återaktiverat",
      intro:
        "Vi bekräftar att abonnemanget har återaktiverats. Skärmtjänsten och kommande abonnemangsdebiteringar är aktiva igen.",
      children: `
        <div style="border:1px solid #d8e7fb; border-radius:14px; background:#f7fbff; padding:16px 18px;">
          <p style="margin:0 0 8px;"><strong>Företag:</strong> ${customer.name}</p>
          ${
            orderNumbers.length
              ? `<p style="margin:0 0 8px;"><strong>Beställningar:</strong> ${orderNumbers.join(", ")}</p>`
              : ""
          }
          <p style="margin:0;"><strong>Notering:</strong> ${reason}</p>
        </div>
        <p style="margin:18px 0 0;">Kontakta <a href="mailto:service@screenia.se" style="color:#155ee8;">service@screenia.se</a> om något inte fungerar som förväntat.</p>
      `,
      showHelper: false,
    }),
  });

  await recordAuditEvent(
    supabaseAdmin,
    {
      customerId: customer.id,
      actorType: "customer",
      actorId: user.id,
      eventType: "customer_subscription_resumed",
      eventDescription:
        "Customer reactivated their subscription from the customer profile.",
      metadata: {
        reason,
        stripeSubscriptionIds: resumedSubscriptions.map((subscription) => subscription.id),
        resendEmailId: emailResult.ok ? emailResult.id || null : null,
        emailWarning: emailResult.ok ? null : emailResult.error,
      },
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
    },
    { throwOnError: true },
  );

  await createAdminNotification(supabaseAdmin, {
    customerId: customer.id,
    eventType: "customer_subscription_resumed",
    title: "Customer reactivated subscription",
    message: `${customer.name} reactivated the subscription from the customer profile.`,
    priority: "high",
    metadata: {
      stripeSubscriptionIds: resumedSubscriptions.map((subscription) => subscription.id),
      resendEmailId: emailResult.ok ? emailResult.id || null : null,
    },
  });

  return NextResponse.json({
    success: true,
    resumedSubscriptionCount: resumedSubscriptions.length,
    emailSent: emailResult.ok,
    resendEmailId: emailResult.ok ? emailResult.id || null : null,
    warning: emailResult.ok ? null : emailResult.error,
  });
}
