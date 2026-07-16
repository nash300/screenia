export type InventoryItem = {
  id: string;
  item_code: string;
  item_type: string;
  status: string;
  condition: string;
  make: string | null;
  model: string | null;
  serial_number: string | null;
  seller: string | null;
  invoice_number: string | null;
  purchase_cost: number | null;
  purchase_currency: string | null;
  purchase_date: string | null;
  warranty_period_months: number | null;
  warranty_until: string | null;
  customer_id: string | null;
  device_id: string | null;
  assigned_at: string | null;
  shipped_at: string | null;
  returned_at: string | null;
  last_checked_at: string | null;
  defect_description: string | null;
  return_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  customers: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  devices: {
    device_code: string;
    name: string | null;
  } | null;
};

export type InventoryEvent = {
  id: string;
  inventory_item_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  notes: string | null;
  created_at: string;
};

export type InventoryForm = {
  item_type: string;
  status: string;
  condition: string;
  make: string;
  model: string;
  serial_number: string;
  seller: string;
  invoice_number: string;
  purchase_cost: string;
  purchase_date: string;
  warranty_period_months: string;
  warranty_until: string;
  defect_description: string;
  return_notes: string;
  notes: string;
  reason: string;
};

export type InventoryOperationId =
  | "shipped"
  | "returned"
  | "defective"
  | "in_repair"
  | "in_stock"
  | "retired";

export type InventoryOperationDraft = {
  operation: InventoryOperationId;
  reason: string;
  confirmed: boolean;
};

export type InventorySelectOption = {
  value: string;
  label: string;
};
