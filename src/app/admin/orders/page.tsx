"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { showAdminNotification } from "@/lib/admin/notifications";
import {
  formatSek,
  formatStatusLabel,
  formatStripeSek,
  deviceAllocationStatuses,
  fulfillmentStatuses,
  isSchemaMismatch,
  matchesOrderSection,
  normalizeOrder,
  orderOperations,
  orderSections,
  orderStatuses,
  summarizeQuoteItems,
} from "./order-workflow";
import type {
  OrderOperationDraft,
  OrderOperationId,
  OrderRow,
  OrderSection,
  SupabaseSchemaError,
} from "./types";

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
      hardware_status: order.hardware_status || "not_reserved",
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

    if (operationDraft.operation === "hardware_status") {
      payload.inventory_status = operationDraft.hardware_status;
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
                hardware_status:
                  payload.inventory_status ?? order.hardware_status,
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
    refunded: orders.filter((order) => order.status === "refunded").length,
  };
  const sectionCounts = Object.fromEntries(
    orderSections.map((section) => [
      section.id,
      orders.filter((order) => matchesOrderSection(order, section.id)).length,
    ]),
  ) as Record<OrderSection, number>;

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-title">Orders & billing</h1>
        <p className="admin-subtitle">
          Follow quote, Stripe payment, material review, layout production,
          device allocation, shipping, refunds, and order evidence in one place.
        </p>
        <a
          href="/api/admin/accounting-export"
          className="admin-button-secondary"
        >
          Export accounting CSV
        </a>
      </div>

      <section className="admin-card p-6">
        <div className="admin-order-toolbar">
          <div className="admin-order-workflow" aria-label="Order workflow">
            {orderSections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => navigateSection(section.id)}
                className={`admin-order-workflow-step ${
                  activeSection === section.id ? "is-active" : ""
                }`}
              >
                <span>{section.stage}</span>
                <strong>
                  {section.label}
                  <em>{sectionCounts[section.id]}</em>
                </strong>
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
                {formatStatusLabel(key)} ({count})
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
                      Customer {order.customers?.customer_number || "pending"} -{" "}
                      {order.customers?.email || "No email"} -{" "}
                      {order.customers?.city || "No city"}
                    </p>
                    <p>
                      {summarizeQuoteItems(order)} - Created{" "}
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
                    <span>Material / production</span>
                    <strong>
                      {formatStatusLabel(order.fulfillment_status || "pending")}
                    </strong>
                  </div>
                  <div>
                    <span>Device allocation</span>
                    <strong>
                      {formatStatusLabel(order.hardware_status || "not_reserved")}
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
                    <div className="admin-order-selected-operation">
                      <div className="admin-operation-flow">
                        <div className="admin-operation-flow-header">
                          <p className="admin-operation-kicker">
                            Selected order action
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
                            {
                              orderOperations.find(
                                (operation) =>
                                  operation.id === operationDraft.operation,
                              )?.description
                            }{" "}
                            Add the audit reason, then confirm the change.
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
                              Material / production status
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

                        {operationDraft.operation === "hardware_status" && (
                          <div className="admin-operation-fields admin-order-single-field">
                            <label>
                              Device allocation status
                              <select
                                value={operationDraft.hardware_status}
                                disabled={savingId === order.id}
                                onChange={(event) =>
                                  updateOperationDraft({
                                    hardware_status: event.target.value,
                                    confirmed: false,
                                  })
                                }
                              >
                                {deviceAllocationStatuses.map((option) => (
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

