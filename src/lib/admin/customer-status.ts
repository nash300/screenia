export const customerStatusOptions = [
  { value: "draft", label: "Draft", group: "Intake" },
  { value: "new_request", label: "New request", group: "Intake" },
  { value: "invited", label: "Setup link sent", group: "Onboarding" },
  { value: "accepted_terms", label: "Terms accepted", group: "Onboarding" },
  { value: "completed_profile", label: "Profile complete", group: "Onboarding" },
  { value: "paid", label: "Paid", group: "Delivery" },
  { value: "content_pending", label: "Material pending", group: "Delivery" },
  { value: "content_received", label: "Material received", group: "Delivery" },
  { value: "active", label: "Active", group: "Service" },
  { value: "suspended", label: "Suspended", group: "Service" },
  { value: "cancelled", label: "Cancelled", group: "Closed" },
  { value: "canceled", label: "Cancelled", group: "Closed" },
  { value: "refunded", label: "Refunded", group: "Closed" },
] as const;

export type CustomerStatus = (typeof customerStatusOptions)[number]["value"];

const customerStatusLabels = new Map(
  customerStatusOptions.map((option) => [option.value, option.label]),
);

export const manuallyManageableCustomerStatuses = new Set<CustomerStatus>([
  "draft",
  "new_request",
  "invited",
  "accepted_terms",
  "completed_profile",
  "content_pending",
  "content_received",
]);

export function customerStatusLabel(value: string | null | undefined) {
  if (!value) return "Not set";
  return customerStatusLabels.get(value as CustomerStatus) ||
    value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function isCustomerStatus(value: unknown): value is CustomerStatus {
  return customerStatusOptions.some((option) => option.value === value);
}
