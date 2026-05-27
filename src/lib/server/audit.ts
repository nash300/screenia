import type { SupabaseClient } from "@supabase/supabase-js";

type AuditEventInput = {
  customerId?: string | null;
  actorType: "system" | "admin" | "customer" | "stripe";
  actorId?: string | null;
  eventType: string;
  eventDescription: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function recordAuditEvent(
  supabaseAdmin: SupabaseClient,
  event: AuditEventInput,
) {
  const { error } = await supabaseAdmin.from("audit_events").insert({
    customer_id: event.customerId || null,
    actor_type: event.actorType,
    actor_id: event.actorId || null,
    event_type: event.eventType,
    event_description: event.eventDescription,
    metadata: event.metadata || {},
    ip_address: event.ipAddress || null,
    user_agent: event.userAgent || null,
  });

  if (error) {
    console.warn("Audit event was not stored:", error.message);
  }
}

type ConsentRecordInput = {
  customerId: string;
  consentType: string;
  granted: boolean;
  statement: string;
  documentName: string;
  documentVersion: string;
  documentUrl?: string | null;
  collectionPoint: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type LegalAgreementInput = {
  customerId: string;
  documentType: "terms" | "privacy";
  documentTitle: string;
  documentVersion: string;
  documentEffectiveAt?: string | null;
  documentUrl?: string | null;
  pdfUrl?: string | null;
  contentSnapshot: string;
  collectionPoint: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function recordConsent(
  supabaseAdmin: SupabaseClient,
  consent: ConsentRecordInput,
) {
  const { error } = await supabaseAdmin.from("consent_records").insert({
    customer_id: consent.customerId,
    consent_type: consent.consentType,
    granted: consent.granted,
    statement: consent.statement,
    document_name: consent.documentName,
    document_version: consent.documentVersion,
    document_url: consent.documentUrl || null,
    collection_point: consent.collectionPoint,
    ip_address: consent.ipAddress || null,
    user_agent: consent.userAgent || null,
  });

  if (error) {
    console.warn("Consent record was not stored:", error.message);
  }
}

export async function recordLegalAgreement(
  supabaseAdmin: SupabaseClient,
  agreement: LegalAgreementInput,
) {
  const { data: document } = await supabaseAdmin
    .from("legal_documents")
    .select("id")
    .eq("document_type", agreement.documentType)
    .eq("version", agreement.documentVersion)
    .maybeSingle();

  const { error } = await supabaseAdmin.from("customer_legal_agreements").insert({
    customer_id: agreement.customerId,
    legal_document_id: document?.id || null,
    document_type: agreement.documentType,
    document_title: agreement.documentTitle,
    document_version: agreement.documentVersion,
    document_effective_at: agreement.documentEffectiveAt || null,
    document_url: agreement.documentUrl || null,
    pdf_url: agreement.pdfUrl || null,
    content_snapshot: agreement.contentSnapshot,
    collection_point: agreement.collectionPoint,
    accepted_ip: agreement.ipAddress || null,
    accepted_user_agent: agreement.userAgent || null,
  });

  if (error) {
    console.warn("Legal agreement was not stored:", error.message);
  }
}

export function getRequestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}
