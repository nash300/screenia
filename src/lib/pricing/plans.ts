export const PRICING_PLANS = [
  {
    code: "standard_fhd",
    name: "Standard",
    resolution: "FHD",
    setupFeeSek: 1599,
    hardwareFeeSek: 0,
    shippingFeeSek: 99,
    monthlyFeeSek: 249,
    trialDays: 21,
    binding: "None",
  },
  {
    code: "premium_4k",
    name: "Premium",
    resolution: "4K",
    setupFeeSek: 1599,
    hardwareFeeSek: 0,
    shippingFeeSek: 99,
    monthlyFeeSek: 349,
    trialDays: 21,
    binding: "None",
  },
] as const;
