import { describe, expect, it, vi } from "vitest";
import {
  AMBIGUOUS_CHARACTERS,
  CHARACTER_SETS,
  CharacterSetName,
  DEFAULT_PASSWORD_OPTIONS,
  GeneratorConfigError,
  PASSWORD_LENGTH_MAX,
  PASSWORD_LENGTH_MIN,
  PasswordOptions,
  generatePassword,
  passwordEntropyBits,
  validatePasswordOptions
} from "@/lib/password-generator";
import { SecureRandomError } from "@/lib/secure-random";

const SET_NAMES = Object.keys(CHARACTER_SETS) as CharacterSetName[];

function options(overrides: Partial<PasswordOptions> = {}): PasswordOptions {
  return { ...DEFAULT_PASSWORD_OPTIONS, ...overrides };
}

/** Every non-empty combination of the four character sets. */
function setCombinations(): Partial<PasswordOptions>[] {
  const combinations: Partial<PasswordOptions>[] = [];
  for (let mask = 1; mask < 1 << SET_NAMES.length; mask += 1) {
    combinations.push(
      Object.fromEntries(SET_NAMES.map((name, index) => [name, Boolean(mask & (1 << index))]))
    );
  }
  return combinations;
}

function allowedCharacters(config: PasswordOptions): Set<string> {
  const allowed = new Set<string>();
  for (const name of SET_NAMES) {
    if (config[name]) {
      for (const character of CHARACTER_SETS[name]) allowed.add(character);
    }
  }
  if (config.excludeAmbiguous) {
    for (const character of AMBIGUOUS_CHARACTERS) allowed.delete(character);
  }
  return allowed;
}

function replay(values: number[]) {
  let position = 0;
  return vi.fn((array: Uint32Array) => {
    array[0] = values[position];
    position += 1;
    return array;
  });
}

describe("generatePassword: randomness API usage", () => {
  it("draws every character from crypto.getRandomValues", () => {
    const spy = vi.spyOn(globalThis.crypto, "getRandomValues");

    const password = generatePassword(options({ length: 24, requireEachSet: false }));

    expect(password).toHaveLength(24);
    // One draw per character. (A rejected draw would add more, which is astronomically rare.)
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(24);
    expect(spy.mock.calls.length).toBeLessThan(30);
  });

  it("maps random draws to alphabet positions in a fixed, documented order", () => {
    // Lowercase only, ambiguous excluded: 25 letters a-z without 'l'. Draws 0..7 pick a..h.
    const fill = replay([0, 1, 2, 3, 4, 5, 6, 7]);
    const config = options({
      length: 8,
      lowercase: true,
      uppercase: false,
      numbers: false,
      symbols: false,
      requireEachSet: false
    });
    expect(generatePassword(config, fill)).toBe("abcdefgh");

    // Index 11 is 'm' because 'l' is excluded as ambiguous.
    const skipsL = replay([10, 11, 10, 11, 10, 11, 10, 11]);
    expect(generatePassword(config, skipsL)).toBe("kmkmkmkm");
  });

  it("never calls Math.random", () => {
    const mathRandom = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not be used");
    });

    for (let index = 0; index < 200; index += 1) {
      generatePassword(options());
    }

    expect(mathRandom).not.toHaveBeenCalled();
  });

  it("throws instead of degrading when secure randomness is unavailable", () => {
    const mathRandom = vi.spyOn(Math, "random");
    vi.stubGlobal("crypto", undefined);

    expect(() => generatePassword(options())).toThrow(SecureRandomError);
    expect(mathRandom).not.toHaveBeenCalled();
  });
});

describe("generatePassword: output length", () => {
  it("produces exactly the requested number of characters for every allowed length", () => {
    const wrongLengths: number[] = [];
    for (let length = PASSWORD_LENGTH_MIN; length <= PASSWORD_LENGTH_MAX; length += 1) {
      for (let sample = 0; sample < 5; sample += 1) {
        if (generatePassword(options({ length })).length !== length) wrongLengths.push(length);
      }
    }
    expect(wrongLengths).toEqual([]);
  });

  it("supports the documented minimum and maximum with every setting combination", () => {
    for (const combination of setCombinations()) {
      for (const length of [PASSWORD_LENGTH_MIN, PASSWORD_LENGTH_MAX]) {
        expect(generatePassword(options({ ...combination, length }))).toHaveLength(length);
      }
    }
  });
});

