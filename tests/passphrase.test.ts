import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PASSPHRASE_OPTIONS,
  GeneratorConfigError,
  PASSPHRASE_SEPARATORS,
  PASSPHRASE_WORDS_MAX,
  PASSPHRASE_WORDS_MIN,
  PassphraseOptions,
  generatePassphrase,
  passphraseEntropyBits
} from "@/lib/password-generator";
import { EFF_LARGE_WORDLIST } from "@/lib/wordlists/eff-large";

const SMALL_LIST = ["alpha", "bravo", "charlie", "delta", "echo"] as const;

function options(overrides: Partial<PassphraseOptions> = {}): PassphraseOptions {
  return { ...DEFAULT_PASSPHRASE_OPTIONS, ...overrides };
}

function replay(values: number[]) {
  let position = 0;
  return vi.fn((array: Uint32Array) => {
    array[0] = values[position];
    position += 1;
    return array;
  });
}

describe("generatePassphrase: construction", () => {
  it("joins uniformly chosen words with the separator", () => {
    const fill = replay([0, 1, 2, 3]);
    expect(generatePassphrase(options({ words: 4 }), { wordlist: SMALL_LIST, fill })).toBe(
      "alpha-bravo-charlie-delta"
    );
    expect(fill).toHaveBeenCalledTimes(4);
  });

  it.each(PASSPHRASE_SEPARATORS)("supports the separator %j", (separator) => {
    const fill = replay([4, 0, 4, 0]);
    expect(generatePassphrase(options({ words: 4, separator }), { wordlist: SMALL_LIST, fill })).toBe(
      ["echo", "alpha", "echo", "alpha"].join(separator)
    );
  });

  it("capitalizes each word without changing the draw", () => {
    const fill = replay([0, 1, 2, 3]);
    expect(
      generatePassphrase(options({ words: 4, capitalize: true }), { wordlist: SMALL_LIST, fill })
    ).toBe("Alpha-Bravo-Charlie-Delta");
  });

  it("appends a number from 0 to 99 drawn from the same CSPRNG", () => {
    const fill = replay([0, 1, 2, 3, 7]);
    expect(
      generatePassphrase(options({ words: 4, appendNumber: true }), { wordlist: SMALL_LIST, fill })
    ).toBe("alpha-bravo-charlie-delta-7");
    expect(fill).toHaveBeenCalledTimes(5);
  });

  it("draws word indexes with rejection sampling over the real list size", () => {
    // 7776 does not divide 2^32, so draws in the top (2^32 % 7776) values must be discarded.
    const remainder = 2 ** 32 % EFF_LARGE_WORDLIST.length;
    expect(remainder).toBeGreaterThan(0);
    const firstRejected = 2 ** 32 - remainder;
    const fill = replay([firstRejected, 5, 6, 7, 8]);
    const phrase = generatePassphrase(options({ words: 4, separator: " " }), { fill });

    expect(phrase.split(" ")).toEqual(
      [5, 6, 7, 8].map((index) => EFF_LARGE_WORDLIST[index % EFF_LARGE_WORDLIST.length])
    );
    expect(fill).toHaveBeenCalledTimes(5);
  });
});

describe("generatePassphrase: output with the real wordlist", () => {
  it.each(Array.from({ length: PASSPHRASE_WORDS_MAX - PASSPHRASE_WORDS_MIN + 1 }, (_, i) => PASSPHRASE_WORDS_MIN + i))(
    "contains exactly %i words, all from the EFF list",
    (words) => {
      const known = new Set(EFF_LARGE_WORDLIST);
      for (let sample = 0; sample < 100; sample += 1) {
        const phrase = generatePassphrase(options({ words, separator: " " }));
        const parts = phrase.split(" ");
        expect(parts).toHaveLength(words);
        for (const part of parts) expect(known.has(part)).toBe(true);
      }
    }
  );

  it("uses the Web Crypto API and never Math.random", () => {
    const getRandomValues = vi.spyOn(globalThis.crypto, "getRandomValues");
    const mathRandom = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not be used");
    });

    generatePassphrase(options({ words: 8, appendNumber: true }));

    expect(getRandomValues.mock.calls.length).toBeGreaterThanOrEqual(9);
    expect(mathRandom).not.toHaveBeenCalled();
  });

  it("picks every word of the list with equal probability (chi-square over 16 buckets)", () => {
    const bucketSize = EFF_LARGE_WORDLIST.length / 16;
    const bucketOf = new Map(EFF_LARGE_WORDLIST.map((word, index) => [word, Math.floor(index / bucketSize)]));
    const counts = new Array(16).fill(0);
    const draws = 80_000;

    for (let index = 0; index < draws / 8; index += 1) {
      for (const word of generatePassphrase(options({ words: 8, separator: " " })).split(" ")) {
        counts[bucketOf.get(word) as number] += 1;
      }
    }

    const expected = draws / 16;
    const chiSquare = counts.reduce((sum, observed) => sum + (observed - expected) ** 2 / expected, 0);
    // 15 degrees of freedom: 60 is far in the tail (p around 1e-7).
    expect(chiSquare).toBeLessThan(60);
  });
});

