import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PRICING_PLANS } from "@/lib/pricing/plans";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const validPlanCodes = new Set<string>(PRICING_PLANS.map((plan) => plan.code));

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

async function sendRequestConfirmationEmail({
  email,
  companyName,
  planName,
  screenQuantity,
}: {
  email: string;
  companyName: string;
  planName: string;
  screenQuantity: number;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) return;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "InfoSync har tagit emot din förfrågan",
      text: `Hej ${companyName},

Tack för din förfrågan. Vi har tagit emot önskemålet om ${screenQuantity} skärm(ar) med paketet ${planName}.

InfoSync granskar uppgifterna och återkommer med nästa steg. Du behöver inte skicka logotyp, meny eller bilder innan betalning.

Vänliga hälsningar,
InfoSync`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #09244a; line-height: 1.6;">
          <h1>Förfrågan mottagen</h1>
          <p>Hej ${companyName},</p>
          <p>Vi har tagit emot önskemålet om <strong>${screenQuantity} skärm(ar)</strong> med paketet <strong>${planName}</strong>.</p>
          <p>InfoSync granskar uppgifterna och återkommer med nästa steg. Du behöver inte skicka logotyp, meny eller bilder innan betalning.</p>
          <p>Vänliga hälsningar,<br />InfoSync</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    console.warn("Could not send onboarding request confirmation email.");
  }
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
    const requestedAt = new Date().toISOString();
    const notes = [
      "Landing purchase request",
      `Requested plan: ${selectedPlan?.name} ${selectedPlan?.resolution} (${planCode})`,
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
            name: selectedPlan?.name,
            resolution: selectedPlan?.resolution,
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
        planName: selectedPlan?.name,
        planResolution: selectedPlan?.resolution,
        screenQuantity,
      },
      ipAddress,
      userAgent,
    });

    await createAdminNotification(supabaseAdmin, {
      customerId: data.id,
      eventType: "landing_purchase_request_created",
      title: "New customer request",
      message: `${companyName} requested ${screenQuantity} screen(s) for ${selectedPlan?.name || planCode}.`,
      priority: "high",
      metadata: {
        planCode,
        planName: selectedPlan?.name,
        screenQuantity,
        customerEmail: email,
      },
    });

    await sendRequestConfirmationEmail({
      email,
      companyName,
      planName: `${selectedPlan?.name || "InfoSync"} ${selectedPlan?.resolution || ""}`.trim(),
      screenQuantity,
    });

    return NextResponse.json({ id: data.id, success: true });
  } catch (error) {
    console.error("Onboarding request error:", error);
    return NextResponse.json(
      { error: "Det gick inte att skapa förfrågan." },
      { status: 500 },
    );
  }
}
