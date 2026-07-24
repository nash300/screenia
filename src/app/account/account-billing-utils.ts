import type { AccountData } from "./account-types";

const formatter = new Intl.NumberFormat("sv-SE");
const preciseCurrencyFormatter = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatNumber(value: number) {
  return formatter.format(value);
}

export function money(amount: number | null) {
  if (typeof amount !== "number") return "-";
  return `${formatter.format(amount)} kr`;
}

export function preciseMoney(amount: number) {
  return `${preciseCurrencyFormatter.format(amount)} kr`;
}

export function date(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function addMonths(value: Date, months: number) {
  const next = new Date(value);
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);

  if (next.getDate() !== day) {
    next.setDate(0);
  }

  return next;
}

export function trialStatus(subscription: AccountData["subscriptions"][number]) {
  if (!subscription.trial_ends_at) {
    return `${subscription.trial_days || 0} dagar`;
  }

  const trialEnd = new Date(subscription.trial_ends_at);
  const currentPeriodStart = subscription.stripe_current_period_start
    ? new Date(subscription.stripe_current_period_start)
    : null;
  const billingHasPassedTrial =
    currentPeriodStart &&
    !Number.isNaN(currentPeriodStart.getTime()) &&
    currentPeriodStart.getTime() >= trialEnd.getTime();

  if (billingHasPassedTrial || trialEnd.getTime() <= Date.now()) {
    return `Avslutad ${date(subscription.trial_ends_at)}`;
  }

  const daysRemaining = Math.max(
    0,
    Math.ceil((trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );
  return `${daysRemaining} dag${daysRemaining === 1 ? "" : "ar"} kvar (till ${date(
    subscription.trial_ends_at,
  )})`;
}

export function subscriptionPackageLabel(subscription: AccountData["subscriptions"][number]) {
  const quoteItems = subscription.quote_items || [];

  if (quoteItems.length) {
    return quoteItems
      .map((item) => {
        const quantity = Math.max(1, item.quantity || 1);
        const name = [item.name, item.resolution].filter(Boolean).join(" ");
        return `${quantity} x ${name || "Screenia"}`;
      })
      .join(" + ");
  }

  return `${subscription.pricing_plans?.name || "Paket"} ${
    subscription.pricing_plans?.resolution || ""
  }`.trim();
}

export function subscriptionPausePlanOptions(
  subscription: AccountData["subscriptions"][number],
) {
  const quoteItems = subscription.quote_items || [];

  if (quoteItems.length) {
    return quoteItems.map((item, index) => {
      const pricingPlanCode = String(item.pricingPlanCode || "");
      const name = [item.name, item.resolution].filter(Boolean).join(" ").trim();
      return {
        value: pricingPlanCode || `item-${index}`,
        pricingPlanCode,
        label: name || "Screenia",
        monthlyFeeSek: item.monthlyFeeSek || 0,
      };
    });
  }

  return [
    {
      value: subscription.id,
      pricingPlanCode: "",
      label: subscriptionPackageLabel(subscription),
      monthlyFeeSek: subscription.monthly_fee_sek || 0,
    },
  ];
}

export function subscriptionInitialPaymentSek(subscription: AccountData["subscriptions"][number]) {
  return (
    (subscription.setup_fee_sek || 0) +
    (subscription.hardware_fee_sek || 0) +
    (subscription.shipping_fee_sek || 0) -
    (subscription.device_discount_amount_sek || 0)
  );
}

export function subscriptionMonthlyTotalSek(subscription: AccountData["subscriptions"][number]) {
  const quoteItems = subscription.quote_items || [];

  if (quoteItems.length) {
    return quoteItems.reduce(
      (sum, item) => sum + (item.monthlyFeeSek || 0) * Math.max(1, item.quantity || 1),
      0,
    );
  }

  return (subscription.monthly_fee_sek || 0) * Math.max(1, subscription.screen_quantity || 1);
}

export function subscriptionIsBillable(subscription: AccountData["subscriptions"][number]) {
  return (
    ["paid", "active"].includes(subscription.status || "") ||
    ["paid", "active", "trialing"].includes(subscription.stripe_payment_status || "")
  );
}
