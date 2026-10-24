import { constrainedEntropyBits, uniformEntropyBits } from "@/lib/entropy";
import { FillRandomValues, SecureRandomError, randomInt, webCryptoFill } from "@/lib/secure-random";
import { EFF_LARGE_WORDLIST } from "@/lib/wordlists/eff-large";

/* -------------------------------------------------------------------------- */
/* Shared configuration errors                                                 */
/* -------------------------------------------------------------------------- */

export type ConfigIssueCode =
  | "INVALID_LENGTH"
  | "NO_CHARACTER_SET"
  | "INVALID_WORD_COUNT"
  | "INVALID_SEPARATOR";

export type ConfigIssue = {
  code: ConfigIssueCode;
  /** Name of the option the message is about, so the UI can attach it to the right control. */
  field: string;
  message: string;
};

export class GeneratorConfigError extends Error {
  readonly issues: ConfigIssue[];

  constructor(issues: ConfigIssue[]) {
    super(issues.map((issue) => issue.message).join(" "));
    this.name = "GeneratorConfigError";
    this.issues = issues;
  }
}

/* -------------------------------------------------------------------------- */
/* Passwords                                                                   */
/* -------------------------------------------------------------------------- */

export const PASSWORD_LENGTH_MIN = 8;
export const PASSWORD_LENGTH_MAX = 128;
export const PASSWORD_LENGTH_DEFAULT = 20;

export const CHARACTER_SETS = {
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/|"
} as const;

export type CharacterSetName = keyof typeof CHARACTER_SETS;
const CHARACTER_SET_NAMES = Object.keys(CHARACTER_SETS) as CharacterSetName[];

/** Characters that are easy to confuse when read or typed by hand. */
export const AMBIGUOUS_CHARACTERS = "O0Il1|";

export type PasswordOptions = {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
  /** Redraw until the password contains at least one character from every enabled set. */
  requireEachSet: boolean;
};

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: PASSWORD_LENGTH_DEFAULT,
  lowercase: true,
  uppercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: true,
  requireEachSet: true
};

/**
 * Practically unreachable: in the worst case (length 8, all four sets, ambiguous characters
 * excluded) one attempt satisfies "every set is present" about 45% of the time, so 1000
 * failures in a row has probability around 10^-258. The cap only exists so a broken random
 * source cannot hang the page.
 */
const MAX_CONSTRAINT_ATTEMPTS = 1000;

function enabledSets(options: PasswordOptions): string[] {
  return CHARACTER_SET_NAMES.filter((name) => options[name] === true).map((name) =>
    options.excludeAmbiguous === true
      ? Array.from(CHARACTER_SETS[name])
          .filter((character) => !AMBIGUOUS_CHARACTERS.includes(character))
          .join("")
      : CHARACTER_SETS[name]
  );
}

export function validatePasswordOptions(options: PasswordOptions): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const { length } = options;

  if (
    typeof length !== "number" ||
    !Number.isInteger(length) ||
    length < PASSWORD_LENGTH_MIN ||
    length > PASSWORD_LENGTH_MAX
  ) {
    issues.push({
      code: "INVALID_LENGTH",
      field: "length",
      message: `Length must be a whole number from ${PASSWORD_LENGTH_MIN} to ${PASSWORD_LENGTH_MAX}.`
    });
  }

  if (enabledSets(options).length === 0) {
    issues.push({
      code: "NO_CHARACTER_SET",
      field: "characterSets",
      message: "Select at least one character type to generate a password."
    });
  }

  return issues;
}

function containsEverySet(candidate: string, sets: string[]): boolean {
  return sets.every((set) => Array.from(candidate).some((character) => set.includes(character)));
}

/**
 * Generates a password in which every character is drawn independently and uniformly from the
 * enabled alphabet using the CSPRNG. When `requireEachSet` is on, whole passwords are redrawn
 * until each enabled set appears, which keeps the result uniform over all valid passwords
 * (picking one character per set first and shuffling would not).
 *
 * @throws GeneratorConfigError when the options are invalid.
 */
export function generatePassword(
  options: PasswordOptions,
  fill: FillRandomValues = webCryptoFill
): string {
  const issues = validatePasswordOptions(options);
  if (issues.length > 0) {
    throw new GeneratorConfigError(issues);
  }

  const sets = enabledSets(options);
  const alphabet = sets.join("");

  for (let attempt = 0; attempt < MAX_CONSTRAINT_ATTEMPTS; attempt += 1) {
    let candidate = "";
    for (let index = 0; index < options.length; index += 1) {
      candidate += alphabet[randomInt(alphabet.length, fill)];
    }
    if (options.requireEachSet !== true || containsEverySet(candidate, sets)) {
      return candidate;
    }
  }

  throw new SecureRandomError("Could not satisfy the character-set requirement; refusing to continue.");
}

