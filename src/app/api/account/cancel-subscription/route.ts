import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import {
  getAuthenticatedUser,
  getCustomerForUser,
  supabaseAdmin,
} from "@/lib/server/customer-account";
import { getStripeSubscriptionEntitlement } from "@/lib/server/subscription-entitlements";

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

async function recordCustomerCancellationSyncFailure(
  customerId: string,
  stripeSubscriptionId: string,
  syncTarget: string,
  syncError: string,
  attemptedUpdate: Record<string, unknown>,
  request: Request,
) {
  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId,
        actorType: "customer",
        eventType: "customer_cancellation_sync_failed",
        eventDescription:
          "Stripe accepted a customer cancellation, but Screenia could not fully sync the local cancellation state.",
        metadata: {
          stripeSubscriptionId,
          syncTarget,
          syncError,
          attemptedUpdate,
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
        eventType: "customer_cancellation_sync_failed",
        title: "Customer cancellation sync failed",
        message:
          "Stripe accepted a customer cancellation, but Screenia could not fully update local cancellation/access state. Review the subscription and display entitlement.",
        priority: "urgent",
        metadata: {
          stripeSubscriptionId,
          syncTarget,
          syncError,
        },
      },
      { throwOnError: true },
    );
    return null;
  } catch (evidenceError) {
    console.error("Customer cancellation sync failure evidence error:", evidenceError);
    return NextResponse.json(
      {
        error:
          "Stripe accepted the cancellation, but Screenia could not sync your account or store urgent failure evidence. Contact support.",
      },
      { status: 500 },
    );
  }
}

function cancellationSyncErrorResponse() {
  return NextResponse.json(
    {
      error:
        "Stripe accepted the cancellation, but Screenia could not fully update your account. Screenia has been notified to review it.",
    },
    { status: 500 },
  );
}

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

  const subscription = await stripe.subscriptions.update(
    customer.stripe_subscription_id,
    { cancel_at_period_end: true },
  );
  const entitlement = getStripeSubscriptionEntitlement(subscription);
  const customerCancellationUpdate = {
    status: "active",
    payment_status: "paid",
    service_access_status: "active_until_period_end",
    service_access_until:
      entitlement.cancellationEffectiveAt || entitlement.currentPeriodEnd,
    inactive_reason: null,
    cancelled_at: null,
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
    const fallbackResult = await supabaseAdmin
      .from("customers")
      .update(customerCancellationUpdate)
      .eq("id", customer.id);

    if (fallbackResult.error) {
      console.error("Customer cancellation fallback update error:", fallbackResult.error);
      const evidenceFailureResponse = await recordCustomerCancellationSyncFailure(
        customer.id,
        customer.stripe_subscription_id,
        "customers",
        fallbackResult.error.message,
        customerCancellationUpdate,
        request,
      );
      if (evidenceFailureResponse) return evidenceFailureResponse;
      return cancellationSyncErrorResponse();
    }
  } else if (customerCancellationResult.error) {
    console.error("Customer cancellation update error:", customerCancellationResult.error);
    const evidenceFailureResponse = await recordCustomerCancellationSyncFailure(
      customer.id,
      customer.stripe_subscription_id,
      "customers",
      customerCancellationResult.error.message,
      {
        ...customerCancellationUpdate,
        cancellation_reason: normalizedReason,
        cancellation_details: details || null,
      },
      request,
    );
    if (evidenceFailureResponse) return evidenceFailureResponse;
    return cancellationSyncErrorResponse();
  }

  const subscriptionUpdate = {
    status: "active",
    stripe_payment_status: subscription.status,
    fulfillment_status: "active",
    cancel_at_period_end: true,
    cancellation_effective_at:
      entitlement.cancellationEffectiveAt || entitlement.currentPeriodEnd,
    stripe_current_period_start: entitlement.currentPeriodStart,
    stripe_current_period_end: entitlement.currentPeriodEnd,
  };
  const { error: subscriptionUpdateError } = await supabaseAdmin
    .from("customer_subscriptions")
    .update(subscriptionUpdate)
    .eq("stripe_subscription_id", customer.stripe_subscription_id);

  if (subscriptionUpdateError) {
    console.error(
      "Customer cancellation subscription sync error:",
      subscriptionUpdateError,
    );
    const evidenceFailureResponse = await recordCustomerCancellationSyncFailure(
      customer.id,
      customer.stripe_subscription_id,
      "customer_subscriptions",
      subscriptionUpdateError.message,
      subscriptionUpdate,
      request,
    );
    if (evidenceFailureResponse) return evidenceFailureResponse;
    return cancellationSyncErrorResponse();
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId: customer.id,
        actorType: "customer",
        eventType: "subscription_cancel_scheduled",
        eventDescription:
          "Customer scheduled subscription cancellation for the end of the paid period.",
        metadata: {
          stripeSubscriptionId: customer.stripe_subscription_id,
          cancellationReason: normalizedReason,
          cancellationDetails: details || null,
          cancellationEffectiveAt:
            entitlement.cancellationEffectiveAt || entitlement.currentPeriodEnd,
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    const message =
      auditError instanceof Error ? auditError.message : "Unknown audit storage error";
    try {
      await createAdminNotification(
        supabaseAdmin,
        {
          customerId: customer.id,
          eventType: "customer_cancellation_audit_failed",
          title: "Customer cancellation audit failed",
          message:
            "A customer cancellation was scheduled in Stripe and synced locally, but the audit event could not be stored.",
          priority: "urgent",
          metadata: {
            stripeSubscriptionId: customer.stripe_subscription_id,
            error: message,
          },
        },
        { throwOnError: true },
      );
    } catch (notificationError) {
      console.error(
        "Customer cancellation audit failure notification error:",
        notificationError,
      );
      return NextResponse.json(
        {
          error:
            "Your cancellation was scheduled, but Screenia could not store the audit record or urgent review notification. Contact support.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Your cancellation was scheduled, but Screenia could not store the audit record. Screenia has been notified to review it.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    cancellationEffectiveAt:
      entitlement.cancellationEffectiveAt || entitlement.currentPeriodEnd,
  });
}
