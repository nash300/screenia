import { describe, expect, it } from "vitest";
import {
  assertCustomerCanReceiveDevice,
  getCustomerDeviceEntitlement,
} from "./device-entitlements";

function fakeSupabase({
  subscriptions = [],
  devices = [],
}: {
  subscriptions?: Array<Record<string, unknown>>;
  devices?: Array<Record<string, unknown>>;
} = {}) {
  return {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return Promise.resolve({
                data: table === "customer_subscriptions" ? subscriptions : devices,
                error: null,
              });
            },
          };
        },
      };
    },
  } as never;
}

describe("customer device entitlement validation", () => {
  it("does not let complimentary displays consume paid slots", async () => {
    const supabase = fakeSupabase({
      subscriptions: [
        { status: "active", stripe_payment_status: "paid", screen_quantity: 1 },
      ],
      devices: [
        { id: "paid", is_active: true, inventory_status: "assigned", is_complimentary: false },
        { id: "free", is_active: true, inventory_status: "assigned", is_complimentary: true },
      ],
    });

    await expect(getCustomerDeviceEntitlement(supabase, "customer-1")).resolves.toEqual({
      allowed: 1,
      active: 1,
      remaining: 0,
      complimentary: 1,
    });
  });

  it("blocks a normal allocation at the paid limit but allows a recorded owner exception", async () => {
    const supabase = fakeSupabase({
      subscriptions: [
        { status: "active", stripe_payment_status: "paid", screen_quantity: 1 },
      ],
      devices: [
        { id: "paid", is_active: true, inventory_status: "assigned", is_complimentary: false },
      ],
    });

    await expect(assertCustomerCanReceiveDevice(supabase, "customer-1")).resolves.toMatchObject({
      ok: false,
      entitlement: { allowed: 1, active: 1, remaining: 0, complimentary: 0 },
    });
    await expect(
      assertCustomerCanReceiveDevice(supabase, "customer-1", {
        complimentary: true,
        complimentaryReason: "Launch validation for a friend",
        complimentaryExpiresAt: "2099-12-31",
      }),
    ).resolves.toMatchObject({ ok: true, complimentary: true });
  });

  it("requires a reason for the owner exception", async () => {
    const supabase = fakeSupabase();

    await expect(
      assertCustomerCanReceiveDevice(supabase, "customer-1", {
        complimentary: true,
        complimentaryReason: "no",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: "A reason of at least 5 characters is required for a complimentary screen.",
    });
  });

  it("allows an approved complimentary screen without a paid subscription", async () => {
    const supabase = fakeSupabase();

    await expect(
      assertCustomerCanReceiveDevice(supabase, "customer-1", {
        complimentary: true,
        complimentaryReason: "Free pilot screen for launch testing",
        complimentaryExpiresAt: "2099-12-31",
      }),
    ).resolves.toMatchObject({
      ok: true,
      complimentary: true,
      entitlement: { allowed: 0, active: 0, remaining: 0, complimentary: 0 },
    });
  });

  it("does not count expired complimentary displays as active exceptions", async () => {
    const supabase = fakeSupabase({
      devices: [
        {
          id: "expired-free",
          is_active: true,
          inventory_status: "assigned",
          is_complimentary: true,
          complimentary_expires_at: "2020-01-01T00:00:00.000Z",
        },
        {
          id: "current-free",
          is_active: true,
          inventory_status: "assigned",
          is_complimentary: true,
          complimentary_expires_at: "2099-12-31T23:59:59.000Z",
        },
      ],
    });

    await expect(getCustomerDeviceEntitlement(supabase, "customer-1")).resolves.toEqual({
      allowed: 0,
      active: 0,
      remaining: 0,
      complimentary: 1,
    });
  });

  it("frees the replaced paid display before validating the new allocation", async () => {
    const supabase = fakeSupabase({
      subscriptions: [
        { status: "active", stripe_payment_status: "paid", screen_quantity: 1 },
      ],
      devices: [
        { id: "paid-old", is_active: true, inventory_status: "assigned", is_complimentary: false },
      ],
    });

    await expect(
      assertCustomerCanReceiveDevice(supabase, "customer-1", {
        replacingDeviceId: "paid-old",
      }),
    ).resolves.toMatchObject({
      ok: true,
      entitlement: { allowed: 1, active: 0, remaining: 1 },
    });
  });
});
