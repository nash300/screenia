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
    const reason = prompt(`Reason for marking ${review.admin_email} as ${status}:`)?.trim();
    if (!reason) return;

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

      <section className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Record admin access</h2>
        <form className="mt-4 grid gap-4 lg:grid-cols-2" onSubmit={submitReview}>
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
            <span>Supabase auth user ID</span>
            <input
              value={form.auth_user_id}
              onChange={(event) => updateForm("auth_user_id", event.target.value)}
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
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.mfa_verified}
              onChange={(event) =>
                updateForm("mfa_verified", event.target.checked)
              }
            />
            MFA verified
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
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

      <section className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Access review register</h2>
        <div className="admin-table-wrap mt-4">
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
                    <br />
                    <small>{review.auth_user_id || "No auth ID recorded"}</small>
                    {review.notes && (
                      <>
                        <br />
                        <small>{review.notes}</small>
                      </>
                    )}
                  </td>
                  <td>{review.review_status}</td>
                  <td>{review.mfa_verified ? "verified" : "missing"}</td>
                  <td>{review.access_confirmed ? "required" : "not confirmed"}</td>
                  <td>{formatDateTime(review.reviewed_at || review.updated_at)}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="admin-button-secondary"
                        disabled={updatingId === review.id}
                        onClick={() => updateReview(review, "approved", true)}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="admin-button-secondary"
                        disabled={updatingId === review.id}
                        onClick={() => updateReview(review, "needs_review")}
                      >
                        Needs review
                      </button>
                      <button
                        type="button"
                        className="admin-button-secondary"
                        disabled={updatingId === review.id}
                        onClick={() => updateReview(review, "removed")}
                      >
                        Removed
                      </button>
                    </div>
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
