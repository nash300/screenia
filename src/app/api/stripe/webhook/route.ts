import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { includedVatFromGross } from "@/lib/pricing/vat";
import { getStripeSubscriptionEntitlement } from "@/lib/server/subscription-entitlements";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function includedVatOreFromStripeTotal(amountOre: number | null | undefined) {
  if (!amountOre) return null;
  return Math.round(includedVatFromGross(amountOre / 100).vat * 100);
}

function invoiceTaxAmountOre(invoice: Stripe.Invoice) {
  const stripeTaxTotal = invoice.total_taxes?.reduce(
    (sum, tax) => sum + tax.amount,
    0,
  );

  if (stripeTaxTotal && stripeTaxTotal > 0) {
    return stripeTaxTotal;
  }

  return includedVatOreFromStripeTotal(invoice.total);
}

function invoiceCustomerId(invoice: Stripe.Invoice) {
  return typeof invoice.customer === "string"
    ? invoice.customer
    : invoice.customer?.id || null;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const invoiceWithSubscription = invoice as Stripe.Invoice & {
    parent?: {
      subscription_details?: {
        subscription?: string | null;
      } | null;
    } | null;
    subscription?: string | Stripe.Subscription | null;
  };

  return typeof invoiceWithSubscription.subscription === "string"
    ? invoiceWithSubscription.subscription
    : invoiceWithSubscription.subscription?.id ||
        invoiceWithSubscription.parent?.subscription_details?.subscription ||
        null;
}

async function recordStripeWebhookFailureVisibility({
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
}): Promise<never> {
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
    console.error("Stripe webhook failure visibility error:", visibilityError);
    throw new Error(
      "Stripe webhook failed and urgent visibility could not be stored.",
    );
  }

  throw new Error(message);
}

async function startWebhookEventProcessing(event: Stripe.Event) {
  const { data, error } = await supabaseAdmin
    .from("stripe_webhook_events")
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      livemode: event.livemode,
      processing_status: "processing",
    })
    .select("id")
    .single();

  if (!error) {
    return { eventRowId: data.id as string, duplicate: false };
  }

  if (error.code !== "23505") {
    console.error("Stripe webhook event ledger insert error:", error);
    throw new Error("Stripe webhook event ledger is not ready.");
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("stripe_webhook_events")
    .select("id, processing_status")
    .eq("stripe_event_id", event.id)
    .single();

  if (existingError || !existing) {
    console.error("Stripe webhook event ledger lookup error:", existingError);
    throw new Error("Stripe webhook event ledger lookup failed.");
  }

  if (existing.processing_status === "processed") {
    return { eventRowId: existing.id as string, duplicate: true };
  }

  const { error: retryError } = await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      processing_status: "processing",
      processing_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (retryError) {
    console.error("Stripe webhook event ledger retry update error:", retryError);
    throw new Error("Stripe webhook event ledger retry failed.");
  }

  return { eventRowId: existing.id as string, duplicate: false };
}

async function finishWebhookEventProcessing(
  eventRowId: string,
  status: "processed" | "failed",
  error?: unknown,
) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : null;

  const { error: updateError } = await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      processing_status: status,
      processing_error: message,
      processed_at: status === "processed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventRowId);

  if (updateError) {
    console.error("Stripe webhook event ledger finish error:", updateError);
  }
}