/** Entropy, in bits, of a password generated with these (valid) options. */
export function passwordEntropyBits(options: PasswordOptions): number {
  const issues = validatePasswordOptions(options);
  if (issues.length > 0) {
    throw new GeneratorConfigError(issues);
  }
  const sets = enabledSets(options);
  if (options.requireEachSet === true && sets.length > 1) {
    return constrainedEntropyBits(
      sets.map((set) => set.length),
      options.length
    );
  }
  return uniformEntropyBits(sets.join("").length, options.length);
}

/* -------------------------------------------------------------------------- */
/* Passphrases                                                                 */
/* -------------------------------------------------------------------------- */

export const PASSPHRASE_WORDS_MIN = 4;
export const PASSPHRASE_WORDS_MAX = 12;
/** Six words from a 7,776-word list is the long-standing Diceware recommendation (~77 bits). */
export const PASSPHRASE_WORDS_DEFAULT = 6;

export const PASSPHRASE_SEPARATORS = ["-", ".", "_", " "] as const;
export type PassphraseSeparator = (typeof PASSPHRASE_SEPARATORS)[number];

export type PassphraseOptions = {
  words: number;
  separator: PassphraseSeparator;
  /** Upper-case the first letter of each word. Cosmetic: adds no entropy. */
  capitalize: boolean;
  /** Append a random number from 0 to 99 (about 6.6 extra bits). */
  appendNumber: boolean;
};

export const DEFAULT_PASSPHRASE_OPTIONS: PassphraseOptions = {
  words: PASSPHRASE_WORDS_DEFAULT,
  separator: "-",
  capitalize: false,
  appendNumber: false
};

const APPENDED_NUMBER_RANGE = 100;

export function validatePassphraseOptions(options: PassphraseOptions): ConfigIssue[] {
  const issues: ConfigIssue[] = [];

  if (
    typeof options.words !== "number" ||
    !Number.isInteger(options.words) ||
    options.words < PASSPHRASE_WORDS_MIN ||
    options.words > PASSPHRASE_WORDS_MAX
  ) {
    issues.push({
      code: "INVALID_WORD_COUNT",
      field: "words",
      message: `Word count must be a whole number from ${PASSPHRASE_WORDS_MIN} to ${PASSPHRASE_WORDS_MAX}.`
    });
  }

  if (!PASSPHRASE_SEPARATORS.includes(options.separator)) {
    issues.push({
      code: "INVALID_SEPARATOR",
      field: "separator",
      message: "Choose one of the available separators."
    });
  }

  return issues;
}

type PassphraseDependencies = {
  wordlist?: readonly string[];
  fill?: FillRandomValues;
};

/**
 * Generates a passphrase by choosing each word independently and uniformly from the wordlist
 * (the EFF large list by default, 7,776 words, ~12.9 bits per word).
 *
 * @throws GeneratorConfigError when the options are invalid.
 */
export function generatePassphrase(
  options: PassphraseOptions,
  { wordlist = EFF_LARGE_WORDLIST, fill = webCryptoFill }: PassphraseDependencies = {}
): string {
  const issues = validatePassphraseOptions(options);
  if (issues.length > 0) {
    throw new GeneratorConfigError(issues);
  }

  const parts: string[] = [];
  for (let index = 0; index < options.words; index += 1) {
    const word = wordlist[randomInt(wordlist.length, fill)];
    parts.push(options.capitalize ? word.charAt(0).toUpperCase() + word.slice(1) : word);
  }
  if (options.appendNumber) {
    parts.push(String(randomInt(APPENDED_NUMBER_RANGE, fill)));
  }

  return parts.join(options.separator);
}

/** Entropy, in bits, of a passphrase generated with these (valid) options. */
export function passphraseEntropyBits(
  options: PassphraseOptions,
  wordlistSize: number = EFF_LARGE_WORDLIST.length
): number {
  const issues = validatePassphraseOptions(options);
  if (issues.length > 0) {
    throw new GeneratorConfigError(issues);
  }
  return (
    uniformEntropyBits(wordlistSize, options.words) +
    (options.appendNumber ? Math.log2(APPENDED_NUMBER_RANGE) : 0)
  );
}