describe("generatePassword: allowed characters", () => {
  it("only uses enabled character types, for every combination and flag setting", () => {
    for (const combination of setCombinations()) {
      for (const excludeAmbiguous of [true, false]) {
        for (const requireEachSet of [true, false]) {
          const config = options({ ...combination, excludeAmbiguous, requireEachSet });
          const allowed = allowedCharacters(config);

          const outsiders: string[] = [];
          for (let sample = 0; sample < 60; sample += 1) {
            const password = generatePassword({ ...config, length: 8 + (sample % 40) });
            outsiders.push(...Array.from(password).filter((character) => !allowed.has(character)));
          }
          expect(outsiders, JSON.stringify(config)).toEqual([]);
        }
      }
    }
  });

  it("includes at least one character of every enabled type when required", () => {
    for (const combination of setCombinations()) {
      const config = options({ ...combination, requireEachSet: true, length: PASSWORD_LENGTH_MIN });
      for (let sample = 0; sample < 100; sample += 1) {
        const password = generatePassword(config);
        for (const name of SET_NAMES) {
          if (config[name]) {
            const members = Array.from(CHARACTER_SETS[name]).filter(
              (character) => !AMBIGUOUS_CHARACTERS.includes(character)
            );
            expect(
              Array.from(password).some((character) => members.includes(character)),
              `${name} missing from ${password}`
            ).toBe(true);
          }
        }
      }
    }
  });

  it("never emits an ambiguous character when they are excluded", () => {
    const config = options({ length: PASSWORD_LENGTH_MAX, excludeAmbiguous: true });
    const ambiguousPattern = new RegExp(`[${AMBIGUOUS_CHARACTERS.replace(/[\]\\^-]/g, "\\$&")}]`);
    for (let sample = 0; sample < 300; sample += 1) {
      expect(generatePassword(config)).not.toMatch(ambiguousPattern);
    }
  });

  it("can emit ambiguous characters when they are allowed", () => {
    const config = options({
      length: PASSWORD_LENGTH_MAX,
      lowercase: false,
      uppercase: false,
      symbols: false,
      numbers: true,
      excludeAmbiguous: false,
      requireEachSet: false
    });
    const seen = new Set<string>();
    for (let sample = 0; sample < 50; sample += 1) {
      for (const character of generatePassword(config)) seen.add(character);
    }
    expect(seen.has("0")).toBe(true);
    expect(seen.has("1")).toBe(true);
  });

  // Regression: the original generator appended "O0Il1" to the pool whenever ambiguous
  // characters were allowed, even if uppercase, digits or the other sets were switched off.
  it("does not leak characters from disabled sets when ambiguous characters are allowed", () => {
    const lowercaseOnly = options({
      length: PASSWORD_LENGTH_MAX,
      lowercase: true,
      uppercase: false,
      numbers: false,
      symbols: false,
      excludeAmbiguous: false,
      requireEachSet: false
    });
    for (let sample = 0; sample < 300; sample += 1) {
      expect(generatePassword(lowercaseOnly)).toMatch(/^[a-z]+$/);
    }
  });
});

describe("generatePassword: distribution", () => {
  it("picks each character of the alphabet with equal probability (chi-square)", () => {
    const config = options({
      length: 100,
      lowercase: true,
      uppercase: false,
      numbers: false,
      symbols: false,
      requireEachSet: false
    });
    const alphabet = Array.from(CHARACTER_SETS.lowercase).filter(
      (character) => !AMBIGUOUS_CHARACTERS.includes(character)
    );
    const counts = new Map(alphabet.map((character) => [character, 0]));
    const passwords = 2000;

    for (let index = 0; index < passwords; index += 1) {
      for (const character of generatePassword(config)) {
        counts.set(character, (counts.get(character) ?? 0) + 1);
      }
    }

    const expected = (passwords * 100) / alphabet.length;
    const chiSquare = Array.from(counts.values()).reduce(
      (sum, observed) => sum + (observed - expected) ** 2 / expected,
      0
    );
    // 24 degrees of freedom (25 letters): 80 is far in the tail (p well below 1e-6).
    expect(chiSquare).toBeLessThan(80);
  });

  it("does not favour any position for a character type when each set is required", () => {
    const config = options({ length: 20, requireEachSet: true });
    const samples = 15_000;
    let digitsFirst = 0;
    let digitsLast = 0;

    for (let index = 0; index < samples; index += 1) {
      const password = generatePassword(config);
      if (/[0-9]/.test(password[0])) digitsFirst += 1;
      if (/[0-9]/.test(password[19])) digitsLast += 1;
    }

    // Both positions have the same distribution (about 11% digits); the difference of the two
    // proportions has a standard deviation of about 0.0037 here, so 0.02 is over 5 sd.
    expect(Math.abs(digitsFirst - digitsLast) / samples).toBeLessThan(0.02);
  });
});

