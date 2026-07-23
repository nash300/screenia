import { createClient } from "@supabase/supabase-js";
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
  const fallback = defaultLegalDocuments.find((item) => item.document_type === documentType)!;

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

async function getActiveDocument(documentType: LegalDocumentType): Promise<LegalDocumentRow> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return getFallbackDocument(documentType);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase
    .from("legal_documents")
    .select("document_type, title, version, effective_at, summary, content, pdf_url")
    .eq("document_type", documentType)
    .eq("status", "active")
    .order("effective_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return getFallbackDocument(documentType);
  return data as LegalDocumentRow;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function splitParagraphs(content: string) {
  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export default async function PublicLegalDocumentPage({
  documentType,
}: PublicLegalDocumentPageProps) {
  const document = await getActiveDocument(documentType);
  const paragraphs = splitParagraphs(document.content);

  return (
    <div className="landing-page flow-page">
      <main className="flow-shell legal-shell">
        <p className="landing-eyebrow">Juridiskt dokument</p>
        <h1>{document.title || legalDocumentLabels[documentType]}</h1>
        {document.summary ? <p>{document.summary}</p> : null}

        <section className="flow-card">
          <h2>Version</h2>
          <p>{document.version}</p>
          <p>Gäller från: {formatDate(document.effective_at)}</p>
        </section>

        <section className="flow-card">
          <h2>Dokumenttext</h2>
          {paragraphs.length ? (
            paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
          ) : (
            <p>Ingen dokumenttext har publicerats ännu.</p>
          )}
        </section>

        <LegalDocumentActions pdfUrl={document.pdf_url} />
      </main>
    </div>
  );
}
