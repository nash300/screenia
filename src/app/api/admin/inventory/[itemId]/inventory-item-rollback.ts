import { createAdminNotification } from "@/lib/server/admin-notifications";
import { supabaseAdmin } from "@/lib/server/admin-api";
import { subscriptionStatusesForInventorySync } from "./inventory-item-policy";
export async function rollbackInventoryFields(
  itemId: string,
  fieldsChanged: string[],
  existing: Record<string, unknown>,
) {
  if (fieldsChanged.length === 0) {
    return { ok: true, errors: [] as string[] };
  }

  const { error } = await supabaseAdmin
    .from("inventory_items")
    .update(
      Object.fromEntries(
        fieldsChanged.map((field) => [field, existing[field]]),
      ),
    )
    .eq("id", itemId);

  return { ok: !error, errors: error ? [error.message] : [] };
}

export async function rollbackInventoryStatusUpdate({
  itemId,
  fieldsChanged,
  existing,
  existingDevice,
}: {
  itemId: string;
  fieldsChanged: string[];
  existing: Record<string, unknown>;
  existingDevice?: Record<string, unknown> | null;
}) {
  const rollbackResults = await Promise.allSettled([
    rollbackInventoryFields(itemId, fieldsChanged, existing),
    existingDevice
      ? supabaseAdmin
          .from("devices")
          .update({
            make: existingDevice.make,
            model: existingDevice.model,
            serial_number: existingDevice.serial_number,
            purchase_cost: existingDevice.purchase_cost,
            purchase_date: existingDevice.purchase_date,
            warranty_period_months: existingDevice.warranty_period_months,
            supplier: existingDevice.supplier,
            inventory_status: existingDevice.inventory_status,
            inventory_notes: existingDevice.inventory_notes,
            is_active: existingDevice.is_active,
          })
          .eq("id", existingDevice.id)
      : Promise.resolve({ error: null }),
  ]);

  const errors = rollbackResults
    .map((result) => {
      if (result.status === "rejected") return String(result.reason);
      if ("ok" in result.value) {
        return result.value.errors.length > 0
          ? result.value.errors.join(" | ")
          : null;
      }
      return result.value.error?.message || null;
    })
    .filter(Boolean) as string[];

  return { ok: errors.length === 0, errors };
}

export async function rollbackInventoryDeviceAllocation({
  existing,
  createdDeviceId,
  existingDevice,
  subscriptionInventory,
}: {
  existing: Record<string, unknown>;
  createdDeviceId?: string | null;
  existingDevice?: Record<string, unknown> | null;
  subscriptionInventory?: { id: string; previousStatus: string | null } | null;
}) {
  const rollbackResults = await Promise.allSettled([
    supabaseAdmin
      .from("inventory_items")
      .update({
        status: existing.status,
        condition: existing.condition,
        customer_id: existing.customer_id,
        device_id: existing.device_id,
        assigned_at: existing.assigned_at,
      })
      .eq("id", existing.id),
    createdDeviceId
      ? supabaseAdmin.from("devices").delete().eq("id", createdDeviceId)
      : Promise.resolve({ error: null }),
    existingDevice
      ? supabaseAdmin
          .from("devices")
          .update({
            customer_id: existingDevice.customer_id,
            name: existingDevice.name,
            make: existingDevice.make,
            model: existingDevice.model,
            serial_number: existingDevice.serial_number,
            purchase_cost: existingDevice.purchase_cost,
            purchase_date: existingDevice.purchase_date,
            warranty_period_months: existingDevice.warranty_period_months,
            supplier: existingDevice.supplier,
            location: existingDevice.location,
            inventory_status: existingDevice.inventory_status,
            inventory_notes: existingDevice.inventory_notes,
            is_active: existingDevice.is_active,
          })
          .eq("id", existingDevice.id)
      : Promise.resolve({ error: null }),
    subscriptionInventory
      ? supabaseAdmin
          .from("customer_subscriptions")
          .update({ inventory_status: subscriptionInventory.previousStatus })
          .eq("id", subscriptionInventory.id)
      : Promise.resolve({ error: null }),
  ]);

  const errors = rollbackResults
    .map((result) => {
      if (result.status === "rejected") return String(result.reason);
      return result.value.error?.message || null;
    })
    .filter(Boolean) as string[];

  return { ok: errors.length === 0, errors };
}

export async function assignCurrentSubscriptionInventory(customerId: string) {
  const { data: subscription, error: lookupError } = await supabaseAdmin
    .from("customer_subscriptions")
    .select("id, inventory_status")
    .eq("customer_id", customerId)
    .in("status", subscriptionStatusesForInventorySync)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (!subscription) {
    throw new Error("No current paid subscription was found for inventory synchronization.");
  }

  const previousStatus = subscription.inventory_status;
  if (previousStatus === "assigned") {
    return { id: subscription.id, previousStatus };
  }

  const { error: updateError } = await supabaseAdmin
    .from("customer_subscriptions")
    .update({ inventory_status: "assigned" })
    .eq("id", subscription.id);

  if (updateError) throw updateError;
  return { id: subscription.id, previousStatus };
}

export async function notifyInventoryRollbackFailure({
  customerId,
  eventType,
  title,
  message,
  metadata,
}: {
  customerId?: string | null;
  eventType: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
}) {
  await createAdminNotification(
    supabaseAdmin,
    {
      customerId: customerId || null,
      eventType,
      title,
      message,
      priority: "urgent",
      metadata,
    },
    { throwOnError: true },
  );
}
