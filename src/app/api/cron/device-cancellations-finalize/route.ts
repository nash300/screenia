import { NextResponse } from "next/server";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { recordAuditEvent } from "@/lib/server/audit";
import { supabaseAdmin } from "@/lib/server/customer-account";

export const dynamic = "force-dynamic";

type DeviceCancellationRow = {
  id: string;
  customer_id: string;
  device_id: string;
  cancellation_effective_at: string | null;
  devices?: {
    device_code: string | null;
    name: string | null;
  } | null;
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function authorizeCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) return process.env.NODE_ENV !== "production";

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("subscription_device_cancellations")
    .select("id, customer_id, device_id, cancellation_effective_at, devices(device_code, name)")
    .in("status", ["scheduled", "active_until_period_end"])
    .lte("cancellation_effective_at", now)
    .order("cancellation_effective_at", { ascending: true })
    .limit(100);

  if (error) {
    console.error("Device cancellation finalize lookup error:", error);
    return NextResponse.json(
      { error: "Could not load due device cancellations." },
      { status: 500 },
    );
  }

  const rows = ((data || []) as unknown as DeviceCancellationRow[]).map((row) => ({
    ...row,
    devices: firstRelation(row.devices),
  }));
  const results = {
    checked: rows.length,
    finalized: 0,
    failed: 0,
  };

  for (const row of rows) {
    const deviceLabel = row.devices?.name || row.devices?.device_code || row.device_id;

    try {
      const finalizedAt = new Date().toISOString();
      const [{ error: cancellationError }, { error: deviceError }] =
        await Promise.all([
          supabaseAdmin
            .from("subscription_device_cancellations")
            .update({
              status: "cancelled",
              updated_at: finalizedAt,
            })
            .eq("id", row.id),
          supabaseAdmin
            .from("devices")
            .update({ is_active: false, inventory_status: "cancelled" })
            .eq("id", row.device_id),
        ]);

      if (cancellationError) throw cancellationError;
      if (deviceError) throw deviceError;

      await Promise.all([
        recordAuditEvent(supabaseAdmin, {
          customerId: row.customer_id,
          actorType: "system",
          eventType: "customer_device_subscription_cancel_finalized",
          eventDescription:
            "Screenia finalized a selected-device cancellation after the paid access period.",
          metadata: {
            deviceCancellationId: row.id,
            deviceId: row.device_id,
            finalizedAt,
          },
        }),
        createAdminNotification(supabaseAdmin, {
          customerId: row.customer_id,
          eventType: "customer_device_subscription_cancel_finalized",
          title: "Device cancellation finalized",
          message: `${deviceLabel} was removed from active display access after the paid period.`,
          priority: "normal",
          metadata: {
            deviceCancellationId: row.id,
            deviceId: row.device_id,
            finalizedAt,
          },
        }),
      ]);

      results.finalized += 1;
    } catch (finalizeError) {
      const message =
        finalizeError instanceof Error ? finalizeError.message : String(finalizeError);

      results.failed += 1;
      await supabaseAdmin
        .from("subscription_device_cancellations")
        .update({ status: "failed" })
        .eq("id", row.id);

      await createAdminNotification(supabaseAdmin, {
        customerId: row.customer_id,
        eventType: "customer_device_subscription_cancel_finalize_failed",
        title: "Device cancellation finalization failed",
        message: `${deviceLabel} could not be finalized automatically. Review the device and customer subscription.`,
        priority: "urgent",
        metadata: {
          deviceCancellationId: row.id,
          deviceId: row.device_id,
          error: message,
        },
      });
    }
  }

  return NextResponse.json(results);
}
