import { NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  getCustomerForUser,
  supabaseAdmin,
} from "@/lib/server/customer-account";

export async function GET() {
  const user = await getAuthenticatedUser();
  const customer = await getCustomerForUser(user);

  if (!user || !customer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [{ data: subscriptions }, { data: devices }, { data: messages }] =
    await Promise.all([
      supabaseAdmin
        .from("customer_subscriptions")
        .select(
          "id, order_number, status, setup_fee_paid, setup_fee_sek, monthly_fee_sek, trial_days, tax_status, tax_amount_sek, total_amount_sek, fulfillment_status, inventory_status, stripe_subscription_id, stripe_payment_status, created_at, updated_at, pricing_plans(name, resolution, code)",
        )
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("devices")
        .select("id, device_code, name, is_active, location, inventory_status, assigned_at, created_at")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("customer_messages")
        .select("id, subject, message, status, created_at")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  return NextResponse.json({
    customer,
    subscriptions: subscriptions || [],
    devices: devices || [],
    messages: messages || [],
  });
}
