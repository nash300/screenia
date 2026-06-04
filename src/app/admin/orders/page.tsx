"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { showAdminNotification } from "@/lib/admin/notifications";

type OrderRow = {
  id: string;
  order_number: string;
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

const orderStatuses = [
  "quote_prepared",
  "quote_sent",
  "checkout_started",
  "active",
  "payment_failed",
  "cancelled",
];

const fulfillmentStatuses = [
  "pending",
  "paid",
  "in_production",
  "ready_to_ship",
  "shipped",
  "completed",
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

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [savingId, setSavingId] = useState("");

  const loadOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("customer_subscriptions")
      .select(
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
        quote_items,
        created_at,
        updated_at,
        customers(id, name, customer_number, email, city),
        pricing_plans(name, resolution)
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Load orders error:", error);
      showAdminNotification("error", "Could not load orders.");
      setOrders([]);
    } else {
      setOrders((data || []) as unknown as OrderRow[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === "all" || order.status === statusFilter;
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

      return matchesStatus && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [orders, query, statusFilter]);

  const updateOrder = async (
    orderId: string,
    field: "status" | "fulfillment_status" | "inventory_status",
    value: string,
  ) => {
    setSavingId(orderId);
    const { error } = await supabase
      .from("customer_subscriptions")
      .update({ [field]: value })
      .eq("id", orderId);

    if (error) {
      console.error("Update order error:", error);
      showAdminNotification("error", "Could not update order.");
    } else {
      setOrders((current) =>
        current.map((order) =>
          order.id === orderId ? { ...order, [field]: value } : order,
        ),
      );
      showAdminNotification("success", "Order updated.");
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
      </div>

      <section className="admin-card p-6">
        <div className="admin-order-toolbar">
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

                <div className="admin-order-grid">
                  <OrderSelect
                    label="Order status"
                    value={order.status}
                    options={orderStatuses}
                    disabled={savingId === order.id}
                    onChange={(value) => updateOrder(order.id, "status", value)}
                  />
                  <OrderSelect
                    label="Fulfillment"
                    value={order.fulfillment_status || "pending"}
                    options={fulfillmentStatuses}
                    disabled={savingId === order.id}
                    onChange={(value) =>
                      updateOrder(order.id, "fulfillment_status", value)
                    }
                  />
                  <OrderSelect
                    label="Inventory"
                    value={order.inventory_status || "not_reserved"}
                    options={inventoryStatuses}
                    disabled={savingId === order.id}
                    onChange={(value) =>
                      updateOrder(order.id, "inventory_status", value)
                    }
                  />
                </div>

                <div className="admin-order-money">
                  <span>Setup {formatSek(order.setup_fee_sek)}</span>
                  <span>Device {formatSek(order.hardware_fee_sek)}</span>
                  <span>Shipping {formatSek(order.shipping_fee_sek)}</span>
                  <span>Monthly {formatSek(order.monthly_fee_sek)}</span>
                  <strong>Total {formatSek(order.total_amount_sek)}</strong>
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

function OrderSelect({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </label>
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

function formatSek(amount: number | null) {
  if (amount === null) return "pending";
  return `${amount.toLocaleString("sv-SE")} kr`;
}
