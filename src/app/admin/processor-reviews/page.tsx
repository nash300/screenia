"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { showAdminNotification } from "@/lib/admin/notifications";

type ProcessorReview = {
  id: string;
  provider: string;
  processing_purpose: string;
  dpa_verified: boolean;
  security_reviewed: boolean;
  account_owner_verified: boolean;
  region_or_location: string | null;
  evidence_reference: string | null;
  review_status: string;
  reviewed_at: string | null;
  next_review_due: string | null;
  notes: string | null;
};

const defaultForm = {
  provider: "Supabase",
  processing_purpose: "",
  dpa_verified: false,
  security_reviewed: false,
  account_owner_verified: false,
  region_or_location: "",
  evidence_reference: "",
  review_status: "pending",
  reviewed_at: "",
  next_review_due: "",
  notes: "",
  reason: "",
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("sv-SE");
}

function reviewToForm(review: ProcessorReview, status = review.review_status) {
  return {
    provider: review.provider,
    processing_purpose: review.processing_purpose,
    dpa_verified: review.dpa_verified,
    security_reviewed: review.security_reviewed,
    account_owner_verified: review.account_owner_verified,
    region_or_location: review.region_or_location || "",
    evidence_reference: review.evidence_reference || "",
    review_status: status,
    reviewed_at: review.reviewed_at || "",
    next_review_due: review.next_review_due || "",
    notes: review.notes || "",
  };
}

