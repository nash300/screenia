export const SWEDISH_STANDARD_VAT_RATE = 0.25;

export function includedVatFromGross(amountSek: number) {
  const grossOre = Math.max(0, Math.round(amountSek * 100));
  const netOre = Math.round(grossOre / (1 + SWEDISH_STANDARD_VAT_RATE));
  const vatOre = grossOre - netOre;

  return {
    gross: grossOre / 100,
    net: netOre / 100,
    vat: vatOre / 100,
  };
}
