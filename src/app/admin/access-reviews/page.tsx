"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { showAdminNotification } from "@/lib/admin/notifications";

type AccessReview = {
  id: string;
  admin_email: string;
  auth_user_id: string | null;
  review_status: string;
  mfa_verified: boolean;
  access_confirmed: boolean;
  reviewed_at: string | null;
  notes: string | null;
  updated_at: string;
};

const defaultForm = {
  admin_email: "",
  auth_user_id: "",
  review_status: "pending",
  mfa_verified: false,
  access_confirmed: false,
  notes: "",
  reason: "",
};

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("sv-SE");
}

function formatChoice(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function reviewToForm(review: AccessReview, status = review.review_status) {
  return {
    admin_email: review.admin_email,
    auth_user_id: review.auth_user_id || "",
    review_status: status,
    mfa_verified: review.mfa_verified,
    access_confirmed: review.access_confirmed,
    notes: review.notes || "",
  };
}

export default function AdminAccessReviewsPage() {
  const [reviews, setReviews] = useState<AccessReview[]>([]);
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
          !review.mfa_verified ||
          !review.access_confirmed,
      ).length,
    [reviews],
  );
  const mfaVerifiedCount = useMemo(
    () => reviews.filter((review) => review.mfa_verified).length,
    [reviews],
  );
  const accessConfirmedCount = useMemo(
    () => reviews.filter((review) => review.access_confirmed).length,
    [reviews],
  );
  const approvedCount = useMemo(
    () =>
      reviews.filter(
        (review) =>
          review.review_status === "approved" &&
          review.mfa_verified &&
          review.access_confirmed,
      ).length,
    [reviews],
  );
  const accessWorkflow = [
    {
      stage: "1",
      label: "Identify admin",
      value: reviews.length,
      description: "Record who can access the Screenia admin area.",
    },
    {
      stage: "2",
      label: "Verify MFA",
      value: mfaVerifiedCount,
      description: "Confirm the login has multi-factor protection.",
    },
    {
      stage: "3",
      label: "Confirm need",
      value: accessConfirmedCount,
      description: "Keep access only when it is still required for operations.",
    },
    {
      stage: "4",
      label: "Approve or remove",
      value: approvedCount,
      description: "Close the review with a timestamped admin reason.",
    },
  ];

  const loadReviews = async () => {
    setLoading(true);
    const response = await fetch("/api/admin/access-reviews", {
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not load admin access reviews.",
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
    const response = await fetch("/api/admin/access-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not save access review.",
      );
    } else {
      setForm(defaultForm);
      await loadReviews();
      showAdminNotification("success", "Access review saved.");
    }

    setSaving(false);
  };

  const updateReview = async (
    review: AccessReview,
    status: string,
    approved = false,
  ) => {
    const reason = actionDrafts[review.id]?.reason.trim() || "";
    if (reason.length < 5) {
      showAdminNotification("error", "Add a reason of at least 5 characters.");
      return;
    }

    setUpdatingId(review.id);
    const response = await fetch(`/api/admin/access-reviews/${review.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...reviewToForm(review, status),
        mfa_verified: approved ? true : review.mfa_verified,
        access_confirmed: approved ? true : review.access_confirmed,
        reason,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not update access review.",
      );
    } else {
      setActionDrafts((current) => {
        const next = { ...current };
        delete next[review.id];
        return next;
      });
      await loadReviews();
      showAdminNotification("success", "Access review updated.");
    }

    setUpdatingId(null);
  };

  return (
    <div className="admin-dashboard-page">
      <div className="admin-page-header admin-dashboard-header">
        <div>
          <h1 className="admin-title">Admin access reviews</h1>
          <p className="admin-subtitle">
            Track who has admin access, MFA/process checks, review status, and
            audit reasons without adding role separation yet.
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

      <section className="admin-card admin-record-panel">
        <h2 className="admin-card-title admin-record-title">Record admin access</h2>
        <div className="admin-access-workflow" aria-label="Admin access workflow">
          {accessWorkflow.map((item) => (
            <div key={item.stage} className="admin-access-workflow-step">
              <span>{item.stage}</span>
              <strong>
                {item.label}
                <em>{item.value}</em>
              </strong>
              <small>{item.description}</small>
            </div>
          ))}
        </div>
        <form className="admin-record-form" onSubmit={submitReview}>
          <label className="admin-field">
            <span>Admin email</span>
            <input
              type="email"
              value={form.admin_email}
              onChange={(event) => updateForm("admin_email", event.target.value)}
              required
            />
          </label>
          <label className="admin-field">
            <span>Login reference</span>
            <input
              value={form.auth_user_id}
              onChange={(event) => updateForm("auth_user_id", event.target.value)}
              placeholder="Optional auth/support reference"
            />
          </label>
          <label className="admin-field">
            <span>Status</span>
            <select
              value={form.review_status}
              onChange={(event) => updateForm("review_status", event.target.value)}
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="needs_review">Needs review</option>
              <option value="removed">Removed</option>
            </select>
          </label>
          <label className="admin-field lg:col-span-2">
            <span>Notes</span>
            <textarea
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              rows={2}
            />
          </label>
          <label className="admin-record-check">
            <input
              type="checkbox"
              checked={form.mfa_verified}
              onChange={(event) =>
                updateForm("mfa_verified", event.target.checked)
              }
            />
            MFA verified
          </label>
          <label className="admin-record-check">
            <input
              type="checkbox"
              checked={form.access_confirmed}
              onChange={(event) =>
                updateForm("access_confirmed", event.target.checked)
              }
            />
            Access still required
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
              {saving ? "Saving..." : "Save access review"}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-card admin-record-panel">
        <h2 className="admin-card-title admin-record-title">Admin access decisions</h2>
        <div className="admin-table-wrap admin-record-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Status</th>
                <th>MFA</th>
                <th>Access</th>
                <th>Reviewed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review.id}>
                  <td>
                    <strong>{review.admin_email}</strong>
                    {(review.auth_user_id || review.notes) && (
                      <details className="admin-access-support-details">
                        <summary>Support evidence</summary>
                        {review.auth_user_id && (
                          <small>Login reference: {review.auth_user_id}</small>
                        )}
                        {review.notes && <small>{review.notes}</small>}
                      </details>
                    )}
                  </td>
                  <td>{formatChoice(review.review_status)}</td>
                  <td>{review.mfa_verified ? "Verified" : "Missing"}</td>
                  <td>{review.access_confirmed ? "Required" : "Not confirmed"}</td>
                  <td>{formatDateTime(review.reviewed_at || review.updated_at)}</td>
                  <td>
                    {review.review_status === "approved" &&
                    review.mfa_verified &&
                    review.access_confirmed ? (
                      <span className="admin-muted">Approved</span>
                    ) : (
                      <div className="admin-record-actions">
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
                                status: "removed",
                                approved: false,
                                reason: current[review.id]?.reason || "",
                              },
                            }))
                          }
                        >
                          Removed
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
                  <td colSpan={6}>No admin access reviews recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