describe("generatePassword: configuration edge cases", () => {
  it("accepts the default configuration", () => {
    expect(validatePasswordOptions(DEFAULT_PASSWORD_OPTIONS)).toEqual([]);
  });

  it.each([
    ["below the minimum", PASSWORD_LENGTH_MIN - 1],
    ["above the maximum", PASSWORD_LENGTH_MAX + 1],
    ["zero", 0],
    ["negative", -20],
    ["fractional", 12.5],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY]
  ])("rejects a length that is %s", (_name, length) => {
    const config = options({ length });

    expect(validatePasswordOptions(config).map((issue) => issue.code)).toEqual(["INVALID_LENGTH"]);
    expect(() => generatePassword(config)).toThrow(GeneratorConfigError);
  });

  it("rejects a non-numeric length passed through untyped code", () => {
    const config = options({ length: "20" as unknown as number });
    expect(() => generatePassword(config)).toThrow(GeneratorConfigError);
  });

  it("rejects a configuration with no character type selected", () => {
    const config = options({ lowercase: false, uppercase: false, numbers: false, symbols: false });

    expect(validatePasswordOptions(config).map((issue) => issue.code)).toEqual(["NO_CHARACTER_SET"]);
    expect(() => generatePassword(config)).toThrow(/at least one character type/i);
  });

  it("reports every problem at once, with the control each one belongs to", () => {
    const config = options({ length: 3, lowercase: false, uppercase: false, numbers: false, symbols: false });
    const error = (() => {
      try {
        generatePassword(config);
      } catch (caught) {
        return caught as GeneratorConfigError;
      }
      return null;
    })();

    expect(error).toBeInstanceOf(GeneratorConfigError);
    expect(error?.issues.map((issue) => issue.field).sort()).toEqual(["characterSets", "length"]);
  });

  it("does not produce output (or consume randomness) for an invalid configuration", () => {
    const spy = vi.spyOn(globalThis.crypto, "getRandomValues");

    expect(() => generatePassword(options({ length: 1 }))).toThrow(GeneratorConfigError);
    expect(spy).not.toHaveBeenCalled();
  });

  it("copes with a single enabled set at the minimum length even when the set is required", () => {
    const config = options({
      length: PASSWORD_LENGTH_MIN,
      lowercase: false,
      uppercase: false,
      symbols: false,
      numbers: true
    });
    expect(generatePassword(config)).toMatch(/^[2-9]{8}$/);
  });
});

describe("passwordEntropyBits", () => {
  it("equals length * log2(alphabet size) for a single set", () => {
    const config = options({
      length: 20,
      lowercase: true,
      uppercase: false,
      numbers: false,
      symbols: false,
      excludeAmbiguous: false
    });
    expect(passwordEntropyBits(config)).toBeCloseTo(20 * Math.log2(26), 10);
  });

  it("is a little below the unconstrained value when every set is required", () => {
    const required = passwordEntropyBits(options({ length: 20, requireEachSet: true }));
    const free = passwordEntropyBits(options({ length: 20, requireEachSet: false }));

    expect(required).toBeLessThan(free);
    expect(free - required).toBeLessThan(1);
  });

  it("grows with length and is about 6.3 bits per character for the default alphabet", () => {
    const short = passwordEntropyBits(options({ length: 16, requireEachSet: false }));
    const long = passwordEntropyBits(options({ length: 32, requireEachSet: false }));

    expect(long).toBeCloseTo(short * 2, 8);
    expect(short / 16).toBeGreaterThan(6.2);
    expect(short / 16).toBeLessThan(6.4);
  });

  it("refuses to describe an invalid configuration", () => {
    expect(() => passwordEntropyBits(options({ length: 2 }))).toThrow(GeneratorConfigError);
  });
});
