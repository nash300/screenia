import { NextResponse } from "next/server";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import {
  getAuthenticatedUser,
  getCustomerForUser,
  sanitizeFileName,
  supabaseAdmin,
} from "@/lib/server/customer-account";

const MESSAGE_FILE_BUCKET = "customer-message-files";
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 5;
const MAX_SUBJECT_LENGTH = 160;
const MAX_MESSAGE_LENGTH = 4000;
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
  "privacy_request",
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

function validateFiles(files: FileInput[]) {
  if (files.length > MAX_FILES) {
    return `Du kan bifoga högst ${MAX_FILES} filer per ärende.`;
  }

  const totalFileSize = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
  if (totalFileSize > MAX_FILE_BYTES) {
    return "Filer får vara högst 20 MB totalt.";
  }

  for (const file of files) {
    const fileName = sanitizeFileName(String(file.name || "message-file"));
    const contentType = String(file.type || "application/octet-stream");
    const fileSize = Number(file.size || 0);

    if (!fileName) {
      return "En bifogad fil saknar filnamn.";
    }

    if (!ALLOWED_FILE_TYPES.has(contentType)) {
      return `${fileName} har en filtyp som inte stöds.`;
    }

    if (fileSize <= 0 || fileSize > MAX_FILE_BYTES) {
      return `${fileName} är för stor. Max 20 MB totalt per ärende.`;
    }

    const bytes = decodeBase64File(file);
    if (bytes.byteLength !== fileSize || bytes.byteLength > MAX_FILE_BYTES) {
      return `${fileName} kunde inte verifieras. Försök bifoga filen igen.`;
    }
  }

  return null;
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
  const ipAddress = getRequestIp(request);
  const userAgent = request.headers.get("user-agent");

  if (!message) {
    return NextResponse.json(
      { error: "Meddelande krävs." },
      { status: 400 },
    );
  }

  if (subject.length > MAX_SUBJECT_LENGTH) {
    return NextResponse.json(
      { error: `Rubriken får vara högst ${MAX_SUBJECT_LENGTH} tecken.` },
      { status: 400 },
    );
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Meddelandet får vara högst ${MAX_MESSAGE_LENGTH} tecken.` },
      { status: 400 },
    );
  }

  const fileValidationError = validateFiles(files);
  if (fileValidationError) {
    return NextResponse.json({ error: fileValidationError }, { status: 400 });
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
  const uploadedStoragePaths: string[] = [];

  const cleanupSavedTicket = async () => {
    if (uploadedStoragePaths.length > 0) {
      const { error } = await supabaseAdmin.storage
        .from(MESSAGE_FILE_BUCKET)
        .remove(uploadedStoragePaths);
      if (error) {
        console.error("Customer message cleanup storage error:", error);
      }
    }

    await Promise.allSettled([
      supabaseAdmin
        .from("customer_message_files")
        .delete()
        .eq("message_id", savedMessage.id),
      supabaseAdmin.from("customer_messages").delete().eq("id", savedMessage.id),
    ]);
  };

  const failAttachmentSave = async (
    errorMessage: string,
    metadata: Record<string, unknown>,
  ) => {
    if (uploadedStoragePaths.length > 0) {
      const { error } = await supabaseAdmin.storage
        .from(MESSAGE_FILE_BUCKET)
        .remove(uploadedStoragePaths);
      if (error) {
        console.error("Customer message attachment cleanup failed:", error);
      }
    }

    await Promise.all([
      supabaseAdmin
        .from("customer_message_files")
        .delete()
        .eq("message_id", savedMessage.id),
      supabaseAdmin.from("customer_messages").delete().eq("id", savedMessage.id),
    ]);

    try {
      await recordAuditEvent(
        supabaseAdmin,
        {
          customerId: customer.id,
          actorType: "customer",
          eventType: "customer_message_attachment_failed",
          eventDescription:
            "Customer support ticket attachment saving failed; partial ticket records were removed.",
          metadata: {
            ticketNumber,
            requestType,
            priority,
            ...metadata,
          },
          ipAddress,
          userAgent,
        },
        { throwOnError: true },
      );

      await createAdminNotification(
        supabaseAdmin,
        {
          customerId: customer.id,
          eventType: "customer_message_attachment_failed",
          title: "Support attachment save failed",
          message: `${customer.name} tried to send ${subject || requestType} (${ticketNumber}), but an attachment could not be saved.`,
          priority: "urgent",
          metadata: {
            ticketNumber,
            requestType,
            priority,
            ...metadata,
          },
        },
        { throwOnError: true },
      );
    } catch (evidenceError) {
      console.error(
        "Customer message attachment failure evidence error:",
        evidenceError,
      );
      return NextResponse.json(
        {
          error:
            "Arendet sparades inte eftersom bilagan inte kunde sparas och Screenia inte kunde skapa intern felbevisning. Kontakta support.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  };

  for (const file of files) {
    const fileName = sanitizeFileName(String(file.name || "message-file"));
    const contentType = String(file.type || "application/octet-stream");
    const bytes = decodeBase64File(file);

    const storagePath = `${customer.id}/${savedMessage.id}/${crypto.randomUUID()}-${fileName}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(MESSAGE_FILE_BUCKET)
      .upload(storagePath, bytes, { contentType, upsert: false });

    if (uploadError) {
      console.error("Customer message file upload failed:", uploadError);
      return failAttachmentSave("Kunde inte spara bifogade filer.", {
        fileName,
        failureStage: "storage_upload",
        error: uploadError.message,
      });
    }
    uploadedStoragePaths.push(storagePath);

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

    if (fileError) {
      console.error("Customer message file metadata save failed:", fileError);
      return failAttachmentSave("Kunde inte spara bifogade filer.", {
        fileName,
        storagePath,
        failureStage: "metadata_insert",
        error: fileError.message,
      });
    }

    storedFiles.push(fileName);
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId: customer.id,
        actorType: "customer",
        actorId: user.id,
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
        ipAddress,
        userAgent,
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Customer message audit error:", auditError);
    await cleanupSavedTicket();

    try {
      await createAdminNotification(
        supabaseAdmin,
        {
          customerId: customer.id,
          eventType: "customer_message_audit_failed",
          title: "Support ticket audit failed",
          message: `${customer.name} tried to send ${subject || requestType} (${ticketNumber}), but the ticket was rolled back because audit evidence could not be stored.`,
          priority: "urgent",
          metadata: {
            subject,
            ticketNumber,
            requestType,
            priority,
            relatedTicketNumber,
            fileCount: storedFiles.length,
            files: storedFiles,
            error:
              auditError instanceof Error
                ? auditError.message
                : "Unknown audit storage error",
          },
        },
        { throwOnError: true },
      );
    } catch (notificationError) {
      console.error(
        "Customer message audit failure notification error:",
        notificationError,
      );
      return NextResponse.json(
        {
          error:
            "Arendet sparades inte och Screenia kunde inte skapa intern adminavisering. Kontakta support.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Arendet sparades inte eftersom revisionshistoriken inte kunde lagras.",
      },
      { status: 500 },
    );
  }

  if (requestType === "privacy_request") {
    const dueAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: dataSubjectRequest, error: dataSubjectRequestError } =
      await supabaseAdmin
        .from("data_subject_requests")
        .insert({
          customer_id: customer.id,
          source_message_id: savedMessage.id,
          request_type: "privacy_request",
          status: "received",
          description: message,
          due_at: dueAt,
        })
        .select("id")
        .single();

    if (dataSubjectRequestError) {
      console.error(
        "Data subject request register error:",
        dataSubjectRequestError,
      );
      try {
        await createAdminNotification(
          supabaseAdmin,
          {
            customerId: customer.id,
            eventType: "data_subject_request_register_failed",
            title: "Privacy request not registered",
            message: `${customer.name} sent a privacy request (${ticketNumber}), but the data subject request register was not updated.`,
            priority: "urgent",
            metadata: {
              ticketNumber,
              messageId: savedMessage.id,
              error: dataSubjectRequestError.message,
            },
          },
          { throwOnError: true },
        );
      } catch (notificationError) {
        console.error(
          "Data subject request register failure notification error:",
          notificationError,
        );
        return NextResponse.json(
          {
            error:
              "Integritetsbegäran sparades som ett supportärende, men Screenia kunde inte skapa dataskyddsregistret eller intern adminavisering. Kontakta support.",
          },
          { status: 500 },
        );
      }
    } else {
      try {
        await recordAuditEvent(
          supabaseAdmin,
          {
            customerId: customer.id,
            actorType: "customer",
            eventType: "data_subject_request_received",
            eventDescription:
              "Customer submitted a privacy/data subject request from the account portal.",
            metadata: {
              dataSubjectRequestId: dataSubjectRequest.id,
              ticketNumber,
              messageId: savedMessage.id,
              dueAt,
            },
            ipAddress,
            userAgent,
          },
          { throwOnError: true },
        );
      } catch (auditError) {
        console.error("Data subject request receipt audit error:", auditError);
        await supabaseAdmin
          .from("data_subject_requests")
          .delete()
          .eq("id", dataSubjectRequest.id);
        try {
          await createAdminNotification(
            supabaseAdmin,
            {
              customerId: customer.id,
              eventType: "data_subject_request_audit_failed",
              title: "Privacy request audit failed",
              message: `${customer.name} sent a privacy request (${ticketNumber}), but the data subject request register entry was rolled back because audit evidence could not be stored.`,
              priority: "urgent",
              metadata: {
                dataSubjectRequestId: dataSubjectRequest.id,
                ticketNumber,
                messageId: savedMessage.id,
                dueAt,
                error:
                  auditError instanceof Error
                    ? auditError.message
                    : "Unknown audit storage error",
              },
            },
            { throwOnError: true },
          );
        } catch (notificationError) {
          console.error(
            "Data subject request audit failure notification error:",
            notificationError,
          );
          return NextResponse.json(
            {
              error:
                "Integritetsbegäran sparades som ett supportärende, men Screenia kunde inte lagra dataskyddsregistret eller intern adminavisering. Kontakta support.",
            },
            { status: 500 },
          );
        }

        return NextResponse.json(
          {
            error:
              "Integritetsbegäran sparades som ett supportärende, men dataskyddsregistret kunde inte lagras revisionssäkert. Kontakta support.",
          },
          { status: 500 },
        );
      }
    }
  }

  try {
    await createAdminNotification(
      supabaseAdmin,
      {
        customerId: customer.id,
        eventType: "customer_message_sent",
        title: "New customer message",
        message: `${customer.name} sent ${subject || requestType} (${ticketNumber}).`,
        priority:
          priority === "urgent" ? "urgent" : priority === "high" ? "high" : "normal",
        metadata: {
          subject,
          ticketNumber,
          requestType,
          priority,
          relatedTicketNumber,
          fileCount: storedFiles.length,
          files: storedFiles,
        },
      },
      { throwOnError: true },
    );
  } catch (notificationError) {
    console.error("Customer message notification error:", notificationError);
    try {
      await recordAuditEvent(
        supabaseAdmin,
        {
          customerId: customer.id,
          actorType: "system",
          eventType: "customer_message_notification_failed",
          eventDescription:
            "Customer support ticket was saved, but admin notification storage failed.",
          metadata: {
            subject,
            ticketNumber,
            requestType,
            priority,
            relatedTicketNumber,
            fileCount: storedFiles.length,
            files: storedFiles,
            error:
              notificationError instanceof Error
                ? notificationError.message
                : "Unknown admin notification storage error",
          },
          ipAddress,
          userAgent,
        },
        { throwOnError: true },
      );
    } catch (notificationAuditError) {
      console.error(
        "Customer message notification failure audit error:",
        notificationAuditError,
      );
      return NextResponse.json(
        {
          error:
            "Arendet sparades, men Screenia kunde inte skapa adminavisering eller intern felbevisning. Kontakta support.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Arendet sparades, men Screenia kunde inte skapa adminaviseringen. Kontakta support om du inte far aterkoppling.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, ticketNumber });
}
