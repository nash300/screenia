import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Webhook } from "svix";
import { recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type ResendWebhookPayload = {
  type?: string;
  data?: {
    email_id?: string;
    to?: string | string[];
    subject?: string;
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
  messageRole: "visitor_confirmation" | "admin_notification" | null;
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

function deliveryEmailStatus(eventType: string) {
  if (["email.delivered", "email.opened", "email.clicked"].includes(eventType)) {
    return "delivered";
  }
  if (eventType === "email.bounced") return "bounced";
  if (eventType === "email.complained") return "complained";
  if (eventType === "email.failed") return "failed";
  if (eventType === "email.sent") return "sent";
  return null;
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
  const nextStatus = deliveryEmailStatus(eventType);
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
    messageRole: null,
  };

  const nextStatus = deliveryEmailStatus(eventType);
  if (!resendEmailId || !nextStatus) {
    return noAssociation;
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
    await recordAuditEvent(supabaseAdmin, {
      actorType: "system",
      eventType: "resend_inbound_email_ignored",
      eventDescription:
        "An inbound Resend email was retained as delivery evidence; Zoho Mail handles customer replies.",
      metadata: {
        eventId: inserted.id,
        svixId,
        resendEmailId: event.data?.email_id || null,
        recipientEmail,
      },
    });
    return NextResponse.json({ received: true, ignored: "zoho_mail_handles_replies" });
  }

  let contactAssociation: ContactEmailAssociation = {
    inquiryId: null,
    caseNumber: null,
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
