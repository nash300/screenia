"use client";

import { useEffect, useMemo, useState } from "react";
import { showAdminNotification } from "@/lib/admin/notifications";

type DataSubjectRequest = {
  id: string;
  customer_id: string | null;
  request_type: string;
  status: string;
  description: string;
  due_at: string;
  completed_at: string | null;
  admin_notes: string | null;
  customers?:
    | { name: string | null; email: string | null; customer_number: string | null }
    | Array<{ name: string | null; email: string | null; customer_number: string | null }>
    | null;
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("sv-SE");
}

function isOverdue(request: DataSubjectRequest) {
  return (
    !["completed", "rejected"].includes(request.status) &&
    new Date(request.due_at).getTime() < Date.now()
  );
}

export default function AdminDataSubjectRequestsPage() {
  const [requests, setRequests] = useState<DataSubjectRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const openCount = useMemo(
    () => requests.filter((item) => !["completed", "rejected"].includes(item.status)).length,
    [requests],
  );
  const overdueCount = useMemo(
    () => requests.filter((item) => isOverdue(item)).length,
    [requests],
  );

  const loadRequests = async () => {
    setLoading(true);
    const response = await fetch("/api/admin/data-subject-requests", {
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification("error", result.error || "Could not load requests.");
      setRequests([]);
    } else {
      setRequests(result.requests || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const updateRequest = async (request: DataSubjectRequest, status: string) => {
    const reason = prompt(`Reason for moving request to ${status}:`)?.trim();
    if (!reason) return;
    const adminNotes = prompt("Internal notes:", request.admin_notes || "")?.trim() || "";
    if (
      ["completed", "rejected"].includes(status) &&
      adminNotes.length < 10
    ) {
      showAdminNotification(
        "error",
        "Completion or rejection requires outcome notes of at least 10 characters.",
      );
      return;
    }

    setUpdatingId(request.id);
    const response = await fetch(`/api/admin/data-subject-requests/${request.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, admin_notes: adminNotes, reason }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification("error", result.error || "Could not update request.");
    } else {
      await loadRequests();
      showAdminNotification("success", "Request updated.");
    }

    setUpdatingId(null);
  };

  return (
    <div className="admin-dashboard-page">
      <div className="admin-page-header admin-dashboard-header">
        <div>
          <h1 className="admin-title">Privacy requests</h1>
          <p className="admin-subtitle">
            Track GDPR data subject requests, deadlines, notes, and completion
            evidence.
          </p>
        </div>
        <div className="admin-dashboard-header-actions">
          <div className="admin-status-chip admin-status-chip-system">
            <span
              className={`admin-status-dot ${
                overdueCount ? "admin-status-danger" : "admin-status-success"
              }`}
            />
            {loading ? "Syncing" : `${openCount} open`}
          </div>
          <button onClick={loadRequests} className="admin-button-primary">
            Refresh
          </button>
        </div>
      </div>

      <section className="admin-dashboard-kpis">
        <div className="admin-card admin-stat-card">
          <span className="admin-stat-icon admin-stat-neutral" />
          <p className="admin-stat-label">Open requests</p>
          <p className="admin-stat-value">{openCount}</p>
          <p className="admin-stat-meta">Need follow-up</p>
        </div>
        <div className="admin-card admin-stat-card">
          <span className="admin-stat-icon admin-stat-neutral" />
          <p className="admin-stat-label">Overdue</p>
          <p className="admin-stat-value">{overdueCount}</p>
          <p className="admin-stat-meta">Past due date</p>
        </div>
      </section>

      <section className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Data subject request register</h2>
        <div className="admin-table-wrap mt-4">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Type</th>
                <th>Status</th>
                <th>Due</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => {
                const customer = firstRelation(request.customers);

                return (
                  <tr key={request.id}>
                    <td>
                      {customer?.name || "Unknown"}
                      <br />
                      <small>{customer?.email || customer?.customer_number || "-"}</small>
                    </td>
                    <td>{request.request_type}</td>
                    <td>{request.status}</td>
                    <td>{formatDate(request.due_at)}</td>
                    <td>{request.description}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {request.status === "received" && (
                          <button
                            type="button"
                            className="admin-button-secondary"
                            disabled={updatingId === request.id}
                            onClick={() => updateRequest(request, "in_progress")}
                          >
                            Start
                          </button>
                        )}
                        {!["completed", "rejected"].includes(request.status) && (
                          <>
                            <button
                              type="button"
                              className="admin-button-secondary"
                              disabled={updatingId === request.id}
                              onClick={() => updateRequest(request, "waiting_for_customer")}
                            >
                              Waiting
                            </button>
                            <button
                              type="button"
                              className="admin-button-secondary"
                              disabled={updatingId === request.id}
                              onClick={() => updateRequest(request, "completed")}
                            >
                              Complete
                            </button>
                            <button
                              type="button"
                              className="admin-button-secondary"
                              disabled={updatingId === request.id}
                              onClick={() => updateRequest(request, "rejected")}
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && requests.length === 0 && (
                <tr>
                  <td colSpan={6}>No data subject requests recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
