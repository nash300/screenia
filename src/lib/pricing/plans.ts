export const PRICING_PLANS = [
  {
    code: "standard_fhd",
    name: "Standard",
    resolution: "FHD",
    setupFeeSek: 1599,
    hardwareFeeSek: 699,
    shippingFeeSek: 99,
    monthlyFeeSek: 219,
    trialDays: 14,
    binding: "None",
  },
  {
    code: "premium_4k",
    name: "Premium",
    resolution: "4K",
    setupFeeSek: 1599,
    hardwareFeeSek: 1099,
    shippingFeeSek: 99,
    monthlyFeeSek: 296,
    trialDays: 14,
    binding: "None",
  },
] as const;
