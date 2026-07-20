import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import {
  CLIENT_COMMUNICATION_FROM_EMAIL,
  escapeHtml,
  renderBrandedEmail,
  sendTransactionalEmail,
} from "@/lib/server/email";
import { checkRateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function caseNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `SC-${date}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const companyName = String(body.companyName || "").trim();
  const subject = String(body.subject || "").trim();
  const message = String(body.message || "").trim();
  const privacyAccepted = Boolean(body.privacyAccepted);
  const website = String(body.website || "").trim();
  const ipAddress = getRequestIp(request);
  const userAgent = request.headers.get("user-agent");

  if (website) {
    return NextResponse.json({ success: true, received: true });
  }

  const rateLimit = checkRateLimit({
    key: `contact-inquiry:${ipAddress || email || "unknown"}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "För många meddelanden. Försök igen senare." },
      { status: 429, headers: rateLimitHeaders(rateLimit) },
    );
  }

  if (name.length < 2 || name.length > 120) {
    return NextResponse.json(
      { error: "Ange ditt namn (2–120 tecken)." },
      { status: 400, headers: rateLimitHeaders(rateLimit) },
    );
  }

  if (!isValidEmail(email) || email.length > 254) {
    return NextResponse.json(
      { error: "Ange en giltig e-postadress." },
      { status: 400, headers: rateLimitHeaders(rateLimit) },
    );
  }

  if (companyName.length > 160) {
    return NextResponse.json(
      { error: "Företagsnamnet är för långt." },
      { status: 400, headers: rateLimitHeaders(rateLimit) },
    );
  }

  if (subject.length < 3 || subject.length > 160) {
    return NextResponse.json(
      { error: "Skriv ett ämne (3–160 tecken)." },
      { status: 400, headers: rateLimitHeaders(rateLimit) },
    );
  }

  if (message.length < 10 || message.length > 4000) {
    return NextResponse.json(
      { error: "Beskriv din fråga med 10–4 000 tecken." },
      { status: 400, headers: rateLimitHeaders(rateLimit) },
    );
  }

  if (!privacyAccepted) {
    return NextResponse.json(
      { error: "Bekräfta att du har läst integritetspolicyn." },
      { status: 400, headers: rateLimitHeaders(rateLimit) },
    );
  }

  const createdAt = new Date().toISOString();
  const inquiryCaseNumber = caseNumber();
  const { data: inquiry, error: insertError } = await supabaseAdmin
    .from("contact_inquiries")
    .insert({
      case_number: inquiryCaseNumber,
      name,
      email,
      company_name: companyName || null,
      subject,
      message,
      privacy_accepted_at: createdAt,
      created_at: createdAt,
    })
    .select("id, case_number, created_at")
    .single();

  if (insertError || !inquiry) {
    console.error("Create contact inquiry error:", insertError);
    return NextResponse.json(
      { error: "Meddelandet kunde inte sparas. Försök igen." },
      { status: 500, headers: rateLimitHeaders(rateLimit) },
    );
  }

  await createAdminNotification(supabaseAdmin, {
    eventType: "visitor_contact_inquiry_received",
    title: `Ny kontaktfråga ${inquiry.case_number}`,
    message: `${name} frågar: ${subject}`,
    priority: "high",
    metadata: {
      inquiryId: inquiry.id,
      caseNumber: inquiry.case_number,
      visitorEmail: email,
    },
  });

  await recordAuditEvent(supabaseAdmin, {
    actorType: "system",
    eventType: "visitor_contact_inquiry_created",
    eventDescription: "A visitor submitted the public contact form.",
    metadata: {
      inquiryId: inquiry.id,
      caseNumber: inquiry.case_number,
      visitorEmail: email,
      privacyAcceptedAt: createdAt,
    },
    ipAddress,
    userAgent,
  });

  const receivedAt = formatDateTime(inquiry.created_at);
  const safeOriginal = htmlLines(message);
  const safeName = escapeHtml(name);
  const safeSubject = escapeHtml(subject);
  const adminEmail =
    process.env.SCREENIA_ADMIN_NOTIFICATION_EMAIL?.trim() ||
    "admin@screenia.se";

  const [confirmationResult, adminEmailResult] = await Promise.all([
    sendTransactionalEmail({
      to: email,
      subject: `${inquiry.case_number} – Vi har tagit emot din fråga`,
      replyTo: CLIENT_COMMUNICATION_FROM_EMAIL,
      text: `Hej ${name},\n\nTack för att du kontaktar Screenia. Vi har tagit emot din fråga och svarar till den här e-postadressen.\n\nÄrendenummer: ${inquiry.case_number}\nÄmne: ${subject}\nMottaget: ${receivedAt}\n\nDin fråga:\n${message}\n\nDu kan svara direkt på detta mejl om du vill lägga till något.\n\nVänliga hälsningar,\nScreenia`,
      html: renderBrandedEmail({
        eyebrow: `Ärende ${inquiry.case_number}`,
        title: "Vi har tagit emot din fråga",
        intro:
          "Tack för att du kontaktar Screenia. Vi svarar till den e-postadress du angav.",
        footer: "Screenia kundservice",
        showHelper: false,
        children: `
          <div style="border:1px solid #d8e6f8; border-radius:14px; background:#f5f9ff; padding:18px 20px;">
            <p style="margin:0 0 8px;"><strong>Ärendenummer:</strong> ${escapeHtml(inquiry.case_number)}</p>
            <p style="margin:0 0 8px;"><strong>Ämne:</strong> ${safeSubject}</p>
            <p style="margin:0;"><strong>Mottaget:</strong> ${escapeHtml(receivedAt)}</p>
          </div>
          <div style="margin-top:20px; border-left:4px solid #2f7df6; padding:2px 0 2px 18px;">
            <p style="margin:0 0 8px; color:#526579; font-size:13px; font-weight:700; text-transform:uppercase;">Din fråga</p>
            <p style="margin:0; color:#102033;">${safeOriginal}</p>
          </div>
          <p style="margin:22px 0 0; color:#526579;">Du kan svara direkt på detta mejl om du vill lägga till något.</p>
        `,
      }),
    }),
    sendTransactionalEmail({
      to: adminEmail,
      subject: `[${inquiry.case_number}] Ny kontaktfråga: ${subject}`,
      replyTo: email,
      text: `Ny kontaktfråga\n\nÄrende: ${inquiry.case_number}\nNamn: ${name}\nFöretag: ${companyName || "-"}\nE-post: ${email}\nÄmne: ${subject}\nMottaget: ${receivedAt}\n\nMeddelande:\n${message}\n\nÖppna Screenia Admin och svara från Visitor messages.`,
      html: renderBrandedEmail({
        eyebrow: "Adminavisering",
        title: "Ny kontaktfråga",
        intro: `${safeName} har skickat ett meddelande via screenia.se.`,
        footer: "Screenia Admin",
        showHelper: false,
        children: `
          <div style="border:1px solid #d8e6f8; border-radius:14px; background:#f5f9ff; padding:18px 20px;">
            <p style="margin:0 0 8px;"><strong>Ärende:</strong> ${escapeHtml(inquiry.case_number)}</p>
            <p style="margin:0 0 8px;"><strong>Namn:</strong> ${safeName}</p>
            <p style="margin:0 0 8px;"><strong>Företag:</strong> ${escapeHtml(companyName || "-")}</p>
            <p style="margin:0 0 8px;"><strong>E-post:</strong> ${escapeHtml(email)}</p>
            <p style="margin:0;"><strong>Ämne:</strong> ${safeSubject}</p>
          </div>
          <div style="margin-top:20px; border-left:4px solid #f3b642; padding:2px 0 2px 18px;">
            <p style="margin:0 0 8px; color:#526579; font-size:13px; font-weight:700; text-transform:uppercase;">Besökarens meddelande</p>
            <p style="margin:0; color:#102033;">${safeOriginal}</p>
          </div>
          <p style="margin:22px 0 0; color:#526579;">Svara och följ ärendet i Screenia Admin under Visitor messages.</p>
        `,
      }),
    }),
  ]);

  await supabaseAdmin
    .from("contact_inquiries")
    .update({
      confirmation_email_id: confirmationResult.ok
        ? confirmationResult.id || null
        : null,
      confirmation_email_status: confirmationResult.ok ? "sent" : "failed",
      admin_notification_email_id: adminEmailResult.ok
        ? adminEmailResult.id || null
        : null,
      admin_notification_email_status: adminEmailResult.ok ? "sent" : "failed",
    })
    .eq("id", inquiry.id);

  await recordAuditEvent(supabaseAdmin, {
    actorType: "system",
    eventType: "visitor_contact_email_dispatch_completed",
    eventDescription:
      "Contact confirmation and admin notification email attempts completed.",
    metadata: {
      inquiryId: inquiry.id,
      caseNumber: inquiry.case_number,
      confirmationEmailSent: confirmationResult.ok,
      confirmationEmailId: confirmationResult.ok
        ? confirmationResult.id || null
        : null,
      adminEmailSent: adminEmailResult.ok,
      adminEmailId: adminEmailResult.ok ? adminEmailResult.id || null : null,
    },
    ipAddress,
    userAgent,
  });

  if (!confirmationResult.ok || !adminEmailResult.ok) {
    await createAdminNotification(supabaseAdmin, {
      eventType: "visitor_contact_email_failed",
      title: `E-postfel för ${inquiry.case_number}`,
      message: "En eller flera e-postaviseringar kunde inte skickas. Ärendet är sparat.",
      priority: "urgent",
      metadata: {
        inquiryId: inquiry.id,
        caseNumber: inquiry.case_number,
        confirmationError: confirmationResult.ok
          ? null
          : confirmationResult.error,
        adminNotificationError: adminEmailResult.ok
          ? null
          : adminEmailResult.error,
      },
    });
  }

  return NextResponse.json(
    {
      success: true,
      caseNumber: inquiry.case_number,
      confirmationEmailSent: confirmationResult.ok,
    },
    { headers: rateLimitHeaders(rateLimit) },
  );
}
