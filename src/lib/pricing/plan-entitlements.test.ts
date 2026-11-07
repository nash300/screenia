import { describe, expect, it } from "vitest";

import {
  customerCanUploadVideos,
  subscriptionIncludesCustomerVideoUploads,
} from "./plan-entitlements";

describe("Premium video entitlement", () => {
  it("allows an active mixed order containing Premium", () => {
    expect(
      subscriptionIncludesCustomerVideoUploads({
        status: "active",
        quote_items: [
          { pricingPlanCode: "standard_fhd" },
          { pricingPlanCode: "premium_4k" },
        ],
      }),
    ).toBe(true);
  });

  it("allows the related Premium plan when quote items are unavailable", () => {
    expect(
      subscriptionIncludesCustomerVideoUploads({
        status: "paid",
        pricing_plans: { code: "premium_4k" },
      }),
    ).toBe(true);
  });

  it.each(["cancelled", "refunded", "checkout_started"])(
    "blocks non-billable status %s",
    (status) => {
      expect(
        subscriptionIncludesCustomerVideoUploads({
          status,
          quote_items: [{ pricingPlanCode: "premium_4k" }],
        }),
      ).toBe(false);
    },
  );

  it("does not grant video upload to Standard subscriptions", () => {
    expect(
      customerCanUploadVideos([
        {
          status: "active",
          quote_items: [{ pricingPlanCode: "standard_fhd" }],
        },
      ]),
    ).toBe(false);
  });
});
