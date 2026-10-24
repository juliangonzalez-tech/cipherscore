import { describe, expect, it, vi } from "vitest";
import { SecureRandomError, randomInt } from "@/lib/secure-random";

const TWO_32 = 2 ** 32;

/** A fake random source that replays the given 32-bit values (and records how often it ran). */
function replay(values: number[]) {
  let position = 0;
  return vi.fn((array: Uint32Array) => {
    array[0] = values[position];
    position += 1;
    return array;
  });
}

describe("randomInt: randomness API usage", () => {
  it("draws from crypto.getRandomValues with a Uint32Array", () => {
    const spy = vi.spyOn(globalThis.crypto, "getRandomValues");

    randomInt(10);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBeInstanceOf(Uint32Array);
  });

  it("never touches Math.random", () => {
    const mathRandom = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not be used for security-sensitive choices");
    });

    for (let index = 0; index < 1000; index += 1) {
      randomInt(94);
    }

    expect(mathRandom).not.toHaveBeenCalled();
  });

  it("fails closed instead of falling back to Math.random when Web Crypto is missing", () => {
    const mathRandom = vi.spyOn(Math, "random");
    vi.stubGlobal("crypto", undefined);

    expect(() => randomInt(10)).toThrow(SecureRandomError);
    expect(mathRandom).not.toHaveBeenCalled();
  });

  it("fails closed when getRandomValues is not a function", () => {
    vi.stubGlobal("crypto", {});

    expect(() => randomInt(10)).toThrow(SecureRandomError);
  });
});

describe("randomInt: input validation", () => {
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, TWO_32 + 1, Number.MAX_SAFE_INTEGER])(
    "rejects an invalid upper bound (%s)",
    (bad) => {
      expect(() => randomInt(bad)).toThrow(RangeError);
    }
  );

  it("returns 0 for a range of one without consuming randomness", () => {
    const fill = replay([]);
    expect(randomInt(1, fill)).toBe(0);
    expect(fill).not.toHaveBeenCalled();
  });

  it("accepts the full 32-bit range with no rejection", () => {
    const fill = replay([TWO_32 - 1]);
    expect(randomInt(TWO_32, fill)).toBe(TWO_32 - 1);
    expect(fill).toHaveBeenCalledTimes(1);
  });

  it("stays within [0, max) for real random output", () => {
    for (let index = 0; index < 5000; index += 1) {
      const value = randomInt(7);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
    }
  });
});

describe("randomInt: rejection sampling removes modulo bias", () => {
  it("rejects the draw at the boundary and uses the next one (max = 3)", () => {
    // 2^32 % 3 === 1, so only 2^32 - 1 (= 4294967295) lies in the biased tail.
    const fill = replay([TWO_32 - 1, 7]);
    expect(randomInt(3, fill)).toBe(1); // 7 % 3, taken from the second draw
    expect(fill).toHaveBeenCalledTimes(2);
  });

  it("accepts the last value below the boundary (max = 3)", () => {
    const fill = replay([TWO_32 - 2]);
    expect(randomInt(3, fill)).toBe(2);
    expect(fill).toHaveBeenCalledTimes(1);
  });

  it("handles the worst case, max = 2^31 + 1, where about half of all draws are rejected", () => {
    const max = 2 ** 31 + 1;
    // Accepted range is [0, 2^31 + 1); 2^31 + 1 itself is the first rejected value.
    expect(randomInt(max, replay([2 ** 31]))).toBe(2 ** 31);
    const fill = replay([2 ** 31 + 1, TWO_32 - 1, 5]);
    expect(randomInt(max, fill)).toBe(5);
    expect(fill).toHaveBeenCalledTimes(3);
  });

  // The sizes used by the app: 7,776 words, the password alphabets, the appended number.
  it.each([3, 5, 6, 7, 10, 24, 25, 26, 62, 80, 81, 94, 100, 7776, 2 ** 31 + 1, TWO_32 - 1])(
    "has an exact accepted range that is a multiple of max (max = %s)",
    (max) => {
      const remainder = TWO_32 % max;
      if (remainder === 0) {
        // Nothing can be biased; the last possible draw is accepted.
        const fill = replay([TWO_32 - 1]);
        expect(randomInt(max, fill)).toBe((TWO_32 - 1) % max);
        expect(fill).toHaveBeenCalledTimes(1);
        return;
      }

      const firstRejected = TWO_32 - remainder;
      // The last accepted value maps to the last residue, the first rejected one is redrawn.
      expect(randomInt(max, replay([firstRejected - 1]))).toBe(max - 1);
      const fill = replay([firstRejected, 0]);
      expect(randomInt(max, fill)).toBe(0);
      expect(fill).toHaveBeenCalledTimes(2);
    }
  );

  it("gives up instead of looping forever on a broken source", () => {
    const stuck = vi.fn((array: Uint32Array) => {
      array[0] = TWO_32 - 1; // always in the rejected tail for max = 3
      return array;
    });

    expect(() => randomInt(3, stuck)).toThrow(SecureRandomError);
    expect(stuck.mock.calls.length).toBeLessThan(2000);
  });

  it("is statistically uniform for real random output (chi-square, 6 outcomes)", () => {
    const draws = 120_000;
    const counts = new Array(6).fill(0);
    for (let index = 0; index < draws; index += 1) {
      counts[randomInt(6)] += 1;
    }
    const expected = draws / 6;
    const chiSquare = counts.reduce((sum, observed) => sum + (observed - expected) ** 2 / expected, 0);

    // 5 degrees of freedom: 40 corresponds to a p-value around 1e-7, so a healthy source
    // essentially never fails while a visibly skewed one does.
    expect(chiSquare).toBeLessThan(40);
  });
});
