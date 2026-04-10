"use client";

import { useEffect, useState } from "react";
import { generatePassphrase, generatePassword } from "@/lib/password-generator";

type GeneratorState = {
  length: number;
  passphraseWords: number;
  passphraseMode: boolean;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
};

const initialState: GeneratorState = {
  length: 18,
  passphraseWords: 4,
  passphraseMode: false,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: true
};

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled = false
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
      aria-pressed={checked}
    >
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="mt-1 text-xs text-white/45">{description}</div>
      </div>
      <span className={`toggle ${checked ? "bg-accent/30" : ""}`}>
        <span className={`toggle-dot ${checked ? "translate-x-4 bg-accent" : ""}`} />
      </span>
    </button>
  );
}

export function PasswordGenerator() {
  const [options, setOptions] = useState(initialState);
  const [generated, setGenerated] = useState("");
  const [copied, setCopied] = useState(false);

  function toggleCharacterOption(key: "uppercase" | "lowercase" | "numbers" | "symbols") {
    setOptions((current) => {
      const enabledCount = [current.uppercase, current.lowercase, current.numbers, current.symbols].filter(Boolean)
        .length;

      if (current[key] && enabledCount === 1) {
        return current;
      }

      return { ...current, [key]: !current[key] };
    });
  }

  useEffect(() => {
    setGenerated(
      options.passphraseMode
        ? generatePassphrase(options.passphraseWords)
        : generatePassword(options)
    );
  }, [options]);

  async function copyToClipboard() {
    if (!generated) {
      return;
    }

    await navigator.clipboard.writeText(generated);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <section className="card p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-white/45">Generator</div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">Create a stronger credential</h2>
          <p className="mt-2 text-sm leading-6 text-white/65">
            Generate either a high-entropy password or a memorable passphrase.
          </p>
        </div>
      </div>

      <div className="relative mt-6 rounded-3xl border border-white/10 bg-black/40 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="break-all font-mono text-xl font-medium tracking-[0.02em] text-white sm:text-2xl">
          {generated || "Select options to generate."}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className="button-primary" onClick={() => setOptions({ ...options })}>
            Regenerate
          </button>
          <button type="button" className="button-secondary" onClick={copyToClipboard}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div
          aria-live="polite"
          className={`pointer-events-none absolute right-4 top-4 rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] transition-all duration-200 ${
            copied
              ? "translate-y-0 border-emerald-400/30 bg-emerald-400/10 text-emerald-200 opacity-100"
              : "-translate-y-1 border-transparent bg-transparent text-transparent opacity-0"
          }`}
        >
          Copied to clipboard
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <ToggleRow
          label="Passphrase mode"
          description="Switch from random characters to memorable multi-word phrases."
          checked={options.passphraseMode}
          onChange={() => setOptions((current) => ({ ...current, passphraseMode: !current.passphraseMode }))}
        />

        <label className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-white">
              {options.passphraseMode ? "Words" : "Length"}
            </span>
            <span className="text-sm text-white/55">
              {options.passphraseMode ? options.passphraseWords : options.length}
            </span>
          </div>
          <input
            aria-label={options.passphraseMode ? "Passphrase word count" : "Generated password length"}
            className="mt-4 w-full accent-sky-300"
            type="range"
            min={options.passphraseMode ? 3 : 10}
            max={options.passphraseMode ? 7 : 32}
            value={options.passphraseMode ? options.passphraseWords : options.length}
            onChange={(event) =>
              setOptions((current) =>
                current.passphraseMode
                  ? { ...current, passphraseWords: Number(event.target.value) }
                  : { ...current, length: Number(event.target.value) }
              )
            }
          />
        </label>

        <div className="grid gap-3">
          <ToggleRow
            label="Uppercase"
            description="Include capital letters."
            checked={options.uppercase}
            disabled={options.passphraseMode}
            onChange={() => toggleCharacterOption("uppercase")}
          />
          <ToggleRow
            label="Lowercase"
            description="Include lowercase letters."
            checked={options.lowercase}
            disabled={options.passphraseMode}
            onChange={() => toggleCharacterOption("lowercase")}
          />
          <ToggleRow
            label="Numbers"
            description="Include digits for extra variation."
            checked={options.numbers}
            disabled={options.passphraseMode}
            onChange={() => toggleCharacterOption("numbers")}
          />
          <ToggleRow
            label="Symbols"
            description="Include punctuation and special characters."
            checked={options.symbols}
            disabled={options.passphraseMode}
            onChange={() => toggleCharacterOption("symbols")}
          />
          <ToggleRow
            label="Exclude ambiguous"
            description="Avoid characters like O, 0, I, l, and 1."
            checked={options.excludeAmbiguous}
            disabled={options.passphraseMode}
            onChange={() =>
              setOptions((current) => ({ ...current, excludeAmbiguous: !current.excludeAmbiguous }))
            }
          />
        </div>
        {!options.passphraseMode && (
          <p className="text-xs uppercase tracking-[0.18em] text-white/35">
            At least one character set stays enabled for secure generation.
          </p>
        )}
      </div>
    </section>
  );
}
