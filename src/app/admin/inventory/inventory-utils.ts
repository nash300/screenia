import type {
  InventoryForm,
  InventoryOperationId,
  InventorySelectOption,
} from "./types";

export const itemTypes: InventorySelectOption[] = [
  { value: "standard_fhd", label: "Standard FHD" },
  { value: "premium_4k", label: "Premium 4K" },
  { value: "spare", label: "Spare part" },
  { value: "other", label: "Other" },
];

export const statuses: InventorySelectOption[] = [
  { value: "in_stock", label: "In stock" },
  { value: "reserved", label: "Reserved" },
  { value: "assigned", label: "Assigned" },
  { value: "shipped", label: "Shipped" },
  { value: "returned", label: "Returned" },
  { value: "defective", label: "Defective" },
  { value: "in_repair", label: "In repair" },
  { value: "retired", label: "Retired" },
  { value: "lost", label: "Lost" },
];

export const conditions: InventorySelectOption[] = [
  { value: "new", label: "New" },
  { value: "tested", label: "Tested" },
  { value: "used", label: "Used" },
  { value: "returned", label: "Returned" },
  { value: "defective", label: "Defective" },
  { value: "repaired", label: "Repaired" },
];

export function createEmptyForm(): InventoryForm {
  return {
    item_type: "standard_fhd",
    status: "in_stock",
    condition: "new",
    make: "Xiaomi",
    model: "",
    serial_number: "",
    seller: "",
    invoice_number: "",
    purchase_cost: "",
    purchase_date: new Date().toISOString().slice(0, 10),
    warranty_period_months: "",
    warranty_until: "",
    defect_description: "",
    return_notes: "",
    notes: "",
    reason: "",
  };
}

export const inventoryOperations: Array<{
  id: InventoryOperationId;
  label: string;
  description: string;
  status: string;
  condition: string;
  tone?: "warning" | "danger" | "success";
}> = [
  {
    id: "shipped",
    label: "Confirm shipped",
    description: "Use after customer allocation when the physical box leaves Screenia.",
    status: "shipped",
    condition: "tested",
    tone: "success",
  },
  {
    id: "returned",
    label: "Mark returned",
    description: "Record a customer return and clear the stock item for inspection.",
    status: "returned",
    condition: "returned",
    tone: "warning",
  },
  {
    id: "defective",
    label: "Mark defective",
    description: "Flag the box as needing diagnosis before it can be reused.",
    status: "defective",
    condition: "defective",
    tone: "danger",
  },
  {
    id: "in_repair",
    label: "Send to repair",
    description: "Move the box into a repair workflow.",
    status: "in_repair",
    condition: "defective",
  },
  {
    id: "in_stock",
    label: "Back to stock",
    description: "Return the repaired or inspected box to available stock.",
    status: "in_stock",
    condition: "repaired",
    tone: "success",
  },
  {
    id: "retired",
    label: "Retire",
    description: "Remove the box from active operational stock.",
    status: "retired",
    condition: "used",
    tone: "warning",
  },
];

export function itemTypeLabel(value: string) {
  return itemTypes.find((item) => item.value === value)?.label || value;
}

export function statusLabel(value: string) {
  return statuses.find((status) => status.value === value)?.label || value;
}

export function conditionLabel(value: string) {
  return conditions.find((condition) => condition.value === value)?.label || value;
}

export function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("sv-SE");
}
