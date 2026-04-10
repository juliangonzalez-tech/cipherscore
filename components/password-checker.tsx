"use client";

import { useEffect, useMemo, useState } from "react";
import zxcvbn, { ZXCVBNResult } from "zxcvbn";

const strengthMeta = [
  { label: "Very weak", color: "bg-danger", text: "text-danger" },
  { label: "Weak", color: "bg-orange-400", text: "text-orange-300" },
  { label: "Fair", color: "bg-warning", text: "text-warning" },
  { label: "Strong", color: "bg-emerald-400", text: "text-emerald-300" },
  { label: "Excellent", color: "bg-success", text: "text-success" }
];

function getLocalFeedback(password: string, result: ZXCVBNResult, breached: boolean) {
  const warnings = new Set<string>();
  const suggestions = new Set<string>(result.feedback.suggestions);

  if (result.feedback.warning) {
    warnings.add(result.feedback.warning);
  }

  if (password.length > 0 && password.length < 12) {
    warnings.add("Too short for modern security expectations.");
  }

  for (const match of result.sequence) {
    if (match.pattern === "repeat") {
      warnings.add("Repeated characters or chunks make this easier to guess.");
    }
    if (match.pattern === "spatial") {
      warnings.add("Keyboard sequence detected.");
    }
    if (match.pattern === "sequence") {
      warnings.add("Predictable character sequence detected.");
    }
    if (match.pattern === "dictionary") {
      warnings.add("Common word or pattern detected.");
    }
  }

  if (!password.includes(" ") && password.length < 20) {
    suggestions.add("Consider a longer passphrase with unrelated words.");
  }

  if (breached) {
    warnings.add("Found in breach database.");
    suggestions.add("Replace it immediately and avoid reusing it anywhere else.");
  }

  if (!warnings.size && password.length > 0) {
    suggestions.add("Length matters most. Add a few more characters to increase resilience.");
  }

  return {
    warnings: Array.from(warnings),
    suggestions: Array.from(suggestions)
  };
}

async function sha1Hex(value: string) {
  const buffer = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export function PasswordChecker() {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [breachEnabled, setBreachEnabled] = useState(false);
  const [breachFound, setBreachFound] = useState<boolean | null>(null);
  const [breachLoading, setBreachLoading] = useState(false);
  const [breachError, setBreachError] = useState("");

  const result = useMemo(() => zxcvbn(password), [password]);
  const scoreMeta = strengthMeta[result.score];
  const feedback = useMemo(
    () => getLocalFeedback(password, result, breachFound === true),
    [password, result, breachFound]
  );

  useEffect(() => {
    setBreachFound(null);
    setBreachError("");
    if (!password) {
      setVisible(false);
      setBreachEnabled(false);
    }
  }, [password]);

  async function runBreachCheck() {
    if (!password) {
      return;
    }

    try {
      setBreachLoading(true);
      setBreachError("");

      const hash = await sha1Hex(password);
      const prefix = hash.slice(0, 5);
      const suffix = hash.slice(5);
      const response = await fetch(`/api/breach-check?prefix=${prefix}`);
      const payload = (await response.json()) as { matches?: string; error?: string };

      if (!response.ok || !payload.matches) {
        throw new Error(payload.error || "Unable to check breach status.");
      }

      const found = payload.matches
        .split("\n")
        .some((line) => line.split(":")[0]?.trim().toUpperCase() === suffix);

      setBreachFound(found);
    } catch (error) {
      setBreachError(error instanceof Error ? error.message : "Unable to check breach status.");
      setBreachFound(null);
    } finally {
      setBreachLoading(false);
    }
  }

  return (
    <section className="card p-6 sm:p-7">
      <div className="flex flex-col gap-3">
        <div className="text-xs uppercase tracking-[0.24em] text-white/45">Checker</div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">Measure strength realistically</h2>
          <p className="mt-2 text-sm leading-6 text-white/65">
            Local browser analysis powered by zxcvbn, with optional breach awareness.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <label htmlFor="password" className="mb-2 block text-sm font-medium text-white">
          Password or passphrase
        </label>
        <div className="flex gap-3">
          <input
            id="password"
            aria-describedby="password-privacy-note"
            className="field"
            type={visible ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Type a password to analyze locally"
            autoComplete="off"
            spellCheck={false}
          />
          {password ? (
            <button
              type="button"
              className="button-secondary min-w-24"
              onClick={() => setVisible((current) => !current)}
              aria-label={visible ? "Hide password" : "Show password"}
            >
              {visible ? "Hide" : "Show"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-6" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className={`text-sm font-medium ${password ? scoreMeta.text : "text-white/60"}`}>
              {password ? scoreMeta.label : "Enter a password to begin a private local analysis."}
            </div>
            <div className="mt-1 text-sm text-white/55">
              Score {password ? `${result.score + 1}/5` : "0/5"}
            </div>
          </div>
          <div className="text-right text-sm text-white/55">
            <div>Estimated crack time</div>
            <div className="mt-1 font-medium text-white">
              {password ? result.crack_times_display.offline_slow_hashing_1e4_per_second : "N/A"}
            </div>
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all duration-500 ${scoreMeta.color}`}
            style={{ width: `${password ? ((result.score + 1) / 5) * 100 : 0}%` }}
          />
        </div>
      </div>

      {password ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-sm font-medium text-white">Warnings</div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-white/65">
              {feedback.warnings.length ? (
                feedback.warnings.map((warning) => <li key={warning}>• {warning}</li>)
              ) : (
                <li>• No major red flags detected in the current input.</li>
              )}
            </ul>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-sm font-medium text-white">Suggestions</div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-white/65">
              {feedback.suggestions.length ? (
                feedback.suggestions.map((suggestion) => <li key={suggestion}>• {suggestion}</li>)
              ) : (
                <li>• This input is in a healthier range. More length still helps.</li>
              )}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-white">Optional breach check</div>
            <p className="mt-1 text-sm text-white/55">
              Uses k-anonymity with a SHA-1 prefix. The raw password is never sent.
            </p>
          </div>
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              setBreachEnabled(true);
              void runBreachCheck();
            }}
            disabled={!password || breachLoading}
          >
            {breachLoading ? "Checking..." : "Check breach status"}
          </button>
        </div>

        {breachEnabled && (
          <div
            className={`mt-4 rounded-2xl border px-3 py-3 text-sm ${
              breachError
                ? "border-danger/30 bg-danger/10 text-rose-200"
                : breachLoading
                  ? "border-white/10 bg-white/[0.04] text-white/70"
                  : breachFound === true
                    ? "border-danger/30 bg-danger/10 text-rose-200"
                    : breachFound === false
                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                      : "border-white/10 bg-white/[0.04] text-white/70"
            }`}
          >
            {breachError
              ? breachError
              : breachLoading
                ? "Checking the hashed prefix against the breach dataset..."
                : breachFound === true
                  ? "Compromised: this password appears in known breach data."
                  : breachFound === false
                    ? "No breach match found in the queried hash range."
                    : "Run a privacy-preserving breach check when you want the extra signal."}
          </div>
        )}
      </div>

      <p id="password-privacy-note" className="mt-5 text-xs uppercase tracking-[0.18em] text-white/40">
        Local analysis only. No storage. No analytics. No raw-password upload for scoring.
      </p>
    </section>
  );
}
