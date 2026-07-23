"use client";

import { useEffect, useMemo, useState } from "react";
import { showAdminNotification } from "@/lib/admin/notifications";

type EmailEvent = {
  id: string;
  svix_id: string;
  event_type: string;
  resend_email_id: string | null;
  recipient_email: string | null;
  subject: string | null;
  event_status: string;
  raw_payload: Record<string, unknown>;
  received_at: string;
  processed_at: string | null;
};

type EmailEventFilter = "all" | "needs_follow_up" | "healthy";

const healthyEmailStatuses = [
  "received",
  "processed",
  "delivered",
  "opened",
  "clicked",
];

const followUpEmailStatuses = [
  "action_required",
  "bounced",
  "complained",
  "failed",
];

const emailEventFilters: Array<{
  id: EmailEventFilter;
  label: string;
}> = [
  { id: "all", label: "All evidence" },
  { id: "needs_follow_up", label: "Needs follow-up" },
  { id: "healthy", label: "Healthy delivery" },
];

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("sv-SE");
}

function formatEventType(value: string) {
  return value
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatEventStatus(value: string) {
  if (value === "action_required") return "Needs action";
  return formatEventType(value);
}

export default function AdminEmailEventsPage() {
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<EmailEventFilter>("all");
  const [query, setQuery] = useState("");
  const actionRequiredCount = useMemo(
    () => events.filter((event) => event.event_status === "action_required").length,
    [events],
  );
  const deliveredCount = useMemo(
    () =>
      events.filter((event) => healthyEmailStatuses.includes(event.event_status))
        .length,
    [events],
  );
  const failedCount = useMemo(
    () =>
      events.filter((event) => followUpEmailStatuses.includes(event.event_status))
        .length,
    [events],
  );
  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return events.filter((event) => {
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "needs_follow_up" &&
          followUpEmailStatuses.includes(event.event_status)) ||
        (activeFilter === "healthy" &&
          healthyEmailStatuses.includes(event.event_status));

      if (!matchesFilter) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        event.event_type,
        event.event_status,
        event.recipient_email,
        event.subject,
        event.resend_email_id,
        event.svix_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [activeFilter, events, query]);
  const filterCounts: Record<EmailEventFilter, number> = {
    all: events.length,
    needs_follow_up: failedCount,
    healthy: deliveredCount,
  };

  const loadEvents = async () => {
    setLoading(true);
    const response = await fetch("/api/admin/email-events", {
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not load email delivery events.",
      );
      setEvents([]);
    } else {
      setEvents(result.events || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  return (
    <div className="admin-dashboard-page">
      <div className="admin-page-header admin-dashboard-header">
        <div>
          <h1 className="admin-title">Email evidence</h1>
          <p className="admin-subtitle">
            Review customer email delivery evidence, bounces, complaints, and
            failures for communication follow-up.
          </p>
        </div>
        <div className="admin-dashboard-header-actions">
          <div className="admin-status-chip admin-status-chip-system">
            <span className="admin-status-dot admin-status-warning" />
            {loading
              ? "Syncing"
              : `${actionRequiredCount} ${
                  actionRequiredCount === 1 ? "needs" : "need"
                } action`}
          </div>
          <button onClick={loadEvents} className="admin-button-primary">
            Refresh
          </button>
        </div>
      </div>

      <section className="admin-email-summary">
        <div>
          <span>Total events</span>
          <strong>{events.length}</strong>
          <small>Latest transactional email evidence</small>
        </div>
        <div>
          <span>Healthy delivery</span>
          <strong>{deliveredCount}</strong>
          <small>Received, processed, delivered, opened, or clicked</small>
        </div>
        <div>
          <span>Needs follow-up</span>
          <strong>{failedCount}</strong>
          <small>Bounces, complaints, failures, or action required</small>
        </div>
      </section>

      <section className="admin-card admin-email-panel">
        <div className="admin-email-heading">
          <div>
            <h2 className="admin-card-title">Delivery evidence</h2>
            <p className="admin-email-heading-copy">
              Start with messages that need follow-up, then use provider IDs
              only when troubleshooting delivery with Resend or webhook logs.
            </p>
          </div>
        </div>

        <div className="admin-email-toolbar">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search recipient, subject, event, Resend ID, or Svix ID..."
          />
          <div className="admin-email-filter-row">
            {emailEventFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className={
                  activeFilter === filter.id
                    ? "admin-email-filter-active"
                    : undefined
                }
              >
                {filter.label} ({filterCounts[filter.id]})
              </button>
            ))}
          </div>
        </div>

        <div className="admin-table-wrap admin-email-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Recipient</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Received</th>
                <th>Support details</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event) => (
                <tr key={event.id}>
                  <td>
                    <strong>{formatEventType(event.event_type)}</strong>
                  </td>
                  <td>{event.recipient_email || "-"}</td>
                  <td>{event.subject || "-"}</td>
                  <td>
                    <span
                      className={`admin-email-status admin-email-status-${event.event_status}`}
                    >
                      {formatEventStatus(event.event_status)}
                    </span>
                  </td>
                  <td>{formatDateTime(event.received_at)}</td>
                  <td>
                    <details className="admin-email-support-details">
                      <summary>IDs and processing</summary>
                      <p>
                        <strong>Resend:</strong> {event.resend_email_id || "-"}
                      </p>
                      <p>
                        <strong>Svix:</strong> {event.svix_id || "-"}
                      </p>
                      <p>
                        <strong>Processed:</strong>{" "}
                        {formatDateTime(event.processed_at)}
                      </p>
                    </details>
                  </td>
                </tr>
              ))}
              {!loading && filteredEvents.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    {events.length === 0
                      ? "No email delivery events recorded."
                      : "No email delivery events match this view."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
