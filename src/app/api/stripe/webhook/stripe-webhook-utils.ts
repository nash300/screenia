import Stripe from "stripe";
import { includedVatFromGross } from "@/lib/pricing/vat";
export function includedVatOreFromStripeTotal(amountOre: number | null | undefined) {
  if (!amountOre) return null;
  return Math.round(includedVatFromGross(amountOre / 100).vat * 100);
}

export function invoiceTaxAmountOre(invoice: Stripe.Invoice) {
  const stripeTaxTotal = invoice.total_taxes?.reduce(
    (sum, tax) => sum + tax.amount,
    0,
  );

  if (stripeTaxTotal && stripeTaxTotal > 0) {
    return stripeTaxTotal;
  }

  return includedVatOreFromStripeTotal(invoice.total);
}

export function invoiceCustomerId(invoice: Stripe.Invoice) {
  return typeof invoice.customer === "string"
    ? invoice.customer
    : invoice.customer?.id || null;
}

export function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const invoiceWithSubscription = invoice as Stripe.Invoice & {
    parent?: {
      subscription_details?: {
        subscription?: string | null;
      } | null;
    } | null;
    subscription?: string | Stripe.Subscription | null;
  };

  return typeof invoiceWithSubscription.subscription === "string"
    ? invoiceWithSubscription.subscription
    : invoiceWithSubscription.subscription?.id ||
        invoiceWithSubscription.parent?.subscription_details?.subscription ||
        null;
}

export function formatStripeSek(amountOre: number | null | undefined) {
  return `${((amountOre ?? 0) / 100).toLocaleString("sv-SE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kr`;
}

export function formatInvoiceDate(timestamp: number | null | undefined) {
  if (!timestamp) return null;
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "long",
    timeZone: "Europe/Stockholm",
  }).format(new Date(timestamp * 1000));
}

export function parseAddOnSubscriptionItems(value: string | undefined) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as Array<{
      price?: string | null;
      quantity?: number;
    }>;

    return parsed
      .map((item) => {
        const quantity = Math.min(50, Math.max(1, Number(item.quantity) || 1));
        if (item.price) return { price: item.price, quantity };
        return null;
      })
      .filter((item): item is { price: string; quantity: number } =>
        Boolean(item?.price),
      );
  } catch {
    return [];
  }
}

export function fulfillmentStatusForPaidRecovery(customer: {
  status?: string | null;
  production_status?: string | null;
  layout_started_at?: string | null;
  content_collected_at?: string | null;
  preview_status?: string | null;
}) {
  if (customer.production_status === "published") return "completed";
  if (
    customer.production_status === "layout_started" ||
    customer.production_status === "ready_for_preview" ||
    customer.layout_started_at
  ) {
    return "layout_started";
  }
  if (
    customer.production_status === "approved" ||
    customer.preview_status === "approved"
  ) {
    return "preview_approved";
  }
  if (customer.preview_status === "changes_requested") return "content_pending";
  if (customer.content_collected_at || customer.status === "content_received") {
    return "content_received";
  }
  if (customer.status === "content_pending") return "content_pending";
  return "active";
}
