export const PRICING_PLANS = [
  {
    code: "standard_fhd",
    name: "Standard",
    resolution: "FHD",
    setupFeeSek: 1999,
    monthlyFeeSek: 219,
    trialDays: 14,
    binding: "None",
  },
  {
    code: "premium_4k",
    name: "Premium",
    resolution: "4K",
    setupFeeSek: 1999,
    monthlyFeeSek: 269,
    trialDays: 14,
    binding: "None",
  },
] as const;
