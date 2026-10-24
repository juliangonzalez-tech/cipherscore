"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { lengthAdvice } from "@/lib/guidance";
import {
  DEFAULT_PASSPHRASE_OPTIONS,
  DEFAULT_PASSWORD_OPTIONS,
  PASSPHRASE_SEPARATORS,
  PASSPHRASE_WORDS_MAX,
  PASSPHRASE_WORDS_MIN,
  PASSWORD_LENGTH_MAX,
  PASSWORD_LENGTH_MIN,
  PassphraseOptions,
  PassphraseSeparator,
  PasswordOptions,
  generatePassphrase,
  generatePassword,
  passphraseEntropyBits,
  passwordEntropyBits,
  validatePassphraseOptions,
  validatePasswordOptions
} from "@/lib/password-generator";

type Mode = "password" | "passphrase";
type CopyState = "idle" | "copied" | "failed";
type PasswordFlags = Omit<PasswordOptions, "length">;

const SEPARATOR_LABELS: Record<PassphraseSeparator, string> = {
  "-": "Hyphen ( - )",
  ".": "Period ( . )",
  "_": "Underscore ( _ )",
  " ": "Space"
};

const { length: DEFAULT_LENGTH, ...DEFAULT_FLAGS } = DEFAULT_PASSWORD_OPTIONS;

function SwitchRow({
  label,
  description,
  checked,
  onChange
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.06]"
    >
      <span>
        <span className="block text-sm font-medium text-white">{label}</span>
        <span id={`${id}-description`} className="mt-1 block text-xs text-white/70">
          {description}
        </span>
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        aria-describedby={`${id}-description`}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden="true"
        className="toggle shrink-0 peer-checked:bg-accent/30 peer-checked:[&>span]:translate-x-4 peer-checked:[&>span]:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/60"
      >
        <span className="toggle-dot" />
      </span>
    </label>
  );
}

function ModeOption({
  value,
  label,
  mode,
  onSelect
}: {
  value: Mode;
  label: string;
  mode: Mode;
  onSelect: (mode: Mode) => void;
}) {
  return (
    <label className="flex-1 cursor-pointer">
      <input
        type="radio"
        name="generator-mode"
        value={value}
        className="peer sr-only"
        checked={mode === value}
        onChange={() => onSelect(value)}
      />
      <span className="flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-white/70 transition peer-checked:bg-white/10 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-accent/60">
        {label}
      </span>
    </label>
  );
}

