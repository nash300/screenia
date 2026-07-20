import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const orderStatuses = new Set([
  "quote_prepared",
  "quote_sent",
  "checkout_started",
  "paid",
  "active",
  "payment_failed",
  "disputed",
  "cancelled",
]);

const fulfillmentStatuses = new Set([
  "pending",
  "content_collection",
  "content_pending",
  "content_received",
  "preview_approved",
  "layout_started",
  "paid",
  "in_production",
  "ready_to_ship",
  "shipped",
  "completed",
  "cancelled",
  "paused",
  "active",
]);

const inventoryStatuses = new Set([
  "not_reserved",
  "ready_to_reserve",
  "reserved",
  "assigned",
  "shipped",
  "returned",
]);

type OrderUpdatePayload = {
  status?: string;
  fulfillment_status?: string;
  inventory_status?: string;
  tracking_number?: string | null;
  tracking_url?: string | null;
  reason?: string;
};

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

function cleanOptionalString(value: unknown, maxLength: number) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function getReason(value: unknown) {
  return String(value || "").trim().slice(0, 1000);
}

function validateTrackingUrl(value: string | null) {
  if (!value) return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  return Object.entries(after)
    .filter(([key, value]) => before[key] !== value)
    .map(([key]) => key);
}

function hasOwnPayloadField(
  payload: Record<string, unknown>,
  field: string,
) {
  return Object.prototype.hasOwnProperty.call(payload, field);
}

