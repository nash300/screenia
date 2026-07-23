"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { legalDocumentLabels, legalDocumentTypes, type LegalDocumentType } from "@/lib/legal/document-catalog";

type LegalDocument = {
  id: string;
  document_type: LegalDocumentType;
  title: string;
  version: string;
  effective_at: string;
  published_at: string | null;
  status: "draft" | "active" | "archived";
  summary: string | null;
  content: string;
  pdf_url: string | null;
  updated_at: string;
};

type Notice = { type: "success" | "error" | "info"; message: string };

const emptyDocument = (documentType: LegalDocumentType = "terms"): LegalDocument => ({
  id: "new-document",
  document_type: documentType,
  title: legalDocumentLabels[documentType],
  version: createVersionValue(),
  effective_at: new Date().toISOString().slice(0, 10),
  published_at: null,
  status: "draft",
  summary: documentUsage[documentType],
  content: "",
  pdf_url: "",
  updated_at: "",
});

const documentUsage: Record<LegalDocumentType, string> = {
  terms: "Used on /terms and during onboarding/payment acceptance. Describes service scope, customer responsibilities, access, cancellation, and refund boundaries.",
  privacy: "Used on /privacy and linked from request, onboarding, account, and customer communication flows. Describes personal data handling, processors, rights, consent, and retention.",
  cookie: "Used on /cookie-policy and linked from the website footer. Describes necessary cookies, session storage, payment flow storage, and optional tracking rules.",
  subscription_billing: "Used on /subscription-billing-policy and linked from pricing, onboarding, and account billing flows. Describes how first payment, trial, subscription billing, invoices, cancellation, VAT, and refunds are handled.",
  support_service: "Used on /support-service-policy and linked from support/customer service flows. Describes service channels, customer material, remote support consent, and traceable support handling.",
};

function createVersionValue() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
}

const formatDateInput = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const formatDocumentReference = (item: LegalDocument) =>
  `${legalDocumentLabels[item.document_type]} - ${item.status === "active" ? "Active" : item.status === "draft" ? "Draft" : "Archived"} - ${item.version}`;

const byNewestVersion = (left: LegalDocument, right: LegalDocument) =>
  Date.parse(right.effective_at || right.updated_at) - Date.parse(left.effective_at || left.updated_at) ||
  right.version.localeCompare(left.version);

