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

async function rollbackDeviceFields(
  deviceId: string,
  fieldsChanged: string[],
  existing: Record<string, unknown>,
) {
  if (fieldsChanged.length === 0) {
    return { ok: true, errors: [] as string[] };
  }

  const { error } = await supabaseAdmin
    .from("devices")
    .update(
      Object.fromEntries(
        fieldsChanged.map((field) => [field, existing[field]]),
      ),
    )
    .eq("id", deviceId);

  return { ok: !error, errors: error ? [error.message] : [] };
}

async function notifyDeviceRollbackFailure({
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

async function getDevice(deviceId: string) {
  return supabaseAdmin
    .from("devices")
    .select(
      "id, device_code, customer_id, name, is_active, make, model, serial_number, purchase_cost, purchase_date, warranty_period_months, supplier, location, internal_notes",
    )
    .eq("id", deviceId)
    .single();
}

type PlaylistSnapshot = {
  id: string;
  device_id: string;
  video_id: string | null;
  type: string | null;
  src: string | null;
  order_index: number | null;
};

async function rollbackDeletedDevice(
  device: Record<string, unknown>,
  playlists: PlaylistSnapshot[],
) {
  const deviceRestore = await supabaseAdmin.from("devices").insert({
    id: device.id,
    customer_id: device.customer_id,
    name: device.name,
    is_active: device.is_active,
    make: device.make,
    model: device.model,
    serial_number: device.serial_number,
    purchase_cost: device.purchase_cost,
    purchase_date: device.purchase_date,
    warranty_period_months: device.warranty_period_months,
    supplier: device.supplier,
    location: device.location,
    internal_notes: device.internal_notes,
  });

  const errors = deviceRestore.error ? [deviceRestore.error.message] : [];

  if (!deviceRestore.error && playlists.length > 0) {
    const playlistRestore = await supabaseAdmin.from("playlists").insert(playlists);
    if (playlistRestore.error) errors.push(playlistRestore.error.message);
  }

  return { ok: errors.length === 0, errors };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { deviceId } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "update_details");
  const reason = getReason(body.reason);

  if (reason.length < 5) {
    return NextResponse.json(
      { error: "A reason of at least 5 characters is required." },
      { status: 400 },
    );
  }

  const { data: existing, error: existingError } = await getDevice(deviceId);

  if (existingError || !existing) {
    return NextResponse.json({ error: "Device was not found." }, { status: 404 });
  }

  let updatePayload: Record<string, string | number | boolean | null> = {};
  let eventType = "admin_device_details_updated";
  let eventDescription = "Admin updated display device details.";

  if (action === "rename") {
    const name = cleanString(body.name, 160);

    if (!name) {
      return NextResponse.json(
        { error: "Device name is required." },
        { status: 400 },
      );
    }

    updatePayload = { name };
    eventType = "admin_device_renamed";
    eventDescription = "Admin renamed a display device.";
  } else if (action === "set_active") {
    updatePayload = { is_active: Boolean(body.is_active) };
    eventType = updatePayload.is_active
      ? "admin_device_activated"
      : "admin_device_deactivated";
    eventDescription = updatePayload.is_active
      ? "Admin activated a display device."
      : "Admin deactivated a display device.";
  } else if (action === "update_details") {
    updatePayload = {
      make: cleanString(body.make, 120),
      model: cleanString(body.model, 120),
      serial_number: cleanString(body.serial_number, 160),
      location: cleanString(body.location, 200),
      purchase_cost: cleanNumber(body.purchase_cost),
      purchase_date: cleanDate(body.purchase_date),
      warranty_period_months: cleanInteger(body.warranty_period_months),
      supplier: cleanString(body.supplier, 160),
      internal_notes: cleanString(body.internal_notes, 1000),
    };
  } else {
    return NextResponse.json(
      { error: "Unsupported device action." },
      { status: 400 },
    );
  }

  const fieldsChanged = changedFields(existing, updatePayload);

  if (fieldsChanged.length === 0) {
    return NextResponse.json({ success: true, changedFields: [] });
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("devices")
    .update(updatePayload)
    .eq("id", existing.id)
    .select("id, device_code, customer_id, name, is_active")
    .single();

  if (updateError || !updated) {
    console.error("Update device error:", updateError);
    return NextResponse.json(
      { error: updateError?.message || "Could not update device." },
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
        eventType,
        eventDescription,
        metadata: {
          deviceId: existing.id,
          deviceCode: existing.device_code,
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
    console.error("Device update audit error:", auditError);
    const rollbackResult = await rollbackDeviceFields(
      existing.id,
      fieldsChanged,
      existing as Record<string, unknown>,
    );

    if (!rollbackResult.ok) {
      console.error("Device update rollback error:", rollbackResult.errors);

      try {
        await notifyDeviceRollbackFailure({
          customerId: existing.customer_id,
          eventType: "admin_device_update_rollback_failed",
          title: "Device update rollback failed",
          message:
            "Display device fields could not be restored after audit storage failed.",
          metadata: {
            deviceId: existing.id,
            deviceCode: existing.device_code,
            changedFields: fieldsChanged,
            attemptedEventType: eventType,
            reason,
            auditError:
              auditError instanceof Error ? auditError.message : String(auditError),
            rollbackErrors: rollbackResult.errors,
          },
        });
      } catch (notificationError) {
        console.error(
          "Device update rollback failure notification error:",
          notificationError,
        );
        return NextResponse.json(
          {
            error:
              "Device update audit failed, rollback failed, and urgent admin visibility could not be stored. Contact technical support before retrying.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          error:
            "Device update audit failed and rollback failed. An urgent admin notification was created.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Device update was not saved because the audit event could not be stored.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    changedFields: fieldsChanged,
    device: updated,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { deviceId } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const reason = getReason(body.reason);

  if (reason.length < 5) {
    return NextResponse.json(
      { error: "A reason of at least 5 characters is required." },
      { status: 400 },
    );
  }

  const { data: existing, error: existingError } = await getDevice(deviceId);

  if (existingError || !existing) {
    return NextResponse.json({ error: "Device was not found." }, { status: 404 });
  }

  const { data: playlistsBeforeDelete, error: playlistSnapshotError } =
    await supabaseAdmin
      .from("playlists")
      .select("id, device_id, video_id, type, src, order_index")
      .eq("device_id", existing.id);

  if (playlistSnapshotError) {
    console.error("Load device playlists before delete error:", playlistSnapshotError);
    return NextResponse.json(
      { error: "Could not verify device playlist before deletion." },
      { status: 500 },
    );
  }

  const { error: playlistError } = await supabaseAdmin
    .from("playlists")
    .delete()
    .eq("device_id", existing.id);

  if (playlistError) {
    console.error("Delete device playlists error:", playlistError);
    return NextResponse.json(
      { error: "Could not delete device playlist." },
      { status: 500 },
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from("devices")
    .delete()
    .eq("id", existing.id);

  if (deleteError) {
    console.error("Delete device error:", deleteError);
    return NextResponse.json(
      { error: "Could not delete device." },
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
        eventType: "admin_device_deleted",
        eventDescription: "Admin deleted a display device and its playlist.",
        metadata: {
          deviceId: existing.id,
          deviceCode: existing.device_code,
          deviceName: existing.name,
          wasActive: existing.is_active,
          removedPlaylistCount: playlistsBeforeDelete?.length || 0,
          reason,
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Device deletion audit error:", auditError);
    const rollbackResult = await rollbackDeletedDevice(
      existing as Record<string, unknown>,
      (playlistsBeforeDelete || []) as PlaylistSnapshot[],
    );

    if (!rollbackResult.ok) {
      console.error("Device deletion rollback error:", rollbackResult.errors);

      try {
        await notifyDeviceRollbackFailure({
          customerId: existing.customer_id,
          eventType: "admin_device_delete_rollback_failed",
          title: "Device deletion rollback failed",
          message:
            "A display device and its playlist could not be restored after deletion audit storage failed.",
          metadata: {
            deviceId: existing.id,
            deviceCode: existing.device_code,
            deviceName: existing.name,
            removedPlaylistCount: playlistsBeforeDelete?.length || 0,
            reason,
            auditError:
              auditError instanceof Error ? auditError.message : String(auditError),
            rollbackErrors: rollbackResult.errors,
          },
        });
      } catch (notificationError) {
        console.error(
          "Device deletion rollback failure notification error:",
          notificationError,
        );
        return NextResponse.json(
          {
            error:
              "Device deletion audit failed, rollback failed, and urgent admin visibility could not be stored. Contact technical support before retrying.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          error:
            "Device deletion audit failed and rollback failed. An urgent admin notification was created.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Device deletion was not saved because the audit event could not be stored.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
