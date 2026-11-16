"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { showAdminNotification } from "@/lib/admin/notifications";

type InquiryStatus = "new" | "open" | "replied" | "closed";
type EmailStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "failed"
  | "bounced"
  | "complained";

type ContactInquiry = {
  id: string;
  case_number: string;
  name: string;
  email: string;
  company_name: string | null;
  subject: string;
  message: string;
  status: InquiryStatus;
  privacy_accepted_at: string;
  confirmation_email_id: string | null;
  confirmation_email_status: EmailStatus;
  admin_notification_email_id: string | null;
  admin_notification_email_status: EmailStatus;
  first_opened_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

type Filter = "active" | "all" | InquiryStatus;

const filters: Array<{ id: Filter; label: string }> = [
  { id: "active", label: "Needs attention" },
  { id: "open", label: "Open" },
  { id: "replied", label: "Previously replied" },
  { id: "closed", label: "Closed" },
  { id: "all", label: "All" },
];

function formatDateTime(value: string | null) {
  if (!value) return "–";
  return new Date(value).toLocaleString("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusLabel(status: InquiryStatus) {
  if (status === "new") return "New";
  if (status === "open") return "Open";
  if (status === "replied") return "Previously replied";
  return "Closed";
}

export default function AdminContactInquiriesPage() {
  const [inquiries, setInquiries] = useState<ContactInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [sortBy, setSortBy] = useState("newest");
  const [workingId, setWorkingId] = useState<string | null>(null);

  const loadInquiries = async () => {
    setLoading(true);
    const response = await fetch("/api/admin/contact-inquiries", {
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not load visitor messages.",
      );
      setInquiries([]);
    } else {
      setInquiries(result.inquiries || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadInquiries();
  }, []);

  const counts = useMemo(
    () => ({
      all: inquiries.length,
      active: inquiries.filter((item) => ["new", "open"].includes(item.status)).length,
      new: inquiries.filter((item) => item.status === "new").length,
      open: inquiries.filter((item) => item.status === "open").length,
      replied: inquiries.filter((item) => item.status === "replied").length,
      closed: inquiries.filter((item) => item.status === "closed").length,
    }),
    [inquiries],
  );

  const visibleInquiries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return inquiries
      .filter((item) => {
        const matchesFilter =
          filter === "all" ||
          (filter === "active" && ["new", "open"].includes(item.status)) ||
          item.status === filter;
        if (!matchesFilter) return false;
        if (!normalizedQuery) return true;

        return [
          item.case_number,
          item.name,
          item.email,
          item.company_name,
          item.subject,
          item.message,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) => {
        if (sortBy === "oldest") return Date.parse(left.created_at) - Date.parse(right.created_at);
        if (sortBy === "name_asc") return left.name.localeCompare(right.name, "sv");
        if (sortBy === "status") return left.status.localeCompare(right.status, "sv");
        return Date.parse(right.created_at) - Date.parse(left.created_at);
      });
  }, [filter, inquiries, query, sortBy]);

  const updateStatus = async (inquiry: ContactInquiry, status: "open" | "closed") => {
    setWorkingId(inquiry.id);
    const response = await fetch("/api/admin/contact-inquiries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inquiryId: inquiry.id, status }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not update the message status.",
      );
    } else {
      showAdminNotification(
        "success",
        `${inquiry.case_number} marked as ${status}.`,
      );
    }
    await loadInquiries();
    setWorkingId(null);
  };

  return (
    <div className="admin-dashboard-page admin-contact-page">
      <div className="admin-page-header admin-dashboard-header">
        <div>
          <h1 className="admin-title">Messages</h1>
          <p className="admin-subtitle">
            Read visitor questions here, then reply from Zoho Mail. The original
            message and delivery status remain available in Screenia.
          </p>
        </div>
        <div className="admin-dashboard-header-actions">
          <Link
            href="https://mail.zoho.eu/zm/#mail/folder/inbox"
            className="admin-button-secondary"
            target="_blank"
            rel="noreferrer"
          >
            Open Zoho Mail
          </Link>
          <Link href="/admin/email-events" className="admin-button-secondary">
            Email delivery evidence
          </Link>
          <div className="admin-status-chip admin-status-chip-system">
            <span className={`admin-status-dot ${counts.active ? "admin-status-warning" : "admin-status-success"}`} />
            {loading ? "Syncing" : `${counts.active} need attention`}
          </div>
          <button type="button" onClick={loadInquiries} className="admin-button-primary">
            Refresh
          </button>
        </div>
      </div>

      <div className="admin-contact-zoho-note" role="note">
        <strong>Communication is handled in Zoho Mail.</strong>
        <span>Use the service@screenia.se mailbox when answering a visitor.</span>
        <Link href="https://mail.zoho.eu/zm/#mail/folder/inbox" target="_blank" rel="noreferrer">
          Open mailbox
        </Link>
      </div>

      <section className="admin-contact-summary" aria-label="Visitor message summary">
        <div><span>Needs attention</span><strong>{counts.active}</strong><small>Open messages</small></div>
        <div><span>Open</span><strong>{counts.open}</strong><small>Waiting for handling</small></div>
        <div><span>Closed</span><strong>{counts.closed}</strong><small>Completed cases</small></div>
        <div><span>Total</span><strong>{counts.all}</strong><small>Original messages retained</small></div>
      </section>

      <section className="admin-card admin-contact-panel">
        <div className="admin-contact-toolbar">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search case, name, email, company, subject, or message..."
            aria-label="Search visitor messages"
          />
          <div className="admin-list-selects">
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as Filter)}
              aria-label="Filter visitor messages"
            >
              {filters.map((item) => {
                const count = item.id === "active" ? counts.active : item.id === "all" ? counts.all : counts[item.id];
                return (
                  <option key={item.id} value={item.id}>{item.label} ({count})</option>
                );
              })}
            </select>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              aria-label="Sort visitor messages"
            >
              <option value="newest">Sort: Newest first</option>
              <option value="oldest">Sort: Oldest first</option>
              <option value="name_asc">Sort: Visitor A-Z</option>
              <option value="status">Sort: Status</option>
            </select>
          </div>
        </div>

        <div className="admin-contact-list">
          {visibleInquiries.map((inquiry) => (
            <details
              key={inquiry.id}
              className={`admin-contact-case admin-contact-case-${inquiry.status}`}
              open={inquiry.status === "new" || inquiry.status === "open"}
            >
              <summary>
                <span className="admin-contact-case-main">
                  <strong>{inquiry.subject}</strong>
                  <small>{inquiry.case_number} · {inquiry.name} · {formatDateTime(inquiry.created_at)}</small>
                </span>
                <span className={`admin-contact-status admin-contact-status-${inquiry.status}`}>
                  {statusLabel(inquiry.status)}
                </span>
              </summary>

              <div className="admin-contact-case-body">
                <dl className="admin-contact-details">
                  <div><dt>Name</dt><dd>{inquiry.name}</dd></div>
                  <div><dt>Email</dt><dd><a className="admin-link" href={`mailto:${inquiry.email}`}>{inquiry.email}</a></dd></div>
                  <div><dt>Company</dt><dd>{inquiry.company_name || "–"}</dd></div>
                  <div><dt>Received</dt><dd>{formatDateTime(inquiry.created_at)}</dd></div>
                  <div><dt>Privacy accepted</dt><dd>{formatDateTime(inquiry.privacy_accepted_at)}</dd></div>
                  <div><dt>Confirmation</dt><dd><span className={`admin-contact-email admin-contact-email-${inquiry.confirmation_email_status}`}>{inquiry.confirmation_email_status}</span></dd></div>
                </dl>

                <section className="admin-contact-source-message" aria-label={`Visitor message for ${inquiry.case_number}`}>
                  <header>
                    <strong>Visitor message</strong>
                    <span>{formatDateTime(inquiry.created_at)}</span>
                  </header>
                  <p>{inquiry.message}</p>
                </section>

                <p className="admin-contact-zoho-instruction">
                  Reply in Zoho Mail from <strong>service@screenia.se</strong>. Screenia does not send replies from this page.
                </p>

                <div className="admin-contact-case-actions">
                  <Link
                    href="https://mail.zoho.eu/zm/#mail/folder/inbox"
                    className="admin-button-secondary"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Zoho Mail
                  </Link>
                  {inquiry.status === "closed" ? (
                    <button
                      type="button"
                      className="admin-button-secondary"
                      disabled={workingId === inquiry.id}
                      onClick={() => updateStatus(inquiry, "open")}
                    >
                      Reopen case
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="admin-button-secondary"
                      disabled={workingId === inquiry.id}
                      onClick={() => updateStatus(inquiry, "closed")}
                    >
                      Close case
                    </button>
                  )}
                </div>
              </div>
            </details>
          ))}

          {!loading && visibleInquiries.length === 0 && (
            <div className="admin-contact-empty">
              <strong>No visitor messages in this view.</strong>
              <p>New questions submitted through screenia.se will appear here.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
