export const passwordPolicyDescription =
  "Lösenordet måste vara minst 6 tecken och innehålla både bokstäver och siffror.";

export function validatePasswordPolicy(password: string) {
  const hasMinimumLength = password.length >= 6;
  const hasLetter = /\p{L}/u.test(password);
  const hasNumber = /\p{N}/u.test(password);

  return hasMinimumLength && hasLetter && hasNumber;
}
