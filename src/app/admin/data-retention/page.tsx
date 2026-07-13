"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { showAdminNotification } from "@/lib/admin/notifications";

type DataRetentionReview = {
  id: string;
  record_area: string;
  related_customer_id: string | null;
  related_record_id: string | null;
  legal_basis: string;
  retention_reason: string;
  retention_until: string | null;
  review_status: string;
  recommended_action: string;
  completed_at: string | null;
  notes: string | null;
  updated_at: string;
};

const defaultForm = {
  record_area: "customer_profile",
  related_customer_id: "",
  related_record_id: "",
  legal_basis: "",
  retention_reason: "",
  retention_until: "",
  review_status: "pending_review",
  recommended_action: "review",
  notes: "",
  reason: "",
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("sv-SE");
}

function reviewToForm(
  review: DataRetentionReview,
  status = review.review_status,
  action = review.recommended_action,
) {
  return {
    record_area: review.record_area,
    related_customer_id: review.related_customer_id || "",
    related_record_id: review.related_record_id || "",
    legal_basis: review.legal_basis,
    retention_reason: review.retention_reason,
    retention_until: review.retention_until || "",
    review_status: status,
    recommended_action: action,
    notes: review.notes || "",
  };
}

export default function AdminDataRetentionPage() {
  const [reviews, setReviews] = useState<DataRetentionReview[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionDrafts, setActionDrafts] = useState<
    Record<string, { status: string; action: string; reason: string }>
  >({});
  const openCount = useMemo(
    () =>
      reviews.filter((review) => review.review_status !== "completed").length,
    [reviews],
  );

  const loadReviews = async () => {
    setLoading(true);
    const response = await fetch("/api/admin/data-retention", {
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not load data retention reviews.",
      );
      setReviews([]);
    } else {
      setReviews(result.reviews || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const response = await fetch("/api/admin/data-retention", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not save retention review.",
      );
    } else {
      setForm(defaultForm);
      await loadReviews();
      showAdminNotification("success", "Retention review saved.");
    }

    setSaving(false);
  };

  const updateReview = async (
    review: DataRetentionReview,
    status: string,
    action: string,
  ) => {
    const reason = actionDrafts[review.id]?.reason.trim() || "";
    if (reason.length < 5) {
      showAdminNotification("error", "Add a reason of at least 5 characters.");
      return;
    }

    setUpdatingId(review.id);
    const response = await fetch(`/api/admin/data-retention/${review.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...reviewToForm(review, status, action),
        reason,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not update retention review.",
      );
    } else {
      setActionDrafts((current) => {
        const next = { ...current };
        delete next[review.id];
        return next;
      });
      await loadReviews();
      showAdminNotification("success", "Retention review updated.");
    }

    setUpdatingId(null);
  };

  return (
    <div className="admin-dashboard-page">
      <div className="admin-page-header admin-dashboard-header">
        <div>
          <h1 className="admin-title">Data retention</h1>
          <p className="admin-subtitle">
            Record why customer, billing, support, content, and audit records
            are retained, reviewed, anonymized, or deleted.
          </p>
        </div>
        <div className="admin-dashboard-header-actions">
          <div className="admin-status-chip admin-status-chip-system">
            <span className="admin-status-dot admin-status-warning" />
            {loading ? "Syncing" : `${openCount} open`}
          </div>
          <button onClick={loadReviews} className="admin-button-primary">
            Refresh
          </button>
        </div>
      </div>

      <section className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Record retention review</h2>
        <form className="mt-4 grid gap-4 lg:grid-cols-2" onSubmit={submitReview}>
          <label className="admin-field">
            <span>Record area</span>
            <select
              value={form.record_area}
              onChange={(event) => updateForm("record_area", event.target.value)}
            >
              <option value="customer_profile">Customer profile</option>
              <option value="billing_accounting">Billing/accounting</option>
              <option value="support_messages">Support messages</option>
              <option value="display_material">Display material</option>
              <option value="device_operations">Device operations</option>
              <option value="audit_security">Audit/security</option>
            </select>
          </label>
          <label className="admin-field">
            <span>Status</span>
            <select
              value={form.review_status}
              onChange={(event) =>
                updateForm("review_status", event.target.value)
              }
            >
              <option value="pending_review">Pending review</option>
              <option value="retain">Retain</option>
              <option value="anonymize">Anonymize</option>
              <option value="delete">Delete</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label className="admin-field">
            <span>Recommended action</span>
            <select
              value={form.recommended_action}
              onChange={(event) =>
                updateForm("recommended_action", event.target.value)
              }
            >
              <option value="review">Review</option>
              <option value="retain">Retain</option>
              <option value="anonymize">Anonymize</option>
              <option value="delete">Delete</option>
            </select>
          </label>
          <label className="admin-field">
            <span>Retention until</span>
            <input
              type="date"
              value={form.retention_until}
              onChange={(event) =>
                updateForm("retention_until", event.target.value)
              }
            />
          </label>
          <label className="admin-field">
            <span>Customer ID</span>
            <input
              value={form.related_customer_id}
              onChange={(event) =>
                updateForm("related_customer_id", event.target.value)
              }
            />
          </label>
          <label className="admin-field">
            <span>Related record ID</span>
            <input
              value={form.related_record_id}
              onChange={(event) =>
                updateForm("related_record_id", event.target.value)
              }
            />
          </label>
          <label className="admin-field lg:col-span-2">
            <span>Legal basis</span>
            <input
              value={form.legal_basis}
              onChange={(event) => updateForm("legal_basis", event.target.value)}
              required
            />
          </label>
          <label className="admin-field lg:col-span-2">
            <span>Retention reason</span>
            <textarea
              value={form.retention_reason}
              onChange={(event) =>
                updateForm("retention_reason", event.target.value)
              }
              rows={2}
              required
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
              {saving ? "Saving..." : "Save retention review"}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Data retention register</h2>
        <div className="admin-table-wrap mt-4">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Area</th>
                <th>Basis</th>
                <th>Status</th>
                <th>Until</th>
                <th>Action</th>
                <th>Controls</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review.id}>
                  <td>
                    <strong>{review.record_area}</strong>
                    <br />
                    <small>{review.related_customer_id || "No customer link"}</small>
                    {review.related_record_id && (
                      <>
                        <br />
                        <small>{review.related_record_id}</small>
                      </>
                    )}
                  </td>
                  <td>
                    {review.legal_basis}
                    <br />
                    <small>{review.retention_reason}</small>
                  </td>
                  <td>{review.review_status}</td>
                  <td>{formatDate(review.retention_until)}</td>
                  <td>{review.recommended_action}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="admin-button-secondary"
                        disabled={updatingId === review.id}
                        onClick={() =>
                          setActionDrafts((current) => ({
                            ...current,
                            [review.id]: {
                              status: "retain",
                              action: "retain",
                              reason: current[review.id]?.reason || "",
                            },
                          }))
                        }
                      >
                        Retain
                      </button>
                      <button
                        type="button"
                        className="admin-button-secondary"
                        disabled={updatingId === review.id}
                        onClick={() =>
                          setActionDrafts((current) => ({
                            ...current,
                            [review.id]: {
                              status: "anonymize",
                              action: "anonymize",
                              reason: current[review.id]?.reason || "",
                            },
                          }))
                        }
                      >
                        Anonymize
                      </button>
                      <button
                        type="button"
                        className="admin-button-secondary"
                        disabled={updatingId === review.id}
                        onClick={() =>
                          setActionDrafts((current) => ({
                            ...current,
                            [review.id]: {
                              status: "completed",
                              action: "review",
                              reason: current[review.id]?.reason || "",
                            },
                          }))
                        }
                      >
                        Complete
                      </button>
                    </div>
                    {actionDrafts[review.id] && (
                      <div className="admin-inline-flow">
                        <label>
                          <span>Reason for {actionDrafts[review.id].status}</span>
                          <textarea
                            value={actionDrafts[review.id].reason}
                            onChange={(event) =>
                              setActionDrafts((current) => ({
                                ...current,
                                [review.id]: {
                                  ...current[review.id],
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
                            disabled={updatingId === review.id}
                            onClick={() =>
                              updateReview(
                                review,
                                actionDrafts[review.id].status,
                                actionDrafts[review.id].action,
                              )
                            }
                          >
                            {updatingId === review.id ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            className="admin-button-secondary"
                            disabled={updatingId === review.id}
                            onClick={() =>
                              setActionDrafts((current) => {
                                const next = { ...current };
                                delete next[review.id];
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
              {!loading && reviews.length === 0 && (
                <tr>
                  <td colSpan={6}>No data retention reviews recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