describe("generatePassphrase: configuration edge cases", () => {
  it("accepts the documented minimum and maximum word counts", () => {
    expect(generatePassphrase(options({ words: PASSPHRASE_WORDS_MIN, separator: " " })).split(" ")).toHaveLength(
      PASSPHRASE_WORDS_MIN
    );
    expect(generatePassphrase(options({ words: PASSPHRASE_WORDS_MAX, separator: " " })).split(" ")).toHaveLength(
      PASSPHRASE_WORDS_MAX
    );
  });

  it.each([
    ["too few", PASSPHRASE_WORDS_MIN - 1],
    ["too many", PASSPHRASE_WORDS_MAX + 1],
    ["zero", 0],
    ["negative", -4],
    ["fractional", 5.5],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY]
  ])("rejects a word count that is %s", (_name, words) => {
    expect(() => generatePassphrase(options({ words }))).toThrow(GeneratorConfigError);
  });

  it.each(["", "ab", "/", "\n"])("rejects the unsupported separator %j", (separator) => {
    const config = options({ separator: separator as PassphraseOptions["separator"] });
    expect(() => generatePassphrase(config)).toThrow(/separator/i);
  });

  it("does not consume randomness for an invalid configuration", () => {
    const spy = vi.spyOn(globalThis.crypto, "getRandomValues");
    expect(() => generatePassphrase(options({ words: 1 }))).toThrow(GeneratorConfigError);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("passphraseEntropyBits", () => {
  const BITS_PER_WORD = Math.log2(7776);

  it("is words * log2(7776), about 12.92 bits per word", () => {
    expect(BITS_PER_WORD).toBeCloseTo(12.925, 3);
    expect(passphraseEntropyBits(options({ words: 6 }))).toBeCloseTo(6 * BITS_PER_WORD, 10);
    expect(passphraseEntropyBits(options({ words: 6 }))).toBeGreaterThan(77);
  });

  it("credits an appended number with log2(100) bits and capitalization with none", () => {
    const base = passphraseEntropyBits(options({ words: 5 }));
    expect(passphraseEntropyBits(options({ words: 5, appendNumber: true }))).toBeCloseTo(base + Math.log2(100), 10);
    expect(passphraseEntropyBits(options({ words: 5, capitalize: true }))).toBe(base);
  });

  it("is far above the 20-word list the original generator used", () => {
    const original = Math.log2(20 ** 4 * 90);
    expect(original).toBeLessThan(24);
    expect(passphraseEntropyBits(options({ words: PASSPHRASE_WORDS_MIN }))).toBeGreaterThan(51);
  });

  it("refuses to describe an invalid configuration", () => {
    expect(() => passphraseEntropyBits(options({ words: 0 }))).toThrow(GeneratorConfigError);
  });
});

describe("EFF large wordlist integrity", () => {
  // SHA-256 of eff_large_wordlist.txt as downloaded from eff.org (see the module header).
  const ORIGINAL_SHA256 = "addd35536511597a02fa0a9ff1e5284677b8883b83e986e43f15a3db996b903e";

  it("has 7,776 words", () => {
    expect(EFF_LARGE_WORDLIST).toHaveLength(7776);
  });

  it("has no duplicates, blanks or whitespace", () => {
    expect(new Set(EFF_LARGE_WORDLIST).size).toBe(EFF_LARGE_WORDLIST.length);
    for (const word of EFF_LARGE_WORDLIST) {
      expect(word).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
    }
  });

  it("is frozen so it cannot be altered at runtime", () => {
    expect(Object.isFrozen(EFF_LARGE_WORDLIST)).toBe(true);
  });

  it("rebuilds to exactly the file EFF published (dice key + tab + word per line)", () => {
    const rebuilt = EFF_LARGE_WORDLIST.map((word, index) => {
      const key = index
        .toString(6)
        .padStart(5, "0")
        .replace(/\d/g, (digit) => String(Number(digit) + 1));
      return `${key}\t${word}\n`;
    }).join("");

    expect(createHash("sha256").update(rebuilt).digest("hex")).toBe(ORIGINAL_SHA256);
  });
});
