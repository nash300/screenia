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

function decodeBase64File(file: FileInput) {
  const base64 = String(file.data || "").split(",").pop() || "";
  return Buffer.from(base64, "base64");
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
  const files = Array.isArray(body.files) ? (body.files as FileInput[]) : [];

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const totalFileSize = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
  if (totalFileSize > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "Files can be at most 20 MB in total." },
      { status: 400 },
    );
  }

  const { data: savedMessage, error: messageError } = await supabaseAdmin
    .from("customer_messages")
    .insert({
      customer_id: customer.id,
      subject: subject || null,
      message,
      status: "new",
    })
    .select("id")
    .single();

  if (messageError || !savedMessage) {
    console.error("Customer message save error:", messageError);
    return NextResponse.json(
      { error: "Could not send message." },
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
      fileCount: storedFiles.length,
      files: storedFiles,
    },
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true });
}
