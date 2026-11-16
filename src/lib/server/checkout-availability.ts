export const CHECKOUT_PAUSED_MESSAGE =
  "Betalningar är tillfälligt pausade medan vi slutför Stripe-konfigurationen. Försök igen senare.";

/**
 * Checkout is deliberately fail-closed. It must be explicitly enabled after
 * Stripe business, payout, webhook, and launch checks have been completed.
 */
export function isCheckoutEnabled() {
  return process.env.SCREENIA_CHECKOUT_ENABLED?.trim().toLowerCase() === "true";
}
