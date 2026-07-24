import {
  createAuthenticatedClient,
  supabaseAdmin,
} from "@/lib/server/admin-api";
import { NextResponse } from "next/server";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { renderBrandedEmail, sendTransactionalEmail } from "@/lib/server/email";


const escapeHtml = (value: string) => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

const emailCopy = {
  sv: {
    subject: "Din startlänk till Screenia",
    intro: "Nu kan du färdigställa dina uppgifter för Screenia här:",
    heading: "Dags att komma igång med Screenia",
    body:
      "Bekräfta företagets uppgifter och gå vidare till betalning via den säkra länken nedan. Material samlas in efter betalning.",
    cta: "Öppna startguiden",
    expires: "Länken gäller i 14 dagar.",
    regards: "Vänliga hälsningar",
    greeting: "Hej",
  },
  en: {
    subject: "Your Screenia setup link",
    intro: "You can now complete your Screenia details here:",
    heading: "Time to get started with Screenia",
    body:
      "Confirm your company details and continue to payment using the secure link below. Content is collected after payment.",
    cta: "Open setup guide",
    expires: "This link is valid for 14 days.",
    regards: "Kind regards",
    greeting: "Hi",
  },
};

function cleanReason(value: unknown) {
  return String(value || "").trim().slice(0, 1200);
}

async function recordOnboardingEmailControlFailure({
  customerId,
  eventType,
  title,
  message,
  metadata,
}: {
  customerId: string;
  eventType: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
}) {
  await createAdminNotification(
    supabaseAdmin,
    {
      customerId,
      eventType,
      title,
      message,
      priority: "urgent",
      metadata,
    },
    { throwOnError: true },
  );
}

