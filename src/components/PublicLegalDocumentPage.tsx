import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import LegalDocumentActions from "@/components/LegalDocumentActions";
import {
  defaultLegalDocuments,
  legalDocumentLabels,
  type LegalDocumentType,
} from "@/lib/legal/document-catalog";

type LegalDocumentRow = {
  document_type: LegalDocumentType;
  title: string;
  version: string;
  effective_at: string;
  summary: string | null;
  content: string;
  pdf_url: string | null;
};

type PublicLegalDocumentPageProps = {
  documentType: LegalDocumentType;
};

function getFallbackDocument(documentType: LegalDocumentType): LegalDocumentRow {
  const fallback = defaultLegalDocuments.find(
    (item) => item.document_type === documentType,
  )!;

  return {
    document_type: fallback.document_type,
    title: fallback.title,
    version: fallback.version,
    effective_at: fallback.effective_at,
    summary: fallback.summary,
    content: fallback.content,
    pdf_url: fallback.pdf_url,
  };
}

async function getActiveDocument(
  documentType: LegalDocumentType,
): Promise<LegalDocumentRow> {
  const fallback = getFallbackDocument(documentType);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return fallback;

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase
    .from("legal_documents")
    .select(
      "document_type, title, version, effective_at, summary, content, pdf_url",
    )
    .eq("document_type", documentType)
    .eq("status", "active")
    .order("effective_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return fallback;

  const storedDocument = data as LegalDocumentRow;
  const storedDate = new Date(storedDocument.effective_at).getTime();
  const fallbackDate = new Date(fallback.effective_at).getTime();

  return Number.isFinite(storedDate) && storedDate > fallbackDate
    ? storedDocument
    : fallback;
}

function formatDate(value: string) {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsedDate);
}

function splitBlocks(content: string) {
  return content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

const relatedDocuments: Array<{
  type: LegalDocumentType;
  href: string;
}> = [
  { type: "terms", href: "/terms" },
  { type: "privacy", href: "/privacy" },
  { type: "cookie", href: "/cookie-policy" },
  { type: "subscription_billing", href: "/subscription-billing-policy" },
  { type: "support_service", href: "/support-service-policy" },
];

export default async function PublicLegalDocumentPage({
  documentType,
}: PublicLegalDocumentPageProps) {
  const document = await getActiveDocument(documentType);
  const blocks = splitBlocks(document.content);
  const isDraft = /utkast|prelaunch/i.test(document.version);

  return (
    <div className="landing-page flow-page">
      <main className="flow-shell legal-shell">
        <p className="landing-eyebrow">Villkor och policy</p>
        <h1>{document.title || legalDocumentLabels[documentType]}</h1>
        {document.summary ? <p>{document.summary}</p> : null}

        {isDraft ? (
          <aside className="legal-draft-notice">
            <strong>Dokumentet är ett avtalsutkast.</strong>
            <span>
              Texten används för granskning och test. Slutlig juridisk
              granskning krävs innan livebetalningar aktiveras.
            </span>
          </aside>
        ) : null}

        <div className="legal-document-meta">
          <span>Version: {document.version}</span>
          <span>Gäller från: {formatDate(document.effective_at)}</span>
        </div>

        <nav className="legal-document-nav" aria-label="Villkor och policyer">
          {relatedDocuments.map((item) => (
            <Link
              href={item.href}
              key={item.type}
              aria-current={item.type === documentType ? "page" : undefined}
            >
              {legalDocumentLabels[item.type]}
            </Link>
          ))}
        </nav>

        <article className="legal-document-body">
          {blocks.length ? (
            blocks.map((block, index) => {
              if (block.startsWith("### ")) {
                return <h3 key={`${index}-${block}`}>{block.slice(4)}</h3>;
              }
              if (block.startsWith("## ")) {
                return <h2 key={`${index}-${block}`}>{block.slice(3)}</h2>;
              }
              return <p key={`${index}-${block}`}>{block}</p>;
            })
          ) : (
            <p>Ingen dokumenttext har publicerats ännu.</p>
          )}
        </article>

        <LegalDocumentActions pdfUrl={document.pdf_url} />
      </main>
    </div>
  );
}
