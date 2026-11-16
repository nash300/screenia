import { afterEach, describe, expect, it, vi } from "vitest";

import { isCheckoutEnabled } from "./checkout-availability";

describe("checkout availability", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stays closed when the flag is missing or false", () => {
    vi.stubEnv("SCREENIA_CHECKOUT_ENABLED", "false");
    expect(isCheckoutEnabled()).toBe(false);

    vi.stubEnv("SCREENIA_CHECKOUT_ENABLED", "");
    expect(isCheckoutEnabled()).toBe(false);
  });

  it("opens only for the explicit true value", () => {
    vi.stubEnv("SCREENIA_CHECKOUT_ENABLED", "TRUE");
    expect(isCheckoutEnabled()).toBe(true);

    vi.stubEnv("SCREENIA_CHECKOUT_ENABLED", "yes");
    expect(isCheckoutEnabled()).toBe(false);
  });
});
