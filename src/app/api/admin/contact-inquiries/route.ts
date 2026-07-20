import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import {
  CLIENT_COMMUNICATION_FROM_EMAIL,
  escapeHtml,
  renderBrandedEmail,
  sendTransactionalEmail,
} from "@/lib/server/email";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getAuthenticatedAdmin() {
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

  return user?.app_metadata?.role === "admin" ? user : null;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Stockholm",
  }).format(new Date(value));
}

function htmlLines(value: string) {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

export async function GET() {
  const user = await getAuthenticatedAdmin();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("contact_inquiries")
    .select(
      "id, case_number, name, email, company_name, subject, message, status, privacy_accepted_at, confirmation_email_id, confirmation_email_status, admin_notification_email_id, admin_notification_email_status, first_opened_at, closed_at, created_at, updated_at, contact_inquiry_replies(id, admin_user_id, message, email_id, email_status, created_at)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Load contact inquiries error:", error);
    return NextResponse.json(
      { error: "Could not load visitor messages." },
      { status: 500 },
    );
  }

  const firstNew = (data || []).filter((item) => item.status === "new");
  if (firstNew.length > 0) {
    await supabaseAdmin
      .from("contact_inquiries")
      .update({ status: "open", first_opened_at: new Date().toISOString() })
      .in(
        "id",
        firstNew.map((item) => item.id),
      );
  }

  const inquiries = (data || []).map((item) => ({
    ...item,
    status: item.status === "new" ? "open" : item.status,
    contact_inquiry_replies: [...(item.contact_inquiry_replies || [])].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    ),
  }));

  return NextResponse.json(
    { inquiries },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const user = await getAuthenticatedAdmin();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const inquiryId = String(body?.inquiryId || "").trim();
  const reply = String(body?.reply || "").trim();

  if (!inquiryId || reply.length < 5 || reply.length > 4000) {
    return NextResponse.json(
      { error: "Write a reply of 5–4,000 characters." },
      { status: 400 },
    );
  }

  const { data: inquiry, error: inquiryError } = await supabaseAdmin
    .from("contact_inquiries")
    .select("id, case_number, name, email, subject, message, status, created_at")
    .eq("id", inquiryId)
    .single();

  if (inquiryError || !inquiry) {
    return NextResponse.json(
      { error: "Visitor message was not found." },
      { status: 404 },
    );
  }

  const { data: savedReply, error: replyError } = await supabaseAdmin
    .from("contact_inquiry_replies")
    .insert({
      inquiry_id: inquiry.id,
      admin_user_id: user.id,
      message: reply,
    })
    .select("id, created_at")
    .single();

  if (replyError || !savedReply) {
    console.error("Save contact reply error:", replyError);
    return NextResponse.json(
      { error: "Could not save the reply." },
      { status: 500 },
    );
  }

  const sentAt = formatDateTime(savedReply.created_at);
  const emailResult = await sendTransactionalEmail({
    to: inquiry.email,
    subject: `Svar från Screenia – ${inquiry.case_number}: ${inquiry.subject}`,
    replyTo: CLIENT_COMMUNICATION_FROM_EMAIL,
    text: `Hej ${inquiry.name},\n\nVårt svar:\n${reply}\n\nDin ursprungliga fråga:\n${inquiry.message}\n\nÄrendenummer: ${inquiry.case_number}\nÄmne: ${inquiry.subject}\nSvarat: ${sentAt}\n\nDu kan svara direkt på detta mejl.\n\nVänliga hälsningar,\nScreenia`,
    html: renderBrandedEmail({
      eyebrow: `Svar på ärende ${inquiry.case_number}`,
      title: "Svar från Screenia",
      intro: `Hej ${escapeHtml(inquiry.name)}, här är vårt svar på din fråga.`,
      footer: "Screenia kundservice",
      showHelper: false,
      children: `
        <div style="border-radius:14px; background:#eef6ff; border:1px solid #cfe1fb; padding:20px;">
          <p style="margin:0 0 8px; color:#155ee8; font-size:13px; font-weight:800; text-transform:uppercase;">Vårt svar</p>
          <p style="margin:0; color:#102033; font-size:16px;">${htmlLines(reply)}</p>
        </div>
        <div style="margin-top:22px; border-left:4px solid #a9bad0; padding:2px 0 2px 18px;">
          <p style="margin:0 0 8px; color:#65788d; font-size:13px; font-weight:700; text-transform:uppercase;">Din ursprungliga fråga</p>
          <p style="margin:0 0 12px; color:#526579;">${htmlLines(inquiry.message)}</p>
          <p style="margin:0; color:#65788d; font-size:13px;"><strong>Ärende:</strong> ${escapeHtml(inquiry.case_number)} &nbsp; <strong>Ämne:</strong> ${escapeHtml(inquiry.subject)}</p>
        </div>
        <p style="margin:22px 0 0; color:#526579;">Du kan svara direkt på detta mejl. Svaret går till service@screenia.se.</p>
      `,
    }),
  });

  await supabaseAdmin
    .from("contact_inquiry_replies")
    .update({
      email_id: emailResult.ok ? emailResult.id || null : null,
      email_status: emailResult.ok ? "sent" : "failed",
    })
    .eq("id", savedReply.id);

  await supabaseAdmin
    .from("contact_inquiries")
    .update({ status: emailResult.ok ? "replied" : "open", closed_at: null })
    .eq("id", inquiry.id);

  await recordAuditEvent(supabaseAdmin, {
    actorType: "admin",
    actorId: user.id,
    eventType: emailResult.ok
      ? "visitor_contact_reply_sent"
      : "visitor_contact_reply_failed",
    eventDescription: emailResult.ok
      ? "Admin replied to a visitor contact inquiry."
      : "Admin reply was saved, but email delivery failed.",
    metadata: {
      inquiryId: inquiry.id,
      replyId: savedReply.id,
      caseNumber: inquiry.case_number,
      recipientEmail: inquiry.email,
      resendEmailId: emailResult.ok ? emailResult.id || null : null,
    },
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  if (!emailResult.ok) {
    await createAdminNotification(supabaseAdmin, {
      eventType: "visitor_contact_reply_failed",
      title: `Svar kunde inte skickas – ${inquiry.case_number}`,
      message: `Svaret är sparat men e-post till ${inquiry.email} misslyckades.`,
      priority: "urgent",
      metadata: {
        inquiryId: inquiry.id,
        replyId: savedReply.id,
        error: emailResult.error,
      },
    });

    return NextResponse.json(
      {
        error: "Reply saved, but the email could not be sent.",
        replySaved: true,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true, emailId: emailResult.id || null });
}

export async function PATCH(request: Request) {
  const user = await getAuthenticatedAdmin();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const inquiryId = String(body?.inquiryId || "").trim();
  const status = String(body?.status || "").trim();

  if (!inquiryId || !["open", "closed"].includes(status)) {
    return NextResponse.json({ error: "Invalid status update." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("contact_inquiries")
    .update({
      status,
      closed_at: status === "closed" ? now : null,
      closed_by: status === "closed" ? user.id : null,
    })
    .eq("id", inquiryId);

  if (error) {
    return NextResponse.json(
      { error: "Could not update message status." },
      { status: 500 },
    );
  }

  await recordAuditEvent(supabaseAdmin, {
    actorType: "admin",
    actorId: user.id,
    eventType: `visitor_contact_inquiry_${status}`,
    eventDescription: `Admin marked a visitor contact inquiry as ${status}.`,
    metadata: { inquiryId },
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true });
}
