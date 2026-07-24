import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import {
  getAuthenticatedUser,
  getCustomerForUser,
  supabaseAdmin,
} from "@/lib/server/customer-account";
import {
  renderBrandedEmail,
  sendTransactionalEmail,
} from "@/lib/server/email";
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

function addMonths(value: Date, months: number) {
  const next = new Date(value);
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);

  if (next.getDate() !== day) {
    next.setDate(0);
  }

  return next;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function customerPauseSyncErrorResponse() {
  return NextResponse.json(
    {
      error:
        "Stripe accepterade pausen, men Screenia kunde inte uppdatera all lokal status. Screenia har notifierats.",
    },
    { status: 500 },
  );
}

async function recordCustomerPauseSyncFailure({
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
        eventType: "customer_pause_sync_failed",
        eventDescription:
          "Stripe accepted a customer pause, but Screenia could not fully sync the local pause state.",
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
        eventType: "customer_pause_sync_failed",
        title: "Customer pause sync failed",
        message:
          "A customer paused billing in Stripe, but Screenia could not fully update local subscription/access state. Review the customer before considering the pause complete.",
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
    console.error("Customer pause sync failure evidence error:", evidenceError);
    return NextResponse.json(
      {
        error:
          "Stripe accepterade pausen, men Screenia kunde inte spara kontrollinformationen. Kontakta support.",
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
    "Customer requested a temporary subscription pause.";
  const durationMonths = Number(body.durationMonths);

  if (!Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 4) {
    return NextResponse.json(
      { error: "Pausen kan vara mellan 1 och 4 månader." },
      { status: 400 },
    );
  }

  const pauseResumesAt = addMonths(new Date(), durationMonths);
  const pauseResumesAtUnix = Math.floor(pauseResumesAt.getTime() / 1000);
  const pauseResumesAtIso = pauseResumesAt.toISOString();

  const { data: localSubscriptions, error: subscriptionLookupError } =
    await supabaseAdmin
      .from("customer_subscriptions")
      .select("id, order_number, status, stripe_subscription_id")
      .eq("customer_id", customer.id)
      .not("stripe_subscription_id", "is", null)
      .in("status", ["paid", "active", "trialing"])
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
      { error: "Inget aktivt Stripe-abonnemang är kopplat till kontot." },
      { status: 400 },
    );
  }

  const pausedSubscriptions: Stripe.Subscription[] = [];

  for (const subscriptionId of stripeSubscriptionIds) {
    const currentSubscription = await stripe.subscriptions.retrieve(subscriptionId);

    if (currentSubscription.status === "canceled") continue;

    const subscription = currentSubscription.pause_collection
      ? currentSubscription
      : await stripe.subscriptions.update(subscriptionId, {
          pause_collection: {
            behavior: "void",
            resumes_at: pauseResumesAtUnix,
          },
        });

    pausedSubscriptions.push(subscription);
  }

  if (pausedSubscriptions.length === 0) {
    return NextResponse.json(
      { error: "Det finns inget abonnemang som kan pausas." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const firstEntitlement = getStripeSubscriptionEntitlement(pausedSubscriptions[0]);
  const localSubscriptionUpdate = {
    status: "paused",
    fulfillment_status: "paused",
    stripe_payment_status: pausedSubscriptions[0].status,
    pause_started_at: firstEntitlement.pauseStartedAt || now,
    pause_resumes_at: firstEntitlement.pauseResumesAt,
    pause_reason: reason,
  };

  const { error: subscriptionSyncError } = await supabaseAdmin
    .from("customer_subscriptions")
    .update(localSubscriptionUpdate)
    .in("stripe_subscription_id", pausedSubscriptions.map((subscription) => subscription.id));

  if (subscriptionSyncError) {
    const evidenceFailureResponse = await recordCustomerPauseSyncFailure({
      customerId: customer.id,
      stripeSubscriptionIds: pausedSubscriptions.map((subscription) => subscription.id),
      syncTarget: "customer_subscriptions",
      syncError: subscriptionSyncError.message,
      request,
    });
    if (evidenceFailureResponse) return evidenceFailureResponse;
    return customerPauseSyncErrorResponse();
  }

  const customerPauseUpdate = {
    status: "suspended",
    service_access_status: "paused",
    service_access_until: null,
    inactive_reason: "paused",
  };

  const { error: customerSyncError } = await supabaseAdmin
    .from("customers")
    .update(customerPauseUpdate)
    .eq("id", customer.id);

  if (customerSyncError) {
    const evidenceFailureResponse = await recordCustomerPauseSyncFailure({
      customerId: customer.id,
      stripeSubscriptionIds: pausedSubscriptions.map((subscription) => subscription.id),
      syncTarget: "customers",
      syncError: customerSyncError.message,
      request,
    });
    if (evidenceFailureResponse) return evidenceFailureResponse;
    return customerPauseSyncErrorResponse();
  }

  const orderNumbers = ((localSubscriptions || []) as LocalSubscription[])
    .filter((subscription) =>
      pausedSubscriptions.some(
        (pausedSubscription) =>
          pausedSubscription.id === subscription.stripe_subscription_id,
      ),
    )
    .map((subscription) => subscription.order_number)
    .filter(Boolean);

  const emailResult = await sendTransactionalEmail({
    to: customer.email,
    subject: "Bekräftelse: abonnemanget är pausat",
    text: [
      `Hej ${customer.name},`,
      "",
      "Vi bekräftar att abonnemanget har pausats enligt begäran.",
      `Skärmtjänsten stoppas under pausen och kommande debiteringar är pausade till ${formatDate(pauseResumesAtIso)}.`,
      "",
      orderNumbers.length ? `Berörda beställningar: ${orderNumbers.join(", ")}` : "",
      `Pauslängd: ${durationMonths} ${durationMonths === 1 ? "månad" : "månader"}`,
      `Planerad återaktivering: ${formatDate(pauseResumesAtIso)}`,
      `Orsak/notering: ${reason}`,
      "",
      "Kontakta service@screenia.se om pausen behöver avslutas tidigare.",
    ]
      .filter(Boolean)
      .join("\n"),
    html: renderBrandedEmail({
      eyebrow: "Abonnemang",
      title: "Abonnemanget är pausat",
      intro:
        `Vi bekräftar att abonnemanget har pausats. Skärmtjänsten stoppas under pausen och kommande debiteringar är pausade till ${formatDate(pauseResumesAtIso)}.`,
      children: `
        <div style="border:1px solid #d8e7fb; border-radius:14px; background:#f7fbff; padding:16px 18px;">
          <p style="margin:0 0 8px;"><strong>Företag:</strong> ${customer.name}</p>
          ${
            orderNumbers.length
              ? `<p style="margin:0 0 8px;"><strong>Beställningar:</strong> ${orderNumbers.join(", ")}</p>`
              : ""
          }
          <p style="margin:0 0 8px;"><strong>Pauslängd:</strong> ${durationMonths} ${durationMonths === 1 ? "månad" : "månader"}</p>
          <p style="margin:0 0 8px;"><strong>Planerad återaktivering:</strong> ${formatDate(pauseResumesAtIso)}</p>
          <p style="margin:0;"><strong>Notering:</strong> ${reason}</p>
        </div>
        <p style="margin:18px 0 0;">Kontakta <a href="mailto:service@screenia.se" style="color:#155ee8;">service@screenia.se</a> om pausen behöver avslutas tidigare.</p>
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
      eventType: "customer_subscription_paused",
      eventDescription:
        "Customer paused their subscription from the customer profile.",
      metadata: {
        reason,
        durationMonths,
        pauseResumesAt: pauseResumesAtIso,
        stripeSubscriptionIds: pausedSubscriptions.map((subscription) => subscription.id),
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
    eventType: "customer_subscription_paused",
    title: "Customer paused subscription",
    message: `${customer.name} paused the subscription from the customer profile.`,
    priority: "high",
    metadata: {
      durationMonths,
      pauseResumesAt: pauseResumesAtIso,
      stripeSubscriptionIds: pausedSubscriptions.map((subscription) => subscription.id),
      resendEmailId: emailResult.ok ? emailResult.id || null : null,
    },
  });

  return NextResponse.json({
    success: true,
    pausedSubscriptionCount: pausedSubscriptions.length,
    pauseResumesAt: pauseResumesAtIso,
    emailSent: emailResult.ok,
    resendEmailId: emailResult.ok ? emailResult.id || null : null,
    warning: emailResult.ok ? null : emailResult.error,
  });
}