export default function AdminProcessorReviewsPage() {
  const [reviews, setReviews] = useState<ProcessorReview[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionDrafts, setActionDrafts] = useState<
    Record<string, { status: string; approved: boolean; reason: string }>
  >({});
  const openCount = useMemo(
    () =>
      reviews.filter(
        (review) =>
          review.review_status !== "approved" ||
          !review.dpa_verified ||
          !review.security_reviewed ||
          !review.account_owner_verified,
      ).length,
    [reviews],
  );

  const loadReviews = async () => {
    setLoading(true);
    const response = await fetch("/api/admin/processor-reviews", {
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not load processor reviews.",
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

  const updateForm = (field: keyof typeof form, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const response = await fetch("/api/admin/processor-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not save processor review.",
      );
    } else {
      setForm(defaultForm);
      await loadReviews();
      showAdminNotification("success", "Processor review saved.");
    }

    setSaving(false);
  };

  const updateReview = async (
    review: ProcessorReview,
    status: string,
    approved = false,
  ) => {
    const reason = actionDrafts[review.id]?.reason.trim() || "";
    if (reason.length < 5) {
      showAdminNotification("error", "Add a reason of at least 5 characters.");
      return;
    }

    setUpdatingId(review.id);
    const response = await fetch(`/api/admin/processor-reviews/${review.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...reviewToForm(review, status),
        dpa_verified: approved ? true : review.dpa_verified,
        security_reviewed: approved ? true : review.security_reviewed,
        account_owner_verified: approved ? true : review.account_owner_verified,
        reason,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not update processor review.",
      );
    } else {
      setActionDrafts((current) => {
        const next = { ...current };
        delete next[review.id];
        return next;
      });
      await loadReviews();
      showAdminNotification("success", "Processor review updated.");
    }

    setUpdatingId(null);
  };

  return (
    <div className="admin-dashboard-page">
      <div className="admin-page-header admin-dashboard-header">
        <div>
          <h1 className="admin-title">Processor reviews</h1>
          <p className="admin-subtitle">
            Track DPA, account ownership, region, and security evidence for
            providers that process Screenia customer data.
          </p>
        </div>
        <div className="admin-dashboard-header-actions">
          <div className="admin-status-chip admin-status-chip-system">
            <span className="admin-status-dot admin-status-warning" />
            {loading ? "Syncing" : `${openCount} need review`}
          </div>
          <button onClick={loadReviews} className="admin-button-primary">
            Refresh
          </button>
        </div>
      </div>

      <section className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Record processor evidence</h2>
        <form className="mt-4 grid gap-4 lg:grid-cols-2" onSubmit={submitReview}>
          <label className="admin-field">
            <span>Provider</span>
            <select
              value={form.provider}
              onChange={(event) => updateForm("provider", event.target.value)}
            >
              <option value="Supabase">Supabase</option>
              <option value="Stripe">Stripe</option>
              <option value="Resend">Resend</option>
              <option value="Vercel">Vercel</option>
              <option value="Loopia">Loopia</option>
              <option value="Other">Other</option>
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
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="needs_review">Needs review</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <label className="admin-field lg:col-span-2">
            <span>Processing purpose</span>
            <textarea
              value={form.processing_purpose}
              onChange={(event) =>
                updateForm("processing_purpose", event.target.value)
              }
              rows={2}
              required
            />
          </label>
          <label className="admin-field">
            <span>Region or location</span>
            <input
              value={form.region_or_location}
              onChange={(event) =>
                updateForm("region_or_location", event.target.value)
              }
            />
          </label>
          <label className="admin-field">
            <span>Next review due</span>
            <input
              type="date"
              value={form.next_review_due}
              onChange={(event) =>
                updateForm("next_review_due", event.target.value)
              }
            />
          </label>
          <label className="admin-field lg:col-span-2">
            <span>Evidence reference</span>
            <input
              value={form.evidence_reference}
              onChange={(event) =>
                updateForm("evidence_reference", event.target.value)
              }
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.dpa_verified}
              onChange={(event) =>
                updateForm("dpa_verified", event.target.checked)
              }
            />
            DPA verified
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.security_reviewed}
              onChange={(event) =>
                updateForm("security_reviewed", event.target.checked)
              }
            />
            Security reviewed
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.account_owner_verified}
              onChange={(event) =>
                updateForm("account_owner_verified", event.target.checked)
              }
            />
            Account owner verified
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
              {saving ? "Saving..." : "Save processor review"}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Processor review register</h2>
        <div className="admin-table-wrap mt-4">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Purpose</th>
                <th>Status</th>
                <th>Evidence</th>
                <th>Next review</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review.id}>
                  <td>
                    <strong>{review.provider}</strong>
                    <br />
                    <small>{review.region_or_location || "No region recorded"}</small>
                  </td>
                  <td>
                    {review.processing_purpose}
                    <br />
                    <small>
                      DPA: {review.dpa_verified ? "yes" : "no"} | Security:{" "}
                      {review.security_reviewed ? "yes" : "no"} | Owner:{" "}
                      {review.account_owner_verified ? "yes" : "no"}
                    </small>
                  </td>
                  <td>{review.review_status}</td>
                  <td>{review.evidence_reference || "-"}</td>
                  <td>{formatDate(review.next_review_due)}</td>
                  <td>
                    {review.review_status === "approved" &&
                    review.dpa_verified &&
                    review.security_reviewed &&
                    review.account_owner_verified ? (
                      <span className="admin-muted">Approved</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="admin-button-secondary"
                          disabled={updatingId === review.id}
                          onClick={() =>
                            setActionDrafts((current) => ({
                              ...current,
                              [review.id]: {
                                status: "approved",
                                approved: true,
                                reason: current[review.id]?.reason || "",
                              },
                            }))
                          }
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="admin-button-secondary"
                          disabled={updatingId === review.id}
                          onClick={() =>
                            setActionDrafts((current) => ({
                              ...current,
                              [review.id]: {
                                status: "needs_review",
                                approved: false,
                                reason: current[review.id]?.reason || "",
                              },
                            }))
                          }
                        >
                          Needs review
                        </button>
                        <button
                          type="button"
                          className="admin-button-secondary"
                          disabled={updatingId === review.id}
                          onClick={() =>
                            setActionDrafts((current) => ({
                              ...current,
                              [review.id]: {
                                status: "disabled",
                                approved: false,
                                reason: current[review.id]?.reason || "",
                              },
                            }))
                          }
                        >
                          Disabled
                        </button>
                      </div>
                    )}
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
                                actionDrafts[review.id].approved,
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
                  <td colSpan={6}>No processor reviews recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
