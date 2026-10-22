import { describe, expect, it } from "vitest";
import {
  customerStatusLabel,
  isCustomerStatus,
  manuallyManageableCustomerStatuses,
} from "./customer-status";

describe("customer status workflow", () => {
  it("provides human labels for stored statuses", () => {
    expect(customerStatusLabel("content_pending")).toBe("Material pending");
    expect(customerStatusLabel("canceled")).toBe("Cancelled");
    expect(customerStatusLabel("future_status")).toBe("Future Status");
  });

  it("accepts only known statuses", () => {
    expect(isCustomerStatus("active")).toBe(true);
    expect(isCustomerStatus("not_a_status")).toBe(false);
  });

  it("keeps service and billing states out of manual workflow editing", () => {
    expect(manuallyManageableCustomerStatuses.has("content_received")).toBe(true);
    expect(manuallyManageableCustomerStatuses.has("active")).toBe(false);
    expect(manuallyManageableCustomerStatuses.has("refunded")).toBe(false);
  });
});
