import { describe, expect, it } from "vitest";
import { calculateCartQuote, normalizeCartItems } from "./cart";

describe("cart pricing", () => {
  it("normalizes repeated package lines and calculates a mixed cart", () => {
    expect(normalizeCartItems([
      { pricingPlanCode: "standard_fhd", quantity: 1 },
      { pricingPlanCode: "standard_fhd", quantity: 2 },
      { pricingPlanCode: "premium_4k", quantity: 1 },
    ])).toEqual([
      { pricingPlanCode: "standard_fhd", quantity: 3 },
      { pricingPlanCode: "premium_4k", quantity: 1 },
    ]);

    expect(calculateCartQuote([
      { pricingPlanCode: "standard_fhd", quantity: 2 },
      { pricingPlanCode: "premium_4k", quantity: 1 },
    ])).toMatchObject({
      screenQuantity: 3,
      setupFeeSek: 499,
      hardwareFeeSek: 2497,
      shippingFeeSek: 99,
      monthlyFeeSek: 327,
      initialPaymentSek: 3095,
      trialDays: 21,
    });
  });

  it("rejects empty and oversized carts", () => {
    expect(() => calculateCartQuote([])).toThrow();
    expect(() => calculateCartQuote([
      { pricingPlanCode: "standard_fhd", quantity: 51 },
    ])).toThrow();
  });

  it("rejects inactive or unknown plans", () => {
    expect(() => calculateCartQuote([
      { pricingPlanCode: "premium_plus_4k", quantity: 1 },
    ])).toThrow();
  });

  it("keeps setup and shipping fixed for the full supported cart size", () => {
    const quote = calculateCartQuote([
      { pricingPlanCode: "standard_fhd", quantity: 50 },
    ]);

    expect(quote.setupFeeSek).toBe(499);
    expect(quote.shippingFeeSek).toBe(99);
    expect(quote.initialPaymentSek).toBe(50 * 699 + 499 + 99);
  });
});
