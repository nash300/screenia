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

function formatChoice(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
  const [actionDrafts, setActionDrafts] = useState<
    Record<string, { status: string; reason: string; adminNotes: string }>
  >({});
  const openCount = useMemo(
    () => requests.filter((item) => !["completed", "rejected"].includes(item.status)).length,
    [requests],
  );
  const overdueCount = useMemo(
    () => requests.filter((item) => isOverdue(item)).length,
    [requests],
  );
  const inProgressCount = useMemo(
    () =>
      requests.filter((item) =>
        ["in_progress", "waiting_for_customer"].includes(item.status),
      ).length,
    [requests],
  );
  const closedCount = useMemo(
    () =>
      requests.filter((item) =>
        ["completed", "rejected"].includes(item.status),
      ).length,
    [requests],
  );
  const privacyWorkflow = [
    {
      stage: "1",
      label: "Receive request",
      value: requests.length,
      description: "Record the customer request and GDPR request type.",
    },
    {
      stage: "2",
      label: "Check deadline",
      value: overdueCount,
      description: "Watch legal due dates and overdue requests first.",
    },
    {
      stage: "3",
      label: "Handle case",
      value: inProgressCount,
      description: "Work the request or wait for customer clarification.",
    },
    {
      stage: "4",
      label: "Close with evidence",
      value: closedCount,
      description: "Complete or reject only with internal outcome notes.",
    },
  ];

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
    const draft = actionDrafts[request.id];
    const reason = draft?.reason.trim() || "";
    if (reason.length < 5) {
      showAdminNotification("error", "Add a reason of at least 5 characters.");
      return;
    }
    const adminNotes = draft?.adminNotes.trim() || "";
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
      setActionDrafts((current) => {
        const next = { ...current };
        delete next[request.id];
        return next;
      });
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
        <h2 className="admin-card-title text-xl">Privacy request workflow</h2>
        <div className="admin-privacy-workflow" aria-label="Privacy request workflow">
          {privacyWorkflow.map((item) => (
            <div key={item.stage} className="admin-privacy-workflow-step">
              <span>{item.stage}</span>
              <strong>
                {item.label}
                <em>{item.value}</em>
              </strong>
              <small>{item.description}</small>
            </div>
          ))}
        </div>
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
                    <td>{formatChoice(request.request_type)}</td>
                    <td>{formatChoice(request.status)}</td>
                    <td>{formatDate(request.due_at)}</td>
                    <td>{request.description}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {request.status === "received" && (
                          <button
                            type="button"
                            className="admin-button-secondary"
                            disabled={updatingId === request.id}
                            onClick={() =>
                              setActionDrafts((current) => ({
                                ...current,
                                [request.id]: {
                                  status: "in_progress",
                                  reason: current[request.id]?.reason || "",
                                  adminNotes:
                                    current[request.id]?.adminNotes ||
                                    request.admin_notes ||
                                    "",
                                },
                              }))
                            }
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
                              onClick={() =>
                                setActionDrafts((current) => ({
                                  ...current,
                                  [request.id]: {
                                    status: "waiting_for_customer",
                                    reason: current[request.id]?.reason || "",
                                    adminNotes:
                                      current[request.id]?.adminNotes ||
                                      request.admin_notes ||
                                      "",
                                  },
                                }))
                              }
                            >
                              Waiting
                            </button>
                            <button
                              type="button"
                              className="admin-button-secondary"
                              disabled={updatingId === request.id}
                              onClick={() =>
                                setActionDrafts((current) => ({
                                  ...current,
                                  [request.id]: {
                                    status: "completed",
                                    reason: current[request.id]?.reason || "",
                                    adminNotes:
                                      current[request.id]?.adminNotes ||
                                      request.admin_notes ||
                                      "",
                                  },
                                }))
                              }
                            >
                              Complete
                            </button>
                            <button
                              type="button"
                              className="admin-button-secondary"
                              disabled={updatingId === request.id}
                              onClick={() =>
                                setActionDrafts((current) => ({
                                  ...current,
                                  [request.id]: {
                                    status: "rejected",
                                    reason: current[request.id]?.reason || "",
                                    adminNotes:
                                      current[request.id]?.adminNotes ||
                                      request.admin_notes ||
                                      "",
                                  },
                                }))
                              }
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                      {actionDrafts[request.id] && (
                        <div className="admin-inline-flow">
                          <label>
                            <span>Internal notes</span>
                            <textarea
                              value={actionDrafts[request.id].adminNotes}
                              onChange={(event) =>
                                setActionDrafts((current) => ({
                                  ...current,
                                  [request.id]: {
                                    ...current[request.id],
                                    adminNotes: event.target.value,
                                  },
                                }))
                              }
                              rows={2}
                            />
                          </label>
                          <label>
                            <span>Reason for {actionDrafts[request.id].status}</span>
                            <textarea
                              value={actionDrafts[request.id].reason}
                              onChange={(event) =>
                                setActionDrafts((current) => ({
                                  ...current,
                                  [request.id]: {
                                    ...current[request.id],
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
                              disabled={updatingId === request.id}
                              onClick={() =>
                                updateRequest(
                                  request,
                                  actionDrafts[request.id].status,
                                )
                              }
                            >
                              {updatingId === request.id ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              className="admin-button-secondary"
                              disabled={updatingId === request.id}
                              onClick={() =>
                                setActionDrafts((current) => {
                                  const next = { ...current };
                                  delete next[request.id];
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
