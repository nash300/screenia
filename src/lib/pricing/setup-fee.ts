export const INCLUDED_SETUP_SCREEN_COUNT = 3;
export const ADDITIONAL_SETUP_FEE_PER_SCREEN_SEK = 249;

export function additionalSetupScreenCount(
  screenQuantity: number,
  includedScreenCount = INCLUDED_SETUP_SCREEN_COUNT,
) {
  return Math.max(
    0,
    Math.floor(screenQuantity) - includedScreenCount,
  );
}

export function calculateSetupFeeSek(
  screenQuantity: number,
  baseSetupFeeSek = 1599,
  includedScreenCount = INCLUDED_SETUP_SCREEN_COUNT,
  additionalSetupFeeSek = ADDITIONAL_SETUP_FEE_PER_SCREEN_SEK,
) {
  if (screenQuantity <= 0) return 0;

  return (
    baseSetupFeeSek +
    additionalSetupScreenCount(screenQuantity, includedScreenCount) *
    additionalSetupFeeSek
  );
}

export function calculateIncrementalSetupFeeSek(
  existingPaidScreenQuantity: number,
  addedScreenQuantity: number,
  baseSetupFeeSek = 1599,
  includedScreenCount = INCLUDED_SETUP_SCREEN_COUNT,
  additionalSetupFeeSek = ADDITIONAL_SETUP_FEE_PER_SCREEN_SEK,
) {
  const existingQuantity = Math.max(0, Math.floor(existingPaidScreenQuantity));
  const addedQuantity = Math.max(0, Math.floor(addedScreenQuantity));

  if (addedQuantity <= 0) return 0;

  return Math.max(
    0,
    calculateSetupFeeSek(
      existingQuantity + addedQuantity,
      baseSetupFeeSek,
      includedScreenCount,
      additionalSetupFeeSek,
    ) -
      calculateSetupFeeSek(
        existingQuantity,
        baseSetupFeeSek,
        includedScreenCount,
        additionalSetupFeeSek,
      ),
  );
}

export function incrementalAdditionalSetupScreenCount(
  existingPaidScreenQuantity: number,
  addedScreenQuantity: number,
  includedScreenCount = INCLUDED_SETUP_SCREEN_COUNT,
) {
  const existingQuantity = Math.max(0, Math.floor(existingPaidScreenQuantity));
  const addedQuantity = Math.max(0, Math.floor(addedScreenQuantity));

  if (addedQuantity <= 0) return 0;

  return Math.max(
    0,
    additionalSetupScreenCount(existingQuantity + addedQuantity, includedScreenCount) -
      additionalSetupScreenCount(existingQuantity, includedScreenCount),
  );
}
