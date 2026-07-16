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
  const actionRequiredCount = useMemo(
    () => events.filter((event) => event.event_status === "action_required").length,
    [events],
  );
  const deliveredCount = useMemo(
    () =>
      events.filter((event) =>
        ["received", "processed", "delivered", "opened", "clicked"].includes(
          event.event_status,
        ),
      ).length,
    [events],
  );
  const failedCount = useMemo(
    () =>
      events.filter((event) =>
        ["action_required", "bounced", "complained", "failed"].includes(
          event.event_status,
        ),
      ).length,
    [events],
  );

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
          <h1 className="admin-title">Email log</h1>
          <p className="admin-subtitle">
            Review transactional email delivery, bounces, complaints, and
            failures for customer communication follow-up.
          </p>
        </div>
        <div className="admin-dashboard-header-actions">
          <div className="admin-status-chip admin-status-chip-system">
            <span className="admin-status-dot admin-status-warning" />
            {loading ? "Syncing" : `${actionRequiredCount} need action`}
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

      <section className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Delivery event register</h2>
        <div className="admin-table-wrap mt-4">
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
              {events.map((event) => (
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
              {!loading && events.length === 0 && (
                <tr>
                  <td colSpan={6}>No email delivery events recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
