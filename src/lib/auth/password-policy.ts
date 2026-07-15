export const PASSWORD_POLICY_MIN_LENGTH = 6;

export const passwordPolicyDescription =
  `Lösenordet måste vara minst ${PASSWORD_POLICY_MIN_LENGTH} tecken och innehålla både bokstäver och siffror.`;

export function validatePasswordPolicy(password: string) {
  const hasMinimumLength = password.length >= PASSWORD_POLICY_MIN_LENGTH;
  const hasLetter = /\p{L}/u.test(password);
  const hasNumber = /\p{N}/u.test(password);

  return hasMinimumLength && hasLetter && hasNumber;
}
