import Stripe from "stripe";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { recordAuditEvent } from "@/lib/server/audit";
import { stripe, supabaseAdmin } from "./stripe-webhook-clients";
import { recordStripeWebhookFailureVisibility } from "./stripe-webhook-failure";
import { syncStripeSubscription } from "./stripe-subscription-sync";
import { fulfillmentStatusForPaidRecovery } from "./stripe-webhook-utils";

export function stripeObjectId(
  value:
    | string
    | { id?: string | null }
    | null
    | undefined,
) {
  return typeof value === "string" ? value : value?.id || null;
}

function stripeChargeCustomerId(charge: Stripe.Charge | null) {
  return typeof charge?.customer === "string"
    ? charge.customer
    : charge?.customer?.id || null;
}

async function retrieveStripeCharge(chargeId: string | null) {
  if (!chargeId) return null;

  try {
    return await stripe.charges.retrieve(chargeId);
  } catch (error) {
    console.error("Retrieve Stripe charge error:", error);
    return null;
  }
}

async function findCustomersForStripeFinancialEvent({
  stripeCustomerId,
  paymentIntentId,
}: {
  stripeCustomerId?: string | null;
  paymentIntentId?: string | null;
}) {
  if (stripeCustomerId) {
    const { data, error } = await supabaseAdmin
      .from("customers")
      .select(
        "id, payment_status, inactive_reason, cancellation_reason, cancellation_details, cancellation_source, cancelled_at, stripe_subscription_id, layout_started_at",
      )
      .eq("stripe_customer_id", stripeCustomerId);

    if (error) {
      console.error("Stripe financial event customer lookup error:", error);
      return [];
    }

    if (data?.length) return data;
  }

  if (!paymentIntentId) return [];

  const { data: subscriptions, error: subscriptionError } = await supabaseAdmin
    .from("customer_subscriptions")
    .select("customer_id")
    .eq("stripe_payment_intent_id", paymentIntentId);

  if (subscriptionError) {
    console.error(
      "Stripe financial event subscription lookup error:",
      subscriptionError,
    );
    return [];
  }

  const customerIds = Array.from(
    new Set((subscriptions || []).map((item) => item.customer_id).filter(Boolean)),
  );

  if (customerIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("customers")
    .select(
      "id, payment_status, inactive_reason, cancellation_reason, cancellation_details, cancellation_source, cancelled_at, stripe_subscription_id, layout_started_at",
    )
    .in("id", customerIds);

  if (error) {
    console.error("Stripe financial event customer id lookup error:", error);
    return [];
  }

  return data || [];
}

async function updateSubscriptionsForStripeFinancialEvent(
  update: Record<string, unknown>,
  {
    stripeCustomerId,
    paymentIntentId,
  }: {
    stripeCustomerId?: string | null;
    paymentIntentId?: string | null;
  },
) {
  const query = supabaseAdmin.from("customer_subscriptions").update(update);

  if (paymentIntentId && stripeCustomerId) {
    return await query.or(
      `stripe_payment_intent_id.eq.${paymentIntentId},stripe_customer_id.eq.${stripeCustomerId}`,
    );
  }

  if (paymentIntentId) return await query.eq("stripe_payment_intent_id", paymentIntentId);
  if (stripeCustomerId) return await query.eq("stripe_customer_id", stripeCustomerId);

  return { error: null };
}

export async function handleStripeDispute(
  dispute: Stripe.Dispute,
  stripeEventType: string,
) {
  const chargeId = stripeObjectId(dispute.charge);
  const charge = await retrieveStripeCharge(chargeId);
  const stripeCustomerId = stripeChargeCustomerId(charge);
  const paymentIntentId =
    stripeObjectId(dispute.payment_intent) ||
    stripeObjectId(charge?.payment_intent);
  const customers = await findCustomersForStripeFinancialEvent({
    stripeCustomerId,
    paymentIntentId,
  });
  const disputeWon = dispute.status === "won";
  const disputeLost = dispute.status === "lost";
  const shouldBlockAccess = !disputeWon;
  const disputeMetadata = {
    stripeEventType,
    disputeId: dispute.id,
    disputeStatus: dispute.status,
    chargeId,
    paymentIntentId,
    stripeCustomerId,
    amount: dispute.amount,
    currency: dispute.currency,
    reason: dispute.reason,
  };

  if (customers.length === 0) {
    await recordStripeWebhookFailureVisibility({
      eventType: "stripe_dispute_sync_failed",
      title: "Unmatched Stripe dispute",
      message: `Stripe reported dispute ${dispute.id}, but no Screenia customer was matched.`,
      metadata: disputeMetadata,
    });
  }

  if (shouldBlockAccess) {
    const { error: customerUpdateError } = await supabaseAdmin
      .from("customers")
      .update({
        status: "suspended",
        payment_status: "disputed",
        service_access_status: "payment_disputed",
        service_access_until: null,
        inactive_reason: "payment_disputed",
        cancellation_source: "stripe",
      })
      .in(
        "id",
        customers.map((customer) => customer.id),
      );

    if (customerUpdateError) {
      console.error("Stripe dispute customer update error:", customerUpdateError);
      await recordStripeWebhookFailureVisibility({
        eventType: "stripe_dispute_sync_failed",
        title: "Stripe dispute sync failed",
        message: `Stripe dispute ${dispute.id} could not block customer display access: ${customerUpdateError.message}`,
        metadata: {
          ...disputeMetadata,
          error: customerUpdateError.message,
        },
        customerIds: customers.map((customer) => customer.id),
      });
    }

    const { error: subscriptionUpdateError } =
      await updateSubscriptionsForStripeFinancialEvent(
        {
        status: "disputed",
        stripe_payment_status: "disputed",
        fulfillment_status: "payment_failed",
        },
        { paymentIntentId, stripeCustomerId },
      );

    if (subscriptionUpdateError) {
      console.error(
        "Stripe dispute subscription update error:",
        subscriptionUpdateError,
      );
      await recordStripeWebhookFailureVisibility({
        eventType: "stripe_dispute_sync_failed",
        title: "Stripe dispute sync failed",
        message: `Stripe dispute ${dispute.id} could not update the local subscription row: ${subscriptionUpdateError.message}`,
        metadata: {
          ...disputeMetadata,
          error: subscriptionUpdateError.message,
        },
        customerIds: customers.map((customer) => customer.id),
      });
    }
  } else {
    await Promise.all(
      customers
        .map(async (customer) => {
          if (!customer.stripe_subscription_id) {
            await recordStripeWebhookFailureVisibility({
              eventType: "stripe_dispute_sync_failed",
              title: "Stripe won-dispute sync failed",
              message: `Stripe dispute ${dispute.id} was won, but the customer has no local Stripe subscription id for entitlement restore.`,
              metadata: {
                ...disputeMetadata,
                customerId: customer.id,
              },
              customerIds: [customer.id],
            });
          }
          try {
            const subscription = await stripe.subscriptions.retrieve(
              customer.stripe_subscription_id,
            );
            const entitlement = await syncStripeSubscription(subscription);
            const { data: journeyCustomer, error: journeyCustomerError } =
              await supabaseAdmin
                .from("customers")
                .select(
                  "id, status, production_status, layout_started_at, content_collected_at, preview_status",
                )
                .eq("id", customer.id)
                .maybeSingle();

            if (journeyCustomerError) {
              throw journeyCustomerError;
            }

            const { error: customerRestoreError } = await supabaseAdmin
              .from("customers")
              .update({
                status: "active",
                payment_status: "paid",
                service_access_status: entitlement.serviceAccessStatus,
                service_access_until: entitlement.serviceAccessUntil,
                inactive_reason: null,
                cancellation_source: null,
              })
              .eq("id", customer.id);

            if (customerRestoreError) {
              throw customerRestoreError;
            }

            const restoredFulfillmentStatus = fulfillmentStatusForPaidRecovery(
              journeyCustomer || {},
            );
            const { error: fulfillmentRestoreError } = await supabaseAdmin
              .from("customer_subscriptions")
              .update({ fulfillment_status: restoredFulfillmentStatus })
              .eq("stripe_subscription_id", customer.stripe_subscription_id)
              .in("status", ["paid", "active"]);

            if (fulfillmentRestoreError) {
              throw fulfillmentRestoreError;
            }
          } catch (error) {
            console.error("Stripe dispute won entitlement sync error:", error);
            await recordStripeWebhookFailureVisibility({
              eventType: "stripe_dispute_sync_failed",
              title: "Stripe won-dispute sync failed",
              message: `Stripe dispute ${dispute.id} was won, but Screenia could not restore subscription entitlement.`,
              metadata: {
                ...disputeMetadata,
                customerId: customer.id,
                error: error instanceof Error ? error.message : String(error),
              },
              customerIds: [customer.id],
            });
          }
        }),
    );
  }

  try {
    await Promise.all(
      customers.map(async (customer) => {
        const evidenceEventType = disputeWon
          ? "payment_dispute_won"
          : disputeLost
            ? "payment_dispute_lost"
            : "payment_disputed";
        const { data: existingEvidence, error: existingEvidenceError } =
          await supabaseAdmin
            .from("audit_events")
            .select("id")
            .eq("customer_id", customer.id)
            .eq("event_type", evidenceEventType)
            .contains("metadata", {
              disputeId: dispute.id,
              disputeStatus: dispute.status,
            })
            .limit(1);

        if (existingEvidenceError) throw existingEvidenceError;
        if (existingEvidence?.length) return;

        const outcomeLabel = disputeWon
          ? "won"
          : disputeLost
            ? "lost"
            : "opened or updated";
        const evidenceDedupeKey = `stripe_dispute:${dispute.id}:${dispute.status}`;

        return Promise.all([
          recordAuditEvent(
            supabaseAdmin,
            {
              customerId: customer.id,
              actorType: "stripe",
              eventType: evidenceEventType,
              dedupeKey: evidenceDedupeKey,
              eventDescription: disputeWon
                ? "Stripe reported a won payment dispute."
                : disputeLost
                  ? "Stripe reported a lost payment dispute. Customer display access remains blocked."
                  : "Stripe reported a payment dispute. Customer display access was blocked.",
              metadata: disputeMetadata,
            },
            { throwOnError: true },
          ),
          createAdminNotification(
            supabaseAdmin,
            {
              customerId: customer.id,
              eventType: evidenceEventType,
              dedupeKey: evidenceDedupeKey,
              title: disputeWon
                ? "Payment dispute won"
                : disputeLost
                  ? "Payment dispute lost"
                  : "Payment disputed",
              message: disputeWon
                ? `Stripe marked dispute ${dispute.id} as won. Review access and records.`
                : disputeLost
                  ? `Stripe marked dispute ${dispute.id} as lost. Display access remains blocked.`
                  : `Stripe ${outcomeLabel} dispute ${dispute.id}. Display access was blocked.`,
              priority: disputeWon ? "high" : "urgent",
              metadata: disputeMetadata,
            },
            { throwOnError: true },
          ),
        ]);
      }),
    );
  } catch (evidenceError) {
    console.error("Stripe dispute evidence storage error:", evidenceError);
    await recordStripeWebhookFailureVisibility({
      eventType: "stripe_dispute_evidence_failed",
      title: "Stripe dispute evidence failed",
      message: `Stripe dispute ${dispute.id} was handled, but Screenia could not store required audit or admin notification evidence.`,
      metadata: {
        ...disputeMetadata,
        error:
          evidenceError instanceof Error
            ? evidenceError.message
            : String(evidenceError),
      },
      customerIds: customers.map((customer) => customer.id),
    });
  }
}

export async function handleStripeRefund(
  refund: Stripe.Refund,
  stripeEventType: string,
) {
  const chargeId = stripeObjectId(refund.charge);
  const charge = await retrieveStripeCharge(chargeId);
  const stripeCustomerId = stripeChargeCustomerId(charge);
  const paymentIntentId =
    stripeObjectId(refund.payment_intent) ||
    stripeObjectId(charge?.payment_intent);
  const customers = await findCustomersForStripeFinancialEvent({
    stripeCustomerId,
    paymentIntentId,
  });
  const fullRefund =
    refund.status === "succeeded" &&
    Boolean(charge) &&
    Number(charge?.amount_refunded || 0) >= Number(charge?.amount || 0);
  const refundMetadata = {
    stripeEventType,
    refundId: refund.id,
    refundStatus: refund.status,
    chargeId,
    paymentIntentId,
    stripeCustomerId,
    amount: refund.amount,
    currency: refund.currency,
    fullRefund,
    chargeAmount: charge?.amount,
    chargeAmountRefunded: charge?.amount_refunded,
  };

  if (customers.length === 0) {
    await recordStripeWebhookFailureVisibility({
      eventType: "stripe_refund_sync_failed",
      title: "Unmatched Stripe refund",
      message: `Stripe reported refund ${refund.id}, but no Screenia customer was matched.`,
      metadata: refundMetadata,
    });
  }

  if (fullRefund) {
    const timestamp = new Date().toISOString();
    for (const customer of customers) {
      const appInitiatedRefund =
        customer.cancellation_source === "admin" ||
        customer.cancellation_source === "customer";
      const refundReason = customer.layout_started_at
        ? "refunded_after_production"
        : "refunded_before_production";

      const { error: customerUpdateError } = await supabaseAdmin
        .from("customers")
        .update({
          status: "suspended",
          payment_status: "refunded",
          service_access_status: "refunded",
          service_access_until: null,
          inactive_reason: appInitiatedRefund
            ? customer.inactive_reason || refundReason
            : refundReason,
          cancellation_reason: appInitiatedRefund
            ? customer.cancellation_reason || refundReason
            : "external_stripe_refund",
          cancellation_details: appInitiatedRefund
            ? customer.cancellation_details
            : "Full payment was refunded in Stripe.",
          cancellation_source: appInitiatedRefund
            ? customer.cancellation_source
            : "stripe",
          cancelled_at: customer.cancelled_at || timestamp,
        })
        .eq("id", customer.id);

      if (customerUpdateError) {
        console.error(
          "Stripe external refund customer update error:",
          customerUpdateError,
        );
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_refund_sync_failed",
          title: "Stripe refund sync failed",
          message: `Stripe refund ${refund.id} could not block refunded customer access: ${customerUpdateError.message}`,
          metadata: {
            ...refundMetadata,
            customerId: customer.id,
            error: customerUpdateError.message,
          },
          customerIds: [customer.id],
        });
      }

      if (customer.stripe_subscription_id) {
        try {
          const stripeSubscription = await stripe.subscriptions.retrieve(
            customer.stripe_subscription_id,
          );
          if (stripeSubscription.status !== "canceled") {
            await stripe.subscriptions.cancel(customer.stripe_subscription_id, {
              cancellation_details: {
                comment: "Full first payment refunded; future billing stopped automatically.",
              },
            });
          }
        } catch (subscriptionCancellationError) {
          await recordStripeWebhookFailureVisibility({
            eventType: "stripe_refund_subscription_cancel_failed",
            title: "Refunded subscription still needs cancellation",
            message: `Full refund ${refund.id} succeeded, but Stripe subscription ${customer.stripe_subscription_id} could not be cancelled automatically.`,
            metadata: {
              ...refundMetadata,
              customerId: customer.id,
              stripeSubscriptionId: customer.stripe_subscription_id,
              error:
                subscriptionCancellationError instanceof Error
                  ? subscriptionCancellationError.message
                  : String(subscriptionCancellationError),
            },
            customerIds: [customer.id],
          });
        }
      }
    }

    const { error: subscriptionUpdateError } =
      await updateSubscriptionsForStripeFinancialEvent(
        {
        status: "refunded",
        stripe_payment_status: "refunded",
        fulfillment_status: "cancelled",
        inventory_status: "cancelled",
        },
        { paymentIntentId, stripeCustomerId },
      );

    if (subscriptionUpdateError) {
      console.error(
        "Stripe external refund subscription update error:",
        subscriptionUpdateError,
      );
      await recordStripeWebhookFailureVisibility({
        eventType: "stripe_refund_sync_failed",
        title: "Stripe refund sync failed",
        message: `Stripe refund ${refund.id} could not update the local subscription row: ${subscriptionUpdateError.message}`,
        metadata: {
          ...refundMetadata,
          error: subscriptionUpdateError.message,
        },
        customerIds: customers.map((customer) => customer.id),
      });
    }
  }

  try {
    await Promise.all(
      customers.map(async (customer) => {
        const evidenceEventType = fullRefund
          ? "payment_refunded_externally"
          : "payment_refund_updated";
        const { data: existingEvidence, error: existingEvidenceError } =
          await supabaseAdmin
            .from("audit_events")
            .select("id")
            .eq("customer_id", customer.id)
            .eq("event_type", evidenceEventType)
            .contains("metadata", { refundId: refund.id })
            .limit(1);

        if (existingEvidenceError) {
          throw existingEvidenceError;
        }

        if (existingEvidence?.length) return;

        return Promise.all([
          recordAuditEvent(
            supabaseAdmin,
            {
              customerId: customer.id,
              actorType: "stripe",
              eventType: evidenceEventType,
              eventDescription: fullRefund
                ? "Stripe reported a full external refund. Customer display access was blocked."
                : "Stripe reported a refund update.",
              metadata: refundMetadata,
            },
            { throwOnError: true },
          ),
          createAdminNotification(
            supabaseAdmin,
            {
              customerId: customer.id,
              eventType: evidenceEventType,
              title: fullRefund
                ? "Payment refunded in Stripe"
                : "Stripe refund updated",
              message: fullRefund
                ? `Stripe reported a full refund ${refund.id}. Display access was blocked.`
                : `Stripe reported refund ${refund.id}. Review whether any manual action is needed.`,
              priority: fullRefund ? "urgent" : "high",
              metadata: refundMetadata,
            },
            { throwOnError: true },
          ),
        ]);
      }),
    );
  } catch (evidenceError) {
    console.error("Stripe refund evidence storage error:", evidenceError);
    await recordStripeWebhookFailureVisibility({
      eventType: "stripe_refund_evidence_failed",
      title: "Stripe refund evidence failed",
      message: `Stripe refund ${refund.id} was handled, but Screenia could not store required audit or admin notification evidence.`,
      metadata: {
        ...refundMetadata,
        error:
          evidenceError instanceof Error
            ? evidenceError.message
            : String(evidenceError),
      },
      customerIds: customers.map((customer) => customer.id),
    });
  }
}
