/**
 * Length guidance taken from NIST SP 800-63B-4 (Digital Identity Guidelines, Authentication and
 * Authenticator Management, section 3.1.1.2) and the OWASP Authentication Cheat Sheet.
 *
 *  - A password used as the only authentication factor must be at least 15 characters.
 *  - A password used only as one factor among several may be as short as 8 characters.
 *  - Neither document asks for (or credits) mixing character types, or for periodic rotation.
 */
export const NIST_SINGLE_FACTOR_MIN_LENGTH = 15;
export const NIST_MULTI_FACTOR_MIN_LENGTH = 8;

/** A reminder when a password is shorter than the single-factor minimum; null when it is fine. */
export function lengthAdvice(passwordLength: number): string | null {
  if (!Number.isFinite(passwordLength) || passwordLength <= 0) {
    return null;
  }
  if (passwordLength >= NIST_SINGLE_FACTOR_MIN_LENGTH) {
    return null;
  }
  return `NIST SP 800-63B-4 requires at least ${NIST_SINGLE_FACTOR_MIN_LENGTH} characters for a password used on its own (${NIST_MULTI_FACTOR_MIN_LENGTH} if it is paired with multi-factor authentication). This one has ${passwordLength}.`;
}
