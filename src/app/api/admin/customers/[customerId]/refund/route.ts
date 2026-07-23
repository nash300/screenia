import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { resolveStripeFirstPayment } from "@/lib/server/stripe-first-payment";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const createAuthenticatedClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );
};

function isMissingRefundColumns(error: { code?: string; message?: string }) {
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    error.message?.includes("service_access_status") ||
    error.message?.includes("service_access_until")
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const supabase = await createAuthenticatedClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.app_metadata.role !== "admin") {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const adminReason = String(body.reason || "").trim().slice(0, 1000);
  if (adminReason.length < 5) {
    return NextResponse.json(
      { error: "A refund reason is required before refunding a customer." },
      { status: 400 },
    );
  }

  const { customerId } = await params;
  const timestamp = new Date().toISOString();

  const { data: customer, error: customerError } = await supabaseAdmin
    .from("customers")
    .select(
      "id, name, payment_status, service_access_status, service_access_until, setup_fee_locked_at, stripe_customer_id",
    )
    .eq("id", customerId)
    .single();

  if (customerError || !customer) {
    if (customerError && isMissingRefundColumns(customerError)) {
      return NextResponse.json(
        {
          error:
            "Refund safety columns are missing. Apply the latest Supabase migration before refunding customers.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: "Customer was not found." }, { status: 404 });
  }

  if (customer.setup_fee_locked_at) {
    return NextResponse.json(
      {
        error:
          "The setup fee is locked because layout work has started. Handle this refund manually if an exception is approved.",
      },
      { status: 409 },
    );
  }

  if (!["paid", "refunded"].includes(customer.payment_status || "")) {
    return NextResponse.json(
      { error: "Only paid customers can be refunded." },
      { status: 400 },
    );
  }

  const { data: subscription, error: subscriptionError } = await supabaseAdmin
    .from("customer_subscriptions")
    .select(
      "id, order_number, stripe_customer_id, stripe_checkout_session_id, stripe_payment_intent_id, stripe_subscription_id, total_amount_sek, status",
    )
    .eq("customer_id", customer.id)
    .in("status", ["paid", "active", "checkout_started", "refunded"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscriptionError) {
    console.error("Refund subscription lookup error:", subscriptionError);
    return NextResponse.json(
      { error: "Could not find the paid subscription." },
      { status: 500 },
    );
  }

  if (!subscription) {
    return NextResponse.json(
      { error: "No refundable paid order was found." },
      { status: 404 },
    );
  }

  let refundResult: {
    id: string;
    status: string | null;
    amount: number | null;
  };

  // The compatibility column stores SEK totals; Stripe refund amounts are resolved in ore.
  const expectedAmount = Math.round(subscription.total_amount_sek || 0);
  let firstPaymentIntentId: string;
  let firstPaymentCharge: Stripe.Charge;
  try {
    const resolvedFirstPayment = await resolveStripeFirstPayment({
      stripe,
      checkoutSessionId: subscription.stripe_checkout_session_id,
      storedPaymentIntentId: subscription.stripe_payment_intent_id,
      expectedAmountOre: expectedAmount,
    });
    firstPaymentIntentId = resolvedFirstPayment.paymentIntentId;
    firstPaymentCharge = resolvedFirstPayment.charge;
  } catch (error) {
    return NextResponse.json(
      {
        error: `${error instanceof Error ? error.message : "The first payment could not be verified."} No refund was created.`,
      },
      { status: 409 },
    );
  }

  if (
    firstPaymentCharge.amount_refunded >= firstPaymentCharge.amount
  ) {
    refundResult = {
      id: `existing_refund_for_${firstPaymentCharge.id}`,
      status: "succeeded",
      amount: firstPaymentCharge.amount_refunded,
    };
  } else {
    const refund = await stripe.refunds.create({
      payment_intent: firstPaymentIntentId,
      metadata: {
        customer_id: customer.id,
        customer_subscription_id: subscription.id,
        order_number: subscription.order_number || "",
        reason: "admin_refund_before_layout_started",
        admin_reason: adminReason,
      },
    });
    refundResult = {
      id: refund.id,
      status: refund.status,
      amount: refund.amount,
    };
  }

  let subscriptionCancellationStatus: string | null = null;
  let subscriptionCancellationError: string | null = null;
  if (subscription.stripe_subscription_id) {
    try {
      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripe_subscription_id,
      );

      if (stripeSubscription.status === "canceled") {
        subscriptionCancellationStatus = stripeSubscription.status;
      } else {
        const cancelledSubscription = await stripe.subscriptions.cancel(
          subscription.stripe_subscription_id,
        );
        subscriptionCancellationStatus = cancelledSubscription.status;
      }
    } catch (error) {
      subscriptionCancellationError =
        error instanceof Error ? error.message : "Unknown Stripe cancellation error.";
    }
  }

  const customerUpdate = supabaseAdmin
    .from("customers")
    .update({
      status: "suspended",
      payment_status: "refunded",
      service_access_status: "refunded",
      service_access_until: null,
      inactive_reason: "refunded_before_production",
      cancellation_reason: "refunded_before_production",
      cancellation_details:
        "First payment was refunded before layout work started.",
      cancelled_at: timestamp,
      cancellation_source: "admin",
    })
    .eq("id", customer.id);

  const subscriptionUpdate = supabaseAdmin
    .from("customer_subscriptions")
    .update({
      status: "refunded",
      stripe_payment_intent_id: firstPaymentIntentId,
      stripe_payment_status: "refunded",
      fulfillment_status: "cancelled",
      inventory_status: "cancelled",
    })
    .eq("id", subscription.id);

  const [customerResult, subscriptionResult] = await Promise.all([
    customerUpdate,
    subscriptionUpdate,
  ]);

  if (customerResult.error || subscriptionResult.error) {
    console.error("Refund database update error:", {
      customer: customerResult.error,
      subscription: subscriptionResult.error,
    });
    await Promise.all([
      recordAuditEvent(supabaseAdmin, {
        customerId: customer.id,
        actorType: "admin",
        actorId: user.id,
        eventType: "payment_refund_local_sync_failed",
        eventDescription:
          "Stripe refund was created, but Screenia could not fully sync the refunded local state.",
        metadata: {
          orderNumber: subscription.order_number,
          refundId: refundResult.id,
          refundStatus: refundResult.status,
          amount: refundResult.amount,
          adminReason,
          customerError: customerResult.error?.message || null,
          subscriptionError: subscriptionResult.error?.message || null,
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      }),
      createAdminNotification(supabaseAdmin, {
        customerId: customer.id,
        eventType: "payment_refund_local_sync_failed",
        title: "Refund sync failed",
        message: `Stripe refund ${refundResult.id} was created, but Screenia could not fully update local customer access.`,
        priority: "urgent",
        metadata: {
          orderNumber: subscription.order_number,
          refundId: refundResult.id,
          refundStatus: refundResult.status,
          amount: refundResult.amount,
          customerError: customerResult.error?.message || null,
          subscriptionError: subscriptionResult.error?.message || null,
        },
      }),
    ]);
    return NextResponse.json(
      {
        error:
          "Stripe refund was created, but the local customer record could not be fully updated.",
        refundId: refundResult.id,
      },
      { status: 500 },
    );
  }

  await recordAuditEvent(supabaseAdmin, {
    customerId: customer.id,
    actorType: "admin",
    actorId: user.id,
    eventType: "payment_refunded",
    eventDescription:
      "Admin refunded the first payment before layout work started.",
    metadata: {
      orderNumber: subscription.order_number,
      refundId: refundResult.id,
      refundStatus: refundResult.status,
      amount: refundResult.amount,
      stripePaymentIntentId: firstPaymentIntentId,
      adminReason,
      stripeSubscriptionId: subscription.stripe_subscription_id,
      subscriptionCancellationStatus,
      subscriptionCancellationError,
    },
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  await createAdminNotification(supabaseAdmin, {
    customerId: customer.id,
    eventType: "payment_refunded",
    title: "Payment refunded",
    message: `Order ${subscription.order_number || subscription.id} was refunded before layout work started.`,
    priority: "high",
    metadata: {
      refundId: refundResult.id,
      refundStatus: refundResult.status,
      amount: refundResult.amount,
      stripePaymentIntentId: firstPaymentIntentId,
      adminReason,
      stripeSubscriptionId: subscription.stripe_subscription_id,
      subscriptionCancellationStatus,
      subscriptionCancellationError,
    },
  });

  if (subscriptionCancellationError) {
    await createAdminNotification(supabaseAdmin, {
      customerId: customer.id,
      eventType: "payment_refund_subscription_cancel_failed",
      title: "Refunded subscription needs Stripe review",
      message: `Order ${subscription.order_number || subscription.id} was refunded, but Stripe subscription cancellation needs manual review.`,
      priority: "urgent",
      metadata: {
        refundId: refundResult.id,
        refundStatus: refundResult.status,
        amount: refundResult.amount,
        stripeSubscriptionId: subscription.stripe_subscription_id,
        subscriptionCancellationError,
      },
    });
  }

  return NextResponse.json({
    success: true,
    refundId: refundResult.id,
    refundStatus: refundResult.status,
    amount: refundResult.amount,
    subscriptionCancellationStatus,
  });
}
