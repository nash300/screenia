import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/server/audit";
import {
  getAuthenticatedUser,
  getCustomerForUser,
  sanitizeFileName,
  supabaseAdmin,
} from "@/lib/server/customer-account";

const MESSAGE_FILE_BUCKET = "customer-message-files";
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
  "text/plain",
]);

type FileInput = {
  name?: string;
  type?: string;
  size?: number;
  data?: string;
};

const REQUEST_TYPES = new Set([
  "general",
  "issue",
  "return",
  "material_update",
  "billing",
  "technical_support",
]);

const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);

function decodeBase64File(file: FileInput) {
  const base64 = String(file.data || "").split(",").pop() || "";
  return Buffer.from(base64, "base64");
}

function normalizeRequestType(value: unknown) {
  const requestType = String(value || "general").trim();
  return REQUEST_TYPES.has(requestType) ? requestType : "general";
}

function normalizePriority(value: unknown) {
  const priority = String(value || "normal").trim();
  return PRIORITIES.has(priority) ? priority : "normal";
}

function makeTicketNumber() {
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const randomPart = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `IS-${datePart}-${randomPart}`;
}

function subjectWithTicket(subject: string, ticketNumber: string) {
  const cleanSubject = subject || "Kundärende";
  return cleanSubject.startsWith(`[${ticketNumber}]`)
    ? cleanSubject
    : `[${ticketNumber}] ${cleanSubject}`;
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  const customer = await getCustomerForUser(user);

  if (!user || !customer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const subject = String(body.subject || "").trim();
  const message = String(body.message || "").trim();
  const requestType = normalizeRequestType(body.requestType);
  const priority = normalizePriority(body.priority);
  const relatedTicketNumber =
    String(body.relatedTicketNumber || "").trim() || null;
  const files = Array.isArray(body.files) ? (body.files as FileInput[]) : [];

  if (!message) {
    return NextResponse.json(
      { error: "Meddelande krävs." },
      { status: 400 },
    );
  }

  const totalFileSize = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
  if (totalFileSize > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "Filer får vara högst 20 MB totalt." },
      { status: 400 },
    );
  }

  const ticketNumber = relatedTicketNumber || makeTicketNumber();
  const insertPayload = {
    customer_id: customer.id,
    subject: subjectWithTicket(subject, ticketNumber),
    message,
    status: relatedTicketNumber ? "customer_reply" : "new",
    ticket_number: ticketNumber,
    request_type: requestType,
    priority,
    related_ticket_number: relatedTicketNumber,
  };

  let { data: savedMessage, error: messageError } = await supabaseAdmin
    .from("customer_messages")
    .insert(insertPayload)
    .select("id, ticket_number")
    .single();

  if (messageError?.code === "PGRST204" || messageError?.code === "42703") {
    const fallbackInsert = {
      customer_id: customer.id,
      subject: subjectWithTicket(subject, ticketNumber),
      message: `[Typ: ${requestType}] [Prioritet: ${priority}]${relatedTicketNumber ? ` [Svar på: ${relatedTicketNumber}]` : ""}\n\n${message}`,
      status: relatedTicketNumber ? "customer_reply" : "new",
    };

    const fallbackResult = await supabaseAdmin
      .from("customer_messages")
      .insert(fallbackInsert)
      .select("id")
      .single();

    savedMessage = fallbackResult.data
      ? { ...fallbackResult.data, ticket_number: ticketNumber }
      : null;
    messageError = fallbackResult.error;
  }

  if (messageError || !savedMessage) {
    console.error("Customer message save error:", messageError);
    return NextResponse.json(
      { error: "Kunde inte skicka ärendet." },
      { status: 500 },
    );
  }

  const storedFiles: string[] = [];

  for (const file of files) {
    const fileName = sanitizeFileName(String(file.name || "message-file"));
    const contentType = String(file.type || "application/octet-stream");
    const fileSize = Number(file.size || 0);

    if (!fileName || !ALLOWED_FILE_TYPES.has(contentType) || fileSize > MAX_FILE_BYTES) {
      continue;
    }

    const bytes = decodeBase64File(file);
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_FILE_BYTES) {
      continue;
    }

    const storagePath = `${customer.id}/${savedMessage.id}/${crypto.randomUUID()}-${fileName}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(MESSAGE_FILE_BUCKET)
      .upload(storagePath, bytes, { contentType, upsert: false });

    if (uploadError) {
      console.warn("Customer message file upload failed:", uploadError.message);
      continue;
    }

    const { error: fileError } = await supabaseAdmin
      .from("customer_message_files")
      .insert({
        message_id: savedMessage.id,
        customer_id: customer.id,
        file_name: fileName,
        content_type: contentType,
        file_size: bytes.byteLength,
        storage_bucket: MESSAGE_FILE_BUCKET,
        storage_path: storagePath,
      });

    if (!fileError) storedFiles.push(fileName);
  }

  await recordAuditEvent(supabaseAdmin, {
    customerId: customer.id,
    actorType: "customer",
    eventType: "customer_message_sent",
    eventDescription: "Customer sent a message from the account portal.",
    metadata: {
      subject,
      ticketNumber,
      requestType,
      priority,
      relatedTicketNumber,
      fileCount: storedFiles.length,
      files: storedFiles,
    },
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, ticketNumber });
}
