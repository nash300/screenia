import { NextResponse } from "next/server";
import Stripe from "stripe";
import { recordAuditEvent } from "@/lib/server/audit";
import {
  getAuthenticatedUser,
  getCustomerForUser,
  supabaseAdmin,
} from "@/lib/server/customer-account";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

const allowedCancellationReasons = new Set([
  "too_expensive",
  "missing_features",
  "not_using",
  "switching_provider",
  "technical_issue",
  "temporary_pause",
  "other",
]);

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  const customer = await getCustomerForUser(user);

  if (!user || !customer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!customer.stripe_subscription_id) {
    return NextResponse.json(
      { error: "No active subscription is connected to this account." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const reason = String(body.reason || "").trim();
  const details = String(body.details || "").trim().slice(0, 1200);
  const normalizedReason = allowedCancellationReasons.has(reason)
    ? reason
    : "other";

  const subscription = await stripe.subscriptions.retrieve(
    customer.stripe_subscription_id,
  );

  if (subscription.status !== "canceled") {
    await stripe.subscriptions.cancel(customer.stripe_subscription_id);
  }

  const cancelledAt = new Date().toISOString();
  const customerCancellationUpdate = {
    status: "suspended",
    payment_status: "cancelled",
    inactive_reason: normalizedReason,
    cancelled_at: cancelledAt,
    cancellation_source: "customer",
  };
  const customerCancellationResult = await supabaseAdmin
    .from("customers")
    .update({
      ...customerCancellationUpdate,
      cancellation_reason: normalizedReason,
      cancellation_details: details || null,
    })
    .eq("id", customer.id);

  if (
    customerCancellationResult.error?.code === "42703" ||
    customerCancellationResult.error?.code === "PGRST204"
  ) {
    await supabaseAdmin
      .from("customers")
      .update(customerCancellationUpdate)
      .eq("id", customer.id);
  }

  await Promise.all([
    supabaseAdmin
      .from("customer_subscriptions")
      .update({
        status: "cancelled",
        fulfillment_status: "cancelled",
      })
      .eq("stripe_subscription_id", customer.stripe_subscription_id),
    recordAuditEvent(supabaseAdmin, {
      customerId: customer.id,
      actorType: "customer",
      eventType: "subscription_cancelled",
      eventDescription: "Customer cancelled subscription from account portal.",
      metadata: {
        stripeSubscriptionId: customer.stripe_subscription_id,
        cancellationReason: normalizedReason,
        cancellationDetails: details || null,
      },
    }),
  ]);

  return NextResponse.json({ success: true });
}
