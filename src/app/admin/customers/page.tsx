"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { showAdminNotification } from "@/lib/admin/notifications";

type Customer = {
  id: string;
  customer_number: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  payment_status: string | null;
  city: string | null;
  created_at: string | null;
  updated_at: string | null;
  activated_at: string | null;
  cancelled_at: string | null;
  devices: {
    id: string;
    playlists: { count: number }[];
  }[];
  customer_subscriptions?: {
    id: string;
    order_number: string | null;
    status: string | null;
    total_amount_sek: number | null;
    monthly_fee_sek: number | null;
    stripe_payment_status: string | null;
    created_at: string | null;
    updated_at: string | null;
  }[];
};

const statusFilters = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "content_pending", label: "Content pending" },
  { value: "content_received", label: "Content received" },
  { value: "needs_device", label: "Needs device" },
  { value: "needs_playlist", label: "Needs playlist" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

const onboardingFilters = [
  { value: "new_request", label: "Requests", hint: "needs review" },
  { value: "draft", label: "Draft", hint: "needs quote" },
  { value: "invited", label: "Invited", hint: "waiting details/payment" },
];

const isSchemaMismatch = (
  error: { code?: string; message?: string; details?: string } | null | undefined,
) =>
  error?.code === "42703" ||
  error?.code === "PGRST200" ||
  error?.code === "PGRST204" ||
  /column|relationship|schema cache/i.test(
    `${error?.message || ""} ${error?.details || ""}`,
  );

export default function CustomersPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-card p-6">
          <p className="admin-muted">Loading customers...</p>
        </div>
      }
    >
      <CustomersContent />
    </Suspense>
  );
}

