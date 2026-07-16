export type OrderRow = {
  id: string;
  order_number: string | null;
  status: string;
  fulfillment_status: string | null;
  hardware_status: string | null;
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

export type SupabaseSchemaError = {
  code?: string;
  message?: string;
};

export type OrderSection =
  | "all"
  | "pipeline"
  | "payment"
  | "shipping"
  | "cancelled";

export type OrderOperationId =
  | "status"
  | "fulfillment_status"
  | "hardware_status"
  | "tracking";

export type OrderOperationDraft = {
  orderId: string;
  operation: OrderOperationId;
  status: string;
  fulfillment_status: string;
  hardware_status: string;
  tracking_number: string;
  tracking_url: string;
  reason: string;
  confirmed: boolean;
};
