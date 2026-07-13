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
import { createAdminNotification } from "@/lib/server/admin-notifications";
import {
  isValidSwedishRegistrationNumber,
  normalizeSwedishRegistrationNumber,
} from "@/lib/business/sweden";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function isMissingOrExpiredToken(expiresAt: string | null | undefined) {
  if (!expiresAt) return true;
  return new Date(expiresAt) < new Date();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

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

  if (!isValidSwedishRegistrationNumber(organisationNumber)) {
    return NextResponse.json(
      { error: "Ange ett giltigt svenskt organisationsnummer." },
      { status: 400 },
    );
  }

  if (!/^\d{3}\s?\d{2}$/.test(postalCode)) {
    return NextResponse.json(
      { error: "Ange ett giltigt svenskt postnummer." },
      { status: 400 },
    );
  }

  if (billingEmail && !isValidEmail(billingEmail)) {
    return NextResponse.json(
      { error: "Ange en giltig faktura-e-postadress." },
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
    .select(
      "id, name, email, status, payment_status, onboarding_token_expires_at, contact_person, phone, organisation_number, billing_email, address, postal_code, city, country, business_category, website_url, preferred_contact_channel, remote_support_consent, analytics_consent, marketing_consent, terms_accepted_at, privacy_accepted_at",
    )
    .eq("onboarding_token", token)
    .single();

  if (customerError || !customer) {
    return NextResponse.json({ error: "Ogiltig startlänk." }, { status: 404 });
  }

  if (isMissingOrExpiredToken(customer.onboarding_token_expires_at)) {
    return NextResponse.json(
      { error: "Den här startlänken har gått ut." },
      { status: 410 },
    );
  }

  if (["paid", "refunded", "cancelled"].includes(customer.payment_status || "")) {
    return NextResponse.json(
      { error: "Den här onboardinglänken kan inte längre ändra kunduppgifter." },
      { status: 409 },
    );
  }

  try {
    await Promise.all([
      recordConsent(
        supabaseAdmin,
        {
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
        },
        { throwOnError: true },
      ),
      recordLegalAgreement(
        supabaseAdmin,
        {
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
        },
        { throwOnError: true },
      ),
      recordConsent(
        supabaseAdmin,
        {
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
        },
        { throwOnError: true },
      ),
      recordLegalAgreement(
        supabaseAdmin,
        {
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
        },
        { throwOnError: true },
      ),
    ]);
  } catch (error) {
    console.error("Required legal evidence was not stored:", error);
    return NextResponse.json(
      {
        error:
          "Det gick inte att spara villkor och integritetssamtycke. Försök igen innan betalning.",
      },
      { status: 500 },
    );
  }

  const acceptedAt = new Date().toISOString();
  const normalizedOrganisationNumber =
    normalizeSwedishRegistrationNumber(organisationNumber);

  const { error: updateError } = await supabaseAdmin
    .from("customers")
    .update({
      contact_person: contactPerson,
      phone: phone || null,
      organisation_number: normalizedOrganisationNumber,
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
    .eq("id", customer.id)
    .eq("onboarding_token", token);

  if (updateError) {
    console.error("Complete onboarding profile error:", updateError);
    return NextResponse.json(
      { error: "Det gick inte att spara uppgifterna." },
      { status: 500 },
    );
  }

  try {
    await Promise.all([
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
      }, { throwOnError: true }),
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
      }, { throwOnError: true }),
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
      }, { throwOnError: true }),
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
      }, { throwOnError: true }),
    ]);
  } catch (evidenceError) {
    console.error("Onboarding profile evidence was not stored:", evidenceError);

    await supabaseAdmin
      .from("customers")
      .update({
        contact_person: customer.contact_person,
        phone: customer.phone,
        organisation_number: customer.organisation_number,
        billing_email: customer.billing_email,
        address: customer.address,
        postal_code: customer.postal_code,
        city: customer.city,
        country: customer.country,
        business_category: customer.business_category,
        website_url: customer.website_url,
        preferred_contact_channel: customer.preferred_contact_channel,
        remote_support_consent: customer.remote_support_consent,
        analytics_consent: customer.analytics_consent,
        marketing_consent: customer.marketing_consent,
        terms_accepted_at: customer.terms_accepted_at,
        privacy_accepted_at: customer.privacy_accepted_at,
        status: customer.status,
      })
      .eq("id", customer.id);

    await createAdminNotification(supabaseAdmin, {
      customerId: customer.id,
      eventType: "onboarding_profile_evidence_failed",
      title: "Onboarding profile evidence failed",
      message:
        "A customer onboarding profile update was rolled back because optional consent or completion audit evidence was not stored.",
      priority: "urgent",
      metadata: {
        email: customer.email,
        error:
          evidenceError instanceof Error
            ? evidenceError.message
            : "Unknown onboarding profile evidence error",
      },
    });

    return NextResponse.json(
      {
        error:
          "Det gick inte att spara hela onboardinghistoriken. Forsok igen innan betalning.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
