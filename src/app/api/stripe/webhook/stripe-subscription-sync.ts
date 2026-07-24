import Stripe from "stripe";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { recordAuditEvent } from "@/lib/server/audit";
import { getStripeSubscriptionEntitlement } from "@/lib/server/subscription-entitlements";
import { supabaseAdmin } from "./stripe-webhook-clients";
export async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const entitlement = getStripeSubscriptionEntitlement(subscription);
  const stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const syncErrorMetadata = {
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    stripeStatus: subscription.status,
    serviceAccessStatus: entitlement.serviceAccessStatus,
    serviceAccessUntil: entitlement.serviceAccessUntil,
  };

  async function recordStripeSubscriptionSyncFailureVisibility({
    eventType,
    title,
    message,
    metadata,
    customerIds = [],
  }: {
    eventType: string;
    title: string;
    message: string;
    metadata: Record<string, unknown>;
    customerIds?: string[];
  }) {
    try {
      const auditTargets = customerIds.length ? customerIds : [null];

      await Promise.all(
        auditTargets.map((customerId) =>
          recordAuditEvent(
            supabaseAdmin,
            {
              customerId,
              actorType: "stripe",
              eventType,
              eventDescription: message,
              metadata,
            },
            { throwOnError: true },
          ),
        ),
      );

      await createAdminNotification(
        supabaseAdmin,
        {
          customerId: customerIds[0] || null,
          eventType,
          title,
          message,
          priority: "urgent",
          metadata,
        },
        { throwOnError: true },
      );
    } catch (visibilityError) {
      console.error(
        "Stripe subscription sync failure visibility error:",
        visibilityError,
      );
      throw new Error(
        "Stripe subscription sync failed and urgent visibility could not be stored.",
      );
    }

    throw new Error(message);
  }

  const customerUpdate =
    entitlement.serviceAccessStatus === "cancelled"
      ? {
          status: "suspended",
          payment_status: "cancelled",
          service_access_status: "cancelled",
          service_access_until: null,
          inactive_reason: "subscription_cancelled",
          cancelled_at: new Date().toISOString(),
          cancellation_source: "stripe",
        }
      : entitlement.serviceAccessStatus === "paused"
        ? {
            service_access_status: "paused",
            service_access_until: null,
            inactive_reason: "paused",
          }
      : entitlement.serviceAccessStatus === "payment_failed"
        ? {
            status: "suspended",
            payment_status: "failed",
            service_access_status: "payment_failed",
            service_access_until: null,
            inactive_reason: "payment_failed",
            cancellation_source: "stripe",
          }
      : entitlement.serviceAccessStatus === "active_until_period_end"
        ? {
            status: "active",
            payment_status: "paid",
            service_access_status: "active_until_period_end",
            service_access_until: entitlement.serviceAccessUntil,
            inactive_reason: null,
          }
      : {
          status: "active",
          payment_status: "paid",
          service_access_status: entitlement.serviceAccessStatus,
          service_access_until: entitlement.serviceAccessUntil,
          inactive_reason: null,
          cancellation_source: null,
        };

  const { data: customers, error: customerError } = await supabaseAdmin
    .from("customers")
    .update(customerUpdate)
    .eq("stripe_customer_id", stripeCustomerId)
    .select("id");

  if (customerError) {
    console.error("Stripe subscription customer sync error:", customerError);
    await recordStripeSubscriptionSyncFailureVisibility({
      eventType: "stripe_subscription_customer_sync_failed",
      title: "Stripe subscription customer sync failed",
      message: `Stripe subscription ${subscription.id} could not update customer entitlement state: ${customerError.message}`,
      metadata: {
        ...syncErrorMetadata,
        error: customerError.message,
      },
    });
  }

  const syncedCustomers = customers ?? [];

  if (!syncedCustomers.length) {
    await recordStripeSubscriptionSyncFailureVisibility({
      eventType: "stripe_subscription_customer_sync_failed",
      title: "Stripe subscription customer sync failed",
      message: `Stripe subscription ${subscription.id} did not match any Screenia customer.`,
      metadata: {
        ...syncErrorMetadata,
        error: "No Screenia customer matched stripe_customer_id.",
      },
    });
  }

  const subscriptionUpdate: Record<string, unknown> = {
    status:
      entitlement.serviceAccessStatus === "cancelled"
        ? "cancelled"
        : entitlement.serviceAccessStatus === "paused"
          ? "paused"
          : entitlement.serviceAccessStatus === "payment_failed"
            ? "payment_failed"
            : "active",
    stripe_payment_status: subscription.status,
    trial_starts_at: entitlement.trialStart,
    trial_ends_at: entitlement.trialEnd,
    stripe_current_period_start: entitlement.currentPeriodStart,
    stripe_current_period_end: entitlement.currentPeriodEnd,
    cancel_at_period_end: entitlement.cancelAtPeriodEnd,
    cancellation_effective_at: entitlement.cancellationEffectiveAt,
    pause_started_at:
      entitlement.serviceAccessStatus === "paused"
        ? entitlement.pauseStartedAt
        : null,
    pause_resumes_at: entitlement.pauseResumesAt,
  };

  if (entitlement.serviceAccessStatus === "cancelled") {
    subscriptionUpdate.fulfillment_status = "cancelled";
    subscriptionUpdate.inventory_status = "cancelled";
  } else if (entitlement.serviceAccessStatus === "payment_failed") {
    subscriptionUpdate.fulfillment_status = "payment_failed";
  }

  const { error: subscriptionError } = await supabaseAdmin
    .from("customer_subscriptions")
    .update(subscriptionUpdate)
    .eq("stripe_subscription_id", subscription.id);

  if (subscriptionError) {
    console.error("Stripe subscription local sync error:", subscriptionError);
    await recordStripeSubscriptionSyncFailureVisibility({
      eventType: "stripe_subscription_local_sync_failed",
      title: "Stripe subscription local sync failed",
      message: `Stripe subscription ${subscription.id} could not update the local subscription row: ${subscriptionError.message}`,
      metadata: {
        ...syncErrorMetadata,
        error: subscriptionError.message,
      },
      customerIds: syncedCustomers.map((customer) => customer.id),
    });
  }

  try {
    await Promise.all(
      syncedCustomers.map((customer) =>
        recordAuditEvent(
          supabaseAdmin,
          {
            customerId: customer.id,
            actorType: "stripe",
            eventType: "subscription_synced",
            eventDescription: "Stripe subscription state was synced to Screenia.",
            metadata: {
              stripeSubscriptionId: subscription.id,
              stripeStatus: subscription.status,
              serviceAccessStatus: entitlement.serviceAccessStatus,
              serviceAccessUntil: entitlement.serviceAccessUntil,
              cancelAtPeriodEnd: entitlement.cancelAtPeriodEnd,
              cancellationEffectiveAt: entitlement.cancellationEffectiveAt,
            },
          },
          { throwOnError: true },
        ),
      ),
    );
  } catch (auditError) {
    console.error("Stripe subscription synced audit error:", auditError);
    await recordStripeSubscriptionSyncFailureVisibility({
      eventType: "stripe_subscription_synced_audit_failed",
      title: "Stripe subscription sync audit failed",
      message: `Stripe subscription ${subscription.id} was synced, but Screenia could not store required audit evidence.`,
      metadata: {
        ...syncErrorMetadata,
        error: auditError instanceof Error ? auditError.message : String(auditError),
      },
      customerIds: syncedCustomers.map((customer) => customer.id),
    });
  }

  return entitlement;
}
