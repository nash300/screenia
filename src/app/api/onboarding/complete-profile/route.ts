import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getRequestIp,
  recordAuditEvent,
  recordConsent,
  recordLegalAgreement,
} from "@/lib/server/audit";
import {
  CURRENT_PRIVACY_DOCUMENT,
  CURRENT_TERMS_DOCUMENT,
} from "@/lib/legal/documents";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: Request) {
  const body = await request.json();
  const token = String(body.token || "").trim();
  const contactPerson = String(body.contactPerson || "").trim();
  const phone = String(body.phone || "").trim();
  const organisationNumber = String(body.organisationNumber || "").trim();
  const billingEmail = String(body.billingEmail || "").trim().toLowerCase();
  const address = String(body.address || "").trim();
  const postalCode = String(body.postalCode || "").trim();
  const city = String(body.city || "").trim();
  const country = String(body.country || "Sverige").trim() || "Sverige";
  const businessCategory = String(body.businessCategory || "").trim();
  const websiteUrl = String(body.websiteUrl || "").trim();
  const preferredContactChannel = String(
    body.preferredContactChannel || "email",
  ).trim();
  const acceptedTerms = Boolean(body.acceptedTerms);
  const acceptedPrivacy = Boolean(body.acceptedPrivacy);
  const marketingConsent = Boolean(body.marketingConsent);
  const analyticsConsent = Boolean(body.analyticsConsent);
  const remoteSupportConsent = Boolean(body.remoteSupportConsent);
  const ipAddress = getRequestIp(request);
  const userAgent = request.headers.get("user-agent");

  if (!token) {
    return NextResponse.json({ error: "Startlänk saknas." }, { status: 400 });
  }

  if (!contactPerson) {
    return NextResponse.json(
      { error: "Kontaktperson måste anges." },
      { status: 400 },
    );
  }

  if (!organisationNumber || !address || !city) {
    return NextResponse.json(
      { error: "Organisationsnummer, adress och ort måste anges." },
      { status: 400 },
    );
  }

  if (!/^\d{3}\s?\d{2}$/.test(postalCode)) {
    return NextResponse.json(
      { error: "Ange ett giltigt svenskt postnummer." },
      { status: 400 },
    );
  }

  if (!["sverige", "sweden", "se"].includes(country.toLowerCase())) {
    return NextResponse.json(
      { error: "Screenia tar bara emot beställningar från svenska kunder." },
      { status: 400 },
    );
  }

  if (!["email", "phone", "sms"].includes(preferredContactChannel)) {
    return NextResponse.json(
      { error: "Välj ett giltigt kontaktsätt." },
      { status: 400 },
    );
  }

  if (!acceptedTerms || !acceptedPrivacy) {
    return NextResponse.json(
      { error: "Villkor och integritetspolicy måste godkännas." },
      { status: 400 },
    );
  }

  const { data: customer, error: customerError } = await supabaseAdmin
    .from("customers")
    .select("id, name, email, onboarding_token_expires_at")
    .eq("onboarding_token", token)
    .single();

  if (customerError || !customer) {
    return NextResponse.json({ error: "Ogiltig startlänk." }, { status: 404 });
  }

  if (
    customer.onboarding_token_expires_at &&
    new Date(customer.onboarding_token_expires_at) < new Date()
  ) {
    return NextResponse.json(
      { error: "Den här startlänken har gått ut." },
      { status: 410 },
    );
  }

  const acceptedAt = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("customers")
    .update({
      contact_person: contactPerson,
      phone: phone || null,
      organisation_number: organisationNumber,
      billing_email: billingEmail || null,
      address,
      postal_code: postalCode.replace(/\s/g, ""),
      city,
      country: "Sverige",
      business_category: businessCategory || null,
      website_url: websiteUrl || null,
      preferred_contact_channel: preferredContactChannel,
      remote_support_consent: remoteSupportConsent,
      analytics_consent: analyticsConsent,
      terms_accepted_at: acceptedAt,
      privacy_accepted_at: acceptedAt,
      marketing_consent: marketingConsent,
      status: "accepted_terms",
    })
    .eq("id", customer.id);

  if (updateError) {
    console.error("Complete onboarding profile error:", updateError);
    return NextResponse.json(
      { error: "Det gick inte att spara uppgifterna." },
      { status: 500 },
    );
  }

  void Promise.allSettled([
    recordConsent(supabaseAdmin, {
      customerId: customer.id,
      consentType: "terms",
      granted: true,
      statement: "Jag godkänner villkoren.",
      documentName: CURRENT_TERMS_DOCUMENT.title,
      documentVersion: CURRENT_TERMS_DOCUMENT.version,
      documentUrl: CURRENT_TERMS_DOCUMENT.url,
      collectionPoint: "customer_onboarding",
      ipAddress,
      userAgent,
    }),
    recordLegalAgreement(supabaseAdmin, {
      customerId: customer.id,
      documentType: "terms",
      documentTitle: CURRENT_TERMS_DOCUMENT.title,
      documentVersion: CURRENT_TERMS_DOCUMENT.version,
      documentEffectiveAt: CURRENT_TERMS_DOCUMENT.effectiveDate,
      documentUrl: CURRENT_TERMS_DOCUMENT.url,
      pdfUrl: CURRENT_TERMS_DOCUMENT.pdfUrl,
      contentSnapshot: CURRENT_TERMS_DOCUMENT.content,
      collectionPoint: "customer_onboarding",
      ipAddress,
      userAgent,
    }),
    recordConsent(supabaseAdmin, {
      customerId: customer.id,
      consentType: "privacy",
      granted: true,
      statement: "Jag godkänner integritetspolicyn.",
      documentName: CURRENT_PRIVACY_DOCUMENT.title,
      documentVersion: CURRENT_PRIVACY_DOCUMENT.version,
      documentUrl: CURRENT_PRIVACY_DOCUMENT.url,
      collectionPoint: "customer_onboarding",
      ipAddress,
      userAgent,
    }),
    recordLegalAgreement(supabaseAdmin, {
      customerId: customer.id,
      documentType: "privacy",
      documentTitle: CURRENT_PRIVACY_DOCUMENT.title,
      documentVersion: CURRENT_PRIVACY_DOCUMENT.version,
      documentEffectiveAt: CURRENT_PRIVACY_DOCUMENT.effectiveDate,
      documentUrl: CURRENT_PRIVACY_DOCUMENT.url,
      pdfUrl: CURRENT_PRIVACY_DOCUMENT.pdfUrl,
      contentSnapshot: CURRENT_PRIVACY_DOCUMENT.content,
      collectionPoint: "customer_onboarding",
      ipAddress,
      userAgent,
    }),
    recordConsent(supabaseAdmin, {
      customerId: customer.id,
      consentType: "marketing",
      granted: marketingConsent,
      statement: "Jag vill få relevanta nyheter och erbjudanden från Screenia.",
      documentName: "Samtycke till marknadskommunikation",
      documentVersion: "2026-05-28",
      collectionPoint: "customer_onboarding",
      ipAddress,
      userAgent,
    }),
    recordConsent(supabaseAdmin, {
      customerId: customer.id,
      consentType: "analytics",
      granted: analyticsConsent,
      statement:
        "Screenia får använda order- och användningsdata för statistik och förbättring av tjänsten.",
      documentName: "Samtycke till statistik och tjänsteförbättring",
      documentVersion: "2026-06-04",
      collectionPoint: "customer_onboarding",
      ipAddress,
      userAgent,
    }),
    recordConsent(supabaseAdmin, {
      customerId: customer.id,
      consentType: "remote_support",
      granted: remoteSupportConsent,
      statement:
        "Screenia får kontakta kunden och ge fjärrsupport när kunden ber om hjälp.",
      documentName: "Samtycke till fjärrsupport",
      documentVersion: "2026-06-04",
      collectionPoint: "customer_onboarding",
      ipAddress,
      userAgent,
    }),
    recordAuditEvent(supabaseAdmin, {
      customerId: customer.id,
      actorType: "customer",
      eventType: "onboarding_profile_completed",
      eventDescription: "Customer completed profile and legal consent before payment.",
      metadata: {
        acceptedTerms,
        acceptedPrivacy,
        marketingConsent,
        analyticsConsent,
        remoteSupportConsent,
        termsVersion: CURRENT_TERMS_DOCUMENT.version,
        privacyVersion: CURRENT_PRIVACY_DOCUMENT.version,
      },
      ipAddress,
      userAgent,
    }),
  ]);

  return NextResponse.json({ success: true });
}
