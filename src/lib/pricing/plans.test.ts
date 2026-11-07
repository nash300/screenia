import { describe, expect, it } from "vitest";
import { PRICING_PLANS } from "./plans";

describe("approved pricing catalog", () => {
  it("contains only Standard and Premium with the approved monthly prices", () => {
    expect(PRICING_PLANS.map((plan) => plan.code)).toEqual([
      "standard_fhd",
      "premium_4k",
    ]);
    expect(PRICING_PLANS.map((plan) => plan.monthlyFeeSek)).toEqual([99, 129]);
  });

  it("keeps device pricing and fixed shipping consistent", () => {
    expect(PRICING_PLANS).toMatchObject([
      {
        hardwareFeeSek: 699,
        shippingFeeSek: 99,
        shippingIncludedDevices: 50,
        additionalShippingFeeSek: 0,
      },
      {
        hardwareFeeSek: 1099,
        shippingFeeSek: 99,
        shippingIncludedDevices: 50,
        additionalShippingFeeSek: 0,
      },
    ]);
  });
});
