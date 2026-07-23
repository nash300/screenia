"use client";

import { useEffect, useMemo, useState } from "react";
import { showAdminNotification } from "@/lib/admin/notifications";

type InquiryStatus = "new" | "open" | "replied" | "closed";

type InquiryReply = {
  id: string;
  admin_user_id: string | null;
  message: string;
  email_id: string | null;
  email_status: "pending" | "sent" | "failed";
  created_at: string;
};

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
  confirmation_email_status: "pending" | "sent" | "failed";
  admin_notification_email_id: string | null;
  admin_notification_email_status: "pending" | "sent" | "failed";
  first_opened_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  contact_inquiry_replies: InquiryReply[];
};

type Filter = "active" | "all" | InquiryStatus;

const filters: Array<{ id: Filter; label: string }> = [
  { id: "active", label: "Needs attention" },
  { id: "open", label: "Open" },
  { id: "replied", label: "Replied" },
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
  if (status === "replied") return "Replied";
  return "Closed";
}

export default function AdminContactInquiriesPage() {
  const [inquiries, setInquiries] = useState<ContactInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [sortBy, setSortBy] = useState("newest");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
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
    return inquiries.filter((item) => {
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
    }).sort((left, right) => {
      if (sortBy === "oldest") return Date.parse(left.created_at) - Date.parse(right.created_at);
      if (sortBy === "name_asc") return left.name.localeCompare(right.name, "sv");
      if (sortBy === "status") return left.status.localeCompare(right.status, "sv");
      return Date.parse(right.created_at) - Date.parse(left.created_at);
    });
  }, [filter, inquiries, query, sortBy]);

  const sendReply = async (inquiry: ContactInquiry) => {
    const reply = (drafts[inquiry.id] || "").trim();
    if (reply.length < 5) {
      showAdminNotification("warning", "Write a reply of at least 5 characters.");
      return;
    }

    setWorkingId(inquiry.id);
    const response = await fetch("/api/admin/contact-inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inquiryId: inquiry.id, reply }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        result.replySaved ? "warning" : "error",
        result.error || "Could not send the reply.",
      );
    } else {
      showAdminNotification(
        "success",
        `Reply sent to ${inquiry.email} and recorded in ${inquiry.case_number}.`,
      );
      setDrafts((current) => ({ ...current, [inquiry.id]: "" }));
    }
    await loadInquiries();
    setWorkingId(null);
  };

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
        result.error || "Could not update the case status.",
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
          <h1 className="admin-title">Visitor messages</h1>
          <p className="admin-subtitle">
            Read public questions, reply by email, and retain the full case and
            delivery history.
          </p>
        </div>
        <div className="admin-dashboard-header-actions">
          <div className="admin-status-chip admin-status-chip-system">
            <span className={`admin-status-dot ${counts.active ? "admin-status-warning" : "admin-status-success"}`} />
            {loading ? "Syncing" : `${counts.active} need attention`}
          </div>
          <button type="button" onClick={loadInquiries} className="admin-button-primary">
            Refresh
          </button>
        </div>
      </div>

      <section className="admin-contact-summary" aria-label="Visitor message summary">
        <div><span>Needs attention</span><strong>{counts.active}</strong><small>Open without a sent reply</small></div>
        <div><span>Replied</span><strong>{counts.replied}</strong><small>Customer email was sent</small></div>
        <div><span>Closed</span><strong>{counts.closed}</strong><small>Completed cases</small></div>
        <div><span>Total</span><strong>{counts.all}</strong><small>Full retained history</small></div>
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
                  <div><dt>Email</dt><dd><a href={`mailto:${inquiry.email}`}>{inquiry.email}</a></dd></div>
                  <div><dt>Company</dt><dd>{inquiry.company_name || "–"}</dd></div>
                  <div><dt>Received</dt><dd>{formatDateTime(inquiry.created_at)}</dd></div>
                  <div><dt>Privacy accepted</dt><dd>{formatDateTime(inquiry.privacy_accepted_at)}</dd></div>
                  <div><dt>Confirmation</dt><dd><span className={`admin-contact-email admin-contact-email-${inquiry.confirmation_email_status}`}>{inquiry.confirmation_email_status}</span></dd></div>
                </dl>

                <div className="admin-contact-original">
                  <span>Visitor&apos;s original question</span>
                  <p>{inquiry.message}</p>
                </div>

                {inquiry.contact_inquiry_replies.length > 0 && (
                  <div className="admin-contact-thread">
                    <h3>Reply history</h3>
                    {inquiry.contact_inquiry_replies.map((reply) => (
                      <article key={reply.id}>
                        <header>
                          <strong>Screenia reply</strong>
                          <span>{formatDateTime(reply.created_at)}</span>
                          <span className={`admin-contact-email admin-contact-email-${reply.email_status}`}>
                            Email {reply.email_status}
                          </span>
                        </header>
                        <p>{reply.message}</p>
                      </article>
                    ))}
                  </div>
                )}

                {inquiry.status !== "closed" && (
                  <div className="admin-contact-reply">
                    <label htmlFor={`reply-${inquiry.id}`}>Reply to {inquiry.name}</label>
                    <textarea
                      id={`reply-${inquiry.id}`}
                      rows={6}
                      maxLength={4000}
                      value={drafts[inquiry.id] || ""}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [inquiry.id]: event.target.value,
                        }))
                      }
                      placeholder="Write a clear answer. The email will include this reply and the visitor's original question."
                    />
                    <div className="admin-contact-reply-actions">
                      <small>{(drafts[inquiry.id] || "").length}/4,000 characters · sends from service@screenia.se</small>
                      <button
                        type="button"
                        className="admin-button-primary"
                        disabled={workingId === inquiry.id}
                        onClick={() => sendReply(inquiry)}
                      >
                        {workingId === inquiry.id ? "Working..." : "Send reply"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="admin-contact-case-actions">
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
