"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { BreachCheckError, BreachResult, checkBreach } from "@/lib/breach";
import { lengthAdvice } from "@/lib/guidance";
import {
  ANALYSIS_MAX_LENGTH,
  StrengthEstimator,
  StrengthResult,
  StrengthScore,
  loadStrengthEstimator
} from "@/lib/strength";

/** Wait for a pause in typing before analyzing, so long input never janks the text field. */
const ANALYSIS_DEBOUNCE_MS = 250;

const SCORE_STYLES: Record<StrengthScore, { bar: string; text: string }> = {
  0: { bar: "bg-danger", text: "text-rose-300" },
  1: { bar: "bg-orange-400", text: "text-orange-300" },
  2: { bar: "bg-warning", text: "text-amber-300" },
  3: { bar: "bg-emerald-400", text: "text-emerald-300" },
  4: { bar: "bg-success", text: "text-emerald-300" }
};

type BreachState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "done"; result: BreachResult }
  | { status: "error"; message: string };

function buildFeedback(password: string, result: StrengthResult | null, breach: BreachState) {
  const warnings = new Set<string>();
  const suggestions = new Set<string>();

  if (breach.status === "done" && breach.result.breached) {
    warnings.add("This password appears in known data breaches. Attackers try leaked passwords first.");
    suggestions.add("Stop using it everywhere and choose a new one that is not reused.");
  }
  if (result?.warning) {
    warnings.add(result.warning);
  }
  const advice = lengthAdvice(password.length);
  if (advice) {
    warnings.add(advice);
  }
  result?.suggestions.forEach((suggestion) => suggestions.add(suggestion));
  if (result && result.score < 4) {
    suggestions.add("A passphrase of several random, unrelated words is easy to remember and hard to guess.");
  }

  return { warnings: Array.from(warnings), suggestions: Array.from(suggestions) };
}

