import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { assertCustomerCanReceiveDevice } from "@/lib/server/device-entitlements";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const itemTypes = new Set(["standard_fhd", "premium_4k", "spare", "other"]);
const statuses = new Set([
  "in_stock",
  "reserved",
  "assigned",
  "shipped",
  "returned",
  "defective",
  "in_repair",
  "retired",
  "lost",
]);
const statusesThatReleaseLinkedDevice = new Set([
  "in_stock",
  "returned",
  "defective",
  "in_repair",
  "retired",
  "lost",
]);
const conditions = new Set([
  "new",
  "tested",
  "used",
  "returned",
  "defective",
  "repaired",
]);

async function getAuthenticatedAdmin() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.app_metadata?.role === "admin" ? user : null;
}

function cleanString(value: unknown, maxLength: number) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function cleanNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return Math.max(0, numericValue);
}

function cleanInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return Math.max(0, Math.round(numericValue));
}

function cleanDate(value: unknown) {
  const date = cleanString(value, 20);
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function getReason(value: unknown) {
  return String(value || "").trim().slice(0, 1000);
}

function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  return Object.entries(after)
    .filter(([key, value]) => before[key] !== value)
    .map(([key]) => key);
}

async function rollbackInventoryFields(
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

async function rollbackInventoryStatusUpdate({
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

async function rollbackInventoryDeviceAllocation({
  existing,
  createdDeviceId,
  existingDevice,
}: {
  existing: Record<string, unknown>;
  createdDeviceId?: string | null;
  existingDevice?: Record<string, unknown> | null;
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
            make: existingDevice.make,
            model: existingDevice.model,
            serial_number: existingDevice.serial_number,
            purchase_cost: existingDevice.purchase_cost,
            purchase_date: existingDevice.purchase_date,
            warranty_period_months: existingDevice.warranty_period_months,
            supplier: existingDevice.supplier,
            inventory_status: existingDevice.inventory_status,
            inventory_notes: existingDevice.inventory_notes,
          })
          .eq("id", existingDevice.id)
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

async function notifyInventoryRollbackFailure({
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

function buildInventoryPayload(body: Record<string, unknown>) {
  const itemType = String(body.item_type || "standard_fhd").trim();
  const status = String(body.status || "in_stock").trim();
  const condition = String(body.condition || "new").trim();

  if (!itemTypes.has(itemType)) {
    return { error: "Choose a valid item type." };
  }

  if (!statuses.has(status)) {
    return { error: "Choose a valid stock status." };
  }

  if (!conditions.has(condition)) {
    return { error: "Choose a valid stock condition." };
  }

  const serialNumber = cleanString(body.serial_number, 160);

  if (!serialNumber) {
    return { error: "Serial number is required." };
  }

  return {
    payload: {
      item_type: itemType,
      status,
      condition,
      make: cleanString(body.make, 120),
      model: cleanString(body.model, 120),
      serial_number: serialNumber,
      seller: cleanString(body.seller, 160),
      invoice_number: cleanString(body.invoice_number, 120),
      purchase_cost: cleanNumber(body.purchase_cost),
      purchase_currency: "sek",
      purchase_date: cleanDate(body.purchase_date),
      warranty_period_months: cleanInteger(body.warranty_period_months),
      warranty_until: cleanDate(body.warranty_until),
      defect_description: cleanString(body.defect_description, 1000),
      return_notes: cleanString(body.return_notes, 1000),
      notes: cleanString(body.notes, 1000),
      last_checked_at: status === "in_stock" ? new Date().toISOString() : null,
    },
  };
}

async function getInventoryItem(itemId: string) {
  return supabaseAdmin
    .from("inventory_items")
    .select(
      "id, item_code, item_type, status, condition, make, model, serial_number, seller, invoice_number, purchase_cost, purchase_currency, purchase_date, warranty_period_months, warranty_until, customer_id, device_id, assigned_at, defect_description, return_notes, notes",
    )
    .eq("id", itemId)
    .single();
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { itemId } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "update_item");
  const reason = getReason(body.reason);

  if (reason.length < 5) {
    return NextResponse.json(
      { error: "A reason of at least 5 characters is required." },
      { status: 400 },
    );
  }

  const { data: existing, error: existingError } = await getInventoryItem(itemId);

  if (existingError || !existing) {
    return NextResponse.json(
      { error: "Inventory item was not found." },
      { status: 404 },
    );
  }

  if (action === "update_item") {
    const result = buildInventoryPayload(body);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const fieldsChanged = changedFields(existing, result.payload);

    if (fieldsChanged.length === 0) {
      return NextResponse.json({ success: true, changedFields: [] });
    }

    const { error } = await supabaseAdmin
      .from("inventory_items")
      .update(result.payload)
      .eq("id", existing.id);

    if (error) {
      console.error("Update inventory item error:", error);
      return NextResponse.json(
        { error: error.message || "Could not update inventory item." },
        { status: 500 },
      );
    }

    try {
      await recordAuditEvent(
        supabaseAdmin,
        {
          customerId: existing.customer_id,
          actorType: "admin",
          actorId: user.id,
          eventType: "admin_inventory_item_updated",
          eventDescription: "Admin updated inventory item details.",
          metadata: {
            inventoryItemId: existing.id,
            itemCode: existing.item_code,
            changedFields: fieldsChanged,
            reason,
          },
          ipAddress: getRequestIp(request),
          userAgent: request.headers.get("user-agent"),
        },
        { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Inventory item update audit error:", auditError);
      const rollbackResult = await rollbackInventoryFields(
        existing.id,
        fieldsChanged,
        existing as Record<string, unknown>,
      );

      if (!rollbackResult.ok) {
        console.error("Inventory item update rollback error:", rollbackResult.errors);
        try {
          await notifyInventoryRollbackFailure({
            customerId: existing.customer_id,
            eventType: "admin_inventory_item_update_rollback_failed",
            title: "Inventory item update rollback failed",
            message:
              "Inventory item details could not be restored after audit storage failed.",
            metadata: {
              inventoryItemId: existing.id,
              itemCode: existing.item_code,
              changedFields: fieldsChanged,
              reason,
              auditError:
                auditError instanceof Error ? auditError.message : String(auditError),
              rollbackErrors: rollbackResult.errors,
            },
          });
        } catch (notificationError) {
          console.error(
            "Inventory item update rollback failure notification error:",
            notificationError,
          );
          return NextResponse.json(
            {
              error:
                "Inventory item update audit failed, rollback failed, and urgent admin visibility could not be stored. Contact technical support before retrying.",
            },
            { status: 500 },
          );
        }

        return NextResponse.json(
          {
            error:
              "Inventory item update audit failed and rollback failed. An urgent admin notification was created.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          error:
            "Inventory item update was not saved because the audit event could not be stored.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, changedFields: fieldsChanged });
  }

  if (action === "update_status") {
    const status = String(body.status || "").trim();
    const condition = String(body.condition || existing.condition || "").trim();

    if (!statuses.has(status)) {
      return NextResponse.json(
        { error: "Choose a valid stock status." },
        { status: 400 },
      );
    }

    if (!conditions.has(condition)) {
      return NextResponse.json(
        { error: "Choose a valid stock condition." },
        { status: 400 },
      );
    }

    const timestamp = new Date().toISOString();
    const payload: Record<string, string | null> = {
      status,
      condition,
    };

    if (body.customer_id !== undefined) {
      payload.customer_id = cleanString(body.customer_id, 80);
    }
    if (body.return_notes !== undefined) {
      payload.return_notes = cleanString(body.return_notes, 1000);
    }
    if (body.defect_description !== undefined) {
      payload.defect_description = cleanString(body.defect_description, 1000);
    }
    const shouldReleaseLinkedDevice =
      Boolean(existing.device_id) && statusesThatReleaseLinkedDevice.has(status);
    let existingDevice: Record<string, unknown> | null = null;

    if (shouldReleaseLinkedDevice) {
      payload.customer_id = null;
      payload.device_id = null;
      payload.assigned_at = null;
    }

    if (status === "returned") payload.returned_at = timestamp;
    if (status === "shipped") payload.shipped_at = timestamp;
    if (status === "in_stock") payload.last_checked_at = timestamp;

    const fieldsChanged = changedFields(existing, payload);

    if (fieldsChanged.length === 0) {
      return NextResponse.json({ success: true, changedFields: [] });
    }

    if (shouldReleaseLinkedDevice) {
      const { data: linkedDevice, error: linkedDeviceError } = await supabaseAdmin
        .from("devices")
        .select(
          "id, make, model, serial_number, purchase_cost, purchase_date, warranty_period_months, supplier, inventory_status, inventory_notes, is_active",
        )
        .eq("id", existing.device_id)
        .single();

      if (linkedDeviceError || !linkedDevice) {
        return NextResponse.json(
          { error: "Linked device could not be found before updating inventory." },
          { status: 500 },
        );
      }

      existingDevice = linkedDevice as Record<string, unknown>;
    }

    const { error } = await supabaseAdmin
      .from("inventory_items")
      .update(payload)
      .eq("id", existing.id);

    if (error) {
      console.error("Update inventory status error:", error);
      return NextResponse.json(
        { error: "Could not update inventory status." },
        { status: 500 },
      );
    }

    if (shouldReleaseLinkedDevice && existingDevice) {
      const { error: deviceUpdateError } = await supabaseAdmin
        .from("devices")
        .update({
          is_active: false,
          inventory_status: status,
          inventory_notes: `Released from inventory item ${existing.item_code}: ${reason}`,
        })
        .eq("id", existingDevice.id);

      if (deviceUpdateError) {
        console.error("Inventory linked device release error:", deviceUpdateError);
        const rollbackResult = await rollbackInventoryFields(
          existing.id,
          fieldsChanged,
          existing as Record<string, unknown>,
        );

        return NextResponse.json(
          {
            error: rollbackResult.ok
              ? "Inventory status was not saved because the linked device could not be released."
              : "Inventory status was saved, but linked device release and inventory rollback failed. Contact technical support before retrying.",
          },
          { status: 500 },
        );
      }
    }

    try {
      await recordAuditEvent(
        supabaseAdmin,
        {
          customerId: existing.customer_id,
          actorType: "admin",
          actorId: user.id,
          eventType: "admin_inventory_status_updated",
          eventDescription: "Admin updated inventory item status.",
          metadata: {
            inventoryItemId: existing.id,
            itemCode: existing.item_code,
            fromStatus: existing.status,
            toStatus: status,
            releasedDeviceId: shouldReleaseLinkedDevice
              ? existing.device_id
              : null,
            changedFields: fieldsChanged,
            reason,
          },
          ipAddress: getRequestIp(request),
          userAgent: request.headers.get("user-agent"),
        },
        { throwOnError: true },
      );
  } catch (auditError) {
    console.error("Inventory status update audit error:", auditError);
      const rollbackResult = await rollbackInventoryStatusUpdate({
        itemId: existing.id,
        fieldsChanged,
        existing: existing as Record<string, unknown>,
        existingDevice,
      });

      if (!rollbackResult.ok) {
        console.error("Inventory status update rollback error:", rollbackResult.errors);
        try {
          await notifyInventoryRollbackFailure({
            customerId: existing.customer_id,
            eventType: "admin_inventory_status_update_rollback_failed",
            title: "Inventory status rollback failed",
            message:
              "Inventory status could not be restored after audit storage failed.",
            metadata: {
              inventoryItemId: existing.id,
              itemCode: existing.item_code,
              changedFields: fieldsChanged,
              fromStatus: existing.status,
              attemptedStatus: status,
              reason,
              auditError:
                auditError instanceof Error ? auditError.message : String(auditError),
              rollbackErrors: rollbackResult.errors,
            },
          });
        } catch (notificationError) {
          console.error(
            "Inventory status update rollback failure notification error:",
            notificationError,
          );
          return NextResponse.json(
            {
              error:
                "Inventory status update audit failed, rollback failed, and urgent admin visibility could not be stored. Contact technical support before retrying.",
            },
            { status: 500 },
          );
        }

        return NextResponse.json(
          {
            error:
              "Inventory status update audit failed and rollback failed. An urgent admin notification was created.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          error:
            "Inventory status update was not saved because the audit event could not be stored.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, changedFields: fieldsChanged });
  }

  if (action === "allocate_new_device") {
    const customerId = cleanString(body.customer_id, 80);

    if (existing.status !== "in_stock") {
      return NextResponse.json(
        { error: "Only in-stock inventory items can be allocated." },
        { status: 400 },
      );
    }

    if (!customerId) {
      return NextResponse.json(
        { error: "Select a customer before allocation." },
        { status: 400 },
      );
    }

    if (existing.device_id) {
      return NextResponse.json(
        { error: "This inventory item is already linked to a device." },
        { status: 400 },
      );
    }

    const entitlement = await assertCustomerCanReceiveDevice(
      supabaseAdmin,
      customerId,
    ).catch((error) => ({
      ok: false as const,
      entitlement: null,
      error:
        error instanceof Error
          ? error.message
          : "Could not verify paid device entitlement.",
    }));

    if (!entitlement.ok) {
      return NextResponse.json(
        { error: entitlement.error, entitlement: entitlement.entitlement },
        { status: 400 },
      );
    }

    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id, name")
      .eq("id", customerId)
      .single();
    const deviceName = `${String(existing.item_type || "Device").replace(/_/g, " ")} - ${
      customer?.name || "Customer screen"
    }`;
    const { data: device, error: deviceError } = await supabaseAdmin
      .from("devices")
      .insert({
        id: crypto.randomUUID(),
        customer_id: customerId,
        name: deviceName,
        make: existing.make,
        model: existing.model,
        serial_number: existing.serial_number,
        purchase_cost: existing.purchase_cost,
        purchase_date: existing.purchase_date,
        warranty_period_months: existing.warranty_period_months,
        supplier: existing.seller,
        location: cleanString(body.location, 200),
        inventory_status: "assigned",
        inventory_notes: existing.notes,
        is_active: true,
      })
      .select("id, device_code")
      .single();

    if (deviceError || !device) {
      console.error("Allocate inventory device error:", deviceError);
      return NextResponse.json(
        { error: deviceError?.message || "Could not create device." },
        { status: 500 },
      );
    }

    const { error: inventoryError } = await supabaseAdmin
      .from("inventory_items")
      .update({
        status: "assigned",
        condition: existing.condition === "new" ? "tested" : existing.condition,
        customer_id: customerId,
        device_id: device.id,
        assigned_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (inventoryError) {
      console.error("Allocate inventory update error:", inventoryError);
      await supabaseAdmin.from("devices").delete().eq("id", device.id);
      return NextResponse.json(
        {
          error:
            "Device was created, but inventory could not be linked. Check the device manager.",
        },
        { status: 500 },
      );
    }

    try {
      await recordAuditEvent(
        supabaseAdmin,
        {
          customerId,
          actorType: "admin",
          actorId: user.id,
          eventType: "admin_inventory_allocated_to_new_device",
          eventDescription: "Admin allocated an inventory item to a new device.",
          metadata: {
            inventoryItemId: existing.id,
            itemCode: existing.item_code,
            deviceId: device.id,
            deviceCode: device.device_code,
            reason,
          },
          ipAddress: getRequestIp(request),
          userAgent: request.headers.get("user-agent"),
        },
        { throwOnError: true },
      );
  } catch (auditError) {
    console.error("Inventory allocation audit error:", auditError);
      const rollbackResult = await rollbackInventoryDeviceAllocation({
        existing: existing as Record<string, unknown>,
        createdDeviceId: device.id,
      });

      if (!rollbackResult.ok) {
        console.error("Inventory allocation rollback error:", rollbackResult.errors);
        try {
          await notifyInventoryRollbackFailure({
            customerId,
            eventType: "admin_inventory_allocation_rollback_failed",
            title: "Inventory allocation rollback failed",
            message:
              "Inventory allocation to a new device could not be fully restored after audit storage failed.",
            metadata: {
              inventoryItemId: existing.id,
              itemCode: existing.item_code,
              deviceId: device.id,
              deviceCode: device.device_code,
              reason,
              auditError:
                auditError instanceof Error ? auditError.message : String(auditError),
              rollbackErrors: rollbackResult.errors,
            },
          });
        } catch (notificationError) {
          console.error(
            "Inventory allocation rollback failure notification error:",
            notificationError,
          );
          return NextResponse.json(
            {
              error:
                "Inventory allocation audit failed, rollback failed, and urgent admin visibility could not be stored. Contact technical support before retrying.",
            },
            { status: 500 },
          );
        }

        return NextResponse.json(
          {
            error:
              "Inventory allocation audit failed and rollback failed. An urgent admin notification was created.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          error:
            "Inventory allocation was not saved because the audit event could not be stored.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, device });
  }

  if (action === "link_existing_device") {
    const deviceId = cleanString(body.device_id, 80);

    if (existing.status !== "in_stock") {
      return NextResponse.json(
        { error: "Only in-stock inventory items can be linked to a device." },
        { status: 400 },
      );
    }

    if (!deviceId) {
      return NextResponse.json(
        { error: "Select an existing device to link." },
        { status: 400 },
      );
    }

    if (existing.device_id) {
      return NextResponse.json(
        { error: "This inventory item is already linked to a device." },
        { status: 400 },
      );
    }

    const { data: device, error: deviceLookupError } = await supabaseAdmin
      .from("devices")
      .select(
        "id, device_code, customer_id, make, model, serial_number, purchase_cost, purchase_date, warranty_period_months, supplier, inventory_status, inventory_notes",
      )
      .eq("id", deviceId)
      .single();

    if (deviceLookupError || !device) {
      return NextResponse.json(
        { error: "Selected device was not found." },
        { status: 404 },
      );
    }

    const { error: inventoryError } = await supabaseAdmin
      .from("inventory_items")
      .update({
        status: "assigned",
        condition: existing.condition === "new" ? "tested" : existing.condition,
        customer_id: device.customer_id,
        device_id: device.id,
        assigned_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (inventoryError) {
      console.error("Link inventory device error:", inventoryError);
      return NextResponse.json(
        { error: "Could not link inventory to device." },
        { status: 500 },
      );
    }

    const { error: deviceUpdateError } = await supabaseAdmin
      .from("devices")
      .update({
        make: existing.make,
        model: existing.model,
        serial_number: existing.serial_number || device.serial_number,
        purchase_cost: existing.purchase_cost,
        purchase_date: existing.purchase_date,
        warranty_period_months: existing.warranty_period_months,
        supplier: existing.seller,
        inventory_status: "assigned",
        inventory_notes: existing.notes,
      })
      .eq("id", device.id);

    if (deviceUpdateError) {
      console.warn("Linked inventory, but device details were not copied.", deviceUpdateError);
    }

    try {
      await recordAuditEvent(
        supabaseAdmin,
        {
          customerId: device.customer_id,
          actorType: "admin",
          actorId: user.id,
          eventType: "admin_inventory_linked_to_existing_device",
          eventDescription: "Admin linked an inventory item to an existing device.",
          metadata: {
            inventoryItemId: existing.id,
            itemCode: existing.item_code,
            deviceId: device.id,
            deviceCode: device.device_code,
            deviceDetailsCopied: !deviceUpdateError,
            reason,
          },
          ipAddress: getRequestIp(request),
          userAgent: request.headers.get("user-agent"),
        },
        { throwOnError: true },
      );
  } catch (auditError) {
    console.error("Inventory device link audit error:", auditError);
      const rollbackResult = await rollbackInventoryDeviceAllocation({
        existing: existing as Record<string, unknown>,
        existingDevice: device as Record<string, unknown>,
      });

      if (!rollbackResult.ok) {
        console.error("Inventory device link rollback error:", rollbackResult.errors);
        try {
          await notifyInventoryRollbackFailure({
            customerId: device.customer_id,
            eventType: "admin_inventory_device_link_rollback_failed",
            title: "Inventory device link rollback failed",
            message:
              "Inventory link to an existing device could not be fully restored after audit storage failed.",
            metadata: {
              inventoryItemId: existing.id,
              itemCode: existing.item_code,
              deviceId: device.id,
              deviceCode: device.device_code,
              deviceDetailsCopied: !deviceUpdateError,
              reason,
              auditError:
                auditError instanceof Error ? auditError.message : String(auditError),
              rollbackErrors: rollbackResult.errors,
            },
          });
        } catch (notificationError) {
          console.error(
            "Inventory device link rollback failure notification error:",
            notificationError,
          );
          return NextResponse.json(
            {
              error:
                "Inventory device link audit failed, rollback failed, and urgent admin visibility could not be stored. Contact technical support before retrying.",
            },
            { status: 500 },
          );
        }

        return NextResponse.json(
          {
            error:
              "Inventory device link audit failed and rollback failed. An urgent admin notification was created.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          error:
            "Inventory device link was not saved because the audit event could not be stored.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, device });
  }

  return NextResponse.json(
    { error: "Unsupported inventory action." },
    { status: 400 },
  );
}
