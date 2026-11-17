import { defaultLegalDocuments } from "@/lib/legal/document-catalog";

export const CURRENT_TERMS_VERSION = "2026-11-18";
export const CURRENT_PRIVACY_VERSION = "2026-11-18";

const currentTermsCatalogDocument = defaultLegalDocuments.find(
  (document) => document.document_type === "terms",
)!;
const currentPrivacyCatalogDocument = defaultLegalDocuments.find(
  (document) => document.document_type === "privacy",
)!;

export const CURRENT_TERMS_DOCUMENT = {
  type: "terms",
  title: "Villkor",
  version: CURRENT_TERMS_VERSION,
  effectiveDate: "2026-11-18",
  url: "/terms",
  pdfUrl: null,
  summary: currentTermsCatalogDocument.summary,
  content: currentTermsCatalogDocument.content,
} as const;

export const CURRENT_PRIVACY_DOCUMENT = {
  type: "privacy",
  title: "Integritetspolicy",
  version: CURRENT_PRIVACY_VERSION,
  effectiveDate: "2026-11-18",
  url: "/privacy",
  pdfUrl: null,
  summary: currentPrivacyCatalogDocument.summary,
  content: currentPrivacyCatalogDocument.content,
} as const;
