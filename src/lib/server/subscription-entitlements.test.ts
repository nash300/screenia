import { afterEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

import {
  getStripeSubscriptionEntitlement,
  hasDisplayEntitlement,
  isManuallySuspendedCustomer,
  isPaymentFailureCustomer,
} from "./subscription-entitlements";

function subscription(
  overrides: Record<string, unknown> = {},
): Stripe.Subscription {
  return {
    status: "active",
    items: {
      data: [
        {
          current_period_start: 1_700_000_000,
          current_period_end: 1_700_086_400,
        },
      ],
    },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Stripe subscription lifecycle scenarios", () => {
  it.each([
    ["past_due", "payment_failed"],
    ["unpaid", "payment_failed"],
    ["canceled", "cancelled"],
  ])("maps %s to %s access", (status, expected) => {
    expect(
      getStripeSubscriptionEntitlement(subscription({ status }))
        .serviceAccessStatus,
    ).toBe(expected);
  });

  it("keeps access through the paid period when cancellation is scheduled", () => {
    const result = getStripeSubscriptionEntitlement(
      subscription({ cancel_at_period_end: true }),
    );

    expect(result.serviceAccessStatus).toBe("active_until_period_end");
    expect(result.serviceAccessUntil).toBe("2023-11-15T22:13:20.000Z");
  });

  it("gives pause state precedence over billing status", () => {
    const result = getStripeSubscriptionEntitlement(
      subscription({
        status: "past_due",
        pause_collection: { behavior: "void", resumes_at: 1_700_086_400 },
      }),
    );

    expect(result.serviceAccessStatus).toBe("paused");
    expect(result.pauseResumesAt).toBe("2023-11-15T22:13:20.000Z");
  });
});

describe("display access scenarios", () => {
  it("allows a paid active customer", () => {
    expect(
      hasDisplayEntitlement({
        customerStatus: "active",
        paymentStatus: "paid",
        serviceAccessStatus: "active",
        serviceAccessUntil: null,
      }),
    ).toBe(true);
  });

  it.each(["cancelled", "refunded", "suspended", "deleted"])(
    "blocks customer status %s",
    (customerStatus) => {
      expect(
        hasDisplayEntitlement({
          customerStatus,
          paymentStatus: "paid",
          serviceAccessStatus: "active",
          serviceAccessUntil: null,
        }),
      ).toBe(false);
    },
  );

  it("blocks expired paid-through access", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-24T12:00:00.000Z"));

    expect(
      hasDisplayEntitlement({
        customerStatus: "active",
        paymentStatus: "paid",
        serviceAccessStatus: "active_until_period_end",
        serviceAccessUntil: "2026-07-24T11:59:59.000Z",
      }),
    ).toBe(false);
  });

  it("recognizes only explicit payment-failure markers for recovery", () => {
    expect(
      isPaymentFailureCustomer({
        paymentStatus: "paid",
        serviceAccessStatus: "inactive",
        inactiveReason: "manual_suspend",
      }),
    ).toBe(false);
    expect(
      isPaymentFailureCustomer({
        paymentStatus: "failed",
        serviceAccessStatus: "payment_failed",
        inactiveReason: "payment_failed",
      }),
    ).toBe(true);
  });

  it("identifies an admin hold separately from payment failure", () => {
    expect(
      isManuallySuspendedCustomer({
        status: "suspended",
        inactiveReason: "manual_suspend",
      }),
    ).toBe(true);
    expect(
      isManuallySuspendedCustomer({
        status: "suspended",
        inactiveReason: "payment_failed",
      }),
    ).toBe(false);
  });
});
