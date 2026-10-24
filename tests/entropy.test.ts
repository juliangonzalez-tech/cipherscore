import { describe, expect, it } from "vitest";
import {
  constrainedEntropyBits,
  countStringsUsingEverySet,
  log2BigInt,
  uniformEntropyBits
} from "@/lib/entropy";

/** Counts strings of `length` over disjoint sets (sizes given) that use every set, by enumeration. */
function bruteForceCount(setSizes: number[], length: number): number {
  const total = setSizes.reduce((sum, size) => sum + size, 0);
  const setOfSymbol: number[] = [];
  setSizes.forEach((size, setIndex) => {
    for (let index = 0; index < size; index += 1) setOfSymbol.push(setIndex);
  });

  let count = 0;
  const combinations = total ** length;
  for (let value = 0; value < combinations; value += 1) {
    const used = new Set<number>();
    let remaining = value;
    for (let position = 0; position < length; position += 1) {
      used.add(setOfSymbol[remaining % total]);
      remaining = Math.floor(remaining / total);
    }
    if (used.size === setSizes.length) count += 1;
  }
  return count;
}

describe("log2BigInt", () => {
  it("is exact for powers of two", () => {
    expect(log2BigInt(1n)).toBe(0);
    expect(log2BigInt(2n ** 10n)).toBe(10);
    expect(log2BigInt(2n ** 1000n)).toBe(1000);
  });

  it("matches Math.log2 on values a double can represent", () => {
    expect(log2BigInt(1000n)).toBeCloseTo(Math.log2(1000), 12);
  });

  it("stays accurate for values far beyond double range", () => {
    expect(log2BigInt(3n ** 500n)).toBeCloseTo(500 * Math.log2(3), 9);
  });

  it("rejects zero and negatives", () => {
    expect(() => log2BigInt(0n)).toThrow(RangeError);
    expect(() => log2BigInt(-5n)).toThrow(RangeError);
  });
});

describe("uniformEntropyBits", () => {
  it("is length * log2(alphabet size)", () => {
    expect(uniformEntropyBits(2, 10)).toBe(10);
    expect(uniformEntropyBits(7776, 6)).toBeCloseTo(77.549, 3);
  });
});

describe("countStringsUsingEverySet", () => {
  it.each([
    { sizes: [2, 3], length: 4 },
    { sizes: [1, 1], length: 3 },
    { sizes: [1, 1, 2], length: 4 },
    { sizes: [2, 1, 2, 1], length: 5 },
    { sizes: [3], length: 4 }
  ])("matches brute-force enumeration for sets $sizes at length $length", ({ sizes, length }) => {
    expect(countStringsUsingEverySet(sizes, length)).toBe(BigInt(bruteForceCount(sizes, length)));
  });

  it("is zero when the string is too short to touch every set", () => {
    expect(countStringsUsingEverySet([3, 3, 3], 2)).toBe(0n);
  });
});

describe("constrainedEntropyBits", () => {
  it("is slightly below the unconstrained entropy and approaches it as length grows", () => {
    const sizes = [24, 24, 8, 24];
    const total = 80;
    const short = constrainedEntropyBits(sizes, 8);
    const long = constrainedEntropyBits(sizes, 64);

    expect(short).toBeLessThan(uniformEntropyBits(total, 8));
    expect(uniformEntropyBits(total, 8) - short).toBeGreaterThan(0.5);
    expect(uniformEntropyBits(total, 64) - long).toBeLessThan(0.01);
  });

  it("rejects an impossible constraint", () => {
    expect(() => constrainedEntropyBits([3, 3, 3], 2)).toThrow(RangeError);
  });
});
