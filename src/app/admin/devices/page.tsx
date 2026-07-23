"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { displayFilters } from "./display-workflow";
import type { DisplayListItem } from "./types";

export default function DevicesPage() {
  const [devices, setDevices] = useState<DisplayListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("customer_asc");

  const loadDevices = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("devices")
      .select(
        `
        id,
        name,
        device_code,
        location,
        is_active,
        customers(name, status),
        playlists(count)
        `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Load devices error:", error);
      setDevices([]);
    } else {
      setDevices((data || []) as unknown as DisplayListItem[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const filteredDevices = useMemo(() => devices.filter((device) => {
      const value = search.toLowerCase();
      const playlistCount = device.playlists?.[0]?.count || 0;

    const matchesSearch =
      device.name?.toLowerCase().includes(value) ||
      device.device_code.toLowerCase().includes(value) ||
      device.location?.toLowerCase().includes(value) ||
      device.customers?.name?.toLowerCase().includes(value);

    const matchesFilter =
      filter === "all" ||
      (filter === "active" && device.is_active) ||
      (filter === "inactive" && !device.is_active) ||
      (filter === "needs_playlist" && playlistCount === 0);

      return matchesSearch && matchesFilter;
    }).sort((left, right) => {
      if (sortBy === "code_asc") return left.device_code.localeCompare(right.device_code, "sv");
      if (sortBy === "name_asc") return (left.name || "").localeCompare(right.name || "", "sv");
      if (sortBy === "status") return Number(right.is_active) - Number(left.is_active);
      return (left.customers?.name || "").localeCompare(right.customers?.name || "", "sv");
    }), [devices, filter, search, sortBy]);

  return (
    <div>
      {/* Page Header */}
      <div className="admin-page-header admin-devices-page-header">
        <div>
          <h1 className="admin-title">Displays</h1>
          <p className="admin-subtitle">
            Manage customer display endpoints, installation locations, and playlist readiness.
          </p>
        </div>

        <Link href="/admin/devices/new" className="admin-button-primary">
          Create display endpoint
        </Link>
      </div>

      {/* Display List */}
      <div className="admin-card admin-devices-list-panel">
        <h2 className="admin-card-title">Display endpoints</h2>
        <div className="admin-devices-info-panel">
          <p className="admin-devices-info-title">Displays are live customer endpoints.</p>
          <p className="admin-devices-info-copy">
            Use this page for display URLs, activation, location, preview, and
            playlist content. Use{" "}
            <Link href="/admin/inventory" className="admin-devices-info-link">
              Hardware stock
            </Link>{" "}
            for serial numbers, purchase records, warranty, repairs, returns,
            and retired boxes.
          </p>
        </div>

        <div className="admin-devices-toolbar">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by display name, code, customer, or location..."
            className="admin-devices-search-input"
          />

          <div className="admin-list-selects">
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              aria-label="Filter displays"
            >
              {displayFilters.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              aria-label="Sort displays"
            >
              <option value="customer_asc">Sort: Customer A-Z</option>
              <option value="name_asc">Sort: Display name</option>
              <option value="code_asc">Sort: Display code</option>
              <option value="status">Sort: Active first</option>
            </select>
          </div>
        </div>

        <div className="admin-scroll-region admin-devices-results">
          {loading ? (
            <p className="admin-muted">Loading...</p>
          ) : filteredDevices.length === 0 ? (
            <p className="admin-muted">No displays found.</p>
          ) : (
            filteredDevices.map((device) => {
              const playlistCount = device.playlists?.[0]?.count || 0;

              return (
                <Link
                  key={device.id}
                  href={`/admin/devices/${device.device_code}`}
                  className="admin-device-list-card"
                >
                  <div className="admin-device-list-card-inner">
                    <div>
                      <p className="admin-device-list-title">
                        {device.name || "Unnamed display"}
                      </p>

                      <p className="admin-device-list-meta admin-device-list-meta-spaced">
                        Code: {device.device_code}
                      </p>

                      <p className="admin-device-list-meta">
                        Customer: {device.customers?.name || "Not assigned"}
                      </p>

                      <p className="admin-device-list-meta">
                        Location: {device.location || "Not set"}
                      </p>

                      {playlistCount === 0 && (
                        <p className="admin-device-list-warning">
                          Needs playlist
                        </p>
                      )}
                    </div>

                    <div className="admin-device-list-status">
                      <p>Videos: {playlistCount}</p>

                      <span
                        className={`admin-device-list-pill ${
                          device.is_active
                            ? "admin-device-list-pill-active"
                            : "admin-device-list-pill-inactive"
                        }`}
                      >
                        {device.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
