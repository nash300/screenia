import type { SupabaseClient } from "@supabase/supabase-js";

type AdminNotificationInput = {
  customerId?: string | null;
  eventType: string;
  title: string;
  message: string;
  dedupeKey?: string | null;
  priority?: "low" | "normal" | "high" | "urgent";
  metadata?: Record<string, unknown>;
};

export async function createAdminNotification(
  supabaseAdmin: SupabaseClient,
  notification: AdminNotificationInput,
  options?: { throwOnError?: boolean },
) {
  const { error } = await supabaseAdmin.from("admin_notifications").insert({
    customer_id: notification.customerId || null,
    event_type: notification.eventType,
    title: notification.title,
    message: notification.message,
    dedupe_key: notification.dedupeKey || null,
    priority: notification.priority || "normal",
    metadata: notification.metadata || {},
  });

  if (error?.code === "23505" && notification.dedupeKey) {
    return;
  }

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      console.warn(
        "Admin notification was not stored because the table is missing. Apply the latest Supabase migrations.",
      );
      if (options?.throwOnError) {
        throw error;
      }
      return;
    }

    console.warn("Admin notification was not stored:", error.message);
    if (options?.throwOnError) {
      throw error;
    }
  }
}
