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

  const [
    { data: subscriptions },
    { data: devices },
    { data: messages },
    { data: displayAssets },
    { data: agreements },
    { data: legalDocuments },
  ] =
    await Promise.all([
      supabaseAdmin
        .from("customer_subscriptions")
        .select(
          "id, order_number, status, setup_fee_paid, setup_fee_sek, hardware_fee_sek, shipping_fee_sek, monthly_fee_sek, trial_days, tax_status, tax_amount_sek, total_amount_sek, fulfillment_status, inventory_status, stripe_subscription_id, stripe_payment_status, created_at, updated_at, pricing_plans(name, resolution, code)",
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
      supabaseAdmin
        .from("customer_display_assets")
        .select("id, file_name, content_type, file_size, asset_category, description, source, status, created_at")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(12),
      supabaseAdmin
        .from("customer_legal_agreements")
        .select(
          "id, document_type, document_title, document_version, document_effective_at, document_url, pdf_url, content_snapshot, accepted_at, collection_point",
        )
        .eq("customer_id", customer.id)
        .order("accepted_at", { ascending: false }),
      supabaseAdmin
        .from("legal_documents")
        .select("id, document_type, title, version, effective_at, status, summary, pdf_url")
        .eq("status", "active")
        .order("effective_at", { ascending: false }),
    ]);

  return NextResponse.json({
    customer,
    subscriptions: subscriptions || [],
    devices: devices || [],
    messages: messages || [],
    displayAssets: displayAssets || [],
    agreements: agreements || [],
    legalDocuments: legalDocuments || [],
  });
}
