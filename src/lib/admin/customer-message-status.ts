export const customerMessageStatusOptions = [
  { value: "new", label: "New" },
  { value: "customer_reply", label: "Customer reply" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting_for_customer", label: "Waiting for customer" },
  { value: "resolved", label: "Resolved" },
] as const;

export type CustomerMessageStatus =
  (typeof customerMessageStatusOptions)[number]["value"];

const legacyCustomerMessageStatusAliases: Record<string, CustomerMessageStatus> = {
  open: "new",
  waiting_customer: "waiting_for_customer",
  closed: "resolved",
};

export function normalizeCustomerMessageStatus(value: string | null | undefined) {
  const status = String(value || "").trim();
  return legacyCustomerMessageStatusAliases[status] || status;
}

export function isCustomerMessageStatus(
  value: string,
): value is CustomerMessageStatus {
  return customerMessageStatusOptions.some((option) => option.value === value);
}
