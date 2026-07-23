"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { showAdminNotification } from "@/lib/admin/notifications";
import {
  getCustomerWorkflowAction,
  type CustomerWorkflowAction,
} from "@/lib/admin/customer-workflow";

type AdminCustomer = {
  id: string;
  name: string;
  email: string | null;
  status: string | null;
  payment_status: string | null;
  service_access_status: string | null;
  created_at: string | null;
  devices?: {
    id: string;
    device_code: string;
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
  resolved_at: string | null;
  resolution_event_type: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
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
  const setupPendingCustomerCount = customers.filter(
    (customer) =>
      customer.status === "invited" ||
      customer.status === "accepted_terms" ||
      customer.status === "completed_profile",
  ).length;
  const suspendedCustomerCount = customers.filter(
    (customer) => customer.status === "suspended",
  ).length;
  const unreadNotificationCount = notifications.filter(
    (notification) => !notification.read_at && !notification.resolved_at,
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
  const customerWorkQueue = customers
    .map((customer) => {
      const firstDeviceWithoutPlaylist = customer.devices?.find(
        (device) => (device.playlists?.[0]?.count || 0) === 0,
      );
      const action = getCustomerWorkflowAction({
        id: customer.id,
        status: customer.status,
        paymentStatus: customer.payment_status,
        serviceAccessStatus: customer.service_access_status,
        deviceCount: customer.devices?.length || 0,
        firstDeviceCode: customer.devices?.[0]?.device_code,
        firstDeviceWithoutPlaylistCode: firstDeviceWithoutPlaylist?.device_code,
      });

      return action ? { customer, action } : null;
    })
    .filter(
      (item): item is { customer: AdminCustomer; action: CustomerWorkflowAction } =>
        Boolean(item),
    )
    .sort((left, right) => {
      const priority = { urgent: 0, high: 1, normal: 2 };
      const priorityDifference =
        priority[left.action.priority] - priority[right.action.priority];
      if (priorityDifference !== 0) return priorityDifference;

      return dateValue(left.customer.created_at) - dateValue(right.customer.created_at);
    })
    .slice(0, 8);

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
        "id, customer_id, event_type, title, message, priority, read_at, resolved_at, resolution_event_type, created_at, metadata, customers(name)",
      )
      .order("created_at", { ascending: false })
      .limit(5);

    const { data, error } = await supabase.from("customers").select(`
      id,
      name,
      email,
      status,
      payment_status,
      service_access_status,
      created_at,
      devices(
        id,
        device_code,
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
            Operational overview of customer intake, material, billing,
            displays, and setup readiness.
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

      <section className="admin-card admin-work-queue">
        <div className="admin-work-queue-header">
          <div>
            <p className="admin-operation-kicker">Next best action</p>
            <h2 className="admin-card-title">Today&apos;s customer work</h2>
            <p className="admin-muted">
              Prioritized by customer impact. Open a row to continue at the correct step.
            </p>
          </div>
          <div className="admin-work-queue-commands">
            <Link href="/admin/contact-inquiries" className="admin-button-secondary">
              Visitor messages
            </Link>
            <Link href="/admin/orders" className="admin-button-secondary">
              Orders &amp; billing
            </Link>
            <Link href="/admin/customers" className="admin-button-primary">
              Customer work
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="admin-muted admin-work-queue-empty">Loading work queue...</p>
        ) : customerWorkQueue.length ? (
          <div className="admin-work-queue-list">
            {customerWorkQueue.map(({ customer, action }) => (
              <article key={customer.id} className="admin-work-queue-item">
                <div className={`admin-work-priority admin-work-priority-${action.priority}`}>
                  {action.priority === "urgent" ? "Urgent" : action.priority === "high" ? "Next" : "Follow up"}
                </div>
                <div className="admin-work-customer">
                  <strong>{customer.name}</strong>
                  <span>{customer.email || "No contact email"}</span>
                </div>
                <div className="admin-work-action-copy">
                  <span>Step {action.stage} - {action.stageLabel}</span>
                  <strong>{action.title}</strong>
                  <small>{action.description}</small>
                </div>
                <div className="admin-work-age">
                  <span>Waiting</span>
                  <strong>{formatWaitingTime(customer.created_at)}</strong>
                </div>
                <Link href={action.href} className="admin-button-primary">
                  Open next step
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="admin-work-queue-empty">
            <strong>No active customer tasks</strong>
            <span>New requests and delivery exceptions will appear here.</span>
          </div>
        )}
      </section>

      <section className="admin-action-grid">
        <ActionCard
          href="/admin/customers?filter=new_request"
          title="New requests"
          description="Review new inquiries and package requests."
          count={newRequestCount}
          tone="warning"
          loading={loading}
        />
        <ActionCard
          href="/admin/customers?filter=setup_pending"
          title="Setup links sent"
          description="Waiting for details or payment."
          count={setupPendingCustomerCount}
          tone="info"
          loading={loading}
        />
        <ActionCard
          href="/admin/customers?filter=material_pending"
          title="Material pending"
          description="Paid customers who still need screen material."
          count={paidCustomerCount + contentPendingCount}
          tone="warning"
          loading={loading}
        />
        <ActionCard
          href="/admin/customers?filter=needs_device"
          title="Ready for device allocation"
          description="Material received without customer device allocation."
          count={needsDisplayCount}
          tone="warning"
          loading={loading}
        />
        <ActionCard
          href="/admin/customers?filter=needs_playlist"
          title="Needs playlist content"
          description="Assigned display endpoints with no playable material."
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

      <div className="admin-dashboard-grid">
        <section className="admin-card admin-dashboard-panel">
          <h2 className="admin-card-title admin-dashboard-panel-title">Account health</h2>

          <div className="admin-status-list">
            <StatusRow label="Active" value={activeCustomerCount} tone="success" />
            <StatusRow label="New requests" value={newRequestCount} tone="warning" />
            <StatusRow label="Paid" value={paidCustomerCount} tone="info" />
            <StatusRow label="Material pending" value={contentPendingCount} tone="warning" />
            <StatusRow label="Material received" value={contentReceivedCount} tone="info" />
            <StatusRow
              label="Suspended"
              value={suspendedCustomerCount}
              tone="danger"
            />
          </div>
        </section>

        <section className="admin-card admin-dashboard-panel">
          <h2 className="admin-card-title admin-dashboard-panel-title">Setup health</h2>

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
              label="Ready for device allocation"
              value={needsDisplayCount}
              tone="warning"
            />
            <StatusRow
              label="Needs playlist content"
              value={needsPlaylistCount}
              tone="danger"
            />
          </div>
        </section>

        <section className="admin-card admin-dashboard-panel">
          <h2 className="admin-card-title admin-dashboard-panel-title">Material review</h2>
          <div className="admin-status-list">
            <StatusRow label="New material" value={newMaterialCount} tone="warning" />
            <StatusRow label="Total attention" value={attentionCount + newMaterialCount} tone="info" />
          </div>
        </section>

        <section className="admin-card admin-dashboard-panel">
          <div className="admin-dashboard-panel-heading">
            <h2 className="admin-card-title admin-dashboard-panel-title">Notifications</h2>
            <button
              type="button"
              onClick={() => setShowMarkAllReadFlow((current) => !current)}
              disabled={savingNotification || unreadNotificationCount === 0}
              className="admin-button-secondary"
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

          <div className="admin-dashboard-notification-list">
            {notifications.length ? (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`admin-dashboard-notification ${
                    notification.resolved_at
                      ? "admin-dashboard-notification-resolved"
                      : notification.read_at
                      ? "admin-dashboard-notification-read"
                      : "admin-dashboard-notification-unread"
                  }`}
                >
                  <Link
                    href={notificationHref(notification)}
                    className="admin-dashboard-notification-link"
                  >
                    <strong>
                      {notification.title}
                    </strong>
                    <span className="admin-dashboard-notification-message">
                      {notificationCustomerName(notification)
                        ? `${notificationCustomerName(notification)} - `
                        : ""}
                      {notification.message}
                    </span>
                    <span className="admin-dashboard-notification-meta">
                      {notification.resolved_at
                        ? `Resolved ${new Date(notification.resolved_at).toLocaleString("sv-SE")}`
                        : `${notification.priority} | ${notification.read_at
                        ? `Read ${new Date(notification.read_at).toLocaleString("sv-SE")}`
                        : "Unread"}`}
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
                    className="admin-button-secondary admin-dashboard-notification-action"
                  >
                    {notification.read_at ? "Mark unread" : "Mark read"}
                  </button>
                </div>
              ))
            ) : (
              <p className="admin-muted admin-dashboard-notification-empty">No notifications yet.</p>
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

function notificationCustomerName(notification: AdminNotification) {
  const customer = Array.isArray(notification.customers)
    ? notification.customers[0]
    : notification.customers;

  return customer?.name || "";
}

function notificationHref(notification: AdminNotification) {
  if (notification.event_type.startsWith("visitor_contact_")) {
    return "/admin/contact-inquiries";
  }
  if (notification.event_type.includes("email")) {
    return "/admin/email-events";
  }
  if (
    notification.event_type.includes("payment") ||
    notification.event_type.includes("invoice") ||
    notification.event_type.includes("subscription") ||
    notification.event_type.includes("refund")
  ) {
    return notification.customer_id
      ? `/admin/customers/${notification.customer_id}?section=orders`
      : "/admin/orders";
  }
  if (notification.customer_id) {
    return `/admin/customers/${notification.customer_id}`;
  }
  return "/admin";
}

function dateValue(value: string | null) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function formatWaitingTime(value: string | null) {
  if (!value) return "Unknown";
  const elapsedMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return "Today";
  const hours = Math.floor(elapsedMs / (60 * 60 * 1000));
  if (hours < 24) return hours <= 1 ? "1 hour" : `${hours} hours`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day" : `${days} days`;
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
