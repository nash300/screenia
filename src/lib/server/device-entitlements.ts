import type { SupabaseClient } from "@supabase/supabase-js";

const billableSubscriptionStatuses = new Set([
  "active",
  "paid",
  "trialing",
  "content_received",
  "layout_started",
]);

const billableStripeStatuses = new Set(["paid", "trialing", "active"]);

const inactiveDeviceInventoryStatuses = new Set([
  "returned",
  "defective",
  "in_repair",
  "retired",
  "lost",
  "cancelled",
  "refunded",
]);

type SubscriptionRow = {
  status: string | null;
  stripe_payment_status: string | null;
  screen_quantity: number | null;
};

type DeviceRow = {
  id: string;
  inventory_status: string | null;
  is_active: boolean | null;
};

export type DeviceEntitlementSummary = {
  allowed: number;
  active: number;
  remaining: number;
};

function subscriptionIsBillable(subscription: SubscriptionRow) {
  const status = String(subscription.status || "").toLowerCase();
  const stripeStatus = String(subscription.stripe_payment_status || "").toLowerCase();

  return (
    billableSubscriptionStatuses.has(status) ||
    billableStripeStatuses.has(stripeStatus)
  );
}

function deviceCountsAgainstEntitlement(device: DeviceRow) {
  if (!device.is_active) return false;

  const inventoryStatus = String(device.inventory_status || "assigned").toLowerCase();
  return !inactiveDeviceInventoryStatuses.has(inventoryStatus);
}

export async function getCustomerDeviceEntitlement(
  supabaseAdmin: SupabaseClient,
  customerId: string,
): Promise<DeviceEntitlementSummary> {
  const [{ data: subscriptions, error: subscriptionError }, { data: devices, error: deviceError }] =
    await Promise.all([
      supabaseAdmin
        .from("customer_subscriptions")
        .select("status, stripe_payment_status, screen_quantity")
        .eq("customer_id", customerId),
      supabaseAdmin
        .from("devices")
        .select("id, inventory_status, is_active")
        .eq("customer_id", customerId),
    ]);

  if (subscriptionError) {
    throw new Error(subscriptionError.message || "Could not verify paid device entitlement.");
  }

  if (deviceError) {
    throw new Error(deviceError.message || "Could not verify existing device count.");
  }

  const allowed = ((subscriptions || []) as SubscriptionRow[])
    .filter(subscriptionIsBillable)
    .reduce((total, subscription) => {
      const quantity = Number(subscription.screen_quantity) || 0;
      return total + Math.max(0, quantity);
    }, 0);

  const active = ((devices || []) as DeviceRow[]).filter(
    deviceCountsAgainstEntitlement,
  ).length;

  return {
    allowed,
    active,
    remaining: Math.max(0, allowed - active),
  };
}

export async function assertCustomerCanReceiveDevice(
  supabaseAdmin: SupabaseClient,
  customerId: string,
) {
  const entitlement = await getCustomerDeviceEntitlement(supabaseAdmin, customerId);

  if (entitlement.allowed < 1) {
    return {
      ok: false as const,
      entitlement,
      error:
        "This customer has no paid device entitlement. Prepare and complete a subscription before allocating hardware.",
    };
  }

  if (entitlement.remaining < 1) {
    return {
      ok: false as const,
      entitlement,
      error: `This customer already has ${entitlement.active} active device(s), matching the paid quantity of ${entitlement.allowed}. Return/deactivate a device or update the subscription before allocating another one.`,
    };
  }

  return { ok: true as const, entitlement };
}
