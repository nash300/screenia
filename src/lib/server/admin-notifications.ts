import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeHtml, renderBrandedEmail, sendTransactionalEmail } from "@/lib/server/email";

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
        "Admin notification could not be stored because setup is incomplete.",
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

  if (!error) {
    await sendAdminMilestoneEmail(notification).catch((emailError) => {
      console.warn("Admin milestone email was not sent:", emailError);
    });
  }
}

const emailEventPattern = /checkout_started|payment_completed|payment_failed|activated|uploaded|submitted|content_received|message|shipped|review|failed/i;

async function sendAdminMilestoneEmail(notification: AdminNotificationInput) {
  const recipients = (process.env.SCREENIA_ADMIN_NOTIFICATION_EMAILS || process.env.ADMIN_NOTIFICATION_EMAILS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!recipients.length || !emailEventPattern.test(notification.eventType)) return;

  const metadata = Object.entries(notification.metadata || {})
    .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
    .map(([key, value]) => `<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(value))}</li>`)
    .join("");
  const html = renderBrandedEmail({
    eyebrow: "Adminavisering",
    title: notification.title,
    intro: notification.message,
    showHelper: false,
    children: `<p><strong>Prioritet:</strong> ${escapeHtml(notification.priority || "normal")}</p>${metadata ? `<ul>${metadata}</ul>` : ""}`,
    footer: "Screenia Admin",
  });

  await Promise.all(recipients.map((to) => sendTransactionalEmail({
    to,
    subject: `[Screenia] ${notification.title}`,
    text: `${notification.title}\n\n${notification.message}`,
    html,
  })));
}
