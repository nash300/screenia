"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { showAdminNotification } from "@/lib/admin/notifications";

type LegalChangeNotice = {
  id: string;
  document_type: string;
  document_version: string;
  change_summary: string;
  effective_at: string | null;
  notice_required: boolean;
  reacceptance_required: boolean;
  notice_status: string;
  notice_sent_at: string | null;
  evidence_reference: string | null;
  notes: string | null;
};

const defaultForm = {
  document_type: "terms",
  document_version: "",
  change_summary: "",
  effective_at: "",
  notice_required: true,
  reacceptance_required: false,
  notice_status: "draft",
  notice_sent_at: "",
  evidence_reference: "",
  notes: "",
  reason: "",
};

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("sv-SE");
}

function noticeToForm(
  notice: LegalChangeNotice,
  status = notice.notice_status,
) {
  return {
    document_type: notice.document_type,
    document_version: notice.document_version,
    change_summary: notice.change_summary,
    effective_at: notice.effective_at || "",
    notice_required: notice.notice_required,
    reacceptance_required: notice.reacceptance_required,
    notice_status: status,
    notice_sent_at:
      status === "sent" && !notice.notice_sent_at
        ? new Date().toISOString()
        : notice.notice_sent_at || "",
    evidence_reference: notice.evidence_reference || "",
    notes: notice.notes || "",
  };
}

