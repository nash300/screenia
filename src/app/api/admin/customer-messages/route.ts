import {
  getAuthenticatedUser,
  supabaseAdmin,
} from "@/lib/server/admin-api";
import { NextResponse } from "next/server";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import {
  escapeHtml,
  renderBrandedEmail,
  sendTransactionalEmail,
} from "@/lib/server/email";
import { createAdminNotification } from "@/lib/server/admin-notifications";


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

type CustomerMessageReplyPayload = {
  customerId?: string;
  messageId?: string;
  reply?: string;
  status?: string;
  reason?: string;
};

type MessageUpdatePayload = {
  customerId?: string;
  messageId?: string;
  status?: string;
  adminNote?: string;
  reason?: string;
};

type OriginalSupportMessageState = {
  id: string;
  ticket_number?: string | null;
  subject?: string | null;
  request_type?: string | null;
  priority?: string | null;
  status?: string | null;
  admin_note_updated_at?: string | null;
  resolved_at?: string | null;
};

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

function getReason(value: unknown) {
  return String(value || "").trim().slice(0, 1000);
}

function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  return Object.entries(after)
    .filter(([key, value]) => before[key] !== value)
    .map(([key]) => key);
}

async function rollbackSupportReply(
  customerId: string,
  replyMessageId: string,
  originalMessage: OriginalSupportMessageState,
) {
  await supabaseAdmin
    .from("customer_messages")
    .delete()
    .eq("id", replyMessageId)
    .eq("customer_id", customerId);

  await supabaseAdmin
    .from("customer_messages")
    .update({
      status: originalMessage.status || "new",
      admin_note_updated_at: originalMessage.admin_note_updated_at || null,
      resolved_at: originalMessage.resolved_at || null,
    })
    .eq("id", originalMessage.id)
    .eq("customer_id", customerId);
}

