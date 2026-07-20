export type Customer = {
  id: string;
  customer_number: string | null;
  requested_screen_quantity: number | null;
  requested_quote_items: QuoteItemRecord[] | null;
  name: string;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
  organisation_number: string | null;
  billing_email: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  business_category: string | null;
  website_url: string | null;
  preferred_contact_channel: string | null;
  remote_support_consent: boolean | null;
  analytics_consent: boolean | null;
  notes: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  onboarding_token: string | null;
  onboarding_token_expires_at: string | null;
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
  marketing_consent: boolean | null;
  payment_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  service_access_status: string | null;
  service_access_until: string | null;
  production_status: string | null;
  preview_url: string | null;
  preview_status: string | null;
  preview_feedback: string | null;
  layout_started_at: string | null;
  setup_fee_locked_at: string | null;
  activated_at: string | null;
  inactive_reason: string | null;
  cancellation_reason: string | null;
  cancellation_details: string | null;
  cancelled_at: string | null;
  cancellation_source: string | null;
};

export type Device = {
  id: string;
  name: string | null;
  device_code: string;
  is_active: boolean | null;
  inventory_status: string | null;
  make: string | null;
  model: string | null;
  serial_number: string | null;
  playlists?: { count: number }[];
};

export type CustomerSubscription = {
  id: string;
  order_number: string | null;
  status: string;
  setup_fee_sek: number | null;
  setup_fee_paid: boolean | null;
  hardware_fee_sek: number | null;
  shipping_fee_sek: number | null;
  monthly_fee_sek: number | null;
  tax_amount_sek: number | null;
  total_amount_sek: number | null;
  tax_status: string | null;
  fulfillment_status: string | null;
  inventory_status: string | null;
  stripe_checkout_session_id: string | null;
  stripe_subscription_id: string | null;
  stripe_invoice_id: string | null;
  stripe_payment_status: string | null;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  stripe_current_period_start: string | null;
  stripe_current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  cancellation_effective_at: string | null;
  pause_started_at: string | null;
  pause_resumes_at: string | null;
  pause_reason: string | null;
  screen_quantity: number | null;
  device_discount_percent: number | null;
  device_discount_months: number | null;
  device_discount_amount_sek: number | null;
  monthly_discount_amount_sek: number | null;
  quote_items: QuoteItemRecord[] | null;
  quote_notes: string | null;
  created_at: string;
};

export type PricingPlan = {
  id: string;
  code: string;
  name: string;
  resolution: string;
  setup_fee_sek: number;
  hardware_fee_sek: number | null;
  shipping_fee_sek: number | null;
  monthly_fee_sek: number;
  trial_days: number;
  currency: string | null;
};

export type QuoteItem = {
  id: string;
  pricingPlanCode: string;
  quantity: number;
};

export type QuoteItemRecord = {
  pricingPlanCode?: string;
  name?: string;
  resolution?: string;
  quantity?: number;
};

export type CustomerMessage = {
  id: string;
  ticketNumber: string | null;
  requestType: string;
  priority: string;
  relatedTicketNumber: string | null;
  subject: string | null;
  message: string;
  status: string;
  adminNote: string | null;
  adminNoteUpdatedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  files: Array<{
    id: string;
    fileName: string;
    contentType: string;
    fileSize: number;
    downloadUrl: string | null;
  }>;
};

export type CustomerAsset = {
  id: string;
  fileName: string | null;
  contentType: string | null;
  fileSize: number | null;
  category: string;
  description: string | null;
  source: string;
  status: string;
  adminNote: string | null;
  adminNoteUpdatedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  downloadUrl: string | null;
};

export type AuditEvent = {
  id: string;
  actor_type: string;
  actor_id: string | null;
  event_type: string;
  event_description: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type CustomerDetailSection =
  | "overview"
  | "onboarding"
  | "communication"
  | "orders"
  | "devices"
  | "history";

export type CommunicationView = "messages" | "uploads";

export type CustomerOperationId =
  | "activate_customer"
  | "suspend_customer"
  | "reactivate_customer"
  | "pause_subscription"
  | "resume_subscription"
  | "apply_temporary_discount"
  | "remove_temporary_discount"
  | "cancel_period_end"
  | "cancel_immediately"
  | "start_layout"
  | "refund_first_payment"
  | "record_post_layout_refund_request"
  | "issue_partial_refund";

export type CustomerOperation = {
  id: CustomerOperationId;
  title: string;
  description: string;
  result: string;
  tone: "primary" | "warning" | "danger" | "success";
  requiresStripe?: boolean;
  requiresDiscount?: boolean;
  requiresRefundAmount?: boolean;
  requiresConfirmation?: boolean;
};

export type CustomerRefundCase = {
  id: string;
  order_number: string | null;
  request_type: "full" | "partial";
  requested_amount_ore: number;
  approved_amount_ore: number | null;
  currency: string;
  customer_reason: string;
  admin_decision: "pending" | "denied" | "approved_partial" | "approved_full";
  admin_reason: string | null;
  status: "open" | "closed";
  stripe_payment_intent_id: string | null;
  stripe_refund_id: string | null;
  requested_at: string;
  decided_at: string | null;
  created_at: string;
};

export type InventoryStockItem = {
  id: string;
  item_code: string;
  item_type: string;
  status: string;
  condition: string;
  make: string | null;
  model: string | null;
  serial_number: string | null;
  seller: string | null;
  notes: string | null;
};

export type SupabaseSchemaError = {
  code?: string;
  message?: string;
};
