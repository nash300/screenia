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
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string | string[];
    from?: string;
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
  const { data: inserted, error: insertError } = await supabaseAdmin
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

  if (insertError?.code === "23505") {
    return NextResponse.json({ received: true, duplicate: true });
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
          },
        })
      : Promise.resolve(),
  ]);

  return NextResponse.json({ received: true });
}
