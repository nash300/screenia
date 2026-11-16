import { afterEach, describe, expect, it, vi } from "vitest";

import { getAdminNotificationRecipients } from "./admin-notifications";

describe("admin notification recipients", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults operational notifications to customer service", () => {
    vi.stubEnv("SCREENIA_ADMIN_NOTIFICATION_EMAILS", "");
    vi.stubEnv("ADMIN_NOTIFICATION_EMAILS", "");

    expect(getAdminNotificationRecipients()).toEqual(["service@screenia.se"]);
  });

  it("never sends operational notifications to the admin login address", () => {
    vi.stubEnv(
      "SCREENIA_ADMIN_NOTIFICATION_EMAILS",
      "admin@screenia.se, service@screenia.se, not-an-email",
    );

    expect(getAdminNotificationRecipients()).toEqual(["service@screenia.se"]);
  });

  it("falls back to customer service when only the admin login is configured", () => {
    vi.stubEnv("SCREENIA_ADMIN_NOTIFICATION_EMAILS", "admin@screenia.se");

    expect(getAdminNotificationRecipients()).toEqual(["service@screenia.se"]);
  });
});