async function syncStripeSubscription(subscription: Stripe.Subscription) {
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
      : {
          payment_status: "paid",
          service_access_status: entitlement.serviceAccessStatus,
          service_access_until: entitlement.serviceAccessUntil,
          inactive_reason: null,
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

function stripeObjectId(
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
        "id, payment_status, inactive_reason, cancellation_reason, cancellation_details, cancellation_source, cancelled_at, stripe_subscription_id",
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
      "id, payment_status, inactive_reason, cancellation_reason, cancellation_details, cancellation_source, cancelled_at, stripe_subscription_id",
    )
    .in("id", customerIds);

  if (error) {
    console.error("Stripe financial event customer id lookup error:", error);
    return [];
  }

  return data || [];
}

async function handleStripeDispute(
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

    const subscriptionUpdate = supabaseAdmin
      .from("customer_subscriptions")
      .update({
        status: "disputed",
        stripe_payment_status: "disputed",
        fulfillment_status: "payment_failed",
      });
    const { error: subscriptionUpdateError } = paymentIntentId
      ? await subscriptionUpdate.eq("stripe_payment_intent_id", paymentIntentId)
      : stripeCustomerId
        ? await subscriptionUpdate.eq("stripe_customer_id", stripeCustomerId)
        : { error: null };

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
        .filter((customer) => customer.inactive_reason === "payment_disputed")
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
            await syncStripeSubscription(subscription);
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
      customers.map((customer) =>
        Promise.all([
          recordAuditEvent(
            supabaseAdmin,
            {
              customerId: customer.id,
              actorType: "stripe",
              eventType: disputeWon ? "payment_dispute_won" : "payment_disputed",
              eventDescription: disputeWon
                ? "Stripe reported a won payment dispute."
                : "Stripe reported a payment dispute. Customer display access was blocked.",
              metadata: disputeMetadata,
            },
            { throwOnError: true },
          ),
          createAdminNotification(
            supabaseAdmin,
            {
              customerId: customer.id,
              eventType: disputeWon ? "payment_dispute_won" : "payment_disputed",
              title: disputeWon ? "Payment dispute won" : "Payment disputed",
              message: disputeWon
                ? `Stripe marked dispute ${dispute.id} as won. Review access and records.`
                : `Stripe opened or updated dispute ${dispute.id}. Display access was blocked.`,
              priority: disputeWon ? "high" : "urgent",
              metadata: disputeMetadata,
            },
            { throwOnError: true },
          ),
        ]),
      ),
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

async function handleStripeRefund(
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
      const { error: customerUpdateError } = await supabaseAdmin
        .from("customers")
        .update({
          status: "suspended",
          payment_status: "refunded",
          service_access_status: "refunded",
          service_access_until: null,
          inactive_reason: appInitiatedRefund
            ? customer.inactive_reason || "refunded_before_production"
            : "refunded_before_production",
          cancellation_reason: appInitiatedRefund
            ? customer.cancellation_reason || "refunded_before_production"
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
    }

    const subscriptionUpdate = supabaseAdmin
      .from("customer_subscriptions")
      .update({
        status: "refunded",
        stripe_payment_status: "refunded",
        fulfillment_status: "cancelled",
      });
    const { error: subscriptionUpdateError } = paymentIntentId
      ? await subscriptionUpdate.eq("stripe_payment_intent_id", paymentIntentId)
      : stripeCustomerId
        ? await subscriptionUpdate.eq("stripe_customer_id", stripeCustomerId)
        : { error: null };

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
      customers.map((customer) =>
        Promise.all([
          recordAuditEvent(
            supabaseAdmin,
            {
              customerId: customer.id,
              actorType: "stripe",
              eventType: fullRefund
                ? "payment_refunded_externally"
                : "payment_refund_updated",
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
              eventType: fullRefund
                ? "payment_refunded_externally"
                : "payment_refund_updated",
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
        ]),
      ),
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

async function saveCustomerAuthUser(customerId: string, authUserId: string) {
  const { error } = await supabaseAdmin
    .from("customers")
    .update({ auth_user_id: authUserId })
    .eq("id", customerId);

  if (error && error.code !== "PGRST204" && error.code !== "42703") {
    console.error("Save customer auth user error:", error);
  }
}

async function ensureCustomerAuthUser(customerId: string, email?: string | null) {
  if (!email) return null;

  const { data: customer, error: customerError } = await supabaseAdmin
    .from("customers")
    .select("auth_user_id")
    .eq("id", customerId)
    .maybeSingle();

  if (
    customerError &&
    customerError.code !== "PGRST204" &&
    customerError.code !== "42703"
  ) {
    console.error("Customer auth user lookup error:", customerError);
  }

  if (customer?.auth_user_id) return customer.auth_user_id;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const redirectTo = appUrl
    ? `${appUrl}/auth/callback?next=/account/activate`
    : undefined;

  const { data: invitedUser, error: inviteError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        customer_id: customerId,
        account_type: "customer",
      },
    });

  if (inviteError) {
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = users.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );

    if (existingUser) {
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        user_metadata: {
          ...(existingUser.user_metadata || {}),
          customer_id: customerId,
          account_type: "customer",
        },
      });
      await saveCustomerAuthUser(customerId, existingUser.id);
      return existingUser.id;
    }

    console.error("Invite customer auth user error:", inviteError);
    return null;
  }

  if (invitedUser.user) {
    await saveCustomerAuthUser(customerId, invitedUser.user.id);
    return invitedUser.user.id;
  }

  return null;
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (error) {
    console.error("Webhook signature error:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let eventRowId: string;
  try {
    const processing = await startWebhookEventProcessing(event);
    eventRowId = processing.eventRowId;

    if (processing.duplicate) {
      return NextResponse.json({ received: true, duplicate: true });
    }
  } catch (error) {
    console.error("Stripe webhook event processing guard error:", error);
    return NextResponse.json(
      { error: "Webhook event ledger is not ready." },
      { status: 500 },
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const customerId = session.metadata?.customer_id;
    const customerSubscriptionId = session.metadata?.customer_subscription_id;
    const orderNumber = session.metadata?.order_number;
    const discountCouponId =
      session.metadata?.stripe_discount_coupon_id || null;
    const customerEmail =
      session.customer_details?.email || session.customer_email || null;
    const accountEmail = session.metadata?.account_email || customerEmail;
    const includedVatOre =
      session.total_details?.amount_tax ||
      includedVatOreFromStripeTotal(session.amount_total);

    if (customerId) {
      await ensureCustomerAuthUser(customerId, accountEmail);
      let stripeSubscription: Stripe.Subscription | null = null;
      if (session.subscription) {
        try {
          stripeSubscription = await stripe.subscriptions.retrieve(
            session.subscription as string,
          );
        } catch (error) {
          console.error("Retrieve checkout subscription error:", error);
        }
      }
      const entitlement = stripeSubscription
        ? getStripeSubscriptionEntitlement(stripeSubscription)
        : null;
      const customerUpdate: Record<string, string | null> = {
        status: "paid",
        payment_status: "paid",
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        service_access_status: entitlement?.serviceAccessStatus || "active",
        service_access_until: entitlement?.serviceAccessUntil || null,
        inactive_reason: null,
      };

      const { error } = await supabaseAdmin
        .from("customers")
        .update(customerUpdate)
        .eq("id", customerId);

      if (error) {
        console.error("Checkout completed customer update error:", error);
      } else {
        await recordAuditEvent(supabaseAdmin, {
          customerId,
          actorType: "stripe",
          eventType: "payment_completed",
          eventDescription:
            "Stripe checkout completed. Customer paid and is ready for content collection.",
          metadata: {
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            stripeCheckoutSessionId: session.id,
            customerSubscriptionId,
            orderNumber,
            taxAmountSek: includedVatOre,
            totalAmountSek: session.amount_total,
          },
        });

        await createAdminNotification(supabaseAdmin, {
          customerId,
          eventType: "payment_completed",
          title: "Payment completed",
          message: `Stripe checkout completed for order ${orderNumber || session.id}.`,
          priority: "urgent",
          metadata: {
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            stripeCheckoutSessionId: session.id,
            customerSubscriptionId,
            orderNumber,
            customerEmail,
          },
        });
      }

      if (session.subscription) {
        if (discountCouponId) {
          try {
            await stripe.subscriptions.update(session.subscription as string, {
              discounts: [{ coupon: discountCouponId }],
            });
          } catch (error) {
            console.error("Apply subscription discount error:", error);
          }
        }

        const subscriptionUpdate = {
          status: "paid",
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          stripe_invoice_id:
            typeof session.invoice === "string" ? session.invoice : session.invoice?.id,
          stripe_payment_intent_id:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id,
          stripe_payment_status: session.payment_status,
          setup_fee_paid: true,
          tax_status: session.automatic_tax?.enabled
            ? session.automatic_tax.status || "complete"
            : "not_enabled",
          tax_amount_sek: includedVatOre,
          total_amount_sek: session.amount_total ?? null,
          fulfillment_status: "content_collection",
          inventory_status: "ready_to_reserve",
          stripe_discount_coupon_id: discountCouponId,
          trial_starts_at: entitlement?.trialStart || null,
          trial_ends_at: entitlement?.trialEnd || null,
          stripe_current_period_start: entitlement?.currentPeriodStart || null,
          stripe_current_period_end: entitlement?.currentPeriodEnd || null,
          cancel_at_period_end: entitlement?.cancelAtPeriodEnd || false,
          cancellation_effective_at: entitlement?.cancellationEffectiveAt || null,
          pause_started_at: null,
          pause_resumes_at: null,
        };

        const updateQuery = supabaseAdmin
          .from("customer_subscriptions")
          .update(subscriptionUpdate);

        const { error: subscriptionError } = customerSubscriptionId
          ? await updateQuery.eq("id", customerSubscriptionId)
          : await updateQuery.eq("stripe_checkout_session_id", session.id);

        if (subscriptionError) {
          console.error(
            "Checkout completed subscription update error:",
            subscriptionError,
          );
        }
      }
    }
  }

    if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;

    const customerId = invoiceCustomerId(invoice);
    const stripeSubscriptionId = invoiceSubscriptionId(invoice);

    if (!customerId) {
      console.warn("Payment failed invoice did not include a customer id:", invoice.id);
      await recordStripeWebhookFailureVisibility({
        eventType: "stripe_invoice_payment_failed_sync_failed",
        title: "Failed-payment invoice sync failed",
        message: `Stripe failed-payment invoice ${invoice.id} did not include a customer id.`,
        metadata: {
          invoiceId: invoice.id,
          stripeSubscriptionId,
          billingReason: invoice.billing_reason,
          amountDue: invoice.amount_due,
          total: invoice.total,
        },
      });
    } else {
    const { data, error } = await supabaseAdmin
      .from("customers")
      .update({
        status: "suspended",
        payment_status: "failed",
        service_access_status: "payment_failed",
        service_access_until: null,
        inactive_reason: "payment_failed",
        cancellation_source: "stripe",
      })
      .eq("stripe_customer_id", customerId)
      .select();

    if (error) {
      console.error("Payment failed update error:", error);
      await recordStripeWebhookFailureVisibility({
        eventType: "stripe_invoice_payment_failed_sync_failed",
        title: "Failed-payment invoice sync failed",
        message: `Stripe failed-payment invoice ${invoice.id} could not suspend customer access: ${error.message}`,
        metadata: {
          stripeCustomerId: customerId,
          stripeSubscriptionId,
          invoiceId: invoice.id,
          error: error.message,
        },
      });
    }

    if (!data || data.length === 0) {
      console.warn("No customer found for failed payment:", customerId);
      await recordStripeWebhookFailureVisibility({
        eventType: "stripe_invoice_payment_failed_sync_failed",
        title: "Failed-payment invoice sync failed",
        message: `Stripe failed-payment invoice ${invoice.id} did not match any Screenia customer.`,
        metadata: {
          stripeCustomerId: customerId,
          stripeSubscriptionId,
          invoiceId: invoice.id,
          error: "No Screenia customer matched invoice customer id.",
        },
      });
    } else {
      const { error: subscriptionError } = await supabaseAdmin
        .from("customer_subscriptions")
        .update({
          status: "payment_failed",
          stripe_invoice_id: invoice.id,
          stripe_payment_status: "failed",
          tax_amount_sek: invoiceTaxAmountOre(invoice),
          total_amount_sek: invoice.total,
          fulfillment_status: "payment_failed",
        })
        .eq(
          stripeSubscriptionId ? "stripe_subscription_id" : "stripe_customer_id",
          stripeSubscriptionId || customerId,
        );

      if (subscriptionError) {
        console.error("Payment failed subscription update error:", subscriptionError);
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_invoice_payment_failed_sync_failed",
          title: "Failed-payment invoice sync failed",
          message: `Stripe failed-payment invoice ${invoice.id} could not update the local subscription row: ${subscriptionError.message}`,
          metadata: {
            stripeCustomerId: customerId,
            stripeSubscriptionId,
            invoiceId: invoice.id,
            error: subscriptionError.message,
          },
          customerIds: data.map((customer) => customer.id),
        });
      }

      try {
        await Promise.all(
          data.map((customer) =>
            Promise.all([
              recordAuditEvent(
                supabaseAdmin,
                {
                  customerId: customer.id,
                  actorType: "stripe",
                  eventType: "payment_failed",
                  eventDescription:
                    "Stripe reported a failed payment. Customer was suspended.",
                  metadata: {
                    stripeCustomerId: customerId,
                    stripeSubscriptionId,
                    invoiceId: invoice.id,
                    amountDue: invoice.amount_due,
                    total: invoice.total,
                    taxAmount: invoiceTaxAmountOre(invoice),
                  },
                },
                { throwOnError: true },
              ),
              createAdminNotification(
                supabaseAdmin,
                {
                  customerId: customer.id,
                  eventType: "payment_failed",
                  title: "Payment failed",
                  message: `Stripe reported a failed payment for invoice ${invoice.id}.`,
                  priority: "urgent",
                  metadata: {
                    stripeCustomerId: customerId,
                    stripeSubscriptionId,
                    invoiceId: invoice.id,
                    amountDue: invoice.amount_due,
                    total: invoice.total,
                    taxAmount: invoiceTaxAmountOre(invoice),
                  },
                },
                { throwOnError: true },
              ),
            ]),
          ),
        );
      } catch (evidenceError) {
        console.error("Payment failed evidence storage error:", evidenceError);
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_invoice_payment_failed_evidence_failed",
          title: "Failed-payment invoice evidence failed",
          message: `Stripe failed-payment invoice ${invoice.id} suspended access, but Screenia could not store required audit or notification evidence.`,
          metadata: {
            stripeCustomerId: customerId,
            stripeSubscriptionId,
            invoiceId: invoice.id,
            error:
              evidenceError instanceof Error
                ? evidenceError.message
                : String(evidenceError),
          },
          customerIds: data.map((customer) => customer.id),
        });
      }
    }
    }
  }

    if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const billingReason = invoice.billing_reason;

    if (billingReason && billingReason !== "subscription_create") {
      const stripeCustomerId = invoiceCustomerId(invoice);
      const stripeSubscriptionId = invoiceSubscriptionId(invoice);
      const paidInvoiceMetadata = {
        stripeCustomerId,
        stripeSubscriptionId,
        invoiceId: invoice.id,
        billingReason,
        amountPaid: invoice.amount_paid,
        amountDue: invoice.amount_due,
        total: invoice.total,
        taxAmount: invoiceTaxAmountOre(invoice),
      };

      if (!stripeCustomerId) {
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_invoice_paid_sync_failed",
          title: "Paid invoice sync failed",
          message: `Stripe paid invoice ${invoice.id} did not include a customer id.`,
          metadata: paidInvoiceMetadata,
        });
      }

      if (!stripeSubscriptionId) {
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_invoice_paid_sync_failed",
          title: "Paid invoice sync failed",
          message: `Stripe paid invoice ${invoice.id} did not include a subscription id.`,
          metadata: paidInvoiceMetadata,
        });
      }

      const paidStripeCustomerId = stripeCustomerId as string;
      const paidStripeSubscriptionId = stripeSubscriptionId as string;

      const { data: customers, error: customerError } = await supabaseAdmin
        .from("customers")
        .select("id, status, payment_status, inactive_reason")
        .eq("stripe_customer_id", paidStripeCustomerId);

      if (customerError) {
        console.error("Invoice paid customer lookup error:", customerError);
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_invoice_paid_sync_failed",
          title: "Paid invoice sync failed",
          message: `Stripe paid invoice ${invoice.id} could not look up the customer: ${customerError.message}`,
          metadata: {
            ...paidInvoiceMetadata,
            error: customerError.message,
          },
        });
      }

      const matchedCustomers = customers ?? [];

      if (!matchedCustomers.length) {
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_invoice_paid_sync_failed",
          title: "Paid invoice sync failed",
          message: `Stripe paid invoice ${invoice.id} did not match any Screenia customer.`,
          metadata: {
            ...paidInvoiceMetadata,
            error: "No Screenia customer matched invoice customer id.",
          },
        });
      }

      const { data: existingAudit, error: auditLookupError } =
        await supabaseAdmin
          .from("audit_events")
          .select("id")
          .eq("event_type", "subscription_invoice_paid")
          .contains("metadata", { invoiceId: invoice.id })
          .limit(1);

      if (auditLookupError) {
        console.error("Invoice paid audit lookup error:", auditLookupError);
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_invoice_paid_evidence_failed",
          title: "Paid invoice evidence failed",
          message: `Stripe paid invoice ${invoice.id} could not verify existing audit evidence: ${auditLookupError.message}`,
          metadata: {
            ...paidInvoiceMetadata,
            error: auditLookupError.message,
          },
          customerIds: matchedCustomers.map((customer) => customer.id),
        });
      }

      const { data: localSubscription, error: subscriptionLookupError } =
        await supabaseAdmin
          .from("customer_subscriptions")
          .select("id, status")
          .eq("stripe_subscription_id", paidStripeSubscriptionId)
          .maybeSingle();

      if (subscriptionLookupError) {
        console.error(
          "Invoice paid subscription lookup error:",
          subscriptionLookupError,
        );
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_invoice_paid_sync_failed",
          title: "Paid invoice sync failed",
          message: `Stripe paid invoice ${invoice.id} could not look up the local subscription: ${subscriptionLookupError.message}`,
          metadata: {
            ...paidInvoiceMetadata,
            error: subscriptionLookupError.message,
          },
          customerIds: matchedCustomers.map((customer) => customer.id),
        });
      }

      if (!localSubscription) {
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_invoice_paid_sync_failed",
          title: "Paid invoice sync failed",
          message: `Stripe paid invoice ${invoice.id} did not match a local subscription row.`,
          metadata: {
            ...paidInvoiceMetadata,
            error: "No customer_subscriptions row matched stripe_subscription_id.",
          },
          customerIds: matchedCustomers.map((customer) => customer.id),
        });
      }

      const matchedSubscription = localSubscription as {
        id: string;
        status: string;
      };

      if (!["refunded", "cancelled"].includes(matchedSubscription.status)) {
        const { error: subscriptionError } = await supabaseAdmin
          .from("customer_subscriptions")
          .update({
            status: "active",
            stripe_invoice_id: invoice.id,
            stripe_payment_status: "paid",
            tax_amount_sek: invoiceTaxAmountOre(invoice),
            total_amount_sek: invoice.total,
            fulfillment_status: "active",
          })
          .eq("id", matchedSubscription.id);

        if (subscriptionError) {
          console.error(
            "Invoice paid subscription update error:",
            subscriptionError,
          );
          await recordStripeWebhookFailureVisibility({
            eventType: "stripe_invoice_paid_sync_failed",
            title: "Paid invoice sync failed",
            message: `Stripe paid invoice ${invoice.id} could not update the local subscription row: ${subscriptionError.message}`,
            metadata: {
              ...paidInvoiceMetadata,
              error: subscriptionError.message,
            },
            customerIds: matchedCustomers.map((customer) => customer.id),
          });
        }
      }

      let entitlement: Awaited<ReturnType<typeof syncStripeSubscription>> | null =
        null;
      try {
        const stripeSubscription =
          await stripe.subscriptions.retrieve(paidStripeSubscriptionId);
        entitlement = await syncStripeSubscription(stripeSubscription);
      } catch (error) {
        console.error("Invoice paid subscription entitlement sync error:", error);
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_invoice_paid_sync_failed",
          title: "Paid invoice sync failed",
          message: `Stripe paid invoice ${invoice.id} could not sync subscription entitlement.`,
          metadata: {
            ...paidInvoiceMetadata,
            error: error instanceof Error ? error.message : String(error),
          },
          customerIds: matchedCustomers.map((customer) => customer.id),
        });
      }

      if (!entitlement) {
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_invoice_paid_sync_failed",
          title: "Paid invoice sync failed",
          message: `Stripe paid invoice ${invoice.id} did not produce subscription entitlement state.`,
          metadata: {
            ...paidInvoiceMetadata,
            error: "Missing synced entitlement after Stripe subscription lookup.",
          },
          customerIds: matchedCustomers.map((customer) => customer.id),
        });
      }

      const syncedEntitlement = entitlement as Awaited<
        ReturnType<typeof syncStripeSubscription>
      >;
      const restoreDisplayAccess =
        syncedEntitlement.serviceAccessStatus === "active" ||
        syncedEntitlement.serviceAccessStatus === "active_until_period_end";
      const paymentFailureCustomerIds = matchedCustomers
        .filter(
          (customer) =>
            customer.payment_status === "failed" ||
            customer.status === "suspended" ||
            customer.inactive_reason === "payment_failed",
        )
        .map((customer) => customer.id);

      if (restoreDisplayAccess && paymentFailureCustomerIds.length > 0) {
        const { error: restoreError } = await supabaseAdmin
          .from("customers")
          .update({
            status: "active",
            payment_status: "paid",
            service_access_status: syncedEntitlement.serviceAccessStatus,
            service_access_until: syncedEntitlement.serviceAccessUntil,
            inactive_reason: null,
            cancellation_source: null,
          })
          .in("id", paymentFailureCustomerIds);

        if (restoreError) {
          console.error(
            "Invoice paid customer access restore error:",
            restoreError,
          );
          await recordStripeWebhookFailureVisibility({
            eventType: "stripe_invoice_paid_sync_failed",
            title: "Paid invoice sync failed",
            message: `Stripe paid invoice ${invoice.id} could not restore customer access: ${restoreError.message}`,
            metadata: {
              ...paidInvoiceMetadata,
              error: restoreError.message,
            },
            customerIds: paymentFailureCustomerIds,
          });
        }
      }

      if (!existingAudit?.length) {
        try {
          await Promise.all(
            matchedCustomers
              .filter((customer) => customer.payment_status !== "refunded")
              .map((customer) =>
                recordAuditEvent(
                  supabaseAdmin,
                  {
                    customerId: customer.id,
                    actorType: "stripe",
                    eventType: "subscription_invoice_paid",
                    eventDescription:
                      "Stripe reported a paid subscription invoice.",
                    metadata: {
                      ...paidInvoiceMetadata,
                      serviceAccessStatus: syncedEntitlement.serviceAccessStatus,
                      serviceAccessUntil: syncedEntitlement.serviceAccessUntil,
                    },
                  },
                  { throwOnError: true },
                ),
              ),
          );
        } catch (evidenceError) {
          console.error("Invoice paid evidence storage error:", evidenceError);
          await recordStripeWebhookFailureVisibility({
            eventType: "stripe_invoice_paid_evidence_failed",
            title: "Paid invoice evidence failed",
            message: `Stripe paid invoice ${invoice.id} was synced, but Screenia could not store required audit evidence.`,
            metadata: {
              ...paidInvoiceMetadata,
              error:
                evidenceError instanceof Error
                  ? evidenceError.message
                  : String(evidenceError),
            },
            customerIds: matchedCustomers.map((customer) => customer.id),
          });
        }
      }
    }
  }

    if (
      event.type === "charge.dispute.created" ||
      event.type === "charge.dispute.updated" ||
      event.type === "charge.dispute.closed"
    ) {
    const dispute = event.data.object as Stripe.Dispute;
    await handleStripeDispute(dispute, event.type);
  }

    if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const latestRefund =
      typeof charge.refunds?.data?.[0] === "object"
        ? charge.refunds.data[0]
        : null;

    if (latestRefund) {
      await handleStripeRefund(latestRefund, event.type);
    }
  }

    if (event.type === "refund.created" || event.type === "refund.updated") {
    const refund = event.data.object as Stripe.Refund;
    await handleStripeRefund(refund, event.type);
  }

    if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    await syncStripeSubscription(subscription);
  }

    if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;

    const customerId = stripeObjectId(subscription.customer);
    const deletedSubscriptionMetadata = {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripeStatus: subscription.status,
    };

    if (!customerId) {
      await recordStripeWebhookFailureVisibility({
        eventType: "stripe_subscription_deleted_sync_failed",
        title: "Subscription deletion sync failed",
        message: `Stripe subscription deletion ${subscription.id} did not include a customer id.`,
        metadata: deletedSubscriptionMetadata,
      });
    }

    const deletedStripeCustomerId = customerId as string;

    const { data: customers, error: customerLookupError } = await supabaseAdmin
      .from("customers")
      .select("id, payment_status, inactive_reason, cancellation_reason, cancellation_source, cancelled_at")
      .eq("stripe_customer_id", deletedStripeCustomerId);

    if (customerLookupError) {
      console.error("Subscription deleted customer lookup error:", customerLookupError);
      await recordStripeWebhookFailureVisibility({
        eventType: "stripe_subscription_deleted_sync_failed",
        title: "Subscription deletion sync failed",
        message: `Stripe subscription deletion ${subscription.id} could not look up the customer: ${customerLookupError.message}`,
        metadata: {
          ...deletedSubscriptionMetadata,
          error: customerLookupError.message,
        },
      });
    }

    const matchedCustomers = customers ?? [];

    if (!matchedCustomers.length) {
      await recordStripeWebhookFailureVisibility({
        eventType: "stripe_subscription_deleted_sync_failed",
        title: "Subscription deletion sync failed",
        message: `Stripe subscription deletion ${subscription.id} did not match any Screenia customer.`,
        metadata: {
          ...deletedSubscriptionMetadata,
          error: "No Screenia customer matched stripe_customer_id.",
        },
      });
    }

    const cancelledAt = new Date().toISOString();

    for (const customer of matchedCustomers) {
      const appInitiatedCancellation =
        customer.cancellation_source === "customer" ||
        customer.cancellation_source === "admin";
      const refundBeforeProduction =
        customer.payment_status === "refunded" ||
        customer.cancellation_reason === "refunded_before_production";

      const { error } = await supabaseAdmin
        .from("customers")
        .update({
          status: "suspended",
          payment_status: refundBeforeProduction ? "refunded" : "cancelled",
          service_access_status: refundBeforeProduction ? "refunded" : "cancelled",
          service_access_until: null,
          inactive_reason: appInitiatedCancellation
            ? customer.inactive_reason || "subscription_cancelled"
            : "subscription_cancelled",
          cancelled_at: customer.cancelled_at || cancelledAt,
          cancellation_source: appInitiatedCancellation
            ? customer.cancellation_source
            : "stripe",
        })
        .eq("id", customer.id);

      if (error) {
        console.error("Subscription deleted customer update error:", error);
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_subscription_deleted_sync_failed",
          title: "Subscription deletion sync failed",
          message: `Stripe subscription deletion ${subscription.id} could not block customer display access: ${error.message}`,
          metadata: {
            ...deletedSubscriptionMetadata,
            customerId: customer.id,
            error: error.message,
          },
          customerIds: [customer.id],
        });
      }
    }

    const { error: fulfillmentUpdateError } = await supabaseAdmin
      .from("customer_subscriptions")
      .update({
        fulfillment_status: "cancelled",
      })
      .eq("stripe_subscription_id", subscription.id);

    if (fulfillmentUpdateError) {
      console.error(
        "Subscription deleted fulfillment update error:",
        fulfillmentUpdateError,
      );
      await recordStripeWebhookFailureVisibility({
        eventType: "stripe_subscription_deleted_sync_failed",
        title: "Subscription deletion sync failed",
        message: `Stripe subscription deletion ${subscription.id} could not update fulfillment status: ${fulfillmentUpdateError.message}`,
        metadata: {
          ...deletedSubscriptionMetadata,
          error: fulfillmentUpdateError.message,
        },
        customerIds: matchedCustomers.map((customer) => customer.id),
      });
    }

    const { error: subscriptionStatusError } = await supabaseAdmin
      .from("customer_subscriptions")
      .update({
        status: "cancelled",
        fulfillment_status: "cancelled",
      })
      .eq("stripe_subscription_id", subscription.id)
      .neq("status", "refunded");

    if (subscriptionStatusError) {
      console.error(
        "Subscription deleted status update error:",
        subscriptionStatusError,
      );
      await recordStripeWebhookFailureVisibility({
        eventType: "stripe_subscription_deleted_sync_failed",
        title: "Subscription deletion sync failed",
        message: `Stripe subscription deletion ${subscription.id} could not update local subscription status: ${subscriptionStatusError.message}`,
        metadata: {
          ...deletedSubscriptionMetadata,
          error: subscriptionStatusError.message,
        },
        customerIds: matchedCustomers.map((customer) => customer.id),
      });
    }

    try {
      await Promise.all(
        matchedCustomers.map((customer) =>
          recordAuditEvent(
            supabaseAdmin,
            {
            customerId: customer.id,
            actorType: "stripe",
            eventType: "subscription_cancelled",
            eventDescription:
              "Stripe subscription was cancelled. Customer was suspended.",
            metadata: {
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscription.id,
            },
            },
            { throwOnError: true },
          ),
        ),
      );
    } catch (evidenceError) {
      console.error("Subscription deleted evidence storage error:", evidenceError);
      await recordStripeWebhookFailureVisibility({
        eventType: "stripe_subscription_deleted_evidence_failed",
        title: "Subscription deletion evidence failed",
        message: `Stripe subscription deletion ${subscription.id} blocked access, but Screenia could not store required audit evidence.`,
        metadata: {
          ...deletedSubscriptionMetadata,
          error:
            evidenceError instanceof Error
              ? evidenceError.message
              : String(evidenceError),
        },
        customerIds: matchedCustomers.map((customer) => customer.id),
      });
    }
  }

    await finishWebhookEventProcessing(eventRowId, "processed");
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing error:", error);
    await finishWebhookEventProcessing(eventRowId, "failed", error);
    await createAdminNotification(supabaseAdmin, {
      eventType: "stripe_webhook_processing_failed",
      title: "Stripe webhook failed",
      message: `Stripe event ${event.type} (${event.id}) could not be processed. Check the webhook event ledger before retrying operational changes.`,
      priority: "urgent",
      metadata: {
        stripeEventId: event.id,
        stripeEventType: event.type,
        livemode: event.livemode,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 },
    );
  }
}
