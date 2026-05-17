"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export default function AdminHomePage() {
  const [customerCount, setCustomerCount] = useState(0);
  const [deviceCount, setDeviceCount] = useState(0);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const needsDeviceCount = customers.filter((customer) => {
    const deviceCount = customer.devices?.length || 0;
    return customer.status === "active" && deviceCount === 0;
  }).length;

  const needsPlaylistCount = customers.filter((customer) => {
    return (
      customer.status === "active" &&
      customer.devices?.some(
        (device: any) => (device.playlists?.[0]?.count || 0) === 0,
      )
    );
  }).length;

  const activeCustomerCount = customers.filter(
    (customer) => customer.status === "active",
  ).length;
  const invitedCustomerCount = customers.filter(
    (customer) => customer.status === "invited",
  ).length;
  const suspendedCustomerCount = customers.filter(
    (customer) => customer.status === "suspended",
  ).length;
  const draftCustomerCount = customers.filter(
    (customer) => !customer.status || customer.status === "draft",
  ).length;

  const readyCustomerCount = customers.filter((customer) => {
    const deviceCount = customer.devices?.length || 0;
    const hasDeviceWithoutPlaylist = customer.devices?.some(
      (device: any) => (device.playlists?.[0]?.count || 0) === 0,
    );

    return (
      customer.status === "active" &&
      deviceCount > 0 &&
      !hasDeviceWithoutPlaylist
    );
  }).length;

  const attentionCount = needsDeviceCount + needsPlaylistCount;
  const setupCompletion =
    activeCustomerCount === 0
      ? 0
      : Math.round((readyCustomerCount / activeCustomerCount) * 100);

  const loadStats = async () => {
    setLoading(true);

    const { count: customers } = await supabase
      .from("customers")
      .select("*", { count: "exact", head: true });

    const { count: devices } = await supabase
      .from("devices")
      .select("*", { count: "exact", head: true });

    const { data } = await supabase.from("customers").select(`
      id,
      status,
      devices(
        id,
        playlists(count)
      )
    `);

    setCustomerCount(customers || 0);
    setDeviceCount(devices || 0);
    setCustomers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="admin-dashboard-page">
      <div className="admin-page-header admin-dashboard-header">
        <div>
          <h1 className="admin-title">Dashboard</h1>
          <p className="admin-subtitle">
            Operational overview of customers, devices, and setup status.
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

      <div className="admin-dashboard-kpis">
        <StatCard
          label="Total customers"
          value={customerCount}
          loading={loading}
          tone="neutral"
          meta={`${activeCustomerCount} active`}
        />

        <StatCard
          label="Total devices"
          value={deviceCount}
          loading={loading}
          tone="neutral"
          meta="Registered screens"
        />

        <StatCard
          label="Need attention"
          value={attentionCount}
          loading={loading}
          tone={attentionCount > 0 ? "warning" : "success"}
          meta="Open setup tasks"
          href="/admin/customers?filter=needs_device"
        />

        <StatCard
          label="Setup complete"
          value={`${setupCompletion}%`}
          loading={loading}
          tone="success"
          meta={`${readyCustomerCount} ready customers`}
        />
      </div>

      <div className="admin-dashboard-grid">
        <section className="admin-card admin-dashboard-panel p-6">
          <h2 className="admin-card-title text-xl">Customer status</h2>

          <div className="admin-status-list">
            <StatusRow label="Active" value={activeCustomerCount} tone="success" />
            <StatusRow label="Invited" value={invitedCustomerCount} tone="info" />
            <StatusRow label="Draft" value={draftCustomerCount} tone="neutral" />
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
              label="Missing devices"
              value={needsDeviceCount}
              tone="warning"
            />
            <StatusRow
              label="Missing playlists"
              value={needsPlaylistCount}
              tone="danger"
            />
          </div>
        </section>

        <section className="admin-card admin-dashboard-panel admin-dashboard-priorities p-6">
          <h2 className="admin-card-title text-xl">Priority queue</h2>

          <div className="admin-priority-list">
            <PriorityItem
              href="/admin/customers?filter=needs_device"
              title="Create missing devices"
              description="Active customers without an assigned screen."
              count={needsDeviceCount}
              tone="warning"
            />

            <PriorityItem
              href="/admin/customers?filter=needs_playlist"
              title="Upload missing playlists"
              description="Devices that exist but have no playable content."
              count={needsPlaylistCount}
              tone="danger"
            />
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

function PriorityItem({
  href,
  title,
  description,
  count,
  tone,
}: {
  href: string;
  title: string;
  description: string;
  count: number;
  tone: "warning" | "danger";
}) {
  return (
    <Link href={href} className={`admin-priority-item admin-priority-${tone}`}>
      <div>
        <p className="admin-priority-title">{title}</p>
        <p className="admin-priority-description">{description}</p>
      </div>
      <span>{count}</span>
    </Link>
  );
}