export function PasswordGenerator() {
  const [mode, setMode] = useState<Mode>("password");
  const [flags, setFlags] = useState<PasswordFlags>(DEFAULT_FLAGS);
  // Kept as text so a half-typed or invalid length can be shown and explained, not silently fixed.
  const [lengthText, setLengthText] = useState(String(DEFAULT_LENGTH));
  const [passphrase, setPassphrase] = useState<PassphraseOptions>(DEFAULT_PASSPHRASE_OPTIONS);

  const [generated, setGenerated] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [regenerations, setRegenerations] = useState(0);
  const [revealed, setRevealed] = useState(true);
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const outputRef = useRef<HTMLOutputElement>(null);
  const copyTimer = useRef<number | undefined>(undefined);
  const ids = { length: useId(), words: useId(), separator: useId(), error: useId(), output: useId() };

  const passwordOptions = useMemo<PasswordOptions>(
    () => ({ ...flags, length: lengthText.trim() === "" ? Number.NaN : Number(lengthText) }),
    [flags, lengthText]
  );

  const issues = useMemo(
    () => (mode === "password" ? validatePasswordOptions(passwordOptions) : validatePassphraseOptions(passphrase)),
    [mode, passwordOptions, passphrase]
  );

  useEffect(() => {
    setGenerationError("");
    if (issues.length > 0) {
      setGenerated("");
      return;
    }
    try {
      setGenerated(mode === "password" ? generatePassword(passwordOptions) : generatePassphrase(passphrase));
    } catch {
      setGenerated("");
      setGenerationError(
        "This browser cannot provide secure random numbers, so nothing was generated. Try a current version of a major browser."
      );
    }
  }, [mode, issues, passwordOptions, passphrase, regenerations]);

  // A new value has not been copied yet.
  useEffect(() => {
    setCopyState("idle");
  }, [generated]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const entropyBits = useMemo(() => {
    if (!generated || issues.length > 0) return null;
    return mode === "password" ? passwordEntropyBits(passwordOptions) : passphraseEntropyBits(passphrase);
  }, [generated, issues, mode, passwordOptions, passphrase]);

  const lengthIssue = issues.some((issue) => issue.field === "length");
  const setsIssue = issues.some((issue) => issue.field === "characterSets");
  const noun = mode === "password" ? "password" : "passphrase";
  const sliderLength = Number.isFinite(passwordOptions.length)
    ? Math.min(PASSWORD_LENGTH_MAX, Math.max(PASSWORD_LENGTH_MIN, Math.round(passwordOptions.length)))
    : DEFAULT_LENGTH;
  const shortNote = mode === "password" && !lengthIssue ? lengthAdvice(passwordOptions.length) : null;

  // When copying fails the text is revealed and selected (after the reveal has rendered) so the
  // user can copy it by hand.
  useEffect(() => {
    if (copyState !== "failed") return;
    const node = outputRef.current;
    const selection = window.getSelection();
    if (!node || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  }, [copyState]);

  async function copyToClipboard() {
    if (!generated) return;
    window.clearTimeout(copyTimer.current);
    try {
      await navigator.clipboard.writeText(generated);
      setCopyState("copied");
      copyTimer.current = window.setTimeout(() => setCopyState("idle"), 3000);
    } catch {
      // Clipboard access can be denied or missing (for example on plain http).
      setRevealed(true);
      setCopyState("failed");
    }
  }

  function setFlag(key: keyof PasswordFlags, value: boolean) {
    setFlags((current) => ({ ...current, [key]: value }));
  }

  const shown = generated ? (revealed ? generated : "•".repeat(generated.length)) : "";

  return (
    <section className="card p-6 sm:p-7" aria-labelledby="generator-heading">
      <div className="text-xs uppercase tracking-[0.24em] text-white/60">Generator</div>
      <h2 id="generator-heading" className="mt-3 text-2xl font-semibold tracking-tight text-white">
        Create a stronger credential
      </h2>
      <p className="mt-2 text-sm leading-6 text-white/70">
        Random passwords and multiword passphrases, generated in your browser with a cryptographically secure random
        number generator. Nothing is sent or stored.
      </p>

      <div className="mt-6 rounded-3xl border border-white/10 bg-black/40 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <span id={`${ids.output}-label`} className="text-xs uppercase tracking-[0.18em] text-white/60">
            Generated {noun}
          </span>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-xs font-medium text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-40"
            onClick={() => setRevealed((current) => !current)}
            disabled={!generated}
          >
            {revealed ? "Hide" : "Show"}
            <span className="sr-only"> generated {noun}</span>
          </button>
        </div>

        <output
          ref={outputRef}
          tabIndex={0}
          aria-live="off"
          aria-labelledby={`${ids.output}-label`}
          className={`mt-3 block min-h-[3.5rem] font-mono text-xl font-medium tracking-[0.02em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 sm:text-2xl ${
            mode === "password" ? "break-all" : "break-words"
          }`}
        >
          {shown || <span className="font-sans text-base font-normal text-white/60">Nothing to show yet.</span>}
        </output>

        {entropyBits !== null && (
          <p className="mt-3 text-xs leading-5 text-white/70">
            <span className="font-medium text-white">{entropyBits.toFixed(1)} bits of entropy</span> in the way this{" "}
            {noun} was generated, for someone who knows your settings. This describes the generator, not how a site
            stores your {noun}.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="button-primary"
            onClick={() => setRegenerations((count) => count + 1)}
            disabled={issues.length > 0}
          >
            Generate new {noun}
          </button>
          <button type="button" className="button-secondary" onClick={copyToClipboard} disabled={!generated}>
            {copyState === "copied" ? "Copied" : "Copy"}
            <span className="sr-only"> {noun} to clipboard</span>
          </button>
          <p role="status" className="text-sm text-emerald-300">
            {copyState === "copied" ? `The ${noun} was copied to your clipboard.` : ""}
          </p>
        </div>

        {copyState === "failed" && (
          <p role="alert" className="mt-3 rounded-2xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-amber-100">
            Your browser blocked clipboard access. The {noun} is selected: press Ctrl+C (or Cmd+C) to copy it.
          </p>
        )}
      </div>

      {(issues.length > 0 || generationError) && (
        <div
          id={ids.error}
          role="alert"
          className="mt-4 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-rose-100"
        >
          {generationError ? (
            <p>{generationError}</p>
          ) : (
            <ul className="space-y-1">
              {issues.map((issue) => (
                <li key={issue.code}>{issue.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-6 space-y-4">
        <fieldset>
          <legend className="sr-only">Generator type</legend>
          <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
            <ModeOption value="password" label="Password" mode={mode} onSelect={setMode} />
            <ModeOption value="passphrase" label="Passphrase" mode={mode} onSelect={setMode} />
          </div>
        </fieldset>

        {mode === "password" ? (
          <>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-4">
                <label htmlFor={ids.length} className="text-sm font-medium text-white">
                  Length
                </label>
                <input
                  id={ids.length}
                  type="number"
                  inputMode="numeric"
                  min={PASSWORD_LENGTH_MIN}
                  max={PASSWORD_LENGTH_MAX}
                  step={1}
                  value={lengthText}
                  onChange={(event) => setLengthText(event.target.value)}
                  aria-invalid={lengthIssue}
                  aria-describedby={lengthIssue ? ids.error : `${ids.length}-hint`}
                  className="field !w-24 !py-2 text-center"
                />
              </div>
              <input
                type="range"
                aria-label="Password length slider"
                className="mt-4 w-full accent-sky-300"
                min={PASSWORD_LENGTH_MIN}
                max={PASSWORD_LENGTH_MAX}
                value={sliderLength}
                onChange={(event) => setLengthText(event.target.value)}
              />
              <p id={`${ids.length}-hint`} className="mt-2 text-xs text-white/70">
                {PASSWORD_LENGTH_MIN} to {PASSWORD_LENGTH_MAX} characters. Length matters more than complexity.
              </p>
              {shortNote && (
                <p className="mt-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs leading-5 text-amber-100">
                  {shortNote}
                </p>
              )}
            </div>

            <fieldset aria-describedby={setsIssue ? ids.error : undefined}>
              <legend className="mb-2 text-sm font-medium text-white">Character types</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <SwitchRow
                  label="Lowercase"
                  description="a–z"
                  checked={flags.lowercase}
                  onChange={(value) => setFlag("lowercase", value)}
                />
                <SwitchRow
                  label="Uppercase"
                  description="A–Z"
                  checked={flags.uppercase}
                  onChange={(value) => setFlag("uppercase", value)}
                />
                <SwitchRow
                  label="Numbers"
                  description="0–9"
                  checked={flags.numbers}
                  onChange={(value) => setFlag("numbers", value)}
                />
                <SwitchRow
                  label="Symbols"
                  description="! @ # $ % ^ & * ( ) - _ = + …"
                  checked={flags.symbols}
                  onChange={(value) => setFlag("symbols", value)}
                />
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-white">Options</legend>
              <div className="grid gap-3">
                <SwitchRow
                  label="Avoid look-alike characters"
                  description="Leaves out O, 0, I, l, 1 and | so the password is easier to read and type."
                  checked={flags.excludeAmbiguous}
                  onChange={(value) => setFlag("excludeAmbiguous", value)}
                />
                <SwitchRow
                  label="Include every selected type"
                  description="Some sites demand at least one of each. Turn off for the largest pool of possible passwords."
                  checked={flags.requireEachSet}
                  onChange={(value) => setFlag("requireEachSet", value)}
                />
              </div>
            </fieldset>
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-4">
                <label htmlFor={ids.words} className="text-sm font-medium text-white">
                  Words
                </label>
                <span className="text-sm text-white/70" aria-hidden="true">
                  {passphrase.words}
                </span>
              </div>
              <input
                id={ids.words}
                type="range"
                className="mt-4 w-full accent-sky-300"
                min={PASSPHRASE_WORDS_MIN}
                max={PASSPHRASE_WORDS_MAX}
                value={passphrase.words}
                aria-describedby={`${ids.words}-hint`}
                onChange={(event) => setPassphrase((current) => ({ ...current, words: Number(event.target.value) }))}
              />
              <p id={`${ids.words}-hint`} className="mt-2 text-xs text-white/70">
                {PASSPHRASE_WORDS_MIN} to {PASSPHRASE_WORDS_MAX} words from the EFF large wordlist (7,776 words, about
                12.9 bits each). Six or more is recommended.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <label htmlFor={ids.separator} className="block text-sm font-medium text-white">
                Separator
              </label>
              <select
                id={ids.separator}
                className="field mt-3"
                value={passphrase.separator}
                onChange={(event) =>
                  setPassphrase((current) => ({
                    ...current,
                    separator: event.target.value as PassphraseSeparator
                  }))
                }
              >
                {PASSPHRASE_SEPARATORS.map((separator) => (
                  <option key={separator} value={separator}>
                    {SEPARATOR_LABELS[separator]}
                  </option>
                ))}
              </select>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-white">Options</legend>
              <div className="grid gap-3">
                <SwitchRow
                  label="Capitalize each word"
                  description="Helps with sites that require a capital letter. Adds no strength."
                  checked={passphrase.capitalize}
                  onChange={(value) => setPassphrase((current) => ({ ...current, capitalize: value }))}
                />
                <SwitchRow
                  label="Add a number"
                  description="Appends a random number from 0 to 99 (about 6.6 extra bits)."
                  checked={passphrase.appendNumber}
                  onChange={(value) => setPassphrase((current) => ({ ...current, appendNumber: value }))}
                />
              </div>
            </fieldset>
          </>
        )}
      </div>
    </section>
  );
}
