import { describe, expect, it } from "vitest";

import {
  BASE_SETUP_FEE_SEK,
  calculateIncrementalSetupFeeSek,
  calculateQuotedSetupFee,
  calculateSetupFeeSek,
} from "./setup-fee";
import { calculateShippingFeeSek } from "./shipping-fee";
import { includedVatFromGross } from "./vat";

describe("setup pricing scenarios", () => {
  it.each([
    [0, 0],
    [1, 499],
    [3, 499],
    [4, 748],
    [5.9, 997],
  ])("prices %s screens at %s SEK", (quantity, expected) => {
    expect(calculateSetupFeeSek(quantity)).toBe(expected);
  });

  it("charges only newly crossed setup thresholds for add-on screens", () => {
    expect(calculateIncrementalSetupFeeSek(2, 1)).toBe(0);
    expect(calculateIncrementalSetupFeeSek(3, 1)).toBe(249);
    expect(calculateIncrementalSetupFeeSek(4, 2)).toBe(498);
    expect(calculateIncrementalSetupFeeSek(4, 0)).toBe(0);
  });

  it("uses 499 SEK as the default base administrative charge", () => {
    expect(BASE_SETUP_FEE_SEK).toBe(499);
  });

  it("waives the base charge for a selected new client", () => {
    expect(
      calculateQuotedSetupFee({
        existingPaidScreenQuantity: 0,
        addedScreenQuantity: 1,
        waiveBaseSetupFee: true,
      }),
    ).toEqual({
      setupFeeSek: 0,
      baseSetupFeeChargedSek: 0,
      additionalSetupScreens: 0,
      setupFeeWaived: true,
    });
  });

  it("keeps extra-screen setup charges when the base charge is waived", () => {
    expect(
      calculateQuotedSetupFee({
        existingPaidScreenQuantity: 0,
        addedScreenQuantity: 5,
        waiveBaseSetupFee: true,
      }),
    ).toMatchObject({
      setupFeeSek: 498,
      baseSetupFeeChargedSek: 0,
      additionalSetupScreens: 2,
      setupFeeWaived: true,
    });
  });

  it("does not apply the new-client waiver to an existing customer add-on", () => {
    expect(
      calculateQuotedSetupFee({
        existingPaidScreenQuantity: 3,
        addedScreenQuantity: 1,
        waiveBaseSetupFee: true,
      }),
    ).toMatchObject({
      setupFeeSek: 249,
      baseSetupFeeChargedSek: 0,
      additionalSetupScreens: 1,
      setupFeeWaived: false,
    });
  });
});

describe("shipping pricing scenarios", () => {
  it.each([
    [0, 0],
    [1, 99],
    [3, 99],
    [4, 99],
    [50, 99],
    [100, 99],
  ])("prices shipping for %s devices at %s SEK", (quantity, expected) => {
    expect(calculateShippingFeeSek(quantity)).toBe(expected);
  });
});

describe("included Swedish VAT", () => {
  it("splits a VAT-inclusive amount using ore-safe rounding", () => {
    expect(includedVatFromGross(2797)).toEqual({
      gross: 2797,
      net: 2237.6,
      vat: 559.4,
    });
  });

  it("never returns negative amounts", () => {
    expect(includedVatFromGross(-100)).toEqual({ gross: 0, net: 0, vat: 0 });
  });
});