export async function POST(request: Request) {
  const supabase = await createAuthenticatedClient({ persistSession: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.app_metadata.role !== "admin") {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { customerId, reason: rawReason } = await request
    .json()
    .catch(() => ({}));
  const reason = cleanReason(rawReason);
  const ipAddress = getRequestIp(request);
  const userAgent = request.headers.get("user-agent");

  if (!customerId) {
    return NextResponse.json(
      { error: "Missing customer id." },
      { status: 400 },
    );
  }

  if (reason.length < 5) {
    return NextResponse.json(
      { error: "A reason of at least 5 characters is required." },
      { status: 400 },
    );
  }

  const { data: customer, error: customerError } = await supabaseAdmin
    .from("customers")
    .select("id, name, email, notes")
    .eq("id", customerId)
    .single();

  if (customerError || !customer) {
    return NextResponse.json(
      { error: "Customer was not found." },
      { status: 404 },
    );
  }

  if (!customer.email) {
    return NextResponse.json(
      { error: "Customer does not have an email address." },
      { status: 400 },
    );
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    `${new URL(request.url).protocol}//${new URL(request.url).host}`;
  const onboardingUrl = `${appUrl}/onboarding/${token}`;
  const customerName = escapeHtml(customer.name);
  const copy = emailCopy.sv;

  const { error: tokenError } = await supabaseAdmin
    .from("customers")
    .update({
      onboarding_token: token,
      onboarding_token_expires_at: expiresAt.toISOString(),
    })
    .eq("id", customer.id);

  if (tokenError) {
    console.error("Onboarding token database update error:", tokenError);
    return NextResponse.json(
      { error: "Could not prepare onboarding link." },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId: customer.id,
        actorType: "admin",
        actorId: user.id,
        eventType: "onboarding_link_prepared",
        eventDescription: "Admin prepared an onboarding link.",
        metadata: {
          expiresAt: expiresAt.toISOString(),
          reason,
        },
        ipAddress,
        userAgent,
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Onboarding link preparation audit was not stored:", auditError);
    await recordOnboardingEmailControlFailure({
      customerId: customer.id,
      eventType: "onboarding_link_audit_failed",
      title: "Onboarding link audit missing",
      message:
        "An onboarding link was prepared, but the admin action audit was not stored.",
      metadata: {
        expiresAt: expiresAt.toISOString(),
        reason,
        error:
          auditError instanceof Error
            ? auditError.message
            : "Unknown onboarding link audit error",
      },
    });

    return NextResponse.json(
      { error: "Onboarding link was prepared, but audit evidence was not stored." },
      { status: 500 },
    );
  }
  const emailResult = await sendTransactionalEmail({
    to: customer.email,
    subject: copy.subject,
    text: `${copy.greeting} ${customer.name},

${copy.intro}
${onboardingUrl}

${copy.expires}

${copy.regards},
Screenia`,
    html: renderBrandedEmail({
      eyebrow: "Startguide",
      title: copy.heading,
      children: `
        <div style="font-family: Arial, sans-serif; color: #102033; line-height: 1.6;">
          <p>${copy.greeting} ${customerName},</p>
          <p>${copy.body}</p>
          <p>
            <a href="${onboardingUrl}" style="display: inline-block; background: #145da0; color: #ffffff; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: 700;">
              ${copy.cta}
            </a>
          </p>
          <p style="color: #5f7187;">${copy.expires}</p>
          <p>${copy.regards},<br />Screenia</p>
        </div>
      `,
    }),
  });

  if (!emailResult.ok && !emailResult.configured) {
    const missingConfig = ["RESEND_API_KEY", "RESEND_FROM_EMAIL"];

    try {
      await recordAuditEvent(
        supabaseAdmin,
        {
          customerId: customer.id,
          actorType: "system",
          eventType: "onboarding_email_not_configured",
          eventDescription:
            "Onboarding email was not sent because email is not fully configured.",
          metadata: {
            sentTo: customer.email,
            missingConfig,
            error: emailResult.error,
            expiresAt: expiresAt.toISOString(),
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
          eventType: "onboarding_email_not_configured",
          title: "Onboarding email not sent",
          message: `Onboarding link was prepared, but email config is missing: ${missingConfig.join(", ")}.`,
          priority: "urgent",
          metadata: {
            missingConfig,
          },
        },
        { throwOnError: true },
      );
    } catch (evidenceError) {
      console.error(
        "Onboarding email not-configured evidence was not stored:",
        evidenceError,
      );
      return NextResponse.json(
        {
          error:
            "Onboarding link was prepared, but Screenia could not store email failure evidence.",
          onboardingUrl,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      emailSent: false,
      onboardingUrl,
      warning:
        "Onboarding link created. Email sending is not fully configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL to send emails.",
    });
  }

  if (!emailResult.ok) {
    const errorMessage = emailResult.error;
    console.error("Resend email error:", errorMessage);

    try {
      await recordAuditEvent(
        supabaseAdmin,
        {
          customerId: customer.id,
          actorType: "system",
          eventType: "onboarding_email_failed",
          eventDescription: "System could not send onboarding email.",
          metadata: {
            sentTo: customer.email,
            error: errorMessage,
            expiresAt: expiresAt.toISOString(),
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
          eventType: "onboarding_email_failed",
          title: "Onboarding email failed",
          message: `Onboarding email could not be sent to ${customer.email}: ${errorMessage}`,
          priority: "urgent",
          metadata: {
            error: errorMessage,
          },
        },
        { throwOnError: true },
      );
    } catch (evidenceError) {
      console.error("Onboarding email failure evidence was not stored:", evidenceError);
      return NextResponse.json(
        {
          error:
            "Onboarding email failed, and Screenia could not store failure evidence.",
          onboardingUrl,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: `Could not send onboarding email: ${errorMessage}` },
      { status: 502 },
    );
  }

  const existingNotes = String(customer.notes || "").trim();
  const sentNote = `Start guide email sent: ${new Date().toISOString()}`;

  const { error: updateError } = await supabaseAdmin
    .from("customers")
    .update({
      status: "invited",
      notes: existingNotes ? `${existingNotes}\n${sentNote}` : sentNote,
    })
    .eq("id", customer.id);

  if (updateError) {
    console.error("Onboarding email database update error:", updateError);
    return NextResponse.json(
      { error: "Email was sent, but customer status update failed." },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId: customer.id,
        actorType: "system",
        eventType: "onboarding_email_sent",
        eventDescription: "System sent onboarding email to customer.",
        metadata: {
          sentTo: customer.email,
          expiresAt: expiresAt.toISOString(),
          resendEmailId: emailResult.id || null,
        },
        ipAddress,
        userAgent,
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Onboarding email sent audit was not stored:", auditError);
    await recordOnboardingEmailControlFailure({
      customerId: customer.id,
      eventType: "onboarding_email_audit_failed",
      title: "Onboarding email audit missing",
      message:
        "An onboarding email was sent, but the delivery audit was not stored.",
      metadata: {
        sentTo: customer.email,
        expiresAt: expiresAt.toISOString(),
        resendEmailId: emailResult.id || null,
        error:
          auditError instanceof Error
            ? auditError.message
            : "Unknown onboarding email audit error",
      },
    });

    return NextResponse.json(
      {
        error:
          "Email was sent, but Screenia could not store delivery audit evidence.",
        onboardingUrl,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    emailSent: true,
    sentTo: customer.email,
    onboardingUrl,
  });
}
