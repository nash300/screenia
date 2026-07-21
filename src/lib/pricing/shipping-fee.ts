export const INCLUDED_SHIPPING_DEVICE_COUNT = 3;
export const BASE_SHIPPING_FEE_SEK = 99;
export const ADDITIONAL_SHIPPING_FEE_PER_DEVICE_SEK = 29;

export function additionalShippingDeviceCount(
  deviceQuantity: number,
  includedDeviceCount = INCLUDED_SHIPPING_DEVICE_COUNT,
) {
  return Math.max(0, Math.floor(deviceQuantity) - includedDeviceCount);
}

export function calculateShippingFeeSek(
  deviceQuantity: number,
  baseShippingFeeSek = BASE_SHIPPING_FEE_SEK,
  includedDeviceCount = INCLUDED_SHIPPING_DEVICE_COUNT,
  additionalShippingFeeSek = ADDITIONAL_SHIPPING_FEE_PER_DEVICE_SEK,
) {
  if (deviceQuantity <= 0) return 0;

  return (
    baseShippingFeeSek +
    additionalShippingDeviceCount(deviceQuantity, includedDeviceCount) *
      additionalShippingFeeSek
  );
}
