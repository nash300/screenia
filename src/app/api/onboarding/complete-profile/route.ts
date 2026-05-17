import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent, recordConsent } from "@/lib/server/audit";
import { normalizeCustomerLanguage } from "@/lib/customer-language";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const TERMS_VERSION = "2026-05-07";
const PRIVACY_VERSION = "2026-05-07";
const DISPLAY_ASSET_BUCKET = "customer-display-assets";
const MAX_DISPLAY_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_DISPLAY_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);
const ALLOWED_COURIERS = new Set([
  "PostNord",
  "DHL",
  "Bring",
  "DB Schenker",
  "Instabox",
]);

type DisplayFileInput = {
  name?: string;
  type?: string;
  size?: number;
  data?: string;
};

function sanitizeFileName(fileName: string) {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function decodeBase64File(file: DisplayFileInput) {
  const base64 = String(file.data || "").split(",").pop() || "";
  return Buffer.from(base64, "base64");
}

export async function POST(request: Request) {
  const body = await request.json();
  const language = normalizeCustomerLanguage(body.language);
  const token = String(body.token || "").trim();
  const contactPerson = String(body.contactPerson || "").trim();
  const phone = String(body.phone || "").trim();
  const organisationNumber = String(body.organisationNumber || "").trim();
  const address = String(body.address || "").trim();
  const city = String(body.city || "").trim();
  const country = String(body.country || "Sweden").trim() || "Sweden";
  const acceptedTerms = Boolean(body.acceptedTerms);
  const acceptedPrivacy = Boolean(body.acceptedPrivacy);
  const marketingConsent = Boolean(body.marketingConsent);
  const preferredCourier = String(body.preferredCourier || "").trim();
  const displayNotes = String(body.displayNotes || "").trim();
  const displayFiles = Array.isArray(body.displayFiles)
    ? (body.displayFiles as DisplayFileInput[])
    : [];
  const ipAddress = getRequestIp(request);
  const userAgent = request.headers.get("user-agent");

  if (!token) {
    return NextResponse.json(
      { error: "Startlänk saknas." },
      { status: 400 },
    );
  }

  if (!contactPerson) {
    return NextResponse.json(
      { error: "Kontaktperson måste anges." },
      { status: 400 },
    );
  }

  if (!acceptedTerms || !acceptedPrivacy) {
    return NextResponse.json(
      { error: "Villkor och integritetspolicy måste godkännas." },
      { status: 400 },
    );
  }

  if (!ALLOWED_COURIERS.has(preferredCourier)) {
    return NextResponse.json(
      { error: "Välj transportör." },
      { status: 400 },
    );
  }

  const { data: customer, error: customerError } = await supabaseAdmin
    .from("customers")
    .select("id, name, email, notes, onboarding_token_expires_at")
    .eq("onboarding_token", token)
    .single();

  if (customerError || !customer) {
    return NextResponse.json(
      { error: "Ogiltig startlänk." },
      { status: 404 },
    );
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
  const currentNotes = String(customer.notes || "").trim();
  const nextNotes =
    [
      currentNotes,
      `Preferred language: ${language}`,
      `Preferred courier: ${preferredCourier}`,
      displayNotes ? `Display material notes: ${displayNotes}` : "",
    ]
      .filter(Boolean)
      .join("\n") || null;

  const { error: updateError } = await supabaseAdmin
    .from("customers")
    .update({
      contact_person: contactPerson,
      phone: phone || null,
      organisation_number: organisationNumber || null,
      address: address || null,
      city: city || null,
      country,
      terms_accepted_at: acceptedAt,
      privacy_accepted_at: acceptedAt,
      marketing_consent: marketingConsent,
      notes: nextNotes,
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

  const storedFiles = [];

  for (const file of displayFiles) {
    const fileName = sanitizeFileName(String(file.name || "display-material"));
    const contentType = String(file.type || "application/octet-stream");
    const fileSize = Number(file.size || 0);

    if (!fileName || !ALLOWED_DISPLAY_FILE_TYPES.has(contentType)) {
      console.warn("Skipped unsupported display asset:", fileName, contentType);
      continue;
    }

    if (fileSize > MAX_DISPLAY_FILE_BYTES) {
      console.warn("Skipped oversized display asset:", fileName, fileSize);
      continue;
    }

    const bytes = decodeBase64File(file);

    if (bytes.byteLength === 0 || bytes.byteLength > MAX_DISPLAY_FILE_BYTES) {
      console.warn("Skipped invalid display asset:", fileName);
      continue;
    }

    const storagePath = `${customer.id}/${crypto.randomUUID()}-${fileName}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(DISPLAY_ASSET_BUCKET)
      .upload(storagePath, bytes, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.warn("Display asset upload failed:", uploadError.message);
      continue;
    }

    const { error: assetError } = await supabaseAdmin
      .from("customer_display_assets")
      .insert({
        customer_id: customer.id,
        file_name: fileName,
        content_type: contentType,
        file_size: bytes.byteLength,
        storage_bucket: DISPLAY_ASSET_BUCKET,
        storage_path: storagePath,
        uploaded_by: "customer",
      });

    if (assetError) {
      console.warn("Display asset metadata failed:", assetError.message);
    } else {
      storedFiles.push(fileName);
    }
  }

  await Promise.all([
    recordConsent(supabaseAdmin, {
      customerId: customer.id,
      consentType: "terms",
      granted: true,
      statement: "Jag godkänner villkoren.",
      documentName: "Villkor",
      documentVersion: TERMS_VERSION,
      documentUrl: "/terms",
      collectionPoint: "customer_onboarding",
      ipAddress,
      userAgent,
    }),
    recordConsent(supabaseAdmin, {
      customerId: customer.id,
      consentType: "privacy",
      granted: true,
      statement: "Jag godkänner integritetspolicyn.",
      documentName: "Integritetspolicy",
      documentVersion: PRIVACY_VERSION,
      documentUrl: "/privacy",
      collectionPoint: "customer_onboarding",
      ipAddress,
      userAgent,
    }),
    recordConsent(supabaseAdmin, {
      customerId: customer.id,
      consentType: "marketing",
      granted: marketingConsent,
      statement: "Jag vill få relevanta nyheter och erbjudanden från InfoSync.",
      documentName: "Samtycke till marknadskommunikation",
      documentVersion: "2026-05-07",
      collectionPoint: "customer_onboarding",
      ipAddress,
      userAgent,
    }),
    recordAuditEvent(supabaseAdmin, {
      customerId: customer.id,
      actorType: "customer",
      eventType: "onboarding_profile_completed",
      eventDescription: "Customer completed profile and legal consent step.",
      metadata: {
        acceptedTerms,
        acceptedPrivacy,
        marketingConsent,
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        displayNotesProvided: Boolean(displayNotes),
        displayFiles: storedFiles,
        preferredCourier,
      },
      ipAddress,
      userAgent,
    }),
  ]);

  return NextResponse.json({ success: true });
}
