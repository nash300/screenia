import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/server/cron-auth";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { recordAuditEvent } from "@/lib/server/audit";
import { supabaseAdmin } from "@/lib/server/customer-account";

export const dynamic = "force-dynamic";

type ExpiringDevice = {
  id: string;
  customer_id: string | null;
  device_code: string | null;
  name: string | null;
  complimentary_expires_at: string;
  inventory_notes: string | null;
};

export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("devices")
    .select(
      "id, customer_id, device_code, name, complimentary_expires_at, inventory_notes",
    )
    .eq("is_complimentary", true)
    .eq("is_active", true)
    .not("complimentary_expires_at", "is", null)
    .lte("complimentary_expires_at", now)
    .limit(100);

  if (error) {
    console.error("Complimentary screen expiry lookup error:", error);
    return NextResponse.json(
      { error: "Could not load expired complimentary screens." },
      { status: 500 },
    );
  }

  const rows = (data || []) as ExpiringDevice[];
  const results = { checked: rows.length, expired: 0, failed: 0 };

  for (const device of rows) {
    try {
      const note = `Complimentary access expired ${device.complimentary_expires_at}.`;
      const { error: updateError } = await supabaseAdmin
        .from("devices")
        .update({
          is_active: false,
          inventory_status: "expired_complimentary",
          inventory_notes: [device.inventory_notes, note].filter(Boolean).join("\n"),
        })
        .eq("id", device.id)
        .eq("is_active", true);

      if (updateError) throw updateError;

      await Promise.all([
        recordAuditEvent(supabaseAdmin, {
          customerId: device.customer_id,
          actorType: "system",
          eventType: "complimentary_screen_expired",
          eventDescription:
            "Screenia automatically deactivated an expired complimentary screen.",
          metadata: {
            deviceId: device.id,
            deviceCode: device.device_code,
            complimentaryExpiresAt: device.complimentary_expires_at,
          },
        }),
        createAdminNotification(supabaseAdmin, {
          customerId: device.customer_id,
          eventType: "complimentary_screen_expired",
          title: "Complimentary screen expired",
          message: `${device.name || device.device_code || device.id} was deactivated after its complimentary period ended.`,
          priority: "normal",
          metadata: {
            deviceId: device.id,
            deviceCode: device.device_code,
            complimentaryExpiresAt: device.complimentary_expires_at,
          },
        }),
      ]);

      results.expired += 1;
    } catch (expiryError) {
      results.failed += 1;
      console.error("Complimentary screen expiry error:", expiryError);
      await createAdminNotification(supabaseAdmin, {
        customerId: device.customer_id,
        eventType: "complimentary_screen_expiry_failed",
        title: "Complimentary screen expiry failed",
        message: `${device.name || device.device_code || device.id} could not be deactivated automatically. Review it in Displays.`,
        priority: "urgent",
        metadata: {
          deviceId: device.id,
          deviceCode: device.device_code,
          error: expiryError instanceof Error ? expiryError.message : String(expiryError),
        },
      });
    }
  }

  return NextResponse.json(results);
}
