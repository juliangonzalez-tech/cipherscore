import type { ZxcvbnResult } from "@zxcvbn-ts/core";

/**
 * Password strength estimation with zxcvbn-ts (the maintained TypeScript successor of Dropbox's
 * zxcvbn, and the estimator OWASP's Authentication Cheat Sheet points to).
 *
 * What the numbers mean: zxcvbn does not measure "entropy". It models an attacker who tries
 * common passwords, dictionary words, names, keyboard walks, repeats, sequences, dates and l33t
 * substitutions, and returns the number of guesses that attacker would need for the cheapest
 * way to build this password. The 0-4 score is just that guess count bucketed
 * (<10^3, <10^6, <10^8, <10^10, otherwise). It cannot know what is in a private leaked list,
 * and it says nothing about how the password is stored. We deliberately do not turn the guess
 * count into a "time to crack": that would need an assumed attacker speed and hash function.
 */

export type StrengthScore = 0 | 1 | 2 | 3 | 4;

/** Wording describes guessability under the model; it does not promise security. */
export const SCORE_LABELS: Record<StrengthScore, string> = {
  0: "Very guessable",
  1: "Guessable",
  2: "Somewhat guessable",
  3: "Hard to guess",
  4: "Very hard to guess"
};

/**
 * Only this many characters are analyzed, so the estimate for longer input covers its first part.
 * That is a safe lower bound: adding characters does not make a password easier to guess.
 *
 * The cap bounds the main-thread cost. Measured on a laptop with repetitive, l33t-heavy input
 * (the slowest kind): about 1.2 s at 256 characters versus about 0.4-0.6 s at 100. Typical
 * passwords take 1-90 ms. NIST SP 800-63B-4 asks verifiers to accept at least 64 characters,
 * which this comfortably covers.
 */
export const ANALYSIS_MAX_LENGTH = 100;

/**
 * A deliberately narrow result: zxcvbn's own result object also carries the raw password and
 * the matched substrings, and none of that should leave this module.
 */
export type StrengthResult = {
  score: StrengthScore;
  label: string;
  /** log10 of the estimated number of guesses. */
  guessesLog10: number;
  warning: string | null;
  suggestions: string[];
  analyzedCharacters: number;
  truncated: boolean;
};

export type StrengthEstimator = (password: string) => StrengthResult;

export function toStrengthResult(raw: ZxcvbnResult, passwordLength: number): StrengthResult {
  return {
    score: raw.score,
    label: SCORE_LABELS[raw.score],
    guessesLog10: raw.guessesLog10,
    warning: raw.feedback.warning,
    suggestions: [...raw.feedback.suggestions],
    analyzedCharacters: Math.min(passwordLength, ANALYSIS_MAX_LENGTH),
    truncated: passwordLength > ANALYSIS_MAX_LENGTH
  };
}

let estimatorPromise: Promise<StrengthEstimator> | null = null;

/**
 * Loads zxcvbn-ts and its English and keyboard data on first use (a dynamic import keeps the
 * dictionaries out of the initial page load). Resolves to a synchronous, local estimator.
 */
export function loadStrengthEstimator(): Promise<StrengthEstimator> {
  if (!estimatorPromise) {
    estimatorPromise = Promise.all([
      import("@zxcvbn-ts/core"),
      import("@zxcvbn-ts/language-common"),
      import("@zxcvbn-ts/language-en")
    ])
      .then(([core, common, english]) => {
        const factory = new core.ZxcvbnFactory({
          translations: english.translations,
          graphs: common.adjacencyGraphs,
          dictionary: { ...common.dictionary, ...english.dictionary },
          // Fuzzy (Levenshtein) dictionary matching is left off, as in the library default: it
          // made short inputs 50-200x slower (about 0.2-0.7 s per estimate) for a modest gain.
          useLevenshteinDistance: false,
          maxLength: ANALYSIS_MAX_LENGTH
        });
        const estimator: StrengthEstimator = (password) =>
          toStrengthResult(factory.check(password), password.length);
        return estimator;
      })
      .catch((error: unknown) => {
        // Allow a retry (for example after a dropped connection while loading the chunk).
        estimatorPromise = null;
        throw error;
      });
  }
  return estimatorPromise;
}
