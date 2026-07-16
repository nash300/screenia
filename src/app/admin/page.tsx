"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { showAdminNotification } from "@/lib/admin/notifications";

type AdminCustomer = {
  id: string;
  name: string;
  email: string | null;
  status: string | null;
  devices?: {
    id: string;
    playlists?: { count: number }[];
  }[];
};

type AdminNotification = {
  id: string;
  customer_id: string | null;
  event_type: string;
  title: string;
  message: string;
  priority: string;
  read_at: string | null;
  created_at: string;
  customers?:
    | {
    name: string | null;
      }
    | Array<{
        name: string | null;
      }>
    | null;
};

export default function AdminHomePage() {
  const [customerCount, setCustomerCount] = useState(0);
  const [displayCount, setDisplayCount] = useState(0);
  const [newMaterialCount, setNewMaterialCount] = useState(0);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingNotification, setSavingNotification] = useState(false);
  const [showMarkAllReadFlow, setShowMarkAllReadFlow] = useState(false);
  const [markAllReadReason, setMarkAllReadReason] = useState("");

  const needsDisplayCount = customers.filter((customer) => {
    const displayCount = customer.devices?.length || 0;
    return (
      ["content_received", "active"].includes(customer.status || "") &&
      displayCount === 0
    );
  }).length;

  const needsPlaylistCount = customers.filter((customer) => {
    return (
      ["content_received", "active"].includes(customer.status || "") &&
      customer.devices?.some(
        (device) => (device.playlists?.[0]?.count || 0) === 0,
      )
    );
  }).length;

  const activeCustomerCount = customers.filter(
    (customer) => customer.status === "active",
  ).length;
  const newRequestCount = customers.filter(
    (customer) => customer.status === "new_request",
  ).length;
  const paidCustomerCount = customers.filter(
    (customer) => customer.status === "paid",
  ).length;
  const contentPendingCount = customers.filter(
    (customer) => customer.status === "content_pending",
  ).length;
  const contentReceivedCount = customers.filter(
    (customer) => customer.status === "content_received",
  ).length;
  const invitedCustomerCount = customers.filter(
    (customer) =>
      customer.status === "invited" || customer.status === "accepted_terms",
  ).length;
  const suspendedCustomerCount = customers.filter(
    (customer) => customer.status === "suspended",
  ).length;
  const unreadNotificationCount = notifications.filter(
    (notification) => !notification.read_at,
  ).length;
  const readyCustomerCount = customers.filter((customer) => {
    const displayCount = customer.devices?.length || 0;
    const hasDisplayWithoutPlaylist = customer.devices?.some(
      (device) => (device.playlists?.[0]?.count || 0) === 0,
    );

    return (
      customer.status === "active" &&
      displayCount > 0 &&
      !hasDisplayWithoutPlaylist
    );
  }).length;

  const managedCustomerCount = customers.filter((customer) =>
    ["paid", "content_pending", "content_received", "active"].includes(
      customer.status || "",
    ),
  ).length;
  const attentionCount =
    newRequestCount +
    paidCustomerCount +
    contentPendingCount +
    needsDisplayCount +
    needsPlaylistCount;
  const setupCompletion =
    managedCustomerCount === 0
      ? 0
      : Math.round((readyCustomerCount / managedCustomerCount) * 100);

  const loadStats = async () => {
    setLoading(true);

    const { count: devices } = await supabase
      .from("devices")
      .select("*", { count: "exact", head: true });

    const { count: newMaterials } = await supabase
      .from("customer_display_assets")
      .select("*", { count: "exact", head: true })
      .eq("status", "new");

    const { data: notificationData, error: notificationError } = await supabase
      .from("admin_notifications")
      .select(
        "id, customer_id, event_type, title, message, priority, read_at, created_at, customers(name)",
      )
      .order("created_at", { ascending: false })
      .limit(5);

    const { data, error } = await supabase.from("customers").select(`
      id,
      name,
      email,
      status,
      devices(
        id,
        playlists(count)
      )
    `);

    if (error) {
      console.error("Load dashboard customer stats error:", error);
      setCustomers([]);
      setCustomerCount(0);
    } else {
      const nextCustomers = (data || []) as AdminCustomer[];
      setCustomers(nextCustomers);
      setCustomerCount(nextCustomers.length);
    }
    setDisplayCount(devices || 0);
    setNewMaterialCount(newMaterials || 0);
    if (notificationError) {
      console.warn("Load admin notifications error:", notificationError.message);
      setNotifications([]);
    } else {
      setNotifications((notificationData || []) as AdminNotification[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const updateNotification = async (
    action: "mark_read" | "mark_unread" | "mark_all_read",
    notificationId?: string,
  ) => {
    const reason =
      action === "mark_all_read" ? markAllReadReason.trim() : "";

    if (action === "mark_all_read" && (!reason || reason.length < 5)) {
      showAdminNotification(
        "error",
        "A reason of at least 5 characters is required.",
      );
      return;
    }

    setSavingNotification(true);

    const response = await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, notificationId, reason }),
    });
    const result = await response.json();

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not update notification.",
      );
      setSavingNotification(false);
      return;
    }

    await loadStats();
    if (action === "mark_all_read") {
      setMarkAllReadReason("");
      setShowMarkAllReadFlow(false);
    }
    showAdminNotification("success", "Notification updated.");
    setSavingNotification(false);
  };

  return (
    <div className="admin-dashboard-page">
      <div className="admin-page-header admin-dashboard-header">
        <div>
          <h1 className="admin-title">Dashboard</h1>
          <p className="admin-subtitle">
            Operational overview of customers, displays, and setup status.
          </p>
        </div>

        <div className="admin-dashboard-header-actions">
          <div className="admin-status-chip admin-status-chip-system">
            <span className="admin-status-dot admin-status-success" />
            {loading ? "Syncing" : "Live status"}
          </div>

          <button onClick={loadStats} className="admin-button-primary">
            Refresh
          </button>
        </div>
      </div>

      <section className="admin-action-grid">
        <ActionCard
          href="/admin/customers?filter=new_request"
          title="New requests"
          description="Review package requests."
          count={newRequestCount}
          tone="warning"
          loading={loading}
        />
        <ActionCard
          href="/admin/customers?filter=invited"
          title="Invited customers"
          description="Waiting for details or payment."
          count={invitedCustomerCount}
          tone="info"
          loading={loading}
        />
        <ActionCard
          href="/admin/customers?filter=content_pending"
          title="Content setup"
          description="Paid customers who still need content."
          count={paidCustomerCount + contentPendingCount}
          tone="warning"
          loading={loading}
        />
        <ActionCard
          href="/admin/customers?filter=needs_device"
          title="Prepare hardware"
          description="Content received without an assigned screen."
          count={needsDisplayCount}
          tone="warning"
          loading={loading}
        />
        <ActionCard
          href="/admin/customers?filter=needs_playlist"
          title="Upload playlists"
          description="Assigned displays with no playable content."
          count={needsPlaylistCount}
          tone="danger"
          loading={loading}
        />
      </section>

      <div className="admin-dashboard-kpis">
        <StatCard
          label="Total customers"
          value={customerCount}
          loading={loading}
          tone="neutral"
          meta="Registered accounts"
        />

        <StatCard
          label="Total displays"
          value={displayCount}
          loading={loading}
          tone="neutral"
          meta="Registered screens"
        />

        <StatCard
          label="Setup complete"
          value={`${setupCompletion}%`}
          loading={loading}
          tone="success"
          meta={`${readyCustomerCount} active of ${managedCustomerCount} paid customers`}
        />
      </div>

      <section className="admin-card admin-dashboard-panel p-6">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <p className="admin-operation-kicker">Admin map</p>
            <h2 className="admin-card-title text-xl">Use the right workspace</h2>
            <p className="admin-muted mt-2">
              Screenia admin is organized by business workflow, not database
              tables.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <WorkspaceLink
            href="/admin/customers"
            title="Customer work"
            description="Requests, onboarding links, customer details, account setup, messages, and uploads."
          />
          <WorkspaceLink
            href="/admin/orders"
            title="Orders & billing"
            description="Quotes, Stripe status, VAT evidence, refunds, cancellation, and accounting exports."
          />
          <WorkspaceLink
            href="/admin/devices"
            title="Displays"
            description="Customer display endpoints, playlists, screen URLs, and content readiness."
          />
          <WorkspaceLink
            href="/admin/inventory"
            title="Hardware stock"
            description="Physical boxes, serial numbers, purchase data, warranty, returns, repair, and retirement."
          />
          <WorkspaceLink
            href="/admin/email-events"
            title="Email log"
            description="Transactional email delivery, failures, bounces, and customer communication evidence."
          />
          <WorkspaceLink
            href="/admin/launch-readiness"
            title="Launch readiness"
            description="Operational gates before live payments and public launch."
          />
        </div>
      </section>

      <div className="admin-dashboard-grid">
        <section className="admin-card admin-dashboard-panel p-6">
          <h2 className="admin-card-title text-xl">Account health</h2>

          <div className="admin-status-list">
            <StatusRow label="Active" value={activeCustomerCount} tone="success" />
            <StatusRow label="New requests" value={newRequestCount} tone="warning" />
            <StatusRow label="Paid" value={paidCustomerCount} tone="info" />
            <StatusRow label="Content pending" value={contentPendingCount} tone="warning" />
            <StatusRow label="Content received" value={contentReceivedCount} tone="info" />
            <StatusRow
              label="Suspended"
              value={suspendedCustomerCount}
              tone="danger"
            />
          </div>
        </section>

        <section className="admin-card admin-dashboard-panel p-6">
          <h2 className="admin-card-title text-xl">Setup health</h2>

          <div className="admin-progress-block">
            <div className="admin-progress-header">
              <span>Ready customers</span>
              <strong>{loading ? "..." : `${setupCompletion}%`}</strong>
            </div>
            <div className="admin-progress-track">
              <div
                className="admin-progress-value"
                style={{ width: `${setupCompletion}%` }}
              />
            </div>
          </div>

          <div className="admin-status-list admin-status-list-compact">
            <StatusRow label="Ready" value={readyCustomerCount} tone="success" />
            <StatusRow
              label="Missing displays"
              value={needsDisplayCount}
              tone="warning"
            />
            <StatusRow
              label="Missing playlists"
              value={needsPlaylistCount}
              tone="danger"
            />
          </div>
        </section>

        <section className="admin-card admin-dashboard-panel p-6">
          <h2 className="admin-card-title text-xl">Uploads</h2>
          <div className="admin-status-list">
            <StatusRow label="New material" value={newMaterialCount} tone="warning" />
            <StatusRow label="Total attention" value={attentionCount + newMaterialCount} tone="info" />
          </div>
        </section>

        <section className="admin-card admin-dashboard-panel p-6">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <h2 className="admin-card-title text-xl">Notifications</h2>
            <button
              type="button"
              onClick={() => setShowMarkAllReadFlow((current) => !current)}
              disabled={savingNotification || unreadNotificationCount === 0}
              className="admin-button-secondary disabled:opacity-50"
            >
              Mark all read
            </button>
          </div>
          {showMarkAllReadFlow && (
            <div className="admin-inline-flow">
              <label>
                <span>Reason for marking all admin notifications as read</span>
                <textarea
                  value={markAllReadReason}
                  onChange={(event) => setMarkAllReadReason(event.target.value)}
                  rows={2}
                />
              </label>
              <div className="admin-inline-flow-actions">
                <button
                  type="button"
                  className="admin-button-primary"
                  disabled={savingNotification || !markAllReadReason.trim()}
                  onClick={() => updateNotification("mark_all_read")}
                >
                  {savingNotification ? "Saving..." : "Confirm all read"}
                </button>
                <button
                  type="button"
                  className="admin-button-secondary"
                  disabled={savingNotification}
                  onClick={() => {
                    setShowMarkAllReadFlow(false);
                    setMarkAllReadReason("");
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
          <div className="admin-status-list">
            <StatusRow label="Unread" value={unreadNotificationCount} tone="warning" />
          </div>

          <div className="mt-4 space-y-3">
            {notifications.length ? (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`rounded-2xl border p-3 text-sm ${
                    notification.read_at
                      ? "border-slate-200 bg-white/60"
                      : "border-amber-200 bg-amber-50/70"
                  }`}
                >
                  <Link
                    href={
                      notification.customer_id
                        ? `/admin/customers/${notification.customer_id}`
                        : "/admin/customers"
                    }
                    className="block text-sm no-underline"
                  >
                    <strong className="block text-slate-950">
                      {notification.title}
                    </strong>
                    <span className="mt-1 block text-slate-600">
                      {notificationCustomerName(notification)
                        ? `${notificationCustomerName(notification)} - `
                        : ""}
                      {notification.message}
                    </span>
                    <span className="mt-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      {notification.priority} |{" "}
                      {notification.read_at
                        ? `Read ${new Date(notification.read_at).toLocaleString("sv-SE")}`
                        : "Unread"}
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() =>
                      updateNotification(
                        notification.read_at ? "mark_unread" : "mark_read",
                        notification.id,
                      )
                    }
                    disabled={savingNotification}
                    className="admin-button-secondary mt-3 disabled:opacity-50"
                  >
                    {notification.read_at ? "Mark unread" : "Mark read"}
                  </button>
                </div>
              ))
            ) : (
              <p className="admin-muted mt-3 text-sm">No notifications yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
  tone,
  meta,
  href,
}: {
  label: string;
  value: number | string;
  loading: boolean;
  tone: "neutral" | "success" | "warning";
  meta: string;
  href?: string;
}) {
  const content = (
    <>
      <span className={`admin-stat-icon admin-stat-${tone}`} />
      <p className="admin-stat-label">{label}</p>
      <p className="admin-stat-value">{loading ? "..." : value}</p>
      <p className="admin-stat-meta">{meta}</p>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="admin-card admin-stat-card">
        {content}
      </Link>
    );
  }

  return <div className="admin-card admin-stat-card">{content}</div>;
}

function WorkspaceLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm no-underline transition hover:bg-white hover:shadow-md"
    >
      <strong className="block text-slate-950">{title}</strong>
      <span className="mt-2 block text-slate-600">{description}</span>
    </Link>
  );
}

function notificationCustomerName(notification: AdminNotification) {
  const customer = Array.isArray(notification.customers)
    ? notification.customers[0]
    : notification.customers;

  return customer?.name || "";
}

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <div className="admin-status-row">
      <span className={`admin-status-dot admin-status-${tone}`} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ActionCard({
  href,
  title,
  description,
  count,
  tone,
  loading,
}: {
  href: string;
  title: string;
  description: string;
  count: number;
  tone: "warning" | "danger" | "info";
  loading: boolean;
}) {
  return (
    <Link href={href} className={`admin-action-card admin-action-${tone}`}>
      <div>
        <p className="admin-priority-title">{title}</p>
        <p className="admin-priority-description">{description}</p>
      </div>
      <span>{loading ? "..." : count}</span>
    </Link>
  );
}
