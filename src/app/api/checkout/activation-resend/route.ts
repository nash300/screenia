import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { supabaseAdmin } from "@/lib/server/admin-api";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { isValidEmailAddress } from "@/lib/validation/email";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const orderId = String(body.orderId || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const generic = { success: true, message: "Om ordern är betald skickas en ny aktiveringslänk." };

  if (!orderId || !isValidEmailAddress(email)) return NextResponse.json(generic);

  const { data: order } = await supabaseAdmin
    .from("checkout_orders")
    .select("id, customer_id, status")
    .eq("id", orderId)
    .in("status", ["activation_pending", "content_pending", "materials_submitted"])
    .maybeSingle();
  if (!order) return NextResponse.json(generic);

  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("email")
    .eq("id", order.customer_id)
    .maybeSingle();
  if (!customer?.email || customer.email.toLowerCase() !== email) return NextResponse.json(generic);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
  const redirectTo = `${appUrl}/auth/callback?next=${encodeURIComponent("/account/reset-password")}`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  await recordAuditEvent(supabaseAdmin, {
    customerId: order.customer_id,
    actorType: "customer",
    eventType: error ? "customer_activation_resend_failed" : "customer_activation_resend_requested",
    dedupeKey: `customer_activation_resend:${order.id}:${new Date().toISOString().slice(0, 13)}`,
    eventDescription: error ? "Customer activation email resend failed." : "Customer requested a new activation email.",
    metadata: { checkoutOrderId: order.id, email, error: error?.message || null },
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent"),
  }).catch(() => undefined);

  if (error) {
    await createAdminNotification(supabaseAdmin, {
      customerId: order.customer_id,
      eventType: "customer_activation_resend_failed",
      title: "Customer activation resend failed",
      message: "A customer requested a new activation link, but Supabase could not send it.",
      priority: "urgent",
      metadata: { checkoutOrderId: order.id, error: error.message },
    });
  }

  return NextResponse.json(generic);
}
