import Stripe from "stripe";

export type ServiceAccessStatus =
  | "inactive"
  | "active"
  | "active_until_period_end"
  | "paused"
  | "payment_failed"
  | "cancelled"
  | "refunded";

type StripeSubscriptionSnapshot = Stripe.Subscription & {
  current_period_start?: number | null;
  current_period_end?: number | null;
  cancel_at?: number | null;
  cancel_at_period_end?: boolean | null;
  canceled_at?: number | null;
  pause_collection?: {
    behavior?: string | null;
    resumes_at?: number | null;
  } | null;
};

function fromUnixSeconds(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : null;
}

export function getStripeSubscriptionEntitlement(
  subscription: Stripe.Subscription,
) {
  const snapshot = subscription as StripeSubscriptionSnapshot;
  const currentPeriodStart = fromUnixSeconds(snapshot.current_period_start);
  const currentPeriodEnd = fromUnixSeconds(snapshot.current_period_end);
  const cancelAt = fromUnixSeconds(snapshot.cancel_at);
  const pauseResumesAt = fromUnixSeconds(snapshot.pause_collection?.resumes_at);
  const isPaused = Boolean(snapshot.pause_collection);
  const cancelAtPeriodEnd = Boolean(snapshot.cancel_at_period_end);
  const cancellationEffectiveAt = cancelAt || (cancelAtPeriodEnd ? currentPeriodEnd : null);

  let serviceAccessStatus: ServiceAccessStatus = "active";
  if (isPaused) serviceAccessStatus = "paused";
  else if (subscription.status === "past_due" || subscription.status === "unpaid") {
    serviceAccessStatus = "payment_failed";
  } else if (subscription.status === "canceled") {
    serviceAccessStatus = "cancelled";
  } else if (cancelAtPeriodEnd) {
    serviceAccessStatus = "active_until_period_end";
  }

  return {
    serviceAccessStatus,
    serviceAccessUntil:
      serviceAccessStatus === "active_until_period_end" ? cancellationEffectiveAt : null,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    cancellationEffectiveAt,
    pauseStartedAt: isPaused ? new Date().toISOString() : null,
    pauseResumesAt,
  };
}

export function hasDisplayEntitlement({
  customerStatus,
  paymentStatus,
  serviceAccessStatus,
  serviceAccessUntil,
}: {
  customerStatus: string | null | undefined;
  paymentStatus: string | null | undefined;
  serviceAccessStatus: string | null | undefined;
  serviceAccessUntil: string | null | undefined;
}) {
  if (customerStatus !== "active" || paymentStatus !== "paid") return false;
  if (!["active", "active_until_period_end"].includes(serviceAccessStatus || "")) {
    return false;
  }
  if (serviceAccessUntil && new Date(serviceAccessUntil).getTime() <= Date.now()) {
    return false;
  }
  return true;
}
