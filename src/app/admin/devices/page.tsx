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
      <div className="admin-page-header flex flex-col justify-between gap-4 md:flex-row md:items-end">
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
      <div className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Display endpoints</h2>
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-950">Displays are live customer endpoints.</p>
          <p className="admin-muted mt-1">
            Use this page for display URLs, activation, location, preview, and
            playlist content. Use{" "}
            <Link href="/admin/inventory" className="font-semibold text-[rgb(8,184,238)] no-underline">
              Hardware stock
            </Link>{" "}
            for serial numbers, purchase records, warranty, repairs, returns,
            and retired boxes.
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by display name, code, customer, or location..."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-cyan)] focus:ring-2 focus:ring-cyan-100 md:max-w-md"
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

        <div className="admin-scroll-region mt-4 space-y-3">
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
                  className="block rounded-2xl border border-slate-200 bg-white/70 p-4 no-underline transition hover:bg-white hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-950">
                        {device.name || "Unnamed display"}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Code: {device.device_code}
                      </p>

                      <p className="text-sm text-slate-500">
                        Customer: {device.customers?.name || "Not assigned"}
                      </p>

                      <p className="text-sm text-slate-500">
                        Location: {device.location || "Not set"}
                      </p>

                      {playlistCount === 0 && (
                        <p className="mt-2 text-sm font-semibold text-red-600">
                          Needs playlist
                        </p>
                      )}
                    </div>

                    <div className="text-right text-sm text-slate-500">
                      <p>Videos: {playlistCount}</p>

                      <span
                        className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          device.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
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
