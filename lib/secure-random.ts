/**
 * Cryptographically secure random integers.
 *
 * Every random choice in CipherScore goes through `randomInt`, which is the only place that
 * touches the randomness API. It uses the Web Crypto `crypto.getRandomValues` CSPRNG and
 * never falls back to `Math.random`: if Web Crypto is unavailable it throws instead.
 */

/** Fills the array with uniformly random 32-bit values (same contract as `getRandomValues`). */
export type FillRandomValues = (array: Uint32Array) => unknown;

export class SecureRandomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecureRandomError";
  }
}

const UINT32_RANGE = 2 ** 32;

/**
 * A rejection loop only runs long if the source is broken (e.g. a stub that always returns the
 * same rejected value). For a healthy source each draw is accepted with probability >= 1/2, so
 * 1000 consecutive rejections has probability <= 2^-1000.
 */
const MAX_REJECTIONS = 1000;

export const webCryptoFill: FillRandomValues = (array) => {
  const webCrypto = globalThis.crypto;
  if (!webCrypto || typeof webCrypto.getRandomValues !== "function") {
    throw new SecureRandomError(
      "A secure random number generator (Web Crypto) is not available in this environment."
    );
  }
  // Called as a method on purpose: detaching getRandomValues from `crypto` throws "Illegal invocation".
  return webCrypto.getRandomValues(array);
};

/**
 * Returns a uniformly distributed integer in [0, maxExclusive).
 *
 * `value % max` on a 32-bit draw is biased whenever `max` does not divide 2^32: the first
 * `2^32 % max` outputs would occur once more often than the rest. To remove the bias we discard
 * draws at or above the largest multiple of `max` that fits in 32 bits (rejection sampling), so
 * every residue is hit by exactly the same number of accepted values.
 */
export function randomInt(maxExclusive: number, fill: FillRandomValues = webCryptoFill): number {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > UINT32_RANGE) {
    throw new RangeError("maxExclusive must be an integer between 1 and 2^32.");
  }
  if (maxExclusive === 1) {
    return 0;
  }

  const acceptBelow = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
  const buffer = new Uint32Array(1);

  for (let rejections = 0; rejections <= MAX_REJECTIONS; rejections += 1) {
    fill(buffer);
    if (buffer[0] < acceptBelow) {
      return buffer[0] % maxExclusive;
    }
  }

  throw new SecureRandomError("The random source kept producing rejected values; refusing to continue.");
}
