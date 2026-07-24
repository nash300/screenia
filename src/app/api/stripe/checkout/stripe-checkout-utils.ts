import { stripe } from "./stripe-checkout-client";

export const stripeAutomaticTaxEnabled =
  process.env.STRIPE_AUTOMATIC_TAX_ENABLED === "true";
export type CheckoutLineItem =
  NonNullable<
    NonNullable<Parameters<typeof stripe.checkout.sessions.create>[0]>["line_items"]
  >[number];
export type SubscriptionItemInput =
  NonNullable<
    NonNullable<Parameters<typeof stripe.subscriptions.update>[1]>["items"]
  >[number];

export function toOre(amountSek: number) {
  return Math.round(amountSek * 100);
}

export function isLiveStripeKey() {
  return process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") === true;
}

export function checkoutImageUrl(appUrl: string, path: string) {
  const imageBaseUrl = appUrl.includes("localhost")
    ? "https://screenia.se"
    : appUrl;

  return new URL(path, imageBaseUrl).toString();
}

export function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

export async function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
): Promise<T | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export type QuoteItem = {
  pricingPlanCode?: string;
  quantity?: number;
  hardwareFeeSek?: number;
  shippingFeeSek?: number;
  monthlyFeeSek?: number;
  orderType?: string;
};

export function staticPriceLineItem({
  priceId,
  expectedAmountSek,
  actualAmountSek,
  quantity,
}: {
  priceId?: string | null;
  expectedAmountSek: number;
  actualAmountSek: number;
  quantity: number;
}): CheckoutLineItem | null {
  if (!priceId || expectedAmountSek !== actualAmountSek) return null;

  return {
    price: priceId,
    quantity,
  };
}

export function subscriptionItemForMonthlyCharge({
  priceId,
  quantity,
}: {
  priceId?: string | null;
  quantity: number;
}): SubscriptionItemInput {
  if (!priceId) {
    throw new Error("Missing Stripe monthly price for add-on subscription update.");
  }

  return { price: priceId, quantity };
}
