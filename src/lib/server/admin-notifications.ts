import type { SupabaseClient } from "@supabase/supabase-js";

type AdminNotificationInput = {
  customerId?: string | null;
  eventType: string;
  title: string;
  message: string;
  priority?: "low" | "normal" | "high" | "urgent";
  metadata?: Record<string, unknown>;
};

export async function createAdminNotification(
  supabaseAdmin: SupabaseClient,
  notification: AdminNotificationInput,
) {
  const { error } = await supabaseAdmin.from("admin_notifications").insert({
    customer_id: notification.customerId || null,
    event_type: notification.eventType,
    title: notification.title,
    message: notification.message,
    priority: notification.priority || "normal",
    metadata: notification.metadata || {},
  });

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      console.warn(
        "Admin notification was not stored because the table is missing. Apply the latest Supabase migrations.",
      );
      return;
    }

    console.warn("Admin notification was not stored:", error.message);
  }
}
