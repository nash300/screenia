import {
  getAuthenticatedAdmin,
  supabaseAdmin,
} from "@/lib/server/admin-api";
import { NextResponse } from "next/server";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

type NotificationRollback =
  | { mode: "bulk"; ids: string[] }
  | { mode: "single"; id: string; previousReadAt: string | null }
  | null;

async function rollbackNotificationAcknowledgement(rollback: NotificationRollback) {
  if (!rollback) {
    return { ok: true, error: null };
  }

  if (rollback.mode === "bulk") {
    if (rollback.ids.length === 0) {
      return { ok: true, error: null };
    }

    const { error } = await supabaseAdmin
      .from("admin_notifications")
      .update({ read_at: null })
      .in("id", rollback.ids);

    return { ok: !error, error };
  }

  const { error } = await supabaseAdmin
    .from("admin_notifications")
    .update({ read_at: rollback.previousReadAt })
    .eq("id", rollback.id);

  return { ok: !error, error };
}

export async function PATCH(request: Request) {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "").trim();
  const notificationId = String(body.notificationId || "").trim();
  const adminReason = String(body.reason || "").trim();
  const now = new Date().toISOString();

  if (!["mark_read", "mark_unread", "mark_all_read"].includes(action)) {
    return noStoreJson(
      { error: "Unsupported notification action." },
      { status: 400 },
    );
  }

  if (action !== "mark_all_read" && !notificationId) {
    return noStoreJson(
      { error: "Notification ID is required." },
      { status: 400 },
    );
  }

  if (action === "mark_all_read" && adminReason.length < 5) {
    return noStoreJson(
      {
        error:
          "A reason of at least 5 characters is required before bulk acknowledging notifications.",
      },
      { status: 400 },
    );
  }

  const updatePayload = {
    read_at: action === "mark_unread" ? null : now,
  };

  let updatedCount = 0;
  let auditMetadata: Record<string, unknown> = {
    action,
    reason: adminReason || null,
  };
  let rollback: NotificationRollback = null;

  if (action === "mark_all_read") {
    const { data, error } = await supabaseAdmin
      .from("admin_notifications")
      .update(updatePayload)
      .is("read_at", null)
      .select("id, priority, event_type");

    if (error) {
      console.error("Mark all notifications read error:", error);
      return noStoreJson(
        { error: "Could not update notifications." },
        { status: 500 },
      );
    }

    updatedCount = data?.length || 0;
    rollback = { mode: "bulk", ids: (data || []).map((item) => item.id) };
    auditMetadata = {
      ...auditMetadata,
      reason: adminReason,
      updatedCount,
      urgentCount: (data || []).filter((item) => item.priority === "urgent")
        .length,
      eventTypes: Array.from(new Set((data || []).map((item) => item.event_type))),
    };
  } else {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("admin_notifications")
      .select("id, customer_id, priority, event_type, read_at")
      .eq("id", notificationId)
      .single();

    if (existingError || !existing) {
      console.error("Load notification before update error:", existingError);
      return noStoreJson(
        { error: "Could not update notification." },
        { status: 500 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("admin_notifications")
      .update(updatePayload)
      .eq("id", notificationId)
      .select("id, customer_id, priority, event_type, read_at")
      .single();

    if (error || !data) {
      console.error("Update notification error:", error);
      return noStoreJson(
        { error: "Could not update notification." },
        { status: 500 },
      );
    }

    updatedCount = 1;
    rollback = {
      mode: "single",
      id: data.id,
      previousReadAt: existing.read_at,
    };
    auditMetadata = {
      ...auditMetadata,
      notificationId: data.id,
      customerId: data.customer_id || null,
      priority: data.priority,
      eventType: data.event_type,
      previousReadAt: existing.read_at,
      readAt: data.read_at,
    };
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        actorType: "admin",
        actorId: user.id,
        eventType: "admin_notification_acknowledged",
        eventDescription: "Admin updated notification read state.",
        metadata: auditMetadata,
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Admin notification acknowledgement audit error:", auditError);

    const rollbackResult = await rollbackNotificationAcknowledgement(rollback);

    if (!rollbackResult.ok) {
      console.error(
        "Admin notification acknowledgement rollback error:",
        rollbackResult.error,
      );

      try {
        await createAdminNotification(
          supabaseAdmin,
          {
            eventType: "admin_notification_acknowledgement_rollback_failed",
            title: "Notification acknowledgement rollback failed",
            message:
              "Admin notification read state could not be restored after acknowledgement audit storage failed.",
            priority: "urgent",
            metadata: {
              action,
              notificationId: notificationId || null,
              updatedCount,
              rollbackMode: rollback?.mode || null,
              rollbackIds: rollback?.mode === "bulk" ? rollback.ids : [],
              rollbackNotificationId:
                rollback?.mode === "single" ? rollback.id : null,
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
          "Admin notification acknowledgement rollback failure notification error:",
          notificationError,
        );
        return noStoreJson(
          {
            error:
              "Notification state audit failed, rollback failed, and urgent admin visibility could not be stored. Contact technical support before retrying.",
          },
          { status: 500 },
        );
      }

      return noStoreJson(
        {
          error:
            "Notification state audit failed and rollback failed. An urgent admin notification was created.",
        },
        { status: 500 },
      );
    }

    return noStoreJson(
      {
        error:
          "Notification state was not saved because the audit event could not be stored.",
      },
      { status: 500 },
    );
  }

  return noStoreJson({ success: true, updatedCount });
}
