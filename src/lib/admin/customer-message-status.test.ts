import { describe, expect, it } from "vitest";
import {
  isCustomerMessageStatus,
  normalizeCustomerMessageStatus,
} from "./customer-message-status";

describe("customer message statuses", () => {
  it("normalizes legacy stored statuses to the current workflow values", () => {
    expect(normalizeCustomerMessageStatus("open")).toBe("new");
    expect(normalizeCustomerMessageStatus("waiting_customer")).toBe(
      "waiting_for_customer",
    );
    expect(normalizeCustomerMessageStatus("closed")).toBe("resolved");
  });

  it("accepts every status exposed by the admin workflow", () => {
    expect(isCustomerMessageStatus("new")).toBe(true);
    expect(isCustomerMessageStatus("customer_reply")).toBe(true);
    expect(isCustomerMessageStatus("in_progress")).toBe(true);
    expect(isCustomerMessageStatus("waiting_for_customer")).toBe(true);
    expect(isCustomerMessageStatus("resolved")).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isCustomerMessageStatus("open")).toBe(false);
    expect(isCustomerMessageStatus("not-a-status")).toBe(false);
    expect(normalizeCustomerMessageStatus("not-a-status")).toBe("not-a-status");
  });
});
