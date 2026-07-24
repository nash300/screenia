import {
  getAuthenticatedAdmin,
  supabaseAdmin,
} from "@/lib/server/admin-api";
import { NextResponse } from "next/server";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import {
  defaultLegalDocuments,
  legalDocumentTypes,
  type LegalDocumentType,
} from "@/lib/legal/document-catalog";

export const dynamic = "force-dynamic";

const statuses = new Set(["draft", "active", "archived"]);

function cleanText(value: unknown, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanDate(value: unknown) {
  const input = cleanText(value, 80);
  if (!input) return null;
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function isDocumentType(value: string): value is LegalDocumentType {
  return (legalDocumentTypes as readonly string[]).includes(value);
}

async function ensureDefaultDocuments() {
  const { data, error } = await supabaseAdmin
    .from("legal_documents")
    .select("document_type, version");

  if (error) return { error };

  const existing = new Set((data || []).map((item) => `${item.document_type}:${item.version}`));
  const missing = defaultLegalDocuments.filter((item) => !existing.has(`${item.document_type}:${item.version}`));

  if (!missing.length) return { error: null };

  const { error: insertError } = await supabaseAdmin
    .from("legal_documents")
    .insert(missing.map((item) => ({ ...item, published_at: item.status === "active" ? item.effective_at : null })));

  return { error: insertError };
}

export async function GET() {
  const user = await getAuthenticatedAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const seeded = await ensureDefaultDocuments();
  if (seeded.error) {
    console.error("Legal document seed error:", seeded.error);
    return NextResponse.json(
      { error: "Could not prepare the document editor. The legal document schema may need updating." },
      { status: 500 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("legal_documents")
    .select("id, document_type, title, version, effective_at, published_at, status, content, summary, pdf_url, created_at, updated_at")
    .order("document_type")
    .order("effective_at", { ascending: false });

  if (error) {
    console.error("Load legal documents error:", error);
    return NextResponse.json({ error: "Could not load legal documents." }, { status: 500 });
  }

  return NextResponse.json({ documents: data || [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const action = cleanText(body.action, 20);
  const id = cleanText(body.id, 100);

  const { data: before, error: beforeError } = id
    ? await supabaseAdmin.from("legal_documents").select("*").eq("id", id).maybeSingle()
    : { data: null, error: null };
  if (beforeError) return NextResponse.json({ error: "Could not read the document." }, { status: 500 });

  if (action === "delete") {
    if (!id || !before) return NextResponse.json({ error: "Document was not found." }, { status: 404 });
    const { error } = await supabaseAdmin.from("legal_documents").delete().eq("id", id);
    if (error) return NextResponse.json({ error: "Could not delete the document." }, { status: 500 });
    await recordAuditEvent(supabaseAdmin, {
      actorType: "admin",
      actorId: user.id,
      eventType: "legal_document_deleted",
      eventDescription: "Admin deleted a customer-facing document.",
      metadata: { before },
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true });
  }

  const documentType = cleanText(body.document_type, 80);
  const title = cleanText(body.title, 160);
  const version = cleanText(body.version, 120);
  const summary = cleanText(body.summary, 2000);
  const content = cleanText(body.content, 25000);
  const status = cleanText(body.status || "draft", 20);
  const effectiveAt = cleanDate(body.effective_at);
  const pdfUrl = cleanText(body.pdf_url, 500) || null;

  if (!isDocumentType(documentType)) return NextResponse.json({ error: "Choose a valid document type." }, { status: 400 });
  if (!statuses.has(status)) return NextResponse.json({ error: "Choose a valid status." }, { status: 400 });
  if (title.length < 2) return NextResponse.json({ error: "Document title is required." }, { status: 400 });
  if (version.length < 2) return NextResponse.json({ error: "Document version is required." }, { status: 400 });
  if (!effectiveAt) return NextResponse.json({ error: "Choose a valid effective date." }, { status: 400 });
  if (content.length < 20) return NextResponse.json({ error: "Document text must be at least 20 characters." }, { status: 400 });

  const payload = {
    document_type: documentType,
    title,
    version,
    effective_at: effectiveAt,
    published_at: status === "active" ? effectiveAt : null,
    status,
    summary,
    content,
    pdf_url: pdfUrl,
  };

  const query = action === "create"
    ? supabaseAdmin.from("legal_documents").insert(payload)
    : supabaseAdmin.from("legal_documents").update(payload).eq("id", id);

  const { data, error } = await query
    .select("id, document_type, title, version, effective_at, published_at, status, content, summary, pdf_url, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("Save legal document error:", error);
    return NextResponse.json({ error: "Could not save the document." }, { status: 500 });
  }

  if (data.status === "active") {
    const { error: archiveError } = await supabaseAdmin
      .from("legal_documents")
      .update({ status: "archived" })
      .eq("document_type", data.document_type)
      .eq("status", "active")
      .neq("id", data.id);

    if (archiveError) {
      console.error("Archive previous legal document versions error:", archiveError);
      return NextResponse.json({ error: "Could not archive older active versions." }, { status: 500 });
    }
  }

  await recordAuditEvent(supabaseAdmin, {
    actorType: "admin",
    actorId: user.id,
    eventType: action === "create" ? "legal_document_created" : "legal_document_updated",
    eventDescription: `Admin ${action === "create" ? "created" : "updated"} a customer-facing document.`,
    metadata: { before, after: data },
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ document: data }, { status: action === "create" ? 201 : 200 });
}
