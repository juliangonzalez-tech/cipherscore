/**
 * Entropy of the *generation process*.
 *
 * A generated secret is chosen uniformly from a known set of possible outputs, so its entropy is
 * exactly log2(number of possible outputs). This says how hard it is to guess the output if an
 * attacker knows the generator and its settings. It is not an estimate of how a human-chosen
 * password will fare (that is what the zxcvbn-based checker is for), and it does not describe
 * how the password will be stored or attacked elsewhere.
 */

/** log2 of a positive BigInt, accurate to double precision even for huge values. */
export function log2BigInt(value: bigint): number {
  if (value <= 0n) {
    throw new RangeError("log2 is only defined for positive values.");
  }
  const bitLength = value.toString(2).length;
  const shift = bitLength > 53 ? bitLength - 53 : 0;
  return Math.log2(Number(value >> BigInt(shift))) + shift;
}

/** Entropy of `length` independent uniform draws from an alphabet of `alphabetSize` symbols. */
export function uniformEntropyBits(alphabetSize: number, length: number): number {
  return length * Math.log2(alphabetSize);
}

/**
 * Number of strings of `length` over the union of the given disjoint character sets that contain
 * at least one character from every set (inclusion-exclusion over the sets that are missing).
 */
export function countStringsUsingEverySet(setSizes: readonly number[], length: number): bigint {
  const total = setSizes.reduce((sum, size) => sum + size, 0);
  let count = 0n;

  for (let mask = 0; mask < 1 << setSizes.length; mask += 1) {
    let missing = 0;
    let missingSets = 0;
    setSizes.forEach((size, index) => {
      if (mask & (1 << index)) {
        missing += size;
        missingSets += 1;
      }
    });
    const term = BigInt(total - missing) ** BigInt(length);
    count += missingSets % 2 === 0 ? term : -term;
  }

  return count;
}

/** Entropy when every output must contain at least one character from each of the sets. */
export function constrainedEntropyBits(setSizes: readonly number[], length: number): number {
  const count = countStringsUsingEverySet(setSizes, length);
  if (count <= 0n) {
    throw new RangeError("No string of this length can use every character set.");
  }
  return log2BigInt(count);
}
