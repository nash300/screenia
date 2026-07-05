import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";

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

  const { customerId } = await params;
  const timestamp = new Date().toISOString();

  const { data: customer, error: customerError } = await supabaseAdmin
    .from("customers")
    .select(
      "id, name, payment_status, setup_fee_locked_at, stripe_customer_id",
    )
    .eq("id", customerId)
    .single();

  if (customerError || !customer) {
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
      "id, order_number, stripe_customer_id, stripe_payment_intent_id, stripe_subscription_id, total_amount_sek, status",
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

  const stripeCustomerId =
    subscription.stripe_customer_id || customer.stripe_customer_id;
  let refundResult: {
    id: string;
    status: string | null;
    amount: number | null;
  };

  if (subscription.stripe_payment_intent_id) {
    const refund = await stripe.refunds.create({
      payment_intent: subscription.stripe_payment_intent_id,
      metadata: {
        customer_id: customer.id,
        customer_subscription_id: subscription.id,
        order_number: subscription.order_number || "",
        reason: "admin_refund_before_layout_started",
      },
    });
    refundResult = {
      id: refund.id,
      status: refund.status,
      amount: refund.amount,
    };
  } else if (stripeCustomerId) {
    const charges = await stripe.charges.list({
      customer: stripeCustomerId,
      limit: 10,
    });
    const refundableCharge = charges.data.find(
      (charge) => charge.status === "succeeded" && !charge.refunded,
    );
    const alreadyRefundedCharge = charges.data.find(
      (charge) => charge.status === "succeeded" && charge.refunded,
    );

    if (!refundableCharge) {
      if (!alreadyRefundedCharge || subscription.status !== "refunded") {
        return NextResponse.json(
          { error: "No refundable Stripe charge was found for this customer." },
          { status: 404 },
        );
      }

      refundResult = {
        id: `existing_refund_for_${alreadyRefundedCharge.id}`,
        status: "succeeded",
        amount: alreadyRefundedCharge.amount_refunded,
      };
    } else {
      const refund = await stripe.refunds.create({
        charge: refundableCharge.id,
        metadata: {
          customer_id: customer.id,
          customer_subscription_id: subscription.id,
          order_number: subscription.order_number || "",
          reason: "admin_refund_before_layout_started",
        },
      });
      refundResult = {
        id: refund.id,
        status: refund.status,
        amount: refund.amount,
      };
    }
  } else {
    return NextResponse.json(
      { error: "No Stripe customer or payment reference is connected." },
      { status: 400 },
    );
  }

  let subscriptionCancellationStatus: string | null = null;
  if (subscription.stripe_subscription_id) {
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
  }

  const customerUpdate = supabaseAdmin
    .from("customers")
    .update({
      status: "suspended",
      payment_status: "refunded",
      inactive_reason: "subscription_cancelled",
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
      stripe_payment_status: "refunded",
      fulfillment_status: "cancelled",
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
      stripeSubscriptionId: subscription.stripe_subscription_id,
      subscriptionCancellationStatus,
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
      stripeSubscriptionId: subscription.stripe_subscription_id,
      subscriptionCancellationStatus,
    },
  });

  return NextResponse.json({
    success: true,
    refundId: refundResult.id,
    refundStatus: refundResult.status,
    amount: refundResult.amount,
    subscriptionCancellationStatus,
  });
}
