import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PRICING_PLANS } from "@/lib/pricing/plans";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import {
  escapeHtml,
  formatSek,
  renderBrandedEmail,
  sendTransactionalEmail,
} from "@/lib/server/email";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const validPlanCodes = new Set<string>(PRICING_PLANS.map((plan) => plan.code));

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

type RequestPlan = (typeof PRICING_PLANS)[number];

function requestReceivedAt(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function sendRequestConfirmationEmail({
  email,
  companyName,
  contactPerson,
  plan,
  screenQuantity,
  message,
  requestedAt,
}: {
  email: string;
  companyName: string;
  contactPerson: string;
  plan: RequestPlan;
  screenQuantity: number;
  message: string;
  requestedAt: string;
}) {
  const planName = `${plan.name} ${plan.resolution}`;
  const receivedAt = requestReceivedAt(requestedAt);
  const safeCompanyName = escapeHtml(companyName);
  const safeContactPerson = contactPerson ? escapeHtml(contactPerson) : "";
  const safeMessage = message ? escapeHtml(message) : "";

  return sendTransactionalEmail({
    to: email,
    subject: "Screenia har tagit emot din förfrågan",
    text: `Hej ${companyName},

Tack för din förfrågan. Vi har tagit emot följande:

Företag: ${companyName}
${contactPerson ? `Kontaktperson: ${contactPerson}\n` : ""}E-post: ${email}
Paket: ${planName}
Antal skärmar/enheter: ${screenQuantity}
Start- och konfigurationsavgift: ${formatSek(plan.setupFeeSek)} inkl. moms
Skärmenhet: ${formatSek(plan.hardwareFeeSek)} inkl. moms per enhet
Frakt: ${formatSek(plan.shippingFeeSek)} inkl. moms per enhet
Månadsabonnemang: ${formatSek(plan.monthlyFeeSek)} inkl. moms per enhet
Kostnadsfri provperiod: ${plan.trialDays} dagar
Mottaget: ${receivedAt}
${message ? `\nMeddelande: ${message}\n` : ""}
Screenia granskar uppgifterna och återkommer med nästa steg. Du behöver inte skicka logotyp, meny eller bilder innan betalning.

Vänliga hälsningar,
Screenia`,
    html: renderBrandedEmail({
      eyebrow: "Screenia",
      title: "F&ouml;rfr&aring;gan mottagen",
      intro: "Vi har tagit emot din f&ouml;rfr&aring;gan och sammanfattningen finns h&auml;r.",
      footer: "V&auml;nliga h&auml;lsningar,<br />Screenia",
      children: `
        <p>Hej ${safeCompanyName},</p>
        <p>Vi har tagit emot din förfrågan och sammanfattningen nedan.</p>
        <div style="border: 1px solid #d9e5f7; border-radius: 14px; padding: 16px; background: #f7fbff;">
          <p><strong>Företag:</strong> ${safeCompanyName}</p>
          ${safeContactPerson ? `<p><strong>Kontaktperson:</strong> ${safeContactPerson}</p>` : ""}
          <p><strong>E-post:</strong> ${escapeHtml(email)}</p>
          <p><strong>Paket:</strong> ${escapeHtml(planName)}</p>
          <p><strong>Antal skärmar/enheter:</strong> ${screenQuantity}</p>
          <p><strong>Start- och konfigurationsavgift:</strong> ${formatSek(plan.setupFeeSek)} inkl. moms</p>
          <p><strong>Skärmenhet:</strong> ${formatSek(plan.hardwareFeeSek)} inkl. moms per enhet</p>
          <p><strong>Frakt:</strong> ${formatSek(plan.shippingFeeSek)} inkl. moms per enhet</p>
          <p><strong>Månadsabonnemang:</strong> ${formatSek(plan.monthlyFeeSek)} inkl. moms per enhet</p>
          <p><strong>Kostnadsfri provperiod:</strong> ${plan.trialDays} dagar</p>
          <p><strong>Mottaget:</strong> ${receivedAt}</p>
          ${safeMessage ? `<p><strong>Meddelande:</strong> ${safeMessage}</p>` : ""}
        </div>
        <p>Screenia granskar uppgifterna och återkommer med nästa steg. Du behöver inte skicka logotyp, meny eller bilder innan betalning.</p>
      `,
    }),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const planCode = String(body.planCode || "").trim();
    const companyName = String(body.companyName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const contactPerson = String(body.contactPerson || "").trim();
    const phone = String(body.phone || "").trim();
    const screenQuantity = Math.min(
      50,
      Math.max(1, Number(body.screenQuantity) || 1),
    );
    const message = String(body.message || "").trim();
    const ipAddress = getRequestIp(request);
    const userAgent = request.headers.get("user-agent");

    if (!validPlanCodes.has(planCode)) {
      return NextResponse.json(
        { error: "Välj ett giltigt paket." },
        { status: 400 },
      );
    }

    if (!companyName) {
      return NextResponse.json(
        { error: "Företagsnamn måste anges." },
        { status: 400 },
      );
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Ange en giltig e-postadress." },
        { status: 400 },
      );
    }

    const selectedPlan = PRICING_PLANS.find((plan) => plan.code === planCode);
    if (!selectedPlan) {
      return NextResponse.json(
        { error: "Välj ett giltigt paket." },
        { status: 400 },
      );
    }

    const requestedAt = new Date().toISOString();
    const notes = [
      "Landing purchase request",
      `Requested plan: ${selectedPlan.name} ${selectedPlan.resolution} (${planCode})`,
      `Requested screens/devices: ${screenQuantity}`,
      `Submitted at: ${requestedAt}`,
      message ? `Message: ${message}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const { data, error } = await supabaseAdmin
      .from("customers")
      .insert({
        id: crypto.randomUUID(),
        name: companyName,
        email,
        contact_person: contactPerson || null,
        phone: phone || null,
        country: "Sverige",
        preferred_contact_channel: "email",
        requested_screen_quantity: screenQuantity,
        requested_quote_items: [
          {
            pricingPlanCode: planCode,
            name: selectedPlan.name,
            resolution: selectedPlan.resolution,
            quantity: screenQuantity,
          },
        ],
        status: "new_request",
        notes,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Create onboarding request error:", error);
      return NextResponse.json(
        { error: "Det gick inte att skapa förfrågan." },
        { status: 500 },
      );
    }

    await recordAuditEvent(supabaseAdmin, {
      customerId: data.id,
      actorType: "customer",
      eventType: "landing_purchase_request_created",
      eventDescription: "Customer submitted a package request from the landing page.",
      metadata: {
        planCode,
        planName: selectedPlan.name,
        planResolution: selectedPlan.resolution,
        screenQuantity,
      },
      ipAddress,
      userAgent,
    });

    await createAdminNotification(supabaseAdmin, {
      customerId: data.id,
      eventType: "landing_purchase_request_created",
      title: "New customer request",
      message: `${companyName} requested ${screenQuantity} screen(s) for ${selectedPlan.name}.`,
      priority: "high",
      metadata: {
        planCode,
        planName: selectedPlan.name,
        screenQuantity,
        customerEmail: email,
      },
    });

    const emailResult = await sendRequestConfirmationEmail({
      email,
      companyName,
      contactPerson,
      plan: selectedPlan,
      screenQuantity,
      message,
      requestedAt,
    });

    if (emailResult.ok) {
      await recordAuditEvent(supabaseAdmin, {
        customerId: data.id,
        actorType: "system",
        eventType: "request_confirmation_email_sent",
        eventDescription: "System sent request confirmation email to customer.",
        metadata: {
          sentTo: email,
          resendEmailId: emailResult.id || null,
          planCode,
          screenQuantity,
        },
        ipAddress,
        userAgent,
      });
    } else {
      const eventType = emailResult.configured
        ? "request_confirmation_email_failed"
        : "request_confirmation_email_not_configured";

      await recordAuditEvent(supabaseAdmin, {
        customerId: data.id,
        actorType: "system",
        eventType,
        eventDescription: emailResult.configured
          ? "System could not send request confirmation email."
          : "Request confirmation email was not sent because email is not configured.",
        metadata: {
          sentTo: email,
          error: emailResult.error,
          planCode,
          screenQuantity,
        },
        ipAddress,
        userAgent,
      });

      await createAdminNotification(supabaseAdmin, {
        customerId: data.id,
        eventType,
        title: "Customer email not sent",
        message: `Confirmation email to ${email} was not sent: ${emailResult.error}`,
        priority: "urgent",
        metadata: {
          planCode,
          screenQuantity,
        },
      });
    }

    return NextResponse.json({
      id: data.id,
      success: true,
      emailSent: emailResult.ok,
      warning: emailResult.ok ? null : emailResult.error,
    });
  } catch (error) {
    console.error("Onboarding request error:", error);
    return NextResponse.json(
      { error: "Det gick inte att skapa förfrågan." },
      { status: 500 },
    );
  }
}