async function rollbackOrderOperation(
  orderId: string,
  fieldsChanged: string[],
  existing: Record<string, unknown>,
) {
  if (fieldsChanged.length === 0) {
    return { ok: true, error: null };
  }

  const { error } = await supabaseAdmin
    .from("customer_subscriptions")
    .update(
      Object.fromEntries(
        fieldsChanged.map((field) => [field, existing[field]]),
      ),
    )
    .eq("id", orderId);

  return { ok: !error, error };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { orderId } = await params;
  const body = (await request.json().catch(() => ({}))) as OrderUpdatePayload;
  const reason = getReason(body.reason);

  if (reason.length < 5) {
    return NextResponse.json(
      { error: "A reason of at least 5 characters is required." },
      { status: 400 },
    );
  }

  const updatePayload: Record<string, string | null> = {};

  if (body.status !== undefined) {
    const status = String(body.status || "").trim();
    if (!orderStatuses.has(status)) {
      return NextResponse.json(
        { error: "Choose a valid order status." },
        { status: 400 },
      );
    }
    updatePayload.status = status;
  }

  if (body.fulfillment_status !== undefined) {
    const fulfillmentStatus = String(body.fulfillment_status || "").trim();
    if (!fulfillmentStatuses.has(fulfillmentStatus)) {
      return NextResponse.json(
        { error: "Choose a valid fulfillment status." },
        { status: 400 },
      );
    }
    updatePayload.fulfillment_status = fulfillmentStatus;
  }

  if (body.inventory_status !== undefined) {
    const inventoryStatus = String(body.inventory_status || "").trim();
    if (!inventoryStatuses.has(inventoryStatus)) {
      return NextResponse.json(
        { error: "Choose a valid inventory status." },
        { status: 400 },
      );
    }
    updatePayload.inventory_status = inventoryStatus;
  }

  if (body.tracking_number !== undefined) {
    updatePayload.tracking_number = cleanOptionalString(
      body.tracking_number,
      160,
    );
  }

  if (body.tracking_url !== undefined) {
    const trackingUrl = cleanOptionalString(body.tracking_url, 500);
    if (!validateTrackingUrl(trackingUrl)) {
      return NextResponse.json(
        { error: "Tracking URL must start with http:// or https://." },
        { status: 400 },
      );
    }
    updatePayload.tracking_url = trackingUrl;
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json(
      { error: "No supported order fields were provided." },
      { status: 400 },
    );
  }

  if (
    (updatePayload.tracking_number || updatePayload.tracking_url) &&
    updatePayload.fulfillment_status === undefined
  ) {
    updatePayload.fulfillment_status = "shipped";
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("customer_subscriptions")
    .select(
      "id, customer_id, order_number, status, fulfillment_status, inventory_status, tracking_number, tracking_url, shipped_at, delivered_at",
    )
    .eq("id", orderId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json(
      { error: "Order was not found." },
      { status: 404 },
    );
  }

  const nextFulfillmentStatus =
    updatePayload.fulfillment_status ?? existing.fulfillment_status;
  const nextTrackingNumber = hasOwnPayloadField(
    updatePayload,
    "tracking_number",
  )
    ? updatePayload.tracking_number
    : existing.tracking_number;
  const nextTrackingUrl = hasOwnPayloadField(updatePayload, "tracking_url")
    ? updatePayload.tracking_url
    : existing.tracking_url;

  if (
    ["shipped", "completed"].includes(String(nextFulfillmentStatus || "")) &&
    !nextTrackingNumber &&
    !nextTrackingUrl
  ) {
    return NextResponse.json(
      {
        error:
          "Shipped or completed orders require tracking evidence before saving.",
      },
      { status: 400 },
    );
  }

  const operationTimestamp = new Date().toISOString();
  if (["shipped", "completed"].includes(String(nextFulfillmentStatus || ""))) {
    updatePayload.shipped_at = existing.shipped_at || operationTimestamp;
  }
  if (nextFulfillmentStatus === "completed") {
    updatePayload.delivered_at = existing.delivered_at || operationTimestamp;
  }

  const fieldsChanged = changedFields(existing, updatePayload);

  if (fieldsChanged.length === 0) {
    return NextResponse.json({ success: true, changedFields: [] });
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("customer_subscriptions")
    .update(updatePayload)
    .eq("id", existing.id)
    .select(
      "id, status, fulfillment_status, inventory_status, tracking_number, tracking_url, shipped_at, delivered_at",
    )
    .single();

  if (updateError) {
    console.error("Update order operation error:", updateError);
    return NextResponse.json(
      { error: "Could not update order operation." },
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
        eventType: "admin_order_operation_updated",
        eventDescription:
          "Admin updated order fulfillment, inventory, or tracking state.",
        metadata: {
          orderId: existing.id,
          orderNumber: existing.order_number,
          changedFields: fieldsChanged,
          before: Object.fromEntries(
            fieldsChanged.map((field) => [
              field,
              (existing as Record<string, unknown>)[field],
            ]),
          ),
          after: Object.fromEntries(
            fieldsChanged.map((field) => [field, updatePayload[field]]),
          ),
          reason,
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Order operation audit error:", auditError);
    const rollbackResult = await rollbackOrderOperation(
      existing.id,
      fieldsChanged,
      existing as Record<string, unknown>,
    );

    if (!rollbackResult.ok) {
      console.error("Order operation rollback error:", rollbackResult.error);

      try {
        await createAdminNotification(
          supabaseAdmin,
          {
            customerId: existing.customer_id,
            eventType: "admin_order_operation_rollback_failed",
            title: "Order operation rollback failed",
            message:
              "Order fulfillment, inventory, or tracking state could not be restored after audit storage failed.",
            priority: "urgent",
            metadata: {
              orderId: existing.id,
              orderNumber: existing.order_number,
              changedFields: fieldsChanged,
              before: Object.fromEntries(
                fieldsChanged.map((field) => [
                  field,
                  (existing as Record<string, unknown>)[field],
                ]),
              ),
              attemptedAfter: Object.fromEntries(
                fieldsChanged.map((field) => [field, updatePayload[field]]),
              ),
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
          "Order operation rollback failure notification error:",
          notificationError,
        );
        return NextResponse.json(
          {
            error:
              "Order operation audit failed, rollback failed, and urgent admin visibility could not be stored. Contact technical support before retrying.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          error:
            "Order operation audit failed and rollback failed. An urgent admin notification was created.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Order operation was not saved because the audit event could not be stored.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    changedFields: fieldsChanged,
    order: updated,
  });
}
