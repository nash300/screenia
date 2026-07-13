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

export default function AdminEmailEventsPage() {
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const actionRequiredCount = useMemo(
    () => events.filter((event) => event.event_status === "action_required").length,
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
          <h1 className="admin-title">Email events</h1>
          <p className="admin-subtitle">
            Review Resend delivery, bounce, complaint, and suppression webhook
            events for customer communication follow-up.
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
                <th>Resend ID</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>
                    <strong>{event.event_type}</strong>
                    <br />
                    <small>{event.svix_id}</small>
                  </td>
                  <td>{event.recipient_email || "-"}</td>
                  <td>{event.subject || "-"}</td>
                  <td>{event.event_status}</td>
                  <td>{formatDateTime(event.received_at)}</td>
                  <td>{event.resend_email_id || "-"}</td>
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
