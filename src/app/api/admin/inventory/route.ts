import {
  getAuthenticatedAdmin,
  supabaseAdmin,
} from "@/lib/server/admin-api";
import { NextResponse } from "next/server";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";

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
const conditions = new Set([
  "new",
  "tested",
  "used",
  "returned",
  "defective",
  "repaired",
]);

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

function resolveWarrantyUntil(
  purchaseDate: string | null,
  warrantyMonths: number | null,
  explicitWarrantyUntil: string | null,
) {
  if (explicitWarrantyUntil) return explicitWarrantyUntil;
  if (!purchaseDate || !warrantyMonths) return null;

  const [year, month, day] = purchaseDate.split("-").map(Number);
  const targetMonthIndex = year * 12 + (month - 1) + warrantyMonths;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDay);

  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}

function getReason(value: unknown) {
  return String(value || "").trim().slice(0, 1000);
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

  const purchaseDate = cleanDate(body.purchase_date);
  const warrantyMonths = cleanInteger(body.warranty_period_months);
  const warrantyUntil = resolveWarrantyUntil(
    purchaseDate,
    warrantyMonths,
    cleanDate(body.warranty_until),
  );

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
      purchase_date: purchaseDate,
      warranty_period_months: warrantyMonths,
      warranty_until: warrantyUntil,
      defect_description: cleanString(body.defect_description, 1000),
      return_notes: cleanString(body.return_notes, 1000),
      notes: cleanString(body.notes, 1000),
      last_checked_at: status === "in_stock" ? new Date().toISOString() : null,
    },
  };
}

async function rollbackCreatedInventoryItem(itemId: string) {
  const { error } = await supabaseAdmin
    .from("inventory_items")
    .delete()
    .eq("id", itemId);

  return { ok: !error, error };
}

export async function POST(request: Request) {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const reason = getReason(body.reason);

  if (reason.length < 5) {
    return NextResponse.json(
      { error: "A reason of at least 5 characters is required." },
      { status: 400 },
    );
  }

  const result = buildInventoryPayload(body);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("inventory_items")
    .insert(result.payload)
    .select("id, item_code, serial_number, status")
    .single();

  if (error || !data) {
    console.error("Create inventory item error:", error);

    if (error?.code === "23505") {
      return NextResponse.json(
        {
          error:
            "This serial number is already registered. Search the hardware stock and update the existing item instead.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: error?.message || "Could not create inventory item." },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        actorType: "admin",
        actorId: user.id,
        eventType: "admin_inventory_item_created",
        eventDescription: "Admin created an inventory item.",
        metadata: {
          inventoryItemId: data.id,
          itemCode: data.item_code,
          serialNumber: data.serial_number,
          status: data.status,
          reason,
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Create inventory item audit error:", auditError);
    const rollbackResult = await rollbackCreatedInventoryItem(data.id);

    if (!rollbackResult.ok) {
      console.error("Create inventory item rollback error:", rollbackResult.error);

      try {
        await createAdminNotification(
          supabaseAdmin,
          {
            eventType: "admin_inventory_item_create_rollback_failed",
            title: "Inventory item rollback failed",
            message:
              "A newly created inventory item could not be removed after audit storage failed.",
            priority: "urgent",
            metadata: {
              inventoryItemId: data.id,
              itemCode: data.item_code,
              serialNumber: data.serial_number,
              status: data.status,
              reason,
              auditError:
                auditError instanceof Error ? auditError.message : String(auditError),
              rollbackError: rollbackResult.error
                ? rollbackResult.error.message
                : null,
            },
          },
          { throwOnError: true },
        );
      } catch (notificationError) {
        console.error(
          "Create inventory item rollback failure notification error:",
          notificationError,
        );
        return NextResponse.json(
          {
            error:
              "Inventory item audit failed, rollback failed, and urgent admin visibility could not be stored. Contact technical support before retrying.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          error:
            "Inventory item audit failed and rollback failed. An urgent admin notification was created.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Inventory item was not saved because the audit event could not be stored.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, item: data });
}