export default function LegalDocumentsPage() {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedType, setSelectedType] = useState<LegalDocumentType>("terms");
  const [draft, setDraft] = useState<LegalDocument | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | LegalDocument["status"]>("all");
  const [sortBy, setSortBy] = useState<"updated" | "type" | "status" | "version">("updated");

  const load = useCallback(async (preferredId = selectedId, preferredType = selectedType) => {
    setLoading(true);
    const response = await fetch("/api/admin/legal-documents", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice({ type: "error", message: data.error || "Could not load documents." });
    } else {
      const items = (data.documents || []) as LegalDocument[];
      setDocuments(items);
      const typeDocuments = items
        .filter((item) => item.document_type === preferredType)
        .sort(byNewestVersion);
      const selected =
        items.find((item) => item.id === preferredId) ||
        typeDocuments.find((item) => item.status === "active") ||
        typeDocuments[0] ||
        items[0] ||
        null;
      setSelectedId(selected?.id || "");
      if (selected) setSelectedType(selected.document_type);
      setDraft(selected ? { ...selected } : null);
    }
    setLoading(false);
  }, [selectedId, selectedType]);

  useEffect(() => { load(); }, [load]);

  const documentTypeCards = useMemo(
    () => legalDocumentTypes.map((type) => {
      const typeDocuments = documents
        .filter((item) => item.document_type === type)
        .sort(byNewestVersion);
      const active = typeDocuments.find((item) => item.status === "active") || null;
      return { type, active, count: typeDocuments.length };
    }),
    [documents],
  );

  const versionOptions = useMemo(
    () => documents
      .filter((item) => item.document_type === selectedType)
      .filter((item) => statusFilter === "all" || item.status === statusFilter)
      .sort((left, right) => {
        if (sortBy === "status") {
          return `${left.status}-${left.document_type}`.localeCompare(`${right.status}-${right.document_type}`);
        }
        if (sortBy === "version") return right.version.localeCompare(left.version);
        return Date.parse(right.updated_at || right.effective_at) - Date.parse(left.updated_at || left.effective_at);
      }),
    [documents, selectedType, sortBy, statusFilter],
  );

  const selectDocumentType = (type: LegalDocumentType) => {
    const selected = documents
      .filter((item) => item.document_type === type)
      .sort(byNewestVersion)
      .find((item) => item.status === "active") || documents
      .filter((item) => item.document_type === type)
      .sort(byNewestVersion)[0] || emptyDocument(type);
    setSelectedType(type);
    setSelectedId(selected.id);
    setDraft({ ...selected });
    setNotice(null);
  };

  const selectDocumentVersion = (id: string) => {
    const item = documents.find((document) => document.id === id);
    if (!item) return;
    setSelectedId(item.id);
    setSelectedType(item.document_type);
    setDraft({ ...item });
    setNotice(null);
  };

  const save = async () => {
    if (!draft) return;
    const nextVersion = draft.id === "new-document" ? draft.version : createVersionValue();
    const nextDraft = {
      ...draft,
      id: "new-document",
      document_type: selectedType,
      version: nextVersion,
      summary: draft.summary || documentUsage[selectedType],
      effective_at: new Date().toISOString().slice(0, 10),
    };
    setSaving(true);
    try {
      const response = await fetch("/api/admin/legal-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", ...nextDraft }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not create the new document version.");
      setSelectedId(data.document.id);
      setSelectedType(data.document.document_type);
      setDraft({ ...data.document });
      setNotice({ type: "success", message: "New document version created and selected." });
      await load(data.document.id, data.document.document_type);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Could not create the new document version." });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft || draft.id === "new-document") return;
    const confirmed = window.confirm(
      `Delete "${draft.title}" (${draft.version})? This removes the document from the editor and records an audit event.`,
    );
    if (!confirmed) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/legal-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: draft.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not delete the document.");
      setSelectedId("");
      setDraft(null);
      setNotice({ type: "success", message: "Document deleted." });
      await load();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Could not delete the document." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="admin-documents-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-operation-kicker">Site content</p>
          <h1 className="admin-title">Document editor</h1>
          <p className="admin-subtitle">
            Choose a document type, edit the selected version, and save changes as a new version.
            Older versions stay available for review.
          </p>
        </div>
      </header>

      {notice && <div className={`admin-pricing-notice admin-pricing-notice-${notice.type}`}>{notice.message}</div>}

      <div className="admin-documents-layout">
        <section className="admin-documents-list admin-card">
          <div className="admin-documents-list-heading">
            <h2>Document types</h2>
            <p>Choose the document area to edit.</p>
          </div>
          <div className="admin-documents-list-scroll">
            {loading ? <p className="admin-muted">Loading documents...</p> : documentTypeCards.map((item) => (
              <button
                type="button"
                key={item.type}
                className={`admin-document-list-item ${selectedType === item.type ? "is-active" : ""}`}
                onClick={() => selectDocumentType(item.type)}
              >
                <strong>{legalDocumentLabels[item.type]}</strong>
                <span>{item.active?.title || "No active version"}</span>
                <small>{item.count} version{item.count === 1 ? "" : "s"}{item.active ? ` | Active ${item.active.version}` : ""}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="admin-document-editor admin-card">
          {!draft ? (
            <p className="admin-muted">Choose a document to edit.</p>
          ) : (
            <>
              <div className="admin-documents-toolbar admin-document-version-toolbar">
                <label>
                  <span>Version</span>
                  <select value={selectedId} onChange={(event) => selectDocumentVersion(event.target.value)}>
                    {versionOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatDocumentReference(item)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Show versions</span>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <label>
                  <span>Sort versions</span>
                  <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
                    <option value="updated">Recently updated</option>
                    <option value="status">Status</option>
                    <option value="version">Version</option>
                  </select>
                </label>
              </div>

              <div className="admin-document-form-grid">
                <label><span>Document type</span><input value={legalDocumentLabels[selectedType]} disabled readOnly /></label>
                <label><span>Status</span><select value={draft.status} disabled={saving} onChange={(event) => setDraft({ ...draft, status: event.target.value as LegalDocument["status"] })}><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></label>
                <label><span>Title</span><input value={draft.title} disabled={saving} maxLength={160} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
                <label><span>New version</span><input value={draft.id === "new-document" ? draft.version : "Created automatically when saved"} disabled readOnly /></label>
                <label><span>Effective date</span><input type="date" value={formatDateInput(draft.effective_at)} disabled={saving} onChange={(event) => setDraft({ ...draft, effective_at: event.target.value })} /></label>
                <label><span>PDF path</span><input value={draft.pdf_url || ""} disabled={saving} maxLength={500} placeholder="/legal/villkor-current.pdf" onChange={(event) => setDraft({ ...draft, pdf_url: event.target.value })} /></label>
              </div>

              <label className="admin-document-field"><span>Purpose and site usage</span><textarea value={draft.summary || ""} disabled={saving} rows={4} maxLength={2000} placeholder={documentUsage[selectedType]} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} /></label>
              <label className="admin-document-field"><span>Document text</span><textarea value={draft.content} disabled={saving} rows={16} maxLength={25000} onChange={(event) => setDraft({ ...draft, content: event.target.value })} /></label>

              <div className="admin-document-actions">
                <button type="button" className="admin-button-primary" disabled={saving} onClick={save}>{saving ? "Saving..." : "Save as new version"}</button>
                {draft.id !== "new-document" && <button type="button" className="admin-button-danger" disabled={saving} onClick={remove}>Delete selected version</button>}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