function CustomersContent() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("filter") || "all",
  );
  const [hasSelectedFilter, setHasSelectedFilter] = useState(
    true,
  );
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [createReason, setCreateReason] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCustomers = async () => {
    setLoading(true);

    const fullSelect = `
        id,
        customer_number,
        name,
        email,
        phone,
        status,
        payment_status,
        city,
        created_at,
        updated_at,
        activated_at,
        cancelled_at,
        devices(id, playlists(count)),
        customer_subscriptions(
          id,
          order_number,
          status,
          total_amount_sek,
          monthly_fee_sek,
          stripe_payment_status,
          created_at,
          updated_at
        )
      `;
    const noCustomerNumberSelect = `
        id,
        name,
        email,
        phone,
        status,
        payment_status,
        city,
        created_at,
        updated_at,
        activated_at,
        cancelled_at,
        devices(id, playlists(count)),
        customer_subscriptions(
          id,
          order_number,
          status,
          total_amount_sek,
          monthly_fee_sek,
          stripe_payment_status,
          created_at,
          updated_at
        )
      `;
    const minimalSelect = `
        id,
        name,
        email,
        phone,
        status,
        payment_status,
        city,
        created_at,
        updated_at,
        activated_at,
        cancelled_at,
        devices(id, playlists(count))
      `;
    const noRelationsSelect = `
        id,
        customer_number,
        name,
        email,
        phone,
        status,
        payment_status,
        city,
        created_at,
        updated_at,
        activated_at,
        cancelled_at
      `;
    const coreSelect = `
        id,
        name,
        email,
        phone,
        status,
        created_at
      `;

    let data: Partial<Customer>[] | null = null;
    let error: { code?: string; message?: string; details?: string } | null = null;
    for (const selectStatement of [
      fullSelect,
      noCustomerNumberSelect,
      minimalSelect,
      noRelationsSelect,
      coreSelect,
    ]) {
      const result = await supabase
        .from("customers")
        .select(selectStatement)
        .order("created_at", { ascending: false });
      if (!result.error) {
        data = result.data as Partial<Customer>[];
        error = null;
        break;
      }
      error = result.error;
      if (!isSchemaMismatch(result.error)) break;
    }

    if (error) {
      console.error("Load customers error:", error);
      setCustomers([]);
    } else {
      setCustomers(
        (data || []).map((customer) => ({
          id: customer.id || "",
          customer_number: customer.customer_number ?? null,
          name: customer.name || "Unknown customer",
          email: customer.email ?? null,
          phone: customer.phone ?? null,
          status: customer.status ?? null,
          payment_status: customer.payment_status ?? null,
          city: customer.city ?? null,
          created_at: customer.created_at ?? null,
          updated_at: customer.updated_at ?? null,
          activated_at: customer.activated_at ?? null,
          cancelled_at: customer.cancelled_at ?? null,
          devices: customer.devices || [],
          customer_subscriptions: customer.customer_subscriptions || [],
        })),
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    const filter = searchParams.get("filter");
    setStatusFilter(filter || "all");
    setHasSelectedFilter(true);
  }, [searchParams]);

  useEffect(() => {
    loadCustomers();
  }, []);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const createCustomer = async () => {
    if (!name.trim()) {
      showAdminNotification("warning", "Customer name is required.");
      return;
    }
    if (!email.trim() || !isValidEmail(email)) {
      showAdminNotification("warning", "Enter a valid email address.");
      return;
    }

    const reason = createReason.trim();
    if (!reason) {
      showAdminNotification("warning", "Add a reason before creating this customer draft.");
      return;
    }

    setSaving(true);
    const response = await fetch("/api/admin/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        reason,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not create customer.",
      );
      setSaving(false);
      return;
    }

    setName("");
    setEmail("");
    setCreateReason("");
    showAdminNotification("success", "Customer draft created successfully.");
    await loadCustomers();
    setSaving(false);
    router.push(`/admin/customers/${result.customer.id}?section=onboarding`);
  };

  const getDeviceCount = (customer: Customer) => customer.devices?.length || 0;

  const hasDeviceWithoutPlaylist = (customer: Customer) =>
    customer.devices?.some((device) => (device.playlists?.[0]?.count || 0) === 0);

  const latestSubscription = (customer: Customer) =>
    [...(customer.customer_subscriptions || [])].sort(
      (left, right) =>
        new Date(right.created_at || 0).getTime() -
        new Date(left.created_at || 0).getTime(),
    )[0];

  const matchesCustomerFilter = (customer: Customer, filter: string) => {
    const deviceCount = getDeviceCount(customer);
    if (filter === "all") return true;
    if (filter === "needs_device") {
      return ["content_received", "active"].includes(customer.status || "") && deviceCount === 0;
    }
    if (filter === "needs_playlist") {
      return (
        ["content_received", "active"].includes(customer.status || "") &&
        hasDeviceWithoutPlaylist(customer)
      );
    }
    return customer.status === filter;
  };

  const getFilterCount = (filter: string) =>
    customers.filter((customer) => matchesCustomerFilter(customer, filter)).length;

  const getStatusClass = (status: string | null) => {
    if (status === "active") return "bg-green-100 text-green-700";
    if (status === "new_request") return "bg-amber-100 text-amber-800";
    if (status === "invited") return "bg-blue-100 text-blue-700";
    if (status === "paid") return "bg-cyan-100 text-cyan-800";
    if (status === "content_pending") return "bg-orange-100 text-orange-800";
    if (status === "content_received") return "bg-purple-100 text-purple-800";
    if (status === "suspended") return "bg-red-100 text-red-700";
    return "bg-slate-100 text-slate-700";
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("sv-SE");
  };

  const formatStripeSek = (value: number | null | undefined) => {
    if (value === null || typeof value === "undefined") return "-";
    const hasOre = value % 100 !== 0;
    return `${(value / 100).toLocaleString("sv-SE", {
      minimumFractionDigits: hasOre ? 2 : 0,
      maximumFractionDigits: 2,
    })} kr`;
  };

  const navigateFilter = (filter: string) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (filter === "all") nextParams.delete("filter");
    else nextParams.set("filter", filter);
    router.push(`/admin/customers${nextParams.toString() ? `?${nextParams.toString()}` : ""}`);
  };

  const filteredCustomers = customers.filter((customer) => {
    const value = search.trim().toLowerCase();
    const subscription = latestSubscription(customer);
    return (
      matchesCustomerFilter(customer, statusFilter) &&
      (!value ||
        customer.name.toLowerCase().includes(value) ||
        customer.customer_number?.toLowerCase().includes(value) ||
        customer.email?.toLowerCase().includes(value) ||
        customer.phone?.toLowerCase().includes(value) ||
        customer.city?.toLowerCase().includes(value) ||
        subscription?.order_number?.toLowerCase().includes(value))
    );
  });

  return (
    <div className="admin-customers-page">
      <div className="admin-page-header">
        <h1 className="admin-title">Customer work</h1>
        <p className="admin-subtitle">
          Manage requests, onboarding, account setup, communication, and the
          full customer profile.
        </p>
      </div>

      <div className="admin-customers-controls">
        <section className="admin-card admin-customers-create p-6">
          <h2 className="admin-card-title text-xl">Create customer draft</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Company name *
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Example: Salon Bella"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Contact email *
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="customer@example.com"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none"
              />
            </label>
          </div>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Reason for manually creating this customer draft *
            <textarea
              value={createReason}
              onChange={(event) => setCreateReason(event.target.value)}
              placeholder="Example: Customer called and asked for a manual quote draft."
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none"
            />
          </label>
          <button
            onClick={createCustomer}
            disabled={saving || !createReason.trim()}
            className="admin-button-primary mt-4 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create customer draft"}
          </button>
        </section>

        <section className="admin-card admin-customers-search p-6">
          <h2 className="admin-card-title text-xl">Search customers</h2>
          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-800">
              Onboarding queue
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {onboardingFilters.map((status) => {
                const count = getFilterCount(status.value);
                const isActive = hasSelectedFilter && statusFilter === status.value;
                return (
                  <button
                    key={status.value}
                    onClick={() => {
                      setStatusFilter(status.value);
                      setHasSelectedFilter(true);
                      navigateFilter(status.value);
                    }}
                    className={isActive ? "is-active" : ""}
                  >
                    <span>{status.label} ({count})</span>
                    <small>{status.hint}</small>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Operations
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {statusFilters.map((status) => {
                const count = getFilterCount(status.value);
                const isActive = hasSelectedFilter && statusFilter === status.value;
                return (
                  <button
                    key={status.value}
                    onClick={() => {
                      setStatusFilter(status.value);
                      setHasSelectedFilter(true);
                      navigateFilter(status.value);
                    }}
                    className={isActive ? "is-active" : ""}
                  >
                    {status.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setHasSelectedFilter(event.target.value.trim().length > 0);
            }}
            placeholder="Search by name, email, phone, city, or order number..."
            className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none"
          />
        </section>
      </div>

      <section
        className={`admin-card admin-customers-list-panel p-6 ${
          hasSelectedFilter ? "" : "admin-customers-list-panel-empty"
        }`}
      >
        <h2 className="admin-card-title text-xl">Customer list</h2>
        {hasSelectedFilter ? (
          <div className="admin-customer-table-wrap mt-4">
            {loading ? (
              <p className="admin-muted">Loading...</p>
            ) : filteredCustomers.length === 0 ? (
              <p className="admin-muted">No customers found.</p>
            ) : (
              <table className="admin-data-table admin-customer-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>Latest order</th>
                    <th>Billing</th>
                    <th>Displays</th>
                    <th>Created</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => {
                    const deviceCount = getDeviceCount(customer);
                    const subscription = latestSubscription(customer);
                    const needsSetup =
                      customer.status === "active" && deviceCount === 0
                        ? "Needs device"
                        : customer.status === "active" && hasDeviceWithoutPlaylist(customer)
                          ? "Needs playlist"
                          : "";
                    return (
                      <tr key={customer.id}>
                        <td>
                          <Link href={`/admin/customers/${customer.id}`}>
                            <strong>{customer.name}</strong>
                            <span>#{customer.customer_number || "pending"}</span>
                          </Link>
                        </td>
                        <td>
                          <strong>{customer.email || "No email"}</strong>
                          <span>{customer.phone || "No phone"}{customer.city ? ` · ${customer.city}` : ""}</span>
                        </td>
                        <td>
                          <span className={`admin-table-pill ${getStatusClass(customer.status)}`}>
                            {customer.status || "draft"}
                          </span>
                          {needsSetup && <small>{needsSetup}</small>}
                        </td>
                        <td>
                          <strong>{subscription?.order_number || "-"}</strong>
                          <span>{subscription?.status || "No order"}</span>
                          <small>{formatDate(subscription?.created_at)}</small>
                        </td>
                        <td>
                          <strong>{formatStripeSek(subscription?.total_amount_sek)}</strong>
                          <span>{subscription?.stripe_payment_status || customer.payment_status || "-"}</span>
                          <small>{formatDate(subscription?.updated_at)}</small>
                        </td>
                        <td>{deviceCount}</td>
                        <td>{formatDate(customer.created_at)}</td>
                        <td>
                          {formatDate(customer.updated_at)}
                          {customer.activated_at && <small>Active {formatDate(customer.activated_at)}</small>}
                          {customer.cancelled_at && <small>Cancelled {formatDate(customer.cancelled_at)}</small>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="admin-customers-empty-message">
            Select a filter above to load matching customers.
          </div>
        )}
      </section>
    </div>
  );
}
