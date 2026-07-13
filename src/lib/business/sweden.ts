export function normalizeSwedishRegistrationNumber(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 12 && /^(16|18|19|20)/.test(digits)) {
    return digits.slice(2);
  }

  return digits;
}

function hasValidLuhnChecksum(digits: string) {
  let sum = 0;

  for (let index = 0; index < digits.length; index += 1) {
    let value = Number(digits[index]);

    if (index % 2 === 0) {
      value *= 2;
      if (value > 9) value -= 9;
    }

    sum += value;
  }

  return sum % 10 === 0;
}

export function isValidSwedishRegistrationNumber(value: string) {
  const normalized = normalizeSwedishRegistrationNumber(value);

  return /^\d{10}$/.test(normalized) && hasValidLuhnChecksum(normalized);
}