export default function AdminLegalChangeNoticesPage() {
  const [notices, setNotices] = useState<LegalChangeNotice[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionDrafts, setActionDrafts] = useState<
    Record<string, { status: string; reason: string }>
  >({});
  const openCount = useMemo(
    () =>
      notices.filter(
        (notice) => notice.notice_required && notice.notice_status !== "sent",
      ).length,
    [notices],
  );

  const loadNotices = async () => {
    setLoading(true);
    const response = await fetch("/api/admin/legal-change-notices", {
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not load legal change notices.",
      );
      setNotices([]);
    } else {
      setNotices(result.notices || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadNotices();
  }, []);

  const updateForm = (field: keyof typeof form, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitNotice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const response = await fetch("/api/admin/legal-change-notices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not save legal change notice.",
      );
    } else {
      setForm(defaultForm);
      await loadNotices();
      showAdminNotification("success", "Legal change notice saved.");
    }

    setSaving(false);
  };

  const updateNoticeStatus = async (
    notice: LegalChangeNotice,
    status: string,
  ) => {
    const reason = actionDrafts[notice.id]?.reason.trim() || "";
    if (reason.length < 5) {
      showAdminNotification("error", "Add a reason of at least 5 characters.");
      return;
    }

    setUpdatingId(notice.id);
    const response = await fetch(`/api/admin/legal-change-notices/${notice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...noticeToForm(notice, status),
        reason,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not update legal change notice.",
      );
    } else {
      setActionDrafts((current) => {
        const next = { ...current };
        delete next[notice.id];
        return next;
      });
      await loadNotices();
      showAdminNotification("success", "Legal change notice updated.");
    }

    setUpdatingId(null);
  };

  return (
    <div className="admin-dashboard-page">
      <div className="admin-page-header admin-dashboard-header">
        <div>
          <h1 className="admin-title">Legal change notices</h1>
          <p className="admin-subtitle">
            Track policy version changes, customer notice decisions, sent
            evidence, and re-acceptance requirements.
          </p>
        </div>
        <div className="admin-dashboard-header-actions">
          <div className="admin-status-chip admin-status-chip-system">
            <span className="admin-status-dot admin-status-warning" />
            {loading ? "Syncing" : `${openCount} need notice`}
          </div>
          <button onClick={loadNotices} className="admin-button-primary">
            Refresh
          </button>
        </div>
      </div>

      <section className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Record policy change</h2>
        <form className="mt-4 grid gap-4 lg:grid-cols-2" onSubmit={submitNotice}>
          <label className="admin-field">
            <span>Document</span>
            <select
              value={form.document_type}
              onChange={(event) => updateForm("document_type", event.target.value)}
            >
              <option value="terms">Terms</option>
              <option value="privacy">Privacy</option>
              <option value="cookie">Cookie</option>
              <option value="subscription_billing">Subscription billing</option>
              <option value="support_service">Support service</option>
            </select>
          </label>
          <label className="admin-field">
            <span>Version</span>
            <input
              value={form.document_version}
              onChange={(event) =>
                updateForm("document_version", event.target.value)
              }
              required
            />
          </label>
          <label className="admin-field">
            <span>Status</span>
            <select
              value={form.notice_status}
              onChange={(event) => updateForm("notice_status", event.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="sent">Sent</option>
              <option value="not_required">Not required</option>
              <option value="needs_review">Needs review</option>
            </select>
          </label>
          <label className="admin-field">
            <span>Effective at</span>
            <input
              type="datetime-local"
              value={form.effective_at}
              onChange={(event) => updateForm("effective_at", event.target.value)}
            />
          </label>
          <label className="admin-field lg:col-span-2">
            <span>Change summary</span>
            <textarea
              value={form.change_summary}
              onChange={(event) =>
                updateForm("change_summary", event.target.value)
              }
              rows={2}
              required
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.notice_required}
              onChange={(event) =>
                updateForm("notice_required", event.target.checked)
              }
            />
            Customer notice required
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.reacceptance_required}
              onChange={(event) =>
                updateForm("reacceptance_required", event.target.checked)
              }
            />
            Re-acceptance required
          </label>
          <label className="admin-field">
            <span>Notice sent at</span>
            <input
              type="datetime-local"
              value={form.notice_sent_at}
              onChange={(event) =>
                updateForm("notice_sent_at", event.target.value)
              }
            />
          </label>
          <label className="admin-field">
            <span>Evidence reference</span>
            <input
              value={form.evidence_reference}
              onChange={(event) =>
                updateForm("evidence_reference", event.target.value)
              }
            />
          </label>
          <label className="admin-field lg:col-span-2">
            <span>Notes</span>
            <textarea
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              rows={2}
            />
          </label>
          <label className="admin-field lg:col-span-2">
            <span>Admin reason</span>
            <input
              value={form.reason}
              onChange={(event) => updateForm("reason", event.target.value)}
              required
            />
          </label>
          <div className="lg:col-span-2">
            <button
              type="submit"
              className="admin-button-primary"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save legal notice"}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Legal change register</h2>
        <div className="admin-table-wrap mt-4">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Summary</th>
                <th>Status</th>
                <th>Notice</th>
                <th>Sent</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {notices.map((notice) => (
                <tr key={notice.id}>
                  <td>
                    <strong>{notice.document_type}</strong>
                    <br />
                    <small>{notice.document_version}</small>
                  </td>
                  <td>{notice.change_summary}</td>
                  <td>{notice.notice_status}</td>
                  <td>
                    Required: {notice.notice_required ? "yes" : "no"}
                    <br />
                    Re-accept: {notice.reacceptance_required ? "yes" : "no"}
                  </td>
                  <td>
                    {formatDateTime(notice.notice_sent_at)}
                    <br />
                    <small>{notice.evidence_reference || "-"}</small>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="admin-button-secondary"
                        disabled={updatingId === notice.id}
                        onClick={() =>
                          setActionDrafts((current) => ({
                            ...current,
                            [notice.id]: {
                              status: "approved",
                              reason: current[notice.id]?.reason || "",
                            },
                          }))
                        }
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="admin-button-secondary"
                        disabled={updatingId === notice.id}
                        onClick={() =>
                          setActionDrafts((current) => ({
                            ...current,
                            [notice.id]: {
                              status: "sent",
                              reason: current[notice.id]?.reason || "",
                            },
                          }))
                        }
                      >
                        Sent
                      </button>
                      <button
                        type="button"
                        className="admin-button-secondary"
                        disabled={updatingId === notice.id}
                        onClick={() =>
                          setActionDrafts((current) => ({
                            ...current,
                            [notice.id]: {
                              status: "needs_review",
                              reason: current[notice.id]?.reason || "",
                            },
                          }))
                        }
                      >
                        Needs review
                      </button>
                    </div>
                    {actionDrafts[notice.id] && (
                      <div className="admin-inline-flow">
                        <label>
                          <span>Reason for {actionDrafts[notice.id].status}</span>
                          <textarea
                            value={actionDrafts[notice.id].reason}
                            onChange={(event) =>
                              setActionDrafts((current) => ({
                                ...current,
                                [notice.id]: {
                                  ...current[notice.id],
                                  reason: event.target.value,
                                },
                              }))
                            }
                            rows={2}
                          />
                        </label>
                        <div className="admin-inline-flow-actions">
                          <button
                            type="button"
                            className="admin-button-primary"
                            disabled={updatingId === notice.id}
                            onClick={() =>
                              updateNoticeStatus(
                                notice,
                                actionDrafts[notice.id].status,
                              )
                            }
                          >
                            {updatingId === notice.id ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            className="admin-button-secondary"
                            disabled={updatingId === notice.id}
                            onClick={() =>
                              setActionDrafts((current) => {
                                const next = { ...current };
                                delete next[notice.id];
                                return next;
                              })
                            }
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && notices.length === 0 && (
                <tr>
                  <td colSpan={6}>No legal change notices recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
