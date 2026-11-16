import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Webhook } from "svix";
import { recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import {
  processInboundContactReply,
  type InboundContactEmailEvent,
  type ReceivedEmailContent,
} from "@/lib/server/contact-inquiry-inbound";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type ResendWebhookPayload = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    created_at?: string;
    to?: string | string[];
    from?: string;
    subject?: string;
    message_id?: string;
    reason?: string;
    bounce?: { message?: string; type?: string };
  };
};

function firstEmail(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function actionStatus(eventType: string) {
  const risky = [
    "email.bounced",
    "email.complained",
    "email.failed",
    "contact.unsubscribed",
  ];

  return risky.includes(eventType) ? "action_required" : "received";
}

type ContactEmailAssociation = {
  inquiryId: string | null;
  caseNumber: string | null;
  replyId: string | null;
  messageRole: "visitor_confirmation" | "admin_notification" | "admin_reply" | null;
};

type BillingEmailAssociation = {
  customerId: string | null;
  stripeInvoiceId: string | null;
};

type PauseReminderEmailAssociation = {
  customerId: string | null;
  pauseReminderId: string | null;
  stripeSubscriptionId: string | null;
};

type CustomerSupportEmailAssociation = {
  customerId: string | null;
  messageId: string | null;
  ticketNumber: string | null;
};

function conversationEmailStatus(eventType: string) {
  if (["email.delivered", "email.opened", "email.clicked"].includes(eventType)) {
    return "delivered";
  }
  if (eventType === "email.bounced") return "bounced";
  if (eventType === "email.complained") return "complained";
  if (eventType === "email.failed") return "failed";
  if (eventType === "email.sent") return "sent";
  return null;
}

async function retrieveReceivedEmail(
  emailId: string,
): Promise<ReceivedEmailContent> {
  const apiKey =
    process.env.RESEND_RECEIVING_API_KEY?.trim() ||
    process.env.RESEND_API_KEY?.trim() ||
    "";
  if (!apiKey) {
    throw new Error("RESEND_RECEIVING_API_KEY is not configured.");
  }

  const response = await fetch(
    `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" },
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `Resend could not return inbound email content (${response.status}).`,
    );
  }

  return {
    text: typeof body.text === "string" ? body.text : null,
    html: typeof body.html === "string" ? body.html : null,
    createdAt:
      typeof body.created_at === "string" ? body.created_at : null,
  };
}

async function processReceivedContactEmail(event: ResendWebhookPayload) {
  const data = event.data;
  if (!data?.email_id || !data.from) {
    throw new Error("Inbound email event is missing its email id or sender.");
  }

  const inboundEvent: InboundContactEmailEvent = {
    emailId: data.email_id,
    messageId: data.message_id || null,
    from: data.from,
    to: Array.isArray(data.to) ? data.to : data.to ? [data.to] : [],
    subject: data.subject || "",
    createdAt: data.created_at || event.created_at || new Date().toISOString(),
  };

  return processInboundContactReply(inboundEvent, {
    async findInquiry(caseNumber) {
      const { data: inquiry, error } = await supabaseAdmin
        .from("contact_inquiries")
        .select("id, case_number, email, name")
        .eq("case_number", caseNumber)
        .maybeSingle();
      if (error) throw error;
      return inquiry
        ? {
            id: inquiry.id,
            caseNumber: inquiry.case_number,
            email: inquiry.email,
            name: inquiry.name,
          }
        : null;
    },
    retrieveEmail: retrieveReceivedEmail,
    async saveReply(input) {
      const { data: saved, error } = await supabaseAdmin
        .from("contact_inquiry_replies")
        .insert({
          inquiry_id: input.inquiryId,
          admin_user_id: null,
          sender_role: "visitor",
          sender_email: input.senderEmail,
          message: input.message,
          email_id: null,
          email_status: null,
          inbound_email_id: input.inboundEmailId,
          inbound_message_id: input.inboundMessageId,
          created_at: input.createdAt,
        })
        .select("id")
        .single();

      if (error?.code === "23505") {
        const { data: existing, error: existingError } = await supabaseAdmin
          .from("contact_inquiry_replies")
          .select("id")
          .eq("inbound_email_id", input.inboundEmailId)
          .single();
        if (existingError || !existing) throw existingError || error;
        return { id: existing.id, duplicate: true };
      }
      if (error || !saved) throw error || new Error("Inbound reply was not saved.");
      return { id: saved.id, duplicate: false };
    },
    async reopenInquiry(inquiryId) {
      const { error } = await supabaseAdmin
        .from("contact_inquiries")
        .update({ status: "open", closed_at: null, closed_by: null, admin_unread_at: new Date().toISOString() })
        .eq("id", inquiryId);
      if (error) throw error;
    },
    async notify(input) {
      await createAdminNotification(supabaseAdmin, input);
    },
    async audit(input) {
      await recordAuditEvent(supabaseAdmin, {
        actorType: "system",
        eventType: input.eventType,
        eventDescription: input.eventDescription,
        metadata: input.metadata,
      });
    },
  });
}

async function synchronizeCustomerSupportEmailState(
  resendEmailId: string | null,
  eventType: string,
): Promise<CustomerSupportEmailAssociation> {
  const noAssociation = {
    customerId: null,
    messageId: null,
    ticketNumber: null,
  };
  const nextStatus = conversationEmailStatus(eventType);
  if (!resendEmailId || !nextStatus) return noAssociation;

  const { data: message, error } = await supabaseAdmin
    .from("customer_messages")
    .update({ email_status: nextStatus })
    .eq("email_id", resendEmailId)
    .select("id, customer_id, ticket_number")
    .maybeSingle();

  if (error) throw error;
  if (!message) return noAssociation;

  return {
    customerId: message.customer_id,
    messageId: message.id,
    ticketNumber: message.ticket_number,
  };
}

async function synchronizeBillingEmailState(
  resendEmailId: string | null,
  eventType: string,
): Promise<BillingEmailAssociation> {
  const noAssociation = { customerId: null, stripeInvoiceId: null };
  if (!resendEmailId) return noAssociation;

  const { data: dispatch, error: lookupError } = await supabaseAdmin
    .from("billing_email_dispatches")
    .select("stripe_invoice_id, customer_id, status")
    .eq("resend_email_id", resendEmailId)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (!dispatch) return noAssociation;

  let nextStatus: "sent" | "delivered" | "failed" | "bounced" | null = null;
  if (["email.delivered", "email.opened", "email.clicked"].includes(eventType)) {
    nextStatus = "delivered";
  } else if (["email.bounced", "email.complained"].includes(eventType)) {
    nextStatus = "bounced";
  } else if (eventType === "email.failed") {
    nextStatus = "failed";
  } else if (eventType === "email.sent" && dispatch.status === "pending") {
    nextStatus = "sent";
  }

  if (nextStatus) {
    const update: Record<string, string | null> = {
      status: nextStatus,
      last_error:
        nextStatus === "failed" || nextStatus === "bounced"
          ? eventType
          : null,
    };
    if (nextStatus === "delivered") {
      update.delivered_at = new Date().toISOString();
    }

    const { error: updateError } = await supabaseAdmin
      .from("billing_email_dispatches")
      .update(update)
      .eq("stripe_invoice_id", dispatch.stripe_invoice_id);
    if (updateError) throw updateError;
  }

  return {
    customerId: dispatch.customer_id,
    stripeInvoiceId: dispatch.stripe_invoice_id,
  };
}

async function synchronizePauseReminderEmailState(
  resendEmailId: string | null,
  eventType: string,
): Promise<PauseReminderEmailAssociation> {
  const noAssociation = {
    customerId: null,
    pauseReminderId: null,
    stripeSubscriptionId: null,
  };
  if (!resendEmailId) return noAssociation;

  const { data: dispatch, error: lookupError } = await supabaseAdmin
    .from("subscription_pause_reminder_dispatches")
    .select("id, customer_id, stripe_subscription_id, status")
    .eq("resend_email_id", resendEmailId)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (!dispatch) return noAssociation;

  let nextStatus: "sent" | "delivered" | "failed" | "bounced" | null = null;
  if (["email.delivered", "email.opened", "email.clicked"].includes(eventType)) {
    nextStatus = "delivered";
  } else if (["email.bounced", "email.complained"].includes(eventType)) {
    nextStatus = "bounced";
  } else if (eventType === "email.failed") {
    nextStatus = "failed";
  } else if (eventType === "email.sent" && dispatch.status === "pending") {
    nextStatus = "sent";
  }

  if (nextStatus) {
    const update: Record<string, string | null> = {
      status: nextStatus,
      last_error:
        nextStatus === "failed" || nextStatus === "bounced"
          ? eventType
          : null,
    };
    if (nextStatus === "delivered") {
      update.delivered_at = new Date().toISOString();
    }

    const { error: updateError } = await supabaseAdmin
      .from("subscription_pause_reminder_dispatches")
      .update(update)
      .eq("id", dispatch.id);
    if (updateError) throw updateError;
  }

  return {
    customerId: dispatch.customer_id,
    pauseReminderId: dispatch.id,
    stripeSubscriptionId: dispatch.stripe_subscription_id,
  };
}

async function synchronizeContactInquiryEmailState(
  resendEmailId: string | null,
  eventType: string,
): Promise<ContactEmailAssociation> {
  const noAssociation: ContactEmailAssociation = {
    inquiryId: null,
    caseNumber: null,
    replyId: null,
    messageRole: null,
  };

  const nextStatus = conversationEmailStatus(eventType);
  if (!resendEmailId || !nextStatus) {
    return noAssociation;
  }

  const { data: reply, error: replyLookupError } = await supabaseAdmin
    .from("contact_inquiry_replies")
    .select("id, inquiry_id")
    .eq("email_id", resendEmailId)
    .maybeSingle();

  if (replyLookupError) throw replyLookupError;

  if (reply) {
    const { data: inquiry, error: inquiryLookupError } = await supabaseAdmin
      .from("contact_inquiries")
      .select("id, case_number")
      .eq("id", reply.inquiry_id)
      .single();

    if (inquiryLookupError || !inquiry) {
      throw inquiryLookupError || new Error("Linked contact inquiry was not found.");
    }

    const { error: replyUpdateError } = await supabaseAdmin
      .from("contact_inquiry_replies")
      .update({ email_status: nextStatus })
      .eq("id", reply.id);

    let inquiryUpdateError = null;
    if (["failed", "bounced", "complained"].includes(nextStatus)) {
      const updateResult = await supabaseAdmin
        .from("contact_inquiries")
        .update({ status: "open", closed_at: null, closed_by: null, admin_unread_at: new Date().toISOString() })
        .eq("id", inquiry.id);
      inquiryUpdateError = updateResult.error;
    }

    if (replyUpdateError || inquiryUpdateError) {
      throw replyUpdateError || inquiryUpdateError;
    }

    return {
      inquiryId: inquiry.id,
      caseNumber: inquiry.case_number,
      replyId: reply.id,
      messageRole: "admin_reply",
    };
  }

  const { data: confirmation, error: confirmationError } = await supabaseAdmin
    .from("contact_inquiries")
    .update({ confirmation_email_status: nextStatus })
    .eq("confirmation_email_id", resendEmailId)
    .select("id, case_number")
    .maybeSingle();

  if (confirmationError) throw confirmationError;
  if (confirmation) {
    return {
      inquiryId: confirmation.id,
      caseNumber: confirmation.case_number,
      replyId: null,
      messageRole: "visitor_confirmation",
    };
  }

  const { data: adminNotice, error: adminNoticeError } = await supabaseAdmin
    .from("contact_inquiries")
    .update({ admin_notification_email_status: nextStatus })
    .eq("admin_notification_email_id", resendEmailId)
    .select("id, case_number")
    .maybeSingle();

  if (adminNoticeError) throw adminNoticeError;
  if (adminNotice) {
    return {
      inquiryId: adminNotice.id,
      caseNumber: adminNotice.case_number,
      replyId: null,
      messageRole: "admin_notification",
    };
  }

  return noAssociation;
}

export async function POST(request: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim() || "";

  if (!webhookSecret) {
    await createAdminNotification(supabaseAdmin, {
      eventType: "resend_webhook_missing_secret",
      title: "Resend webhook secret missing",
      message:
        "A Resend webhook request arrived, but RESEND_WEBHOOK_SECRET is not configured.",
      priority: "urgent",
      metadata: {},
    });
    return NextResponse.json(
      { error: "Resend webhook secret is not configured." },
      { status: 500 },
    );
  }

  const payload = await request.text();
  const svixId = request.headers.get("svix-id") || "";
  const svixTimestamp = request.headers.get("svix-timestamp") || "";
  const svixSignature = request.headers.get("svix-signature") || "";

  let event: ResendWebhookPayload;

  try {
    event = new Webhook(webhookSecret).verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ResendWebhookPayload;
  } catch (error) {
    console.error("Invalid Resend webhook signature:", error);
    return NextResponse.json({ error: "Invalid webhook." }, { status: 400 });
  }

  const eventType = String(event.type || "unknown");
  const eventStatus = actionStatus(eventType);
  const recipientEmail = firstEmail(event.data?.to);
  let { data: inserted, error: insertError } = await supabaseAdmin
    .from("resend_delivery_events")
    .insert({
      svix_id: svixId,
      event_type: eventType,
      resend_email_id: event.data?.email_id || null,
      recipient_email: recipientEmail,
      subject: event.data?.subject || null,
      event_status: eventStatus,
      raw_payload: event,
      processed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError?.code === "23505" && eventType !== "email.received") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (insertError?.code === "23505") {
    const existingResult = await supabaseAdmin
      .from("resend_delivery_events")
      .select("id")
      .eq("svix_id", svixId)
      .maybeSingle();
    inserted = existingResult.data;
    insertError = existingResult.error;
  }

  if (insertError || !inserted) {
    console.error("Resend delivery event insert error:", insertError);
    await createAdminNotification(supabaseAdmin, {
      eventType: "resend_webhook_processing_failed",
      title: "Resend webhook failed",
      message: `Resend event ${eventType} could not be stored.`,
      priority: "urgent",
      metadata: { svixId, eventType, error: insertError?.message || null },
    });
    return NextResponse.json(
      { error: "Could not store Resend event." },
      { status: 500 },
    );
  }

  if (eventType === "email.received") {
    try {
      const inboundResult = await processReceivedContactEmail(event);
      await recordAuditEvent(supabaseAdmin, {
        actorType: "system",
        eventType: "resend_inbound_email_processed",
        eventDescription: "A verified Resend inbound email event was processed.",
        metadata: {
          eventId: inserted.id,
          svixId,
          resendEmailId: event.data?.email_id || null,
          recipientEmail,
          ...inboundResult,
        },
      });
      return NextResponse.json({ received: true, inbound: inboundResult });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown inbound email error.";
      console.error("Inbound contact email processing failed:", error);
      await supabaseAdmin
        .from("resend_delivery_events")
        .update({ event_status: "action_required" })
        .eq("id", inserted.id);
      await Promise.all([
        createAdminNotification(supabaseAdmin, {
          eventType: "visitor_contact_reply_processing_failed",
          title: "Incoming customer reply needs attention",
          message: "A received email could not be added to its Screenia conversation.",
          priority: "urgent",
          metadata: {
            eventId: inserted.id,
            svixId,
            resendEmailId: event.data?.email_id || null,
            error: message,
          },
        }),
        recordAuditEvent(supabaseAdmin, {
          actorType: "system",
          eventType: "resend_inbound_email_failed",
          eventDescription: "A verified inbound email could not be processed.",
          metadata: {
            eventId: inserted.id,
            svixId,
            resendEmailId: event.data?.email_id || null,
            error: message,
          },
        }),
      ]);
      return NextResponse.json(
        { error: "Inbound email could not be processed." },
        { status: 500 },
      );
    }
  }

  let contactAssociation: ContactEmailAssociation = {
    inquiryId: null,
    caseNumber: null,
    replyId: null,
    messageRole: null,
  };
  let contactSyncError: string | null = null;
  let billingAssociation: BillingEmailAssociation = {
    customerId: null,
    stripeInvoiceId: null,
  };
  let billingSyncError: string | null = null;
  let pauseReminderAssociation: PauseReminderEmailAssociation = {
    customerId: null,
    pauseReminderId: null,
    stripeSubscriptionId: null,
  };
  let pauseReminderSyncError: string | null = null;
  let customerSupportAssociation: CustomerSupportEmailAssociation = {
    customerId: null,
    messageId: null,
    ticketNumber: null,
  };
  let customerSupportSyncError: string | null = null;

  try {
    contactAssociation = await synchronizeContactInquiryEmailState(
      event.data?.email_id || null,
      eventType,
    );
  } catch (error) {
    contactSyncError =
      error instanceof Error ? error.message : "Unknown contact email sync error.";
    console.error("Contact inquiry email state sync error:", error);
  }

  try {
    customerSupportAssociation = await synchronizeCustomerSupportEmailState(
      event.data?.email_id || null,
      eventType,
    );
  } catch (error) {
    customerSupportSyncError =
      error instanceof Error
        ? error.message
        : "Unknown customer support email sync error.";
    console.error("Customer support email state sync error:", error);
  }

  try {
    billingAssociation = await synchronizeBillingEmailState(
      event.data?.email_id || null,
      eventType,
    );
  } catch (error) {
    billingSyncError =
      error instanceof Error ? error.message : "Unknown billing email sync error.";
    console.error("Billing email state sync error:", error);
  }

  try {
    pauseReminderAssociation = await synchronizePauseReminderEmailState(
      event.data?.email_id || null,
      eventType,
    );
  } catch (error) {
    pauseReminderSyncError =
      error instanceof Error
        ? error.message
        : "Unknown pause reminder email sync error.";
    console.error("Pause reminder email state sync error:", error);
  }

  await Promise.all([
    recordAuditEvent(supabaseAdmin, {
      actorType: "system",
      eventType: "resend_delivery_event_received",
      eventDescription: "Resend delivery webhook event was received.",
      metadata: {
        eventId: inserted.id,
        svixId,
        eventType,
        resendEmailId: event.data?.email_id || null,
        recipientEmail,
        eventStatus,
        ...contactAssociation,
        contactSyncError,
        ...billingAssociation,
        billingSyncError,
        ...pauseReminderAssociation,
        pauseReminderSyncError,
        customerSupport: customerSupportAssociation,
        customerSupportSyncError,
      },
    }),
    eventStatus === "action_required"
      ? createAdminNotification(supabaseAdmin, {
          eventType: "resend_delivery_action_required",
          title: "Customer email delivery needs attention",
          message: `${eventType} for ${recipientEmail || "unknown recipient"}.`,
          priority: "high",
          metadata: {
            eventId: inserted.id,
            svixId,
            eventType,
            recipientEmail,
            reason: event.data?.reason || event.data?.bounce?.message || null,
            ...contactAssociation,
            contactSyncError,
            ...billingAssociation,
            billingSyncError,
            ...pauseReminderAssociation,
            pauseReminderSyncError,
            customerSupport: customerSupportAssociation,
            customerSupportSyncError,
          },
        })
      : Promise.resolve(),
  ]);

  return NextResponse.json({ received: true });
}