export async function PATCH(request: Request) {
  const user = await getAuthenticatedUser();

  if (user?.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as MessageUpdatePayload;
  const messageId = String(body.messageId || "").trim();
  const customerId = String(body.customerId || "").trim();
  const status = String(body.status || "").trim();
  const adminNote = String(body.adminNote || "").trim();
  const reason = getReason(body.reason);

  if (!messageId || !customerId) {
    return NextResponse.json(
      { error: "Message ID and customer ID are required." },
      { status: 400 },
    );
  }

  if (!MESSAGE_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid message status." }, { status: 400 });
  }

  if (reason.length < 5) {
    return NextResponse.json(
      { error: "A reason of at least 5 characters is required." },
      { status: 400 },
    );
  }

  const baseSelect =
    "id, ticket_number, subject, status, admin_note, admin_note_updated_at, resolved_at";
  const fallbackSelect = "id, ticket_number, subject, status, resolved_at";
  let adminNoteStored = true;
  const existingQuery = await supabaseAdmin
    .from("customer_messages")
    .select(baseSelect)
    .eq("id", messageId)
    .eq("customer_id", customerId)
    .single();
  let existing = existingQuery.data as Record<string, unknown> | null;
  let existingError = existingQuery.error;

  if (existingError?.code === "42703" || existingError?.code === "PGRST204") {
    adminNoteStored = false;
    const fallback = await supabaseAdmin
      .from("customer_messages")
      .select(fallbackSelect)
      .eq("id", messageId)
      .eq("customer_id", customerId)
      .single();
    existing = fallback.data as Record<string, unknown> | null;
    existingError = fallback.error;
  }

  if (existingError || !existing) {
    return NextResponse.json(
      { error: "Customer message was not found." },
      { status: 404 },
    );
  }

  const updatePayload = {
    status,
    admin_note: adminNote || null,
    admin_note_updated_at: new Date().toISOString(),
    resolved_at: status === "resolved" ? new Date().toISOString() : null,
  };

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

  const auditedPayload = adminNoteStored ? updatePayload : { status };
  const fieldsChanged = changedFields(existing, auditedPayload);

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
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
          changedFields: fieldsChanged,
          before: Object.fromEntries(
            fieldsChanged.map((field) => [
              field,
              (existing as Record<string, unknown>)[field],
            ]),
          ),
          after: Object.fromEntries(
            fieldsChanged.map((field) => [
              field,
              (auditedPayload as Record<string, unknown>)[field],
            ]),
          ),
          reason,
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Customer message review audit error:", auditError);
    if (fieldsChanged.length > 0) {
      await supabaseAdmin
        .from("customer_messages")
        .update(
          Object.fromEntries(
            fieldsChanged.map((field) => [
              field,
              (existing as Record<string, unknown>)[field],
            ]),
          ),
        )
        .eq("id", messageId)
        .eq("customer_id", customerId);
    }

    return NextResponse.json(
      {
        error:
          "Customer message review was not saved because the audit event could not be stored.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, message, adminNoteStored });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();

  if (user?.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as CustomerMessageReplyPayload;
  const messageId = String(body.messageId || "").trim();
  const customerId = String(body.customerId || "").trim();
  const reply = String(body.reply || "").trim();
  const status = String(body.status || "waiting_for_customer").trim();

  if (!messageId || !customerId) {
    return NextResponse.json(
      { error: "Message ID and customer ID are required." },
      { status: 400 },
    );
  }

  if (reply.length < 5) {
    return NextResponse.json(
      { error: "Reply must be at least 5 characters." },
      { status: 400 },
    );
  }

  if (reply.length > 4000) {
    return NextResponse.json(
      { error: "Reply may be at most 4000 characters." },
      { status: 400 },
    );
  }

  if (!MESSAGE_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid message status." }, { status: 400 });
  }

  const { data: customer, error: customerError } = await supabaseAdmin
    .from("customers")
    .select("id, name, email")
    .eq("id", customerId)
    .single();

  if (customerError || !customer) {
    return NextResponse.json(
      { error: "Customer was not found." },
      { status: 404 },
    );
  }

  const { data: originalMessage, error: originalError } = await supabaseAdmin
    .from("customer_messages")
    .select(
      "id, ticket_number, subject, request_type, priority, status, admin_note_updated_at, resolved_at",
    )
    .eq("id", messageId)
    .eq("customer_id", customerId)
    .single();

  if (originalError || !originalMessage) {
    return NextResponse.json(
      { error: "Original support message was not found." },
      { status: 404 },
    );
  }

  const ticketNumber =
    originalMessage.ticket_number ||
    String(originalMessage.subject || "").match(/\[(IS-[^\]]+)\]/)?.[1] ||
    `IS-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}`;
  const replySubject = `[${ticketNumber}] Reply from Screenia`;
  const now = new Date().toISOString();

  const { data: replyMessage, error: replyError } = await supabaseAdmin
    .from("customer_messages")
    .insert({
      customer_id: customerId,
      ticket_number: ticketNumber,
      related_ticket_number: ticketNumber,
      request_type: originalMessage.request_type || "general",
      priority: originalMessage.priority || "normal",
      subject: replySubject,
      message: reply,
      status,
    })
    .select("id, ticket_number, subject, status, created_at")
    .single();

  if (replyError || !replyMessage) {
    console.error("Create admin support reply error:", replyError);
    return NextResponse.json(
      { error: "Could not save the customer-visible reply." },
      { status: 500 },
    );
  }

  const originalMessageState = originalMessage as OriginalSupportMessageState;

  const { error: originalUpdateError } = await supabaseAdmin
    .from("customer_messages")
    .update({
      status,
      admin_note_updated_at: now,
      resolved_at: status === "resolved" ? now : null,
    })
    .eq("id", originalMessage.id)
    .eq("customer_id", customerId);

  if (originalUpdateError) {
    console.error("Update original support message state error:", originalUpdateError);
    await supabaseAdmin
      .from("customer_messages")
      .delete()
      .eq("id", replyMessage.id)
      .eq("customer_id", customerId);

    return NextResponse.json(
      { error: "Support reply was not saved because the original ticket state could not be updated." },
      { status: 500 },
    );
  }

  let emailSent = false;
  let emailWarning: string | null = null;

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId,
        actorType: "admin",
        actorId: user.id,
        eventType: "customer_support_reply_sent",
        eventDescription: "Admin sent a customer-visible support reply.",
        metadata: {
          originalMessageId: originalMessage.id,
          replyMessageId: replyMessage.id,
          ticketNumber,
          status,
          emailSent: false,
          emailWarning: "Email delivery not attempted until reply audit succeeded.",
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Customer support reply audit error:", auditError);
    await rollbackSupportReply(customerId, replyMessage.id, originalMessageState);

    try {
      await createAdminNotification(
        supabaseAdmin,
        {
          customerId,
          eventType: "customer_support_reply_audit_failed",
          title: "Support reply audit failed",
          message: `Support reply for ${ticketNumber} was not saved because audit evidence could not be stored.`,
          priority: "urgent",
          metadata: {
            originalMessageId: originalMessage.id,
            replyMessageId: replyMessage.id,
            ticketNumber,
            status,
            error:
              auditError instanceof Error ? auditError.message : String(auditError),
          },
        },
        { throwOnError: true },
      );
    } catch (notificationError) {
      console.error(
        "Customer support reply audit failure notification error:",
        notificationError,
      );
      return NextResponse.json(
        {
          error:
            "Support reply was not saved and the audit failure notification could not be stored. Contact technical support before retrying.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Support reply was not saved because the audit event could not be stored.",
      },
      { status: 500 },
    );
  }

  if (customer.email) {
    const safeCustomerName = escapeHtml(customer.name || "kund");
    const safeReply = escapeHtml(reply).replace(/\n/g, "<br />");
    const emailResult = await sendTransactionalEmail({
      to: customer.email,
      subject: `${replySubject}`,
      text: `Hej ${customer.name || ""},

Screenia har svarat på ditt ärende ${ticketNumber}:

${reply}

Du kan se ärendet och svara i kundportalen.

Vänliga hälsningar,
Screenia`,
      html: renderBrandedEmail({
        eyebrow: "Support",
        title: "Svar från Screenia",
        children: `
        <div style="font-family: Arial, sans-serif; color: #102033; line-height: 1.6;">
          <p>Hej ${safeCustomerName},</p>
          <p>Screenia har svarat på ditt ärende <strong>${escapeHtml(ticketNumber)}</strong>.</p>
          <div style="border: 1px solid #d9e5f7; border-radius: 14px; padding: 16px; background: #f7fbff;">
            <p style="margin: 0;">${safeReply}</p>
          </div>
          <p>Du kan se ärendet och svara i kundportalen.</p>
          <p>Vänliga hälsningar,<br />Screenia</p>
        </div>
      `,
      }),
    });

    emailSent = emailResult.ok;
    let emailFailureNotificationError: unknown = null;
    if (!emailResult.ok) {
      emailWarning = emailResult.configured
        ? emailResult.error
        : "Transactional email is not configured.";
      try {
        await createAdminNotification(
          supabaseAdmin,
          {
            customerId,
            eventType: emailResult.configured
              ? "customer_support_reply_email_failed"
              : "customer_support_reply_email_not_configured",
            title: "Support reply email not sent",
            message: `Support reply for ${ticketNumber} was saved, but email was not sent to ${customer.email}: ${emailWarning}`,
            priority: "urgent",
            metadata: {
              originalMessageId: originalMessage.id,
              replyMessageId: replyMessage.id,
              ticketNumber,
              error: emailWarning,
            },
          },
          { throwOnError: true },
        );
      } catch (notificationError) {
        console.error(
          "Customer support reply email failure notification error:",
          notificationError,
        );
        emailFailureNotificationError = notificationError;
        emailWarning =
          "Support reply was saved, but email was not sent and the urgent admin notification could not be stored.";
      }
    }

    let emailAuditStored = true;
    try {
      await recordAuditEvent(
        supabaseAdmin,
        {
          customerId,
          actorType: "system",
          eventType: emailResult.ok
            ? "customer_support_reply_email_sent"
            : emailResult.configured
              ? "customer_support_reply_email_failed"
              : "customer_support_reply_email_not_configured",
          eventDescription: emailResult.ok
            ? "System sent a support reply email to the customer."
            : "System could not send a support reply email to the customer.",
          metadata: {
            originalMessageId: originalMessage.id,
            replyMessageId: replyMessage.id,
            ticketNumber,
            sentTo: customer.email,
            error: emailResult.ok ? null : emailResult.error,
            resendEmailId: emailResult.ok ? emailResult.id || null : null,
            notificationError:
              emailFailureNotificationError instanceof Error
                ? emailFailureNotificationError.message
                : emailFailureNotificationError
                  ? String(emailFailureNotificationError)
                  : null,
          },
          ipAddress: getRequestIp(request),
          userAgent: request.headers.get("user-agent"),
        },
        { throwOnError: true },
      );
    } catch (emailAuditError) {
      emailAuditStored = false;
      console.error("Customer support reply email audit error:", emailAuditError);
      try {
        await createAdminNotification(
          supabaseAdmin,
          {
            customerId,
            eventType: "customer_support_reply_email_audit_failed",
            title: "Support reply email audit failed",
            message: `Support reply email delivery state for ${ticketNumber} could not be audited.`,
            priority: "urgent",
            metadata: {
              originalMessageId: originalMessage.id,
              replyMessageId: replyMessage.id,
              ticketNumber,
              sentTo: customer.email,
              emailSent: emailResult.ok,
              error:
                emailAuditError instanceof Error
                  ? emailAuditError.message
                  : String(emailAuditError),
            },
          },
          { throwOnError: true },
        );
      } catch (notificationError) {
        console.error(
          "Customer support reply email audit failure notification error:",
          notificationError,
        );
        return NextResponse.json(
          {
            error:
              "Support reply was saved, but email delivery audit failure visibility could not be stored. Contact technical support before retrying.",
          },
          { status: 500 },
        );
      }
      emailWarning =
        "Support reply was saved, but email delivery audit evidence could not be stored.";
    }

    if (emailFailureNotificationError && emailAuditStored) {
      try {
        await recordAuditEvent(
          supabaseAdmin,
          {
            customerId,
            actorType: "system",
            eventType: "customer_support_reply_email_notification_failed",
            eventDescription:
              "System could not notify admins about a failed support reply email.",
            metadata: {
              originalMessageId: originalMessage.id,
              replyMessageId: replyMessage.id,
              ticketNumber,
              sentTo: customer.email,
              emailWarning,
              error:
                emailFailureNotificationError instanceof Error
                  ? emailFailureNotificationError.message
                  : String(emailFailureNotificationError),
            },
            ipAddress: getRequestIp(request),
            userAgent: request.headers.get("user-agent"),
          },
          { throwOnError: true },
        );
      } catch (notificationAuditError) {
        console.error(
          "Customer support reply email notification audit error:",
          notificationAuditError,
        );
      }

      return NextResponse.json(
        {
          error:
            "Support reply was saved, but the failed email notification could not be stored for admins.",
        },
        { status: 500 },
      );
    }
  } else {
    emailWarning = "Customer has no email address.";
  }

  return NextResponse.json({
    success: true,
    reply: replyMessage,
    emailSent,
    warning: emailWarning,
  });
}
