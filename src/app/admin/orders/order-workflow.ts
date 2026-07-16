import type { OrderOperationId, OrderRow, OrderSection } from "./types";

export const orderStatuses = [
  "quote_prepared",
  "quote_sent",
  "checkout_started",
  "paid",
  "active",
  "payment_failed",
  "disputed",
  "cancelled",
];

export const fulfillmentStatuses = [
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

export const hardwareStatuses = [
  "not_reserved",
  "ready_to_reserve",
  "reserved",
  "assigned",
  "shipped",
  "returned",
];

export const orderSections: Array<{
  id: OrderSection;
  label: string;
  description: string;
  stage: string;
}> = [
  {
    id: "all",
    label: "All orders",
    description: "Full commercial record",
    stage: "All",
  },
  {
    id: "pipeline",
    label: "Pipeline",
    description: "Quote, content, and production",
    stage: "1",
  },
  {
    id: "payment",
    label: "Payment",
    description: "Checkout and failed payments",
    stage: "2",
  },
  {
    id: "shipping",
    label: "Shipping",
    description: "Allocated, ready to ship, and tracking",
    stage: "3",
  },
  {
    id: "cancelled",
    label: "Cancelled",
    description: "Cancelled and closed orders",
    stage: "4",
  },
];

export const orderOperations: Array<{
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
    id: "hardware_status",
    label: "Device allocation",
    description: "Reserve or assign the screen for this customer order.",
    tone: "warning",
  },
  {
    id: "tracking",
    label: "Shipment tracking",
    description: "Save carrier tracking details and mark the order shipped when appropriate.",
  },
];

export function summarizeQuoteItems(order: OrderRow) {
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

export function matchesOrderSection(order: OrderRow, section: OrderSection) {
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
      ["assigned", "shipped"].includes(order.hardware_status || "") ||
      Boolean(order.tracking_number || order.tracking_url)
    );
  }
  return (
    ["quote_prepared", "quote_sent", "paid", "active"].includes(order.status) ||
    [
      "content_collection",
      "content_pending",
      "content_received",
      "preview_approved",
      "in_production",
    ].includes(order.fulfillment_status || "")
  );
}

export function formatSek(amount: number | null) {
  if (amount === null) return "pending";
  return `${amount.toLocaleString("sv-SE")} kr`;
}

export function formatStripeSek(amount: number | null) {
  if (amount === null) return "pending";
  const hasOre = amount % 100 !== 0;
  return `${(amount / 100).toLocaleString("sv-SE", {
    minimumFractionDigits: hasOre ? 2 : 0,
    maximumFractionDigits: 2,
  })} kr`;
}

export function formatStatusLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export const isSchemaMismatch = (
  error: { code?: string; message?: string } | null | undefined,
) => error?.code === "42703" || error?.code === "PGRST204";

export const normalizeOrder = (row: Partial<OrderRow>): OrderRow => ({
  id: row.id || "",
  order_number: row.order_number ?? null,
  status: row.status || "pending",
  fulfillment_status: row.fulfillment_status ?? null,
  hardware_status:
    row.hardware_status ??
    (row as Partial<OrderRow> & { inventory_status?: string | null })
      .inventory_status ??
    null,
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
