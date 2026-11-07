import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  existingCustomer: null as null | {
    id: string;
    name: string;
    status: string;
  },
  insertedCustomer: null as null | Record<string, unknown>,
  deletedCustomerIds: [] as string[],
  recordAuditEvent: vi.fn(),
  recordConsent: vi.fn(),
  createAdminNotification: vi.fn(),
  sendTransactionalEmail: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table !== "customers") {
        throw new Error(`Unexpected table in onboarding request test: ${table}`);
      }

      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({
                  data: mocks.existingCustomer,
                  error: null,
                }),
              }),
            }),
          }),
        }),
        insert: (payload: Record<string, unknown>) => {
          mocks.insertedCustomer = payload;
          return {
            select: () => ({
              single: async () => ({
                data: { id: "customer-created-1" },
                error: null,
              }),
            }),
          };
        },
        delete: () => ({
          eq: async (_column: string, id: string) => {
            mocks.deletedCustomerIds.push(id);
            return { error: null };
          },
        }),
      };
    },
  }),
}));

vi.mock("@/lib/server/audit", () => ({
  getRequestIp: () => "192.0.2.10",
  recordAuditEvent: mocks.recordAuditEvent,
  recordConsent: mocks.recordConsent,
}));

vi.mock("@/lib/server/admin-notifications", () => ({
  createAdminNotification: mocks.createAdminNotification,
}));

vi.mock("@/lib/server/rate-limit", () => ({
  rateLimitHeaders: () => ({}),
}));

vi.mock("@/lib/server/persistent-rate-limit", () => ({
  checkPersistentRateLimit: async () => ({
    allowed: true,
    limit: 5,
    remaining: 4,
    resetAt: Date.now() + 60_000,
    persistent: true,
  }),
}));

vi.mock("@/lib/server/email", () => ({
  escapeHtml: (value: string) => value,
  formatSek: (value: number) => `${value} kr`,
  renderBrandedEmail: () => "<html>confirmation</html>",
  sendTransactionalEmail: mocks.sendTransactionalEmail,
}));

import { POST } from "./route";

const validRequest = (overrides: Record<string, unknown> = {}) =>
  new Request("http://localhost/api/onboarding-requests", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "Screenia lifecycle test",
    },
    body: JSON.stringify({
      companyName: "TEST - Lifecycle AB",
      email: "lifecycle@example.test",
      contactPerson: "Test Person",
      phone: "+46 70 123 45 67",
      quoteItems: [{ pricingPlanCode: "standard_fhd", quantity: 2 }],
      privacyAccepted: true,
      ...overrides,
    }),
  });

beforeEach(() => {
  mocks.existingCustomer = null;
  mocks.insertedCustomer = null;
  mocks.deletedCustomerIds.length = 0;
  mocks.recordAuditEvent.mockReset().mockResolvedValue(undefined);
  mocks.recordConsent.mockReset().mockResolvedValue(undefined);
  mocks.createAdminNotification.mockReset().mockResolvedValue(undefined);
  mocks.sendTransactionalEmail.mockReset().mockResolvedValue({
    ok: true,
    id: "email-confirmation-1",
  });
});

