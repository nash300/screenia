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
  { value: "content_pending", label: "Material pending" },
  { value: "content_received", label: "Material received" },
  { value: "needs_device", label: "Ready for device allocation" },
  { value: "needs_playlist", label: "Needs playlist content" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "billing_issue", label: "Billing issues" },
  { value: "closed", label: "Cancelled or refunded" },
];

const PAGE_SIZE = 25;

const onboardingFilters = [
  { value: "new_request", label: "New requests", hint: "review inquiry" },
  { value: "draft", label: "Quote drafts", hint: "prepare offer" },
  { value: "invited", label: "Setup links sent", hint: "waiting details/payment" },
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
        <div className="admin-card admin-customers-loading-panel">
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
  const [sortBy, setSortBy] = useState("updated_desc");
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

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

    setSaving(true);
    const response = await fetch("/api/admin/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
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
    if (filter === "setup_pending") {
      return ["invited", "accepted_terms", "completed_profile"].includes(
        customer.status || "",
      );
    }
    if (filter === "material_pending") {
      return ["paid", "content_pending"].includes(customer.status || "");
    }
    if (filter === "needs_device") {
      return ["content_received", "active"].includes(customer.status || "") && deviceCount === 0;
    }
    if (filter === "needs_playlist") {
      return (
        ["content_received", "active"].includes(customer.status || "") &&
        hasDeviceWithoutPlaylist(customer)
      );
    }
    if (filter === "billing_issue") {
      return ["failed", "disputed"].includes(customer.payment_status || "");
    }
    if (filter === "closed") {
      return ["cancelled", "refunded"].includes(customer.status || "");
    }
    return customer.status === filter;
  };

  const getFilterCount = (filter: string) =>
    customers.filter((customer) => matchesCustomerFilter(customer, filter)).length;

  const getStatusClass = (status: string | null) => {
    if (status === "active") return "admin-customer-status-active";
    if (status === "new_request") return "admin-customer-status-new-request";
    if (status === "invited") return "admin-customer-status-invited";
    if (status === "paid") return "admin-customer-status-paid";
    if (status === "content_pending") return "admin-customer-status-content-pending";
    if (status === "content_received") return "admin-customer-status-content-received";
    if (status === "suspended") return "admin-customer-status-suspended";
    return "admin-customer-status-default";
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("sv-SE");
  };

  const formatStatusLabel = (value: string | null | undefined) => {
    if (!value) return "-";
    return value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
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

  const filteredCustomers = customers
    .filter((customer) => {
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
    })
    .sort((left, right) => {
      if (sortBy === "created_desc") {
        return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
      }
      if (sortBy === "name_asc") return left.name.localeCompare(right.name, "sv");
      if (sortBy === "status_asc") {
        return (left.status || "").localeCompare(right.status || "", "sv");
      }
      return new Date(right.updated_at || 0).getTime() - new Date(left.updated_at || 0).getTime();
    });
  const pageCount = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE));
  const visiblePage = Math.min(page, pageCount);
  const paginatedCustomers = filteredCustomers.slice(
    (visiblePage - 1) * PAGE_SIZE,
    visiblePage * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [search, sortBy, statusFilter]);

  return (
    <div className="admin-customers-page">
      <div className="admin-page-header">
        <h1 className="admin-title">Customer work</h1>
        <p className="admin-subtitle">
          Find customers, review their current stage, and continue the next task.
        </p>
      </div>

      <section className="admin-card admin-customers-toolbar">
        <div className="admin-customers-toolbar-heading">
          <div>
            <h2 className="admin-card-title admin-customers-panel-title">Find customer work</h2>
            <p className="admin-muted">Search directly or open a common queue.</p>
          </div>
          <span className="admin-customers-total">
            {filteredCustomers.length} shown
          </span>
        </div>

        <div className="admin-customers-search-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, phone, city, or order number"
            aria-label="Search customers"
          />
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              navigateFilter(event.target.value);
            }}
            aria-label="Detailed customer queue"
          >
            <option value="all">All queues</option>
            <optgroup label="Customer intake">
              {onboardingFilters.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label} ({getFilterCount(status.value)})
                </option>
              ))}
            </optgroup>
            <optgroup label="Service delivery">
              <option value="setup_pending">
                Setup pending ({getFilterCount("setup_pending")})
              </option>
              {statusFilters
                .filter((status) => status.value !== "all")
                .map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label} ({getFilterCount(status.value)})
                  </option>
                ))}
            </optgroup>
          </select>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            aria-label="Sort customers"
          >
            <option value="updated_desc">Sort: Recently updated</option>
            <option value="created_desc">Sort: Newest request</option>
            <option value="name_asc">Sort: Company A-Z</option>
            <option value="status_asc">Sort: Customer status</option>
          </select>
        </div>
      </section>

      <details className="admin-card admin-customers-create">
        <summary>Create a manual customer draft</summary>
        <div className="admin-customers-create-body">
          <p className="admin-muted">
            Use this only when a customer contacted Screenia outside the website.
          </p>
          <div className="admin-customers-create-grid">
            <label className="admin-customers-create-field">
              Company name *
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Example: Salon Bella"
                className="admin-customers-create-control"
              />
            </label>
            <label className="admin-customers-create-field">
              Contact email *
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="customer@example.com"
                className="admin-customers-create-control"
              />
            </label>
          </div>
          <button
            onClick={createCustomer}
            disabled={saving}
            className="admin-button-primary admin-customers-create-submit"
          >
            {saving ? "Creating..." : "Create customer draft"}
          </button>
        </div>
      </details>

      <section className="admin-card admin-customers-list-panel">
        <div className="admin-customers-list-heading">
          <h2 className="admin-card-title admin-customers-panel-title">Customer queue</h2>
          <span>{loading ? "Loading" : `${filteredCustomers.length} records`}</span>
        </div>
        <div className="admin-customer-table-wrap">
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
                    <th>Order</th>
                    <th>Payment</th>
                    <th>Device allocation</th>
                    <th>Created</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCustomers.map((customer) => {
                    const deviceCount = getDeviceCount(customer);
                    const subscription = latestSubscription(customer);
                    const needsSetup =
                      customer.status === "active" && deviceCount === 0
                        ? "Ready for device allocation"
                        : customer.status === "active" && hasDeviceWithoutPlaylist(customer)
                          ? "Needs playlist content"
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
                          <span>{customer.phone || "No phone"}{customer.city ? ` - ${customer.city}` : ""}</span>
                        </td>
                        <td>
                          <span className={`admin-table-pill ${getStatusClass(customer.status)}`}>
                            {formatStatusLabel(customer.status || "draft")}
                          </span>
                          {needsSetup && <small>{needsSetup}</small>}
                        </td>
                        <td>
                          <strong>{subscription?.order_number || "-"}</strong>
                          <span>{formatStatusLabel(subscription?.status || "No order")}</span>
                          <small>{formatDate(subscription?.created_at)}</small>
                        </td>
                        <td>
                          <strong>{formatStripeSek(subscription?.total_amount_sek)}</strong>
                          <span>
                            {formatStatusLabel(
                              subscription?.stripe_payment_status ||
                                customer.payment_status ||
                                "-",
                            )}
                          </span>
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
        {!loading && filteredCustomers.length > PAGE_SIZE && (
          <nav className="admin-queue-pagination" aria-label="Customer queue pages">
            <span>
              Page {visiblePage} of {pageCount} - {filteredCustomers.length} records
            </span>
            <div>
              <button
                type="button"
                className="admin-button-secondary admin-queue-pagination-button"
                disabled={visiblePage === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="admin-button-secondary admin-queue-pagination-button"
                disabled={visiblePage === pageCount}
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              >
                Next
              </button>
            </div>
          </nav>
        )}
      </section>
    </div>
  );
}