export function PasswordChecker() {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);

  const [estimator, setEstimator] = useState<StrengthEstimator | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [result, setResult] = useState<StrengthResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [breach, setBreach] = useState<BreachState>({ status: "idle" });
  const breachRequest = useRef<AbortController | null>(null);

  const inputId = useId();
  const noteId = useId();

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    loadStrengthEstimator().then(
      (loaded) => {
        if (!cancelled) setEstimator(() => loaded);
      },
      () => {
        if (!cancelled) setLoadFailed(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  useEffect(() => {
    if (!password) {
      setResult(null);
      setAnalyzing(false);
      return;
    }
    if (!estimator) {
      return;
    }
    setAnalyzing(true);
    const timer = window.setTimeout(() => {
      setResult(estimator(password));
      setAnalyzing(false);
    }, ANALYSIS_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [password, estimator]);

  // Any edit invalidates a breach result, and cancels a lookup that is still running.
  useEffect(() => {
    breachRequest.current?.abort();
    breachRequest.current = null;
    setBreach({ status: "idle" });
  }, [password]);

  useEffect(() => () => breachRequest.current?.abort(), []);

  async function runBreachCheck() {
    if (!password) return;

    breachRequest.current?.abort();
    const controller = new AbortController();
    breachRequest.current = controller;
    setBreach({ status: "checking" });

    try {
      const outcome = await checkBreach(password, { signal: controller.signal });
      if (!controller.signal.aborted) setBreach({ status: "done", result: outcome });
    } catch (error) {
      if (controller.signal.aborted) return;
      setBreach({
        status: "error",
        message: error instanceof BreachCheckError ? error.message : "Unable to check breach status."
      });
    }
  }

  const feedback = useMemo(() => buildFeedback(password, result, breach), [password, result, breach]);
  const style = result ? SCORE_STYLES[result.score] : null;
  const meterWidth = result ? Math.max(6, (result.score / 4) * 100) : 0;
  const breached = breach.status === "done" && breach.result.breached;

  return (
    <section className="card p-6 sm:p-7" aria-labelledby="checker-heading">
      <div className="text-xs uppercase tracking-[0.24em] text-white/60">Checker</div>
      <h2 id="checker-heading" className="mt-3 text-2xl font-semibold tracking-tight text-white">
        Estimate how guessable a password is
      </h2>
      <p className="mt-2 text-sm leading-6 text-white/70">
        Analysis runs in this browser tab with zxcvbn-ts. Your password is not sent, stored or logged.
      </p>

      <div className="mt-6">
        <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-white">
          Password or passphrase
        </label>
        <div className="flex gap-3">
          <input
            id={inputId}
            aria-describedby={noteId}
            className="field"
            type={visible ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Type or paste a password to analyze"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="button-secondary min-w-24"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {loadFailed && (
        <div role="alert" className="mt-4 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-rose-100">
          <p>The strength estimator could not be loaded, so no analysis is available.</p>
          <button type="button" className="button-secondary mt-3" onClick={() => setLoadAttempt((n) => n + 1)}>
            Try again
          </button>
        </div>
      )}

      <p role="status" className="sr-only">
        {result && !analyzing ? `${result.label}. Score ${result.score} of 4.` : ""}
      </p>

      <div className="mt-6" aria-busy={analyzing}>
        {result && style ? (
          <div className={analyzing ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className={`text-lg font-semibold ${style.text}`}>{result.label}</div>
                <div className="mt-1 text-sm text-white/70">zxcvbn score {result.score} of 4</div>
              </div>
              <div className="text-right text-sm text-white/70">
                <div>Guesses needed, by zxcvbn&rsquo;s model</div>
                <div className="mt-1 font-medium text-white">
                  about 10<sup>{result.guessesLog10.toFixed(1)}</sup>
                </div>
              </div>
            </div>
            <div
              role="meter"
              aria-label="Password strength"
              aria-valuemin={0}
              aria-valuemax={4}
              aria-valuenow={result.score}
              aria-valuetext={`${result.label}, score ${result.score} of 4`}
              className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"
            >
              <div
                className={`h-full rounded-full transition-all duration-500 motion-reduce:transition-none ${style.bar}`}
                style={{ width: `${meterWidth}%` }}
              />
            </div>
            {result.truncated && (
              <p className="mt-3 text-xs text-white/70">
                Only the first {ANALYSIS_MAX_LENGTH} characters were analyzed. Extra length cannot make a password
                easier to guess.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-white/70">
            {password && !loadFailed
              ? "Analyzing…"
              : "Enter a password to see an estimate. Nothing you type leaves this page."}
          </p>
        )}
      </div>

      {password && result ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-sm font-medium text-white">Warnings</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-white/75">
              {feedback.warnings.length ? (
                feedback.warnings.map((warning) => <li key={warning}>• {warning}</li>)
              ) : (
                <li>• No specific weaknesses found. That is an estimate, not a guarantee.</li>
              )}
            </ul>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-sm font-medium text-white">Suggestions</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-white/75">
              {feedback.suggestions.length ? (
                feedback.suggestions.map((suggestion) => <li key={suggestion}>• {suggestion}</li>)
              ) : (
                <li>• Use a unique password for every account, ideally from a password manager.</li>
              )}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-medium text-white">Optional breach check</h3>
            <p className="mt-1 text-sm leading-6 text-white/70">
              Looks the password up in the Have I Been Pwned Pwned Passwords list. Only the first 5 characters of its
              SHA-1 hash are sent (k-anonymity), never the password. Nothing happens until you press the button.
            </p>
          </div>
          <button
            type="button"
            className="button-secondary shrink-0"
            onClick={() => void runBreachCheck()}
            disabled={!password || breach.status === "checking"}
          >
            {breach.status === "checking" ? "Checking…" : "Check breach status"}
          </button>
        </div>

        <div aria-live="polite" className="empty:hidden">
          {breach.status === "checking" && (
            <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white/80">
              Checking the hash prefix against the breach list…
            </p>
          )}
          {breach.status === "done" && (
            <p
              className={`mt-4 rounded-2xl border px-3 py-3 text-sm ${
                breached
                  ? "border-danger/40 bg-danger/10 text-rose-100"
                  : "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
              }`}
            >
              {breached
                ? `Found in breaches: this password appears ${breach.result.count.toLocaleString("en-US")} times in leaked data. Do not use it.`
                : "Not found in the breach list. That only means it is not a known leaked password; it does not prove the password is strong."}
            </p>
          )}
        </div>
        {breach.status === "error" && (
          <p role="alert" className="mt-4 rounded-2xl border border-danger/40 bg-danger/10 px-3 py-3 text-sm text-rose-100">
            {breach.message}
          </p>
        )}
      </div>

      <details className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-white/75">
        <summary className="cursor-pointer rounded-lg font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60">
          How to read this estimate
        </summary>
        <ul className="mt-3 space-y-2">
          <li>
            • zxcvbn models an attacker who guesses common passwords, dictionary words, names, keyboard patterns,
            repeats, sequences, dates and letter substitutions like &ldquo;@&rdquo; for &ldquo;a&rdquo;. The score
            buckets its guess estimate: under 10<sup>3</sup>, 10<sup>6</sup>, 10<sup>8</sup>, 10<sup>10</sup>, or more.
          </li>
          <li>
            • It is an estimate. It cannot see private leaked lists, and a high score does not mean a site stores your
            password safely.
          </li>
          <li>
            • No &ldquo;time to crack&rdquo; is shown on purpose: it would depend on an attacker&rsquo;s hardware and on
            how the site hashes passwords, neither of which this page can know.
          </li>
          <li>
            • Following NIST SP 800-63B-4 and OWASP, length counts for more than mixing character types, and a unique
            password per account matters more than any score.
          </li>
        </ul>
      </details>

      <p id={noteId} className="mt-5 text-xs leading-5 text-white/65">
        Local analysis only. Nothing is stored. No analytics or tracking. The only network request this page can make
        with your input is the optional breach check described above.
      </p>
    </section>
  );
}
