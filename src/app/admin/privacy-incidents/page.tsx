"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { showAdminNotification } from "@/lib/admin/notifications";

type PrivacyIncident = {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  affected_data: string | null;
  containment_notes: string | null;
  authority_notification_required: boolean;
  authority_notified_at: string | null;
  customer_notification_required: boolean;
  customer_notified_at: string | null;
  detected_at: string;
  resolved_at: string | null;
};

const defaultForm = {
  title: "",
  description: "",
  severity: "medium",
  status: "detected",
  affected_data: "",
  containment_notes: "",
  authority_notification_required: false,
  authority_notified_at: "",
  customer_notification_required: false,
  customer_notified_at: "",
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

function incidentToForm(incident: PrivacyIncident, status = incident.status) {
  return {
    title: incident.title,
    description: incident.description,
    severity: incident.severity,
    status,
    affected_data: incident.affected_data || "",
    containment_notes: incident.containment_notes || "",
    authority_notification_required: incident.authority_notification_required,
    authority_notified_at: incident.authority_notified_at || "",
    customer_notification_required: incident.customer_notification_required,
    customer_notified_at: incident.customer_notified_at || "",
  };
}

export default function AdminPrivacyIncidentsPage() {
  const [incidents, setIncidents] = useState<PrivacyIncident[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionDrafts, setActionDrafts] = useState<
    Record<string, { status: string; reason: string; containmentNotes: string }>
  >({});
  const openCount = useMemo(
    () => incidents.filter((incident) => incident.status !== "resolved").length,
    [incidents],
  );
  const notifyDecisionCount = useMemo(
    () =>
      incidents.filter(
        (incident) =>
          incident.authority_notification_required ||
          incident.customer_notification_required,
      ).length,
    [incidents],
  );
  const containedCount = useMemo(
    () =>
      incidents.filter((incident) =>
        ["contained", "resolved"].includes(incident.status),
      ).length,
    [incidents],
  );
  const resolvedCount = useMemo(
    () => incidents.filter((incident) => incident.status === "resolved").length,
    [incidents],
  );
  const incidentWorkflow = [
    {
      stage: "1",
      label: "Detect incident",
      value: incidents.length,
      description: "Record what happened, severity, and affected data.",
    },
    {
      stage: "2",
      label: "Decide notification",
      value: notifyDecisionCount,
      description: "Decide whether authority or customer notice is required.",
    },
    {
      stage: "3",
      label: "Contain risk",
      value: containedCount,
      description: "Document containment before closing the incident.",
    },
    {
      stage: "4",
      label: "Resolve with evidence",
      value: resolvedCount,
      description: "Close the incident with an audited admin reason.",
    },
  ];

  const loadIncidents = async () => {
    setLoading(true);
    const response = await fetch("/api/admin/privacy-incidents", {
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification("error", result.error || "Could not load incidents.");
      setIncidents([]);
    } else {
      setIncidents(result.incidents || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadIncidents();
  }, []);

  const updateForm = (field: keyof typeof form, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitIncident = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const response = await fetch("/api/admin/privacy-incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification("error", result.error || "Could not save incident.");
    } else {
      setForm(defaultForm);
      await loadIncidents();
      showAdminNotification("success", "Incident saved.");
    }

    setSaving(false);
  };

  const updateIncidentStatus = async (incident: PrivacyIncident, status: string) => {
    const draft = actionDrafts[incident.id];
    const reason = draft?.reason.trim() || "";
    if (reason.length < 5) {
      showAdminNotification("error", "Add a reason of at least 5 characters.");
      return;
    }

    const payload = {
      ...incidentToForm(incident, status),
      containment_notes:
        status === "contained" && !incident.containment_notes
          ? draft?.containmentNotes.trim() || ""
          : incident.containment_notes || "",
      reason,
    };

    setUpdatingId(incident.id);
    const response = await fetch(`/api/admin/privacy-incidents/${incident.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification("error", result.error || "Could not update incident.");
    } else {
      setActionDrafts((current) => {
        const next = { ...current };
        delete next[incident.id];
        return next;
      });
      await loadIncidents();
      showAdminNotification("success", "Incident updated.");
    }

    setUpdatingId(null);
  };

  return (
    <div className="admin-dashboard-page">
      <div className="admin-page-header admin-dashboard-header">
        <div>
          <h1 className="admin-title">Privacy incidents</h1>
          <p className="admin-subtitle">
            Record suspected data/security incidents, response status,
            notification decisions, and audit evidence.
          </p>
        </div>
        <div className="admin-dashboard-header-actions">
          <div className="admin-status-chip admin-status-chip-system">
            <span className="admin-status-dot admin-status-warning" />
            {loading ? "Syncing" : `${openCount} open`}
          </div>
          <button onClick={loadIncidents} className="admin-button-primary">
            Refresh
          </button>
        </div>
      </div>

      <section className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Incident response workflow</h2>
        <div className="admin-incident-workflow" aria-label="Privacy incident response workflow">
          {incidentWorkflow.map((item) => (
            <div key={item.stage} className="admin-incident-workflow-step">
              <span>{item.stage}</span>
              <strong>
                {item.label}
                <em>{item.value}</em>
              </strong>
              <small>{item.description}</small>
            </div>
          ))}
        </div>
        <form className="mt-4 grid gap-4 lg:grid-cols-2" onSubmit={submitIncident}>
          <label className="admin-field">
            <span>Title</span>
            <input
              value={form.title}
              onChange={(event) => updateForm("title", event.target.value)}
              required
            />
          </label>
          <label className="admin-field">
            <span>Severity</span>
            <select
              value={form.severity}
              onChange={(event) => updateForm("severity", event.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label className="admin-field lg:col-span-2">
            <span>Description</span>
            <textarea
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              rows={3}
              required
            />
          </label>
          <label className="admin-field lg:col-span-2">
            <span>Affected data</span>
            <textarea
              value={form.affected_data}
              onChange={(event) => updateForm("affected_data", event.target.value)}
              rows={2}
            />
          </label>
          <label className="admin-field lg:col-span-2">
            <span>Containment notes</span>
            <textarea
              value={form.containment_notes}
              onChange={(event) =>
                updateForm("containment_notes", event.target.value)
              }
              rows={2}
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.authority_notification_required}
              onChange={(event) =>
                updateForm("authority_notification_required", event.target.checked)
              }
            />
            Authority notification required
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.customer_notification_required}
              onChange={(event) =>
                updateForm("customer_notification_required", event.target.checked)
              }
            />
            Customer notification required
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
              {saving ? "Saving..." : "Save incident"}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Incident response cases</h2>
        <div className="admin-table-wrap mt-4">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Incident</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Detected</th>
                <th>Notifications</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr key={incident.id}>
                  <td>
                    <strong>{incident.title}</strong>
                    <br />
                    <small>{incident.description}</small>
                  </td>
                  <td>{formatChoice(incident.severity)}</td>
                  <td>{formatChoice(incident.status)}</td>
                  <td>{formatDateTime(incident.detected_at)}</td>
                  <td>
                    Authority: {incident.authority_notification_required ? "Yes" : "No"}
                    <br />
                    Customer: {incident.customer_notification_required ? "Yes" : "No"}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {incident.status === "detected" && (
                        <button
                          type="button"
                          className="admin-button-secondary"
                          disabled={updatingId === incident.id}
                          onClick={() =>
                            setActionDrafts((current) => ({
                              ...current,
                              [incident.id]: {
                                status: "investigating",
                                reason: current[incident.id]?.reason || "",
                                containmentNotes:
                                  current[incident.id]?.containmentNotes || "",
                              },
                            }))
                          }
                        >
                          Investigating
                        </button>
                      )}
                      {incident.status !== "contained" &&
                        incident.status !== "resolved" && (
                          <button
                            type="button"
                            className="admin-button-secondary"
                            disabled={updatingId === incident.id}
                            onClick={() =>
                              setActionDrafts((current) => ({
                                ...current,
                                [incident.id]: {
                                  status: "contained",
                                  reason: current[incident.id]?.reason || "",
                                  containmentNotes:
                                    current[incident.id]?.containmentNotes ||
                                    incident.containment_notes ||
                                    "",
                                },
                              }))
                            }
                          >
                            Contained
                          </button>
                        )}
                      {incident.status !== "resolved" && (
                        <button
                          type="button"
                          className="admin-button-secondary"
                          disabled={updatingId === incident.id}
                          onClick={() =>
                            setActionDrafts((current) => ({
                              ...current,
                              [incident.id]: {
                                status: "resolved",
                                reason: current[incident.id]?.reason || "",
                                containmentNotes:
                                  current[incident.id]?.containmentNotes || "",
                              },
                            }))
                          }
                        >
                          Resolved
                        </button>
                      )}
                    </div>
                    {actionDrafts[incident.id] && (
                      <div className="admin-inline-flow">
                        {actionDrafts[incident.id].status === "contained" &&
                          !incident.containment_notes && (
                            <label>
                              <span>Containment notes</span>
                              <textarea
                                value={actionDrafts[incident.id].containmentNotes}
                                onChange={(event) =>
                                  setActionDrafts((current) => ({
                                    ...current,
                                    [incident.id]: {
                                      ...current[incident.id],
                                      containmentNotes: event.target.value,
                                    },
                                  }))
                                }
                                rows={2}
                              />
                            </label>
                          )}
                        <label>
                          <span>Reason for {actionDrafts[incident.id].status}</span>
                          <textarea
                            value={actionDrafts[incident.id].reason}
                            onChange={(event) =>
                              setActionDrafts((current) => ({
                                ...current,
                                [incident.id]: {
                                  ...current[incident.id],
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
                            disabled={updatingId === incident.id}
                            onClick={() =>
                              updateIncidentStatus(
                                incident,
                                actionDrafts[incident.id].status,
                              )
                            }
                          >
                            {updatingId === incident.id ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            className="admin-button-secondary"
                            disabled={updatingId === incident.id}
                            onClick={() =>
                              setActionDrafts((current) => {
                                const next = { ...current };
                                delete next[incident.id];
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
              {!loading && incidents.length === 0 && (
                <tr>
                  <td colSpan={6}>No privacy incidents recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
