import { PRICING_PLANS } from "./plans";
import { BASE_SETUP_FEE_SEK } from "./setup-fee";
import { calculateShippingFeeSek } from "./shipping-fee";

export const CART_MAX_SCREENS = 50;

export type CartItemInput = {
  pricingPlanCode: string;
  quantity: number;
};

export type CartQuoteItem = {
  pricingPlanCode: string;
  name: string;
  resolution: string;
  quantity: number;
  hardwareFeeSek: number;
  monthlyFeeSek: number;
  trialDays: number;
};

export type CartQuote = {
  items: CartQuoteItem[];
  screenQuantity: number;
  setupFeeSek: number;
  hardwareFeeSek: number;
  shippingFeeSek: number;
  monthlyFeeSek: number;
  initialPaymentSek: number;
  currency: "sek";
  trialDays: number;
};

export function normalizeCartItems(input: unknown): CartItemInput[] {
  if (!Array.isArray(input)) return [];

  const quantities = new Map<string, number>();
  for (const rawItem of input) {
    if (!rawItem || typeof rawItem !== "object") continue;
    const value = rawItem as Record<string, unknown>;
    const code = String(value.pricingPlanCode || "").trim();
    const quantity = Number(value.quantity);
    if (!code || !Number.isInteger(quantity) || quantity < 0) continue;
    quantities.set(code, (quantities.get(code) || 0) + quantity);
  }

  return Array.from(quantities, ([pricingPlanCode, quantity]) => ({
    pricingPlanCode,
    quantity,
  })).filter((item) => item.quantity > 0);
}

export function calculateCartQuote(input: unknown): CartQuote {
  const items = normalizeCartItems(input);
  const quoteItems: CartQuoteItem[] = [];

  for (const item of items) {
    const plan = PRICING_PLANS.find((candidate) => candidate.code === item.pricingPlanCode);
    if (!plan) throw new Error("Unknown pricing plan.");
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error("Invalid cart quantity.");
    }

    quoteItems.push({
      pricingPlanCode: plan.code,
      name: plan.name,
      resolution: plan.resolution,
      quantity: item.quantity,
      hardwareFeeSek: plan.hardwareFeeSek,
      monthlyFeeSek: plan.monthlyFeeSek,
      trialDays: plan.trialDays,
    });
  }

  const screenQuantity = quoteItems.reduce((sum, item) => sum + item.quantity, 0);
  if (screenQuantity < 1 || screenQuantity > CART_MAX_SCREENS) {
    throw new Error(`Cart must contain between 1 and ${CART_MAX_SCREENS} screens.`);
  }

  const setupFeeSek = BASE_SETUP_FEE_SEK;
  const hardwareFeeSek = quoteItems.reduce(
    (sum, item) => sum + item.hardwareFeeSek * item.quantity,
    0,
  );
  const shippingFeeSek = calculateShippingFeeSek(screenQuantity);
  const monthlyFeeSek = quoteItems.reduce(
    (sum, item) => sum + item.monthlyFeeSek * item.quantity,
    0,
  );

  return {
    items: quoteItems,
    screenQuantity,
    setupFeeSek,
    hardwareFeeSek,
    shippingFeeSek,
    monthlyFeeSek,
    initialPaymentSek: setupFeeSek + hardwareFeeSek + shippingFeeSek,
    currency: "sek",
    trialDays: Math.max(...quoteItems.map((item) => item.trialDays)),
  };
}
