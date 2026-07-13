"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { showAdminNotification } from "@/lib/admin/notifications";

type OrderRow = {
  id: string;
  order_number: string | null;
  status: string;
  fulfillment_status: string | null;
  inventory_status: string | null;
  stripe_payment_status: string | null;
  screen_quantity: number | null;
  setup_fee_sek: number | null;
  hardware_fee_sek: number | null;
  shipping_fee_sek: number | null;
  monthly_fee_sek: number | null;
  total_amount_sek: number | null;
  tracking_number: string | null;
  tracking_url: string | null;
  quote_notes: string | null;
  quote_items: Array<{
    name?: string;
    resolution?: string;
    quantity?: number;
  }> | null;
  created_at: string;
  updated_at: string | null;
  customers: {
    id: string;
    name: string;
    customer_number: string | null;
    email: string | null;
    city: string | null;
  } | null;
  pricing_plans: {
    name: string;
    resolution: string;
  } | null;
};

type SupabaseSchemaError = {
  code?: string;
  message?: string;
};

const isSchemaMismatch = (error: SupabaseSchemaError | null | undefined) =>
  error?.code === "42703" || error?.code === "PGRST204";

const normalizeOrder = (row: Partial<OrderRow>): OrderRow => ({
  id: row.id || "",
  order_number: row.order_number ?? null,
  status: row.status || "pending",
  fulfillment_status: row.fulfillment_status ?? null,
  inventory_status: row.inventory_status ?? null,
  stripe_payment_status: row.stripe_payment_status ?? null,
  screen_quantity: row.screen_quantity ?? null,
  setup_fee_sek: row.setup_fee_sek ?? null,
  hardware_fee_sek: row.hardware_fee_sek ?? null,
  shipping_fee_sek: row.shipping_fee_sek ?? null,
  monthly_fee_sek: row.monthly_fee_sek ?? null,
  total_amount_sek: row.total_amount_sek ?? null,
  tracking_number: row.tracking_number ?? null,
  tracking_url: row.tracking_url ?? null,
  quote_notes: row.quote_notes ?? null,
  quote_items: row.quote_items ?? null,
  created_at: row.created_at || new Date().toISOString(),
  updated_at: row.updated_at ?? null,
  customers: row.customers
    ? {
        id: row.customers.id,
        name: row.customers.name,
        customer_number: row.customers.customer_number ?? null,
        email: row.customers.email ?? null,
        city: row.customers.city ?? null,
      }
    : null,
  pricing_plans: row.pricing_plans
    ? {
        name: row.pricing_plans.name,
        resolution: row.pricing_plans.resolution,
      }
    : null,
});

const orderStatuses = [
  "quote_prepared",
  "quote_sent",
  "checkout_started",
  "paid",
  "active",
  "payment_failed",
  "disputed",
  "cancelled",
];

const fulfillmentStatuses = [
  "pending",
  "content_collection",
  "content_pending",
  "content_received",
  "preview_approved",
  "layout_started",
  "paid",
  "in_production",
  "ready_to_ship",
  "shipped",
  "completed",
  "active",
  "paused",
  "cancelled",
];

const inventoryStatuses = [
  "not_reserved",
  "ready_to_reserve",
  "reserved",
  "assigned",
  "shipped",
  "returned",
];

type OrderSection = "all" | "pipeline" | "payment" | "shipping" | "cancelled";
type OrderOperationId =
  | "status"
  | "fulfillment_status"
  | "inventory_status"
  | "tracking";

type OrderOperationDraft = {
  orderId: string;
  operation: OrderOperationId;
  status: string;
  fulfillment_status: string;
  inventory_status: string;
  tracking_number: string;
  tracking_url: string;
  reason: string;
  confirmed: boolean;
};

