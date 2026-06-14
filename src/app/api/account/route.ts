import { NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  getCustomerForUser,
  supabaseAdmin,
} from "@/lib/server/customer-account";

type CustomerMessageRow = {
  id: string;
  ticket_number?: string | null;
  request_type?: string | null;
  priority?: string | null;
  related_ticket_number?: string | null;
  subject: string | null;
  message: string;
  status: string;
  created_at: string;
  customer_message_files?: Array<{
    id: string;
    file_name: string;
    content_type: string;
    file_size: number;
    storage_bucket: string;
    storage_path: string;
  }>;
};

export async function GET() {
  const user = await getAuthenticatedUser();
  const customer = await getCustomerForUser(user);

  if (!user || !customer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const messageSelectWithTickets =
    "id, ticket_number, request_type, priority, related_ticket_number, subject, message, status, created_at, customer_message_files(id, file_name, content_type, file_size, storage_bucket, storage_path)";
  const messageSelectFallback =
    "id, subject, message, status, created_at, customer_message_files(id, file_name, content_type, file_size, storage_bucket, storage_path)";

  const [
    { data: subscriptions },
    { data: devices },
    messageResult,
    { data: displayAssets },
    { data: agreements },
    { data: legalDocuments },
  ] =
    await Promise.all([
      supabaseAdmin
        .from("customer_subscriptions")
        .select(
          "id, order_number, status, setup_fee_paid, setup_fee_sek, hardware_fee_sek, shipping_fee_sek, monthly_fee_sek, trial_days, tax_status, tax_amount_sek, total_amount_sek, fulfillment_status, inventory_status, tracking_number, tracking_url, stripe_subscription_id, stripe_payment_status, created_at, updated_at, pricing_plans(name, resolution, code)",
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
        .select(messageSelectWithTickets)
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabaseAdmin
        .from("customer_display_assets")
        .select(
          "id, file_name, content_type, file_size, storage_bucket, storage_path, asset_category, description, source, status, created_at",
        )
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

  let messages = (messageResult.data || []) as CustomerMessageRow[];

  if (messageResult.error?.code === "42703" || messageResult.error?.code === "PGRST204") {
    const fallbackMessages = await supabaseAdmin
      .from("customer_messages")
      .select(messageSelectFallback)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(10);
    messages = (fallbackMessages.data || []) as CustomerMessageRow[];
  }

  const messagesWithFiles = await Promise.all(
    (messages || []).map(async (message) => {
      const files = await Promise.all(
        (message.customer_message_files || []).map(async (file) => {
          const { data } = await supabaseAdmin.storage
            .from(file.storage_bucket)
            .createSignedUrl(file.storage_path, 60 * 15);

          return {
            id: file.id,
            fileName: file.file_name,
            contentType: file.content_type,
            fileSize: file.file_size,
            downloadUrl: data?.signedUrl || null,
          };
        }),
      );

      return {
        id: message.id,
        ticket_number:
          message.ticket_number ||
          String(message.subject || "").match(/\[(IS-[^\]]+)\]/)?.[1] ||
          null,
        request_type: message.request_type || "general",
        priority: message.priority || "normal",
        related_ticket_number: message.related_ticket_number || null,
        subject: message.subject,
        message: message.message,
        status: message.status,
        created_at: message.created_at,
        files,
      };
    }),
  );

  const displayAssetsWithUrls = await Promise.all(
    (displayAssets || []).map(async (asset) => {
      let downloadUrl: string | null = null;

      if (asset.storage_bucket && asset.storage_path) {
        const { data } = await supabaseAdmin.storage
          .from(asset.storage_bucket)
          .createSignedUrl(asset.storage_path, 60 * 15);
        downloadUrl = data?.signedUrl || null;
      }

      return {
        id: asset.id,
        file_name: asset.file_name,
        content_type: asset.content_type,
        file_size: asset.file_size,
        asset_category: asset.asset_category,
        description: asset.description,
        source: asset.source,
        status: asset.status,
        created_at: asset.created_at,
        downloadUrl,
      };
    }),
  );

  return NextResponse.json({
    customer,
    subscriptions: subscriptions || [],
    devices: devices || [],
    messages: messagesWithFiles,
    displayAssets: displayAssetsWithUrls,
    agreements: agreements || [],
    legalDocuments: legalDocuments || [],
  });
}
