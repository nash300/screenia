const itemTypes = new Set(["standard_fhd", "premium_4k", "spare", "other"]);
export const statuses = new Set([
  "in_stock",
  "reserved",
  "assigned",
  "shipped",
  "returned",
  "defective",
  "in_repair",
  "retired",
  "lost",
]);
export const statusesThatReleaseLinkedDevice = new Set([
  "in_stock",
  "returned",
  "defective",
  "in_repair",
  "retired",
  "lost",
]);
export const conditions = new Set([
  "new",
  "tested",
  "used",
  "returned",
  "defective",
  "repaired",
]);
export const subscriptionStatusesForInventorySync = [
  "active",
  "paid",
  "trialing",
  "content_received",
  "layout_started",
];

export function cleanString(value: unknown, maxLength: number) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function cleanNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return Math.max(0, numericValue);
}

function cleanInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return Math.max(0, Math.round(numericValue));
}

function cleanDate(value: unknown) {
  const date = cleanString(value, 20);
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function resolveWarrantyUntil(
  purchaseDate: string | null,
  warrantyMonths: number | null,
  explicitWarrantyUntil: string | null,
) {
  if (explicitWarrantyUntil) return explicitWarrantyUntil;
  if (!purchaseDate || !warrantyMonths) return null;

  const [year, month, day] = purchaseDate.split("-").map(Number);
  const targetMonthIndex = year * 12 + (month - 1) + warrantyMonths;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDay);

  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}

export function getReason(value: unknown) {
  return String(value || "").trim().slice(0, 1000);
}

export function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  return Object.entries(after)
    .filter(([key, value]) => before[key] !== value)
    .map(([key]) => key);
}

export function buildInventoryPayload(body: Record<string, unknown>) {
  const itemType = String(body.item_type || "standard_fhd").trim();
  const status = String(body.status || "in_stock").trim();
  const condition = String(body.condition || "new").trim();

  if (!itemTypes.has(itemType)) {
    return { error: "Choose a valid item type." };
  }

  if (!statuses.has(status)) {
    return { error: "Choose a valid stock status." };
  }

  if (!conditions.has(condition)) {
    return { error: "Choose a valid stock condition." };
  }

  const serialNumber = cleanString(body.serial_number, 160);

  if (!serialNumber) {
    return { error: "Serial number is required." };
  }

  const purchaseDate = cleanDate(body.purchase_date);
  const warrantyMonths = cleanInteger(body.warranty_period_months);
  const warrantyUntil = resolveWarrantyUntil(
    purchaseDate,
    warrantyMonths,
    cleanDate(body.warranty_until),
  );

  return {
    payload: {
      item_type: itemType,
      status,
      condition,
      make: cleanString(body.make, 120),
      model: cleanString(body.model, 120),
      serial_number: serialNumber,
      seller: cleanString(body.seller, 160),
      invoice_number: cleanString(body.invoice_number, 120),
      purchase_cost: cleanNumber(body.purchase_cost),
      purchase_currency: "sek",
      purchase_date: purchaseDate,
      warranty_period_months: warrantyMonths,
      warranty_until: warrantyUntil,
      defect_description: cleanString(body.defect_description, 1000),
      return_notes: cleanString(body.return_notes, 1000),
      notes: cleanString(body.notes, 1000),
      last_checked_at: status === "in_stock" ? new Date().toISOString() : null,
    },
  };
}