const orderSections: Array<{ id: OrderSection; label: string; description: string }> = [
  { id: "all", label: "All orders", description: "Everything in one list" },
  { id: "pipeline", label: "Pipeline", description: "Quote, content, and production" },
  { id: "payment", label: "Payment", description: "Checkout and failed payments" },
  { id: "shipping", label: "Shipping", description: "Ready to ship, shipped, and tracking" },
  { id: "cancelled", label: "Cancelled", description: "Cancelled orders" },
];

const orderOperations: Array<{
  id: OrderOperationId;
  label: string;
  description: string;
  tone?: "warning" | "danger" | "success";
}> = [
  {
    id: "status",
    label: "Order status",
    description: "Move the commercial order state after payment or customer events.",
  },
  {
    id: "fulfillment_status",
    label: "Fulfillment",
    description: "Track production, shipping readiness, completion, or cancellation.",
    tone: "success",
  },
  {
    id: "inventory_status",
    label: "Inventory",
    description: "Reserve, assign, ship, or return the physical screen hardware.",
    tone: "warning",
  },
  {
    id: "tracking",
    label: "Shipment tracking",
    description: "Save carrier tracking details and mark the order shipped when appropriate.",
  },
];

export default function AdminOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-card p-6">
          <p className="admin-muted">Loading orders...</p>
        </div>
      }
    >
      <AdminOrdersContent />
    </Suspense>
  );
}

function AdminOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [savingId, setSavingId] = useState("");
  const [activeSection, setActiveSection] = useState<OrderSection>("all");
  const [operationDraft, setOperationDraft] =
    useState<OrderOperationDraft | null>(null);
  const [trackingDrafts, setTrackingDrafts] = useState<
    Record<string, { tracking_number: string; tracking_url: string }>
  >({});

  const loadOrders = async () => {
    setLoading(true);

    const orderSelects = [`
        id,
        order_number,
        status,
        fulfillment_status,
        inventory_status,
        stripe_payment_status,
        screen_quantity,
        setup_fee_sek,
        hardware_fee_sek,
        shipping_fee_sek,
        monthly_fee_sek,
        total_amount_sek,
        tracking_number,
        tracking_url,
        quote_notes,
        quote_items,
        created_at,
        updated_at,
        customers(id, name, customer_number, email, city),
        pricing_plans(name, resolution)
      `,
      `
        id,
        order_number,
        status,
        fulfillment_status,
        inventory_status,
        stripe_payment_status,
        screen_quantity,
        setup_fee_sek,
        hardware_fee_sek,
        shipping_fee_sek,
        monthly_fee_sek,
        total_amount_sek,
        quote_notes,
        created_at,
        updated_at,
        customers(id, name, email, city),
        pricing_plans(name, resolution)
      `,
      `
        id,
        status,
        setup_fee_sek,
        monthly_fee_sek,
        stripe_checkout_session_id,
        stripe_subscription_id,
        created_at,
        customers(id, name, email, city)
      `,
      `
        id,
        status,
        created_at
      `,
    ];

    let data: Partial<OrderRow>[] | null = null;
    let error: SupabaseSchemaError | null = null;

    for (const selectStatement of orderSelects) {
      const result = await supabase
        .from("customer_subscriptions")
        .select(selectStatement)
        .order("created_at", { ascending: false });

      if (!result.error) {
        data = result.data as Partial<OrderRow>[];
        error = null;
        break;
      }

      error = result.error;
      if (!isSchemaMismatch(result.error)) break;
    }

    if (error) {
      console.error("Load orders error:", error);
      showAdminNotification("error", "Could not load orders.");
      setOrders([]);
    } else {
      const nextOrders = (data || []).map(normalizeOrder);
      setOrders(nextOrders);
      setTrackingDrafts(
        Object.fromEntries(
          nextOrders.map((order) => [
            order.id,
            {
              tracking_number: order.tracking_number || "",
              tracking_url: order.tracking_url || "",
            },
          ]),
        ),
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    const section = searchParams.get("section");
    const validSection = orderSections.some((item) => item.id === section)
      ? (section as OrderSection)
      : "all";
    setActiveSection(validSection);
  }, [searchParams]);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === "all" || order.status === statusFilter;
      const matchesSection = matchesOrderSection(order, activeSection);
      const haystack = [
        order.order_number,
        order.customers?.name,
        order.customers?.customer_number,
        order.customers?.email,
        order.customers?.city,
        order.pricing_plans?.name,
        order.pricing_plans?.resolution,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        matchesSection &&
        (!normalizedQuery || haystack.includes(normalizedQuery))
      );
    });
  }, [orders, query, statusFilter, activeSection]);

  const navigateSection = (section: OrderSection) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (section === "all") nextParams.delete("section");
    else nextParams.set("section", section);
    router.push(`/admin/orders${nextParams.toString() ? `?${nextParams.toString()}` : ""}`);
  };

  const openOrderOperation = (
    order: OrderRow,
    operation: OrderOperationId,
  ) => {
    const trackingDraft = trackingDrafts[order.id] || {
      tracking_number: order.tracking_number || "",
      tracking_url: order.tracking_url || "",
    };

    setOperationDraft({
      orderId: order.id,
      operation,
      status: order.status,
      fulfillment_status: order.fulfillment_status || "pending",
      inventory_status: order.inventory_status || "not_reserved",
      tracking_number: trackingDraft.tracking_number,
      tracking_url: trackingDraft.tracking_url,
      reason: "",
      confirmed: false,
    });
  };

  const updateOperationDraft = (
    updates: Partial<Omit<OrderOperationDraft, "orderId">>,
  ) => {
    setOperationDraft((current) =>
      current ? { ...current, ...updates } : current,
    );
  };

  const submitOrderOperation = async () => {
    if (!operationDraft) return;

    const order = orders.find((item) => item.id === operationDraft.orderId);
    if (!order) return;

    const reason = operationDraft.reason.trim();
    if (!reason) {
      showAdminNotification("error", "Add a reason before saving the order update.");
      return;
    }

    if (!operationDraft.confirmed) {
      showAdminNotification("error", "Confirm the order operation before saving.");
      return;
    }

    const payload: {
      status?: string;
      fulfillment_status?: string;
      inventory_status?: string;
      tracking_number?: string | null;
      tracking_url?: string | null;
      reason: string;
    } = { reason };

    if (operationDraft.operation === "status") {
      payload.status = operationDraft.status;
    }

    if (operationDraft.operation === "fulfillment_status") {
      payload.fulfillment_status = operationDraft.fulfillment_status;
    }

    if (operationDraft.operation === "inventory_status") {
      payload.inventory_status = operationDraft.inventory_status;
    }

    if (operationDraft.operation === "tracking") {
      const trackingNumber = operationDraft.tracking_number.trim();
      const trackingUrl = operationDraft.tracking_url.trim();
      const hasTracking = Boolean(trackingNumber || trackingUrl);
      payload.tracking_number = trackingNumber || null;
      payload.tracking_url = trackingUrl || null;

      if (
        hasTracking &&
        !["completed", "cancelled"].includes(order.fulfillment_status || "")
      ) {
        payload.fulfillment_status = "shipped";
      }
    }

    setSavingId(order.id);
    const response = await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not update order.",
      );
    } else {
      setOrders((current) =>
        current.map((order) =>
          order.id === operationDraft.orderId
            ? {
                ...order,
                status: payload.status ?? order.status,
                fulfillment_status:
                  payload.fulfillment_status ?? order.fulfillment_status,
                inventory_status:
                  payload.inventory_status ?? order.inventory_status,
                tracking_number:
                  "tracking_number" in payload
                    ? payload.tracking_number ?? null
                    : order.tracking_number,
                tracking_url:
                  "tracking_url" in payload
                    ? payload.tracking_url ?? null
                    : order.tracking_url,
              }
            : order,
        ),
      );
      if (operationDraft.operation === "tracking") {
        setTrackingDrafts((current) => ({
          ...current,
          [operationDraft.orderId]: {
            tracking_number: operationDraft.tracking_number.trim(),
            tracking_url: operationDraft.tracking_url.trim(),
          },
        }));
      }
      setOperationDraft(null);
      showAdminNotification("success", "Order operation saved.");
    }

    setSavingId("");
  };

  const counts = {
    all: orders.length,
    quote_sent: orders.filter((order) => order.status === "quote_sent").length,
    checkout_started: orders.filter((order) => order.status === "checkout_started").length,
    active: orders.filter((order) => order.status === "active").length,
    payment_failed: orders.filter((order) => order.status === "payment_failed").length,
  };

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-title">Orders</h1>
        <p className="admin-subtitle">
          Follow quote, payment, inventory, shipping, and order updates in one place.
        </p>
        <a
          href="/api/admin/accounting-export"
          className="admin-button-secondary"
        >
          Export accounting CSV
        </a>
        <a
          href="/api/admin/vat-summary?format=csv"
          className="admin-button-secondary"
        >
          Export VAT summary
        </a>
      </div>

      <section className="admin-card p-6">
        <div className="admin-order-toolbar">
          <div className="admin-section-tabs" aria-label="Order sections">
            {orderSections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => navigateSection(section.id)}
                className={`admin-section-tab ${
                  activeSection === section.id ? "is-active" : ""
                }`}
              >
                <span>{section.label}</span>
                <small>{section.description}</small>
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search order number, customer, email, city..."
          />
          <div className="admin-order-filter-row">
            {Object.entries(counts).map(([key, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={statusFilter === key ? "is-active" : ""}
              >
                {key.replace(/_/g, " ")} ({count})
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-card mt-6 p-6">
        {loading ? (
          <p className="admin-muted">Loading orders...</p>
        ) : filteredOrders.length === 0 ? (
          <p className="admin-muted">No orders found.</p>
        ) : (
          <div className="admin-order-list">
            {filteredOrders.map((order) => (
              <article key={order.id} className="admin-order-card">
                <div className="admin-order-card-main">
                  <div>
                    <p className="admin-order-number">{order.order_number}</p>
                    <h2>{order.customers?.name || "Unknown customer"}</h2>
                    <p>
                      Customer {order.customers?.customer_number || "pending"} ·{" "}
                      {order.customers?.email || "No email"} ·{" "}
                      {order.customers?.city || "No city"}
                    </p>
                    <p>
                      {summarizeQuoteItems(order)} · Created{" "}
                      {new Date(order.created_at).toLocaleDateString("sv-SE")}
                    </p>
                  </div>
                  {order.customers?.id && (
                    <Link
                      href={`/admin/customers/${order.customers.id}?section=orders`}
                      className="admin-button-primary"
                    >
                      Open customer
                    </Link>
                  )}
                </div>

                <div className="admin-order-state-grid">
                  <div>
                    <span>Order status</span>
                    <strong>{formatStatusLabel(order.status)}</strong>
                  </div>
                  <div>
                    <span>Fulfillment</span>
                    <strong>
                      {formatStatusLabel(order.fulfillment_status || "pending")}
                    </strong>
                  </div>
                  <div>
                    <span>Inventory</span>
                    <strong>
                      {formatStatusLabel(order.inventory_status || "not_reserved")}
                    </strong>
                  </div>
                  <div>
                    <span>Tracking</span>
                    <strong>
                      {order.tracking_number || order.tracking_url || "Not saved"}
                    </strong>
                  </div>
                </div>

                <div className="admin-order-action-row">
                  {orderOperations.map((operation) => (
                    <button
                      key={operation.id}
                      type="button"
                      disabled={savingId === order.id}
                      onClick={() => openOrderOperation(order, operation.id)}
                      className={`admin-button-secondary ${
                        operationDraft?.orderId === order.id &&
                        operationDraft.operation === operation.id
                          ? "is-active"
                          : ""
                      }`}
                    >
                      {operation.label}
                    </button>
                  ))}
                </div>

                {operationDraft?.orderId === order.id && (
                  <div className="admin-operation-panel admin-order-operation-panel">
                    <div className="admin-operation-grid">
                      <div className="admin-operation-list">
                        {orderOperations.map((operation) => (
                          <button
                            key={operation.id}
                            type="button"
                            className={`admin-operation-card ${
                              operation.tone
                                ? `admin-operation-${operation.tone}`
                                : ""
                            } ${
                              operationDraft.operation === operation.id
                                ? "is-selected"
                                : ""
                            }`}
                            onClick={() => openOrderOperation(order, operation.id)}
                          >
                            <span>
                              <strong>{operation.label}</strong>
                              <small>{operation.description}</small>
                            </span>
                            <em>
                              {operationDraft.operation === operation.id
                                ? "Open"
                                : "Choose"}
                            </em>
                          </button>
                        ))}
                      </div>

                      <div className="admin-operation-flow">
                        <div className="admin-operation-flow-header">
                          <p className="admin-operation-kicker">
                            Order operation flow
                          </p>
                          <h4>
                            {
                              orderOperations.find(
                                (operation) =>
                                  operation.id === operationDraft.operation,
                              )?.label
                            }
                          </h4>
                          <p>
                            Review the current order, choose the new value, add
                            the audit reason, then confirm the change.
                          </p>
                        </div>

                        {operationDraft.operation === "status" && (
                          <div className="admin-operation-fields admin-order-single-field">
                            <label>
                              Order status
                              <select
                                value={operationDraft.status}
                                disabled={savingId === order.id}
                                onChange={(event) =>
                                  updateOperationDraft({
                                    status: event.target.value,
                                    confirmed: false,
                                  })
                                }
                              >
                                {orderStatuses.map((option) => (
                                  <option key={option} value={option}>
                                    {formatStatusLabel(option)}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        )}

                        {operationDraft.operation === "fulfillment_status" && (
                          <div className="admin-operation-fields admin-order-single-field">
                            <label>
                              Fulfillment status
                              <select
                                value={operationDraft.fulfillment_status}
                                disabled={savingId === order.id}
                                onChange={(event) =>
                                  updateOperationDraft({
                                    fulfillment_status: event.target.value,
                                    confirmed: false,
                                  })
                                }
                              >
                                {fulfillmentStatuses.map((option) => (
                                  <option key={option} value={option}>
                                    {formatStatusLabel(option)}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        )}

                        {operationDraft.operation === "inventory_status" && (
                          <div className="admin-operation-fields admin-order-single-field">
                            <label>
                              Inventory status
                              <select
                                value={operationDraft.inventory_status}
                                disabled={savingId === order.id}
                                onChange={(event) =>
                                  updateOperationDraft({
                                    inventory_status: event.target.value,
                                    confirmed: false,
                                  })
                                }
                              >
                                {inventoryStatuses.map((option) => (
                                  <option key={option} value={option}>
                                    {formatStatusLabel(option)}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        )}

                        {operationDraft.operation === "tracking" && (
                          <div className="admin-operation-fields">
                            <label>
                              Tracking number
                              <input
                                value={operationDraft.tracking_number}
                                disabled={savingId === order.id}
                                onChange={(event) =>
                                  updateOperationDraft({
                                    tracking_number: event.target.value,
                                    confirmed: false,
                                  })
                                }
                                placeholder="Carrier tracking number"
                              />
                            </label>
                            <label>
                              Tracking URL
                              <input
                                value={operationDraft.tracking_url}
                                disabled={savingId === order.id}
                                onChange={(event) =>
                                  updateOperationDraft({
                                    tracking_url: event.target.value,
                                    confirmed: false,
                                  })
                                }
                                placeholder="https://..."
                              />
                            </label>
                          </div>
                        )}

                        <label className="admin-operation-reason">
                          Reason for audit log
                          <textarea
                            value={operationDraft.reason}
                            disabled={savingId === order.id}
                            onChange={(event) =>
                              updateOperationDraft({
                                reason: event.target.value,
                                confirmed: false,
                              })
                            }
                            placeholder="Example: Customer confirmed delivery address and screen is ready to ship."
                          />
                        </label>

                        <label className="admin-operation-confirm">
                          <input
                            type="checkbox"
                            checked={operationDraft.confirmed}
                            disabled={savingId === order.id}
                            onChange={(event) =>
                              updateOperationDraft({
                                confirmed: event.target.checked,
                              })
                            }
                          />
                          <span>
                            I checked this order and want to save this audited
                            operation.
                          </span>
                        </label>

                        <div className="admin-operation-actions">
                          <button
                            type="button"
                            className="admin-button-primary"
                            disabled={savingId === order.id}
                            onClick={submitOrderOperation}
                          >
                            {savingId === order.id ? "Saving..." : "Save operation"}
                          </button>
                          <button
                            type="button"
                            className="admin-button-secondary"
                            disabled={savingId === order.id}
                            onClick={() => setOperationDraft(null)}
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="admin-order-money">
                  <span>Setup {formatSek(order.setup_fee_sek)}</span>
                  <span>Device {formatSek(order.hardware_fee_sek)}</span>
                  <span>Shipping {formatSek(order.shipping_fee_sek)}</span>
                  <span>Monthly {formatSek(order.monthly_fee_sek)}</span>
                  <strong>Total {formatStripeSek(order.total_amount_sek)}</strong>
                </div>

                {order.quote_notes && (
                  <p className="admin-order-note">{order.quote_notes}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function summarizeQuoteItems(order: OrderRow) {
  if (Array.isArray(order.quote_items) && order.quote_items.length > 0) {
    return order.quote_items
      .map((item) =>
        `${item.quantity || 1} x ${item.name || order.pricing_plans?.name || "Plan"} ${
          item.resolution || order.pricing_plans?.resolution || ""
        }`.trim(),
      )
      .join(", ");
  }

  return `${order.screen_quantity || 1} x ${order.pricing_plans?.name || "Plan"} ${
    order.pricing_plans?.resolution || ""
  }`.trim();
}

function matchesOrderSection(order: OrderRow, section: OrderSection) {
  if (section === "all") return true;
  if (section === "cancelled") {
    return order.status === "cancelled" || order.fulfillment_status === "cancelled";
  }
  if (section === "payment") {
    return ["checkout_started", "payment_failed"].includes(order.status);
  }
  if (section === "shipping") {
    return (
      ["ready_to_ship", "shipped", "completed"].includes(
        order.fulfillment_status || "",
      ) ||
      ["assigned", "shipped"].includes(order.inventory_status || "") ||
      Boolean(order.tracking_number || order.tracking_url)
    );
  }
  return (
    ["quote_prepared", "quote_sent", "paid", "active"].includes(order.status) ||
    ["content_collection", "content_pending", "content_received", "preview_approved", "in_production"].includes(
      order.fulfillment_status || "",
    )
  );
}

function formatSek(amount: number | null) {
  if (amount === null) return "pending";
  return `${amount.toLocaleString("sv-SE")} kr`;
}

function formatStripeSek(amount: number | null) {
  if (amount === null) return "pending";
  const hasOre = amount % 100 !== 0;
  return `${(amount / 100).toLocaleString("sv-SE", {
    minimumFractionDigits: hasOre ? 2 : 0,
    maximumFractionDigits: 2,
  })} kr`;
}

function formatStatusLabel(value: string) {
  return value.replace(/_/g, " ");
}
