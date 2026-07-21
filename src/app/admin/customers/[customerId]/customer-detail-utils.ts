import type {
  Customer,
  CustomerSubscription,
  Device,
  SupabaseSchemaError,
} from "./types";

const billableSubscriptionStatuses = new Set([
  "active",
  "paid",
  "trialing",
  "content_received",
  "layout_started",
]);

const billableStripeStatuses = new Set(["paid", "trialing", "active"]);

const inactiveDeviceInventoryStatuses = new Set([
  "returned",
  "defective",
  "in_repair",
  "retired",
  "lost",
  "cancelled",
  "refunded",
]);

const inventoryTypeLabels: Record<string, string> = {
  standard_fhd: "Standard FHD",
  premium_4k: "Premium 4K",
  spare: "Spare part",
  other: "Other",
};

export const isSchemaMismatch = (
  error: SupabaseSchemaError | null | undefined,
) => error?.code === "42703" || error?.code === "PGRST204";

export const normalizeCustomer = (row: Partial<Customer>): Customer => ({
  id: row.id || "",
  customer_number: row.customer_number ?? null,
  requested_screen_quantity: row.requested_screen_quantity ?? null,
  requested_quote_items: row.requested_quote_items ?? null,
  name: row.name || "Unknown customer",
  email: row.email ?? null,
  phone: row.phone ?? null,
  contact_person: row.contact_person ?? null,
  organisation_number: row.organisation_number ?? null,
  billing_email: row.billing_email ?? null,
  address: row.address ?? null,
  postal_code: row.postal_code ?? null,
  city: row.city ?? null,
  country: row.country ?? null,
  business_category: row.business_category ?? null,
  website_url: row.website_url ?? null,
  preferred_contact_channel: row.preferred_contact_channel ?? null,
  remote_support_consent: row.remote_support_consent ?? null,
  analytics_consent: row.analytics_consent ?? null,
  notes: row.notes ?? null,
  status: row.status ?? null,
  created_at: row.created_at ?? null,
  updated_at: row.updated_at ?? null,
  onboarding_token: row.onboarding_token ?? null,
  onboarding_token_expires_at: row.onboarding_token_expires_at ?? null,
  terms_accepted_at: row.terms_accepted_at ?? null,
  privacy_accepted_at: row.privacy_accepted_at ?? null,
  marketing_consent: row.marketing_consent ?? null,
  payment_status: row.payment_status ?? null,
  stripe_customer_id: row.stripe_customer_id ?? null,
  stripe_subscription_id: row.stripe_subscription_id ?? null,
  service_access_status: row.service_access_status ?? null,
  service_access_until: row.service_access_until ?? null,
  production_status: row.production_status ?? null,
  preview_url: row.preview_url ?? null,
  preview_status: row.preview_status ?? null,
  preview_feedback: row.preview_feedback ?? null,
  layout_started_at: row.layout_started_at ?? null,
  setup_fee_locked_at: row.setup_fee_locked_at ?? null,
  activated_at: row.activated_at ?? null,
  inactive_reason: row.inactive_reason ?? null,
  cancellation_reason: row.cancellation_reason ?? null,
  cancellation_details: row.cancellation_details ?? null,
  cancelled_at: row.cancelled_at ?? null,
  cancellation_source: row.cancellation_source ?? null,
});

export const normalizeSubscription = (
  row: Partial<CustomerSubscription>,
): CustomerSubscription => ({
  id: row.id || "",
  order_number: row.order_number ?? null,
  status: row.status || "pending",
  setup_fee_sek: row.setup_fee_sek ?? null,
  setup_fee_paid: row.setup_fee_paid ?? null,
  hardware_fee_sek: row.hardware_fee_sek ?? null,
  shipping_fee_sek: row.shipping_fee_sek ?? null,
  base_shipping_fee_sek: row.base_shipping_fee_sek ?? null,
  shipping_included_devices: row.shipping_included_devices ?? null,
  additional_shipping_fee_per_device_sek:
    row.additional_shipping_fee_per_device_sek ?? null,
  additional_shipping_device_count:
    row.additional_shipping_device_count ?? null,
  monthly_fee_sek: row.monthly_fee_sek ?? null,
  tax_amount_sek: row.tax_amount_sek ?? null,
  total_amount_sek: row.total_amount_sek ?? null,
  tax_status: row.tax_status ?? null,
  fulfillment_status: row.fulfillment_status ?? null,
  inventory_status: row.inventory_status ?? null,
  stripe_checkout_session_id: row.stripe_checkout_session_id ?? null,
  stripe_subscription_id: row.stripe_subscription_id ?? null,
  stripe_invoice_id: row.stripe_invoice_id ?? null,
  stripe_payment_status: row.stripe_payment_status ?? null,
  trial_starts_at: row.trial_starts_at ?? null,
  trial_ends_at: row.trial_ends_at ?? null,
  stripe_current_period_start: row.stripe_current_period_start ?? null,
  stripe_current_period_end: row.stripe_current_period_end ?? null,
  cancel_at_period_end: row.cancel_at_period_end ?? false,
  cancellation_effective_at: row.cancellation_effective_at ?? null,
  pause_started_at: row.pause_started_at ?? null,
  pause_resumes_at: row.pause_resumes_at ?? null,
  pause_reason: row.pause_reason ?? null,
  screen_quantity: row.screen_quantity ?? 1,
  device_discount_percent: row.device_discount_percent ?? 0,
  device_discount_months: row.device_discount_months ?? 0,
  device_discount_amount_sek: row.device_discount_amount_sek ?? 0,
  monthly_discount_amount_sek: row.monthly_discount_amount_sek ?? 0,
  quote_items: row.quote_items ?? null,
  quote_notes: row.quote_notes ?? null,
  created_at: row.created_at || new Date().toISOString(),
});

export function subscriptionCountsTowardDeviceEntitlement(
  subscription: CustomerSubscription,
) {
  const status = String(subscription.status || "").toLowerCase();
  const stripeStatus = String(subscription.stripe_payment_status || "").toLowerCase();

  return (
    billableSubscriptionStatuses.has(status) ||
    billableStripeStatuses.has(stripeStatus)
  );
}

export function deviceCountsTowardEntitlement(device: Device) {
  if (!device.is_active) return false;

  const inventoryStatus = String(device.inventory_status || "assigned").toLowerCase();
  return !inactiveDeviceInventoryStatuses.has(inventoryStatus);
}

export function inventoryTypeLabel(value: string) {
  return inventoryTypeLabels[value] || value.replace(/_/g, " ");
}

export function formatSek(amount: number | null) {
  if (amount === null) return "";

  return `${amount.toLocaleString("sv-SE", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })} kr`;
}

export function formatStripeSek(amount: number | null) {
  if (amount === null) return "";

  const hasOre = amount % 100 !== 0;
  return `${(amount / 100).toLocaleString("sv-SE", {
    minimumFractionDigits: hasOre ? 2 : 0,
    maximumFractionDigits: 2,
  })} kr`;
}
