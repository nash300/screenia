export const SWEDISH_STANDARD_VAT_RATE = 0.25;

export function includedVatFromGross(amountSek: number) {
  const gross = Math.max(0, Math.round(amountSek));
  const net = Math.round(gross / (1 + SWEDISH_STANDARD_VAT_RATE));

  return {
    gross,
    net,
    vat: gross - net,
  };
}
