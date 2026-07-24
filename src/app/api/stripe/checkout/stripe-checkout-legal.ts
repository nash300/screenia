import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from "@/lib/legal/documents";
import { supabaseAdmin } from "@/lib/server/admin-api";
export async function hasRequiredLegalEvidence(customerId: string) {
  const [consentResult, agreementResult] = await Promise.all([
    supabaseAdmin
      .from("consent_records")
      .select("consent_type, document_version")
      .eq("customer_id", customerId)
      .eq("granted", true)
      .in("consent_type", ["terms", "privacy"])
      .in("document_version", [CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION]),
    supabaseAdmin
      .from("customer_legal_agreements")
      .select("document_type, document_version")
      .eq("customer_id", customerId)
      .in("document_type", ["terms", "privacy"])
      .in("document_version", [CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION]),
  ]);

  if (consentResult.error || agreementResult.error) {
    console.error("Checkout legal evidence lookup failed:", {
      consentError: consentResult.error,
      agreementError: agreementResult.error,
    });

    return {
      ok: false,
      error:
        "Det gick inte att kontrollera villkor och integritetssamtycke. Försök igen innan betalning.",
    };
  }

  const consentRows = consentResult.data || [];
  const agreementRows = agreementResult.data || [];
  const hasTermsConsent = consentRows.some(
    (row) =>
      row.consent_type === "terms" &&
      row.document_version === CURRENT_TERMS_VERSION,
  );
  const hasPrivacyConsent = consentRows.some(
    (row) =>
      row.consent_type === "privacy" &&
      row.document_version === CURRENT_PRIVACY_VERSION,
  );
  const hasTermsAgreement = agreementRows.some(
    (row) =>
      row.document_type === "terms" &&
      row.document_version === CURRENT_TERMS_VERSION,
  );
  const hasPrivacyAgreement = agreementRows.some(
    (row) =>
      row.document_type === "privacy" &&
      row.document_version === CURRENT_PRIVACY_VERSION,
  );

  if (
    !hasTermsConsent ||
    !hasPrivacyConsent ||
    !hasTermsAgreement ||
    !hasPrivacyAgreement
  ) {
    return {
      ok: false,
      error:
        "Kunden måste först godkänna aktuella villkor och integritetspolicy i onboarding innan betalning kan startas.",
    };
  }

  return { ok: true, error: null };
}