describe("customer creation to audit lifecycle", () => {
  it("silently accepts the honeypot field without creating data", async () => {
    const response = await POST(validRequest({ website: "https://spam.test" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, received: true });
    expect(mocks.insertedCustomer).toBeNull();
    expect(mocks.recordAuditEvent).not.toHaveBeenCalled();
  });

  it.each([
    [{ quoteItems: [] }, "giltig kombination"],
    [
      { quoteItems: [{ pricingPlanCode: "not-a-plan", quantity: 1 }] },
      "giltig kombination",
    ],
    [
      { quoteItems: [{ pricingPlanCode: "standard_fhd", quantity: 0 }] },
      "giltig kombination",
    ],
    [
      { quoteItems: [{ pricingPlanCode: "standard_fhd", quantity: 51 }] },
      "giltig kombination",
    ],
    [{ companyName: "" }, "Företagsnamn"],
    [{ email: "invalid-email" }, "giltig e-postadress"],
    [{ phone: "123" }, "telefonnummer"],
    [{ privacyAccepted: false }, "integritetspolicyn"],
  ])("rejects invalid request data %#", async (overrides, expectedError) => {
    const response = await POST(validRequest(overrides));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain(expectedError);
    expect(mocks.insertedCustomer).toBeNull();
    expect(mocks.recordAuditEvent).not.toHaveBeenCalled();
  });

  it("creates the customer, stores consent, audits creation, notifies admin, and audits email", async () => {
    const response = await POST(validRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: "customer-created-1",
      success: true,
      emailSent: true,
    });
    expect(mocks.insertedCustomer).toMatchObject({
      name: "TEST - Lifecycle AB",
      email: "lifecycle@example.test",
      requested_screen_quantity: 2,
      status: "new_request",
    });
    expect(mocks.recordConsent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        customerId: "customer-created-1",
        consentType: "privacy_request",
        granted: true,
      }),
      { throwOnError: true },
    );
    expect(mocks.recordAuditEvent.mock.calls.map((call) => call[1].eventType)).toEqual([
      "landing_purchase_request_created",
      "request_confirmation_email_sent",
    ]);
    expect(mocks.createAdminNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        customerId: "customer-created-1",
        eventType: "landing_purchase_request_created",
        priority: "high",
      }),
      { throwOnError: true },
    );
    expect(mocks.deletedCustomerIds).toEqual([]);
  });

  it("accepts the Premium video package", async () => {
    const response = await POST(
      validRequest({
        quoteItems: [
          { pricingPlanCode: "premium_4k", quantity: 1 },
        ],
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.insertedCustomer).toMatchObject({
      requested_screen_quantity: 1,
      requested_quote_items: [
        {
          pricingPlanCode: "premium_4k",
          quantity: 1,
        },
      ],
    });
  });

  it("rolls customer creation back when the required creation audit cannot be stored", async () => {
    mocks.recordAuditEvent.mockRejectedValueOnce(
      new Error("audit storage unavailable"),
    );

    const response = await POST(validRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain("revisionshistoriken");
    expect(mocks.deletedCustomerIds).toEqual(["customer-created-1"]);
    expect(mocks.createAdminNotification).not.toHaveBeenCalled();
    expect(mocks.sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("rolls customer creation back when required privacy consent cannot be stored", async () => {
    mocks.recordConsent.mockRejectedValueOnce(
      new Error("consent storage unavailable"),
    );

    const response = await POST(validRequest());

    expect(response.status).toBe(500);
    expect(mocks.deletedCustomerIds).toEqual(["customer-created-1"]);
    expect(mocks.recordAuditEvent).not.toHaveBeenCalled();
    expect(mocks.sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("keeps the customer and audits a confirmation-email failure", async () => {
    mocks.sendTransactionalEmail.mockResolvedValueOnce({
      ok: false,
      configured: true,
      error: "email provider unavailable",
    });

    const response = await POST(validRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: "customer-created-1",
      success: true,
      emailSent: false,
    });
    expect(mocks.recordAuditEvent.mock.calls.map((call) => call[1].eventType)).toEqual([
      "landing_purchase_request_created",
      "request_confirmation_email_failed",
    ]);
    expect(mocks.deletedCustomerIds).toEqual([]);
  });

  it("blocks duplicate customers and leaves an audit plus admin review notification", async () => {
    mocks.existingCustomer = {
      id: "existing-customer-1",
      name: "Existing AB",
      status: "active",
    };

    const response = await POST(validRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.existingRequest).toBe(true);
    expect(mocks.insertedCustomer).toBeNull();
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        customerId: "existing-customer-1",
        eventType: "landing_purchase_request_duplicate_blocked",
      }),
    );
    expect(mocks.createAdminNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        customerId: "existing-customer-1",
        eventType: "landing_purchase_request_duplicate_blocked",
        priority: "high",
      }),
    );
  });
});
