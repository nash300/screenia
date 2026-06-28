import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type CustomerMessageRow = {
  id: string;
  ticket_number?: string | null;
  request_type?: string | null;
  priority?: string | null;
  related_ticket_number?: string | null;
  subject: string | null;
  message: string;
  status: string;
  admin_note?: string | null;
  admin_note_updated_at?: string | null;
  resolved_at?: string | null;
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

async function getAuthenticatedUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();

  if (user?.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");

  if (!customerId) {
    return NextResponse.json(
      { error: "Customer ID is required." },
      { status: 400 },
    );
  }

  const selectWithTickets =
    "id, ticket_number, request_type, priority, related_ticket_number, subject, message, status, admin_note, admin_note_updated_at, resolved_at, created_at, customer_message_files(id, file_name, content_type, file_size, storage_bucket, storage_path)";
  const selectWithTicketsNoAdminNote =
    "id, ticket_number, request_type, priority, related_ticket_number, subject, message, status, created_at, customer_message_files(id, file_name, content_type, file_size, storage_bucket, storage_path)";
  const selectFallback =
    "id, subject, message, status, created_at, customer_message_files(id, file_name, content_type, file_size, storage_bucket, storage_path)";

  const messageQuery = await supabaseAdmin
    .from("customer_messages")
    .select(selectWithTickets)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  let messages = (messageQuery.data || []) as CustomerMessageRow[];
  let error = messageQuery.error;

  if (error?.code === "42703" || error?.code === "PGRST204") {
    const ticketFallback = await supabaseAdmin
      .from("customer_messages")
      .select(selectWithTicketsNoAdminNote)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    messages = (ticketFallback.data || []) as CustomerMessageRow[];
    error = ticketFallback.error;
  }

  if (error?.code === "42703" || error?.code === "PGRST204") {
    const fallback = await supabaseAdmin
      .from("customer_messages")
      .select(selectFallback)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    messages = (fallback.data || []) as CustomerMessageRow[];
    error = fallback.error;
  }

  if (error) {
    if (error.code === "PGRST205" || error.code === "42703") {
      return NextResponse.json({
        messages: [],
        warning:
          "Customer message tables are not available. Apply the latest Supabase migrations.",
      });
    }

    console.error("Load customer messages error:", error);
    return NextResponse.json(
      { error: "Could not load customer messages." },
      { status: 500 },
    );
  }

  const messagesWithFiles = await Promise.all(
    ((messages || []) as CustomerMessageRow[]).map(async (message) => {
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
        ticketNumber:
          message.ticket_number ||
          String(message.subject || "").match(/\[(IS-[^\]]+)\]/)?.[1] ||
          null,
        requestType: message.request_type || "general",
        priority: message.priority || "normal",
        relatedTicketNumber: message.related_ticket_number || null,
        subject: message.subject,
        message: message.message,
        status: message.status,
        adminNote: message.admin_note || null,
        adminNoteUpdatedAt: message.admin_note_updated_at || null,
        resolvedAt: message.resolved_at || null,
        createdAt: message.created_at,
        files,
      };
    }),
  );

  return NextResponse.json({ messages: messagesWithFiles });
}

const MESSAGE_STATUSES = new Set([
  "new",
  "customer_reply",
  "in_progress",
  "waiting_for_customer",
  "resolved",
]);

export async function PATCH(request: Request) {
  const user = await getAuthenticatedUser();

  if (user?.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const messageId = String(body.messageId || "").trim();
  const customerId = String(body.customerId || "").trim();
  const status = String(body.status || "").trim();
  const adminNote = String(body.adminNote || "").trim();

  if (!messageId || !customerId) {
    return NextResponse.json(
      { error: "Message ID and customer ID are required." },
      { status: 400 },
    );
  }

  if (!MESSAGE_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid message status." }, { status: 400 });
  }

  const updatePayload = {
    status,
    admin_note: adminNote || null,
    admin_note_updated_at: new Date().toISOString(),
    resolved_at: status === "resolved" ? new Date().toISOString() : null,
  };

  let adminNoteStored = true;
  let { data: message, error } = await supabaseAdmin
    .from("customer_messages")
    .update(updatePayload)
    .eq("id", messageId)
    .eq("customer_id", customerId)
    .select("id, ticket_number, subject, status")
    .single();

  if (error?.code === "42703" || error?.code === "PGRST204") {
    adminNoteStored = false;
    const fallback = await supabaseAdmin
      .from("customer_messages")
      .update({ status })
      .eq("id", messageId)
      .eq("customer_id", customerId)
      .select("id, ticket_number, subject, status")
      .single();
    message = fallback.data;
    error = fallback.error;
  }

  if (error || !message) {
    console.error("Update customer message error:", error);
    return NextResponse.json(
      { error: "Could not update customer message." },
      { status: 500 },
    );
  }

  await recordAuditEvent(supabaseAdmin, {
    customerId,
    actorType: "admin",
    actorId: user.id,
    eventType: "customer_message_admin_update",
    eventDescription: "Admin updated a customer support message.",
    metadata: {
      messageId,
      ticketNumber: message.ticket_number || null,
      status,
      hasAdminNote: Boolean(adminNote),
      adminNoteStored,
    },
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, message, adminNoteStored });
}
