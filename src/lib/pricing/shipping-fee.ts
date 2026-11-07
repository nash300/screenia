// Screenia charges one fixed shipping amount for every supported order size.
// The application currently caps a quote at 50 devices; this value keeps the
// persisted pricing snapshot explicit without introducing an extra fee tier.
export const INCLUDED_SHIPPING_DEVICE_COUNT = 50;
export const BASE_SHIPPING_FEE_SEK = 99;
export const ADDITIONAL_SHIPPING_FEE_PER_DEVICE_SEK = 0;

export function additionalShippingDeviceCount(
  deviceQuantity: number,
  includedDeviceCount = INCLUDED_SHIPPING_DEVICE_COUNT,
) {
  void deviceQuantity;
  void includedDeviceCount;
  return 0;
}

export function calculateShippingFeeSek(
  deviceQuantity: number,
  baseShippingFeeSek = BASE_SHIPPING_FEE_SEK,
  includedDeviceCount = INCLUDED_SHIPPING_DEVICE_COUNT,
  additionalShippingFeeSek = ADDITIONAL_SHIPPING_FEE_PER_DEVICE_SEK,
) {
  if (deviceQuantity <= 0) return 0;

  void includedDeviceCount;
  void additionalShippingFeeSek;
  return baseShippingFeeSek;
}
