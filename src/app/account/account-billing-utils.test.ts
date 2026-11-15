import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addMonths,
  money,
  preciseMoney,
  subscriptionInitialPaymentSek,
  subscriptionIsBillable,
  subscriptionMonthlyTotalSek,
  subscriptionPackageLabel,
  subscriptionPausePlanOptions,
  trialStatus,
} from "./account-billing-utils";
import type { AccountData } from "./account-types";

type Subscription = AccountData["subscriptions"][number];

const subscription = (overrides: Partial<Subscription> = {}) =>
  ({
    id: "subscription-1",
    status: "active",
    stripe_payment_status: "active",
    screen_quantity: 1,
    monthly_fee_sek: 99,
    setup_fee_sek: 199,
    hardware_fee_sek: 1_999,
    shipping_fee_sek: 149,
    device_discount_amount_sek: 0,
    quote_items: [],
    pricing_plans: { name: "Standard", resolution: "FHD", code: "standard_fhd" },
    ...overrides,
  }) as Subscription;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-15T10:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("customer account billing presentation", () => {
  it("formats whole and precise Swedish krona amounts", () => {
    expect(money(1_499)).toBe("1 499 kr");
    expect(money(null)).toBe("-");
    expect(preciseMoney(1499.5)).toBe("1 499,50 kr");
  });

  it("keeps end-of-month dates valid when adding months", () => {
    expect(addMonths(new Date("2026-01-31T12:00:00.000Z"), 1).toISOString()).toBe(
      "2026-02-28T12:00:00.000Z",
    );
  });

  it("shows trial time before and after billing starts", () => {
    expect(
      trialStatus(
        subscription({
          trial_ends_at: "2026-08-17T10:00:00.000Z",
          stripe_current_period_start: null,
        }),
      ),
    ).toContain("2 dagar kvar");

    expect(
      trialStatus(
        subscription({
          trial_ends_at: "2026-08-14T10:00:00.000Z",
          stripe_current_period_start: "2026-08-14T10:00:00.000Z",
        }),
      ),
    ).toContain("Avslutad");
  });

  it("uses quote items for mixed packages, pause choices, and monthly totals", () => {
    const mixed = subscription({
      quote_items: [
        {
          pricingPlanCode: "standard_fhd",
          name: "Standard",
          resolution: "FHD",
          quantity: 2,
          monthlyFeeSek: 99,
        },
        {
          pricingPlanCode: "premium_4k",
          name: "Premium",
          resolution: "4K",
          quantity: 1,
          monthlyFeeSek: 129,
        },
      ],
    });

    expect(subscriptionPackageLabel(mixed)).toBe(
      "2 x Standard FHD + 1 x Premium 4K",
    );
    expect(subscriptionMonthlyTotalSek(mixed)).toBe(327);
    expect(subscriptionPausePlanOptions(mixed)).toEqual([
      {
        value: "standard_fhd",
        pricingPlanCode: "standard_fhd",
        label: "Standard FHD",
        monthlyFeeSek: 99,
      },
      {
        value: "premium_4k",
        pricingPlanCode: "premium_4k",
        label: "Premium 4K",
        monthlyFeeSek: 129,
      },
    ]);
  });

  it("calculates the first payment and legacy multi-screen monthly total", () => {
    const legacy = subscription({
      screen_quantity: 3,
      monthly_fee_sek: 99,
      setup_fee_sek: 199,
      hardware_fee_sek: 3_000,
      shipping_fee_sek: 300,
      device_discount_amount_sek: 500,
    });

    expect(subscriptionInitialPaymentSek(legacy)).toBe(2_999);
    expect(subscriptionMonthlyTotalSek(legacy)).toBe(297);
  });

  it.each([
    [{ status: "paid", stripe_payment_status: null }, true],
    [{ status: "draft", stripe_payment_status: "trialing" }, true],
    [{ status: "cancelled", stripe_payment_status: "canceled" }, false],
    [{ status: "payment_failed", stripe_payment_status: "past_due" }, false],
  ])("identifies billable subscription state %#", (state, expected) => {
    expect(subscriptionIsBillable(subscription(state))).toBe(expected);
  });
});
