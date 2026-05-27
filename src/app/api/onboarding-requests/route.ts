import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PRICING_PLANS } from "@/lib/pricing/plans";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const validPlanCodes = new Set<string>(PRICING_PLANS.map((plan) => plan.code));

const isValidEmail = (value: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const planCode = String(body.planCode || "").trim();
    const companyName = String(body.companyName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const contactPerson = String(body.contactPerson || "").trim();
    const phone = String(body.phone || "").trim();
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
      },
      ipAddress,
      userAgent,
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
