import { PasswordChecker } from "@/components/password-checker";
import { PasswordGenerator } from "@/components/password-generator";
import { SectionShell } from "@/components/section-shell";

const howItWorks = [
  {
    title: "Local-first analysis",
    text: "CipherScore uses zxcvbn in the browser to estimate real-world resistance against common attack patterns."
  },
  {
    title: "Actionable feedback",
    text: "It flags weak patterns like repeats, sequences, common phrases, and short passwords, then suggests stronger alternatives."
  },
  {
    title: "Optional breach awareness",
    text: "If you choose, the app can query the Pwned Passwords range API using only a SHA-1 prefix, not your raw password."
  }
];

const privacyItems = [
  "Local strength analysis happens entirely in your browser.",
  "The raw password is never stored.",
  "The raw password is never sent for the local strength meter.",
  "Breach checks are optional and only send the first 5 SHA-1 hash characters."
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-6 pb-16 pt-8 sm:px-8 lg:px-10 lg:pt-10">
        <div className="card relative overflow-hidden px-6 py-8 sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute inset-0 bg-mesh opacity-80" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/65">
                Privacy-first password intelligence
              </div>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                CipherScore helps people build stronger passwords without giving their secrets away.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
                A sleek local-first checker and generator designed to feel like a real security product, not a classroom demo.
              </p>
            </div>
            <div className="grid max-w-md grid-cols-2 gap-3 text-sm text-white/75 sm:grid-cols-3 lg:min-w-[320px]">
              <div className="card animate-float px-4 py-4">
                <div className="text-xl font-semibold text-white">Local</div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">Analysis</div>
              </div>
              <div className="card animate-float px-4 py-4 [animation-delay:1.2s]">
                <div className="text-xl font-semibold text-white">Optional</div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">Breach check</div>
              </div>
              <div className="card animate-float px-4 py-4 [animation-delay:2.4s] col-span-2 sm:col-span-1">
                <div className="text-xl font-semibold text-white">Fast</div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">Responsive UI</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <PasswordChecker />
          <PasswordGenerator />
        </div>

        <SectionShell
          eyebrow="Privacy"
          title="Built to reduce exposure, not create more of it."
          description="CipherScore is intentionally simple: no accounts, no tracking, no ads, and no database."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {privacyItems.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-white/75"
              >
                {item}
              </div>
            ))}
          </div>
        </SectionShell>

        <SectionShell
          eyebrow="How It Works"
          title="Security-focused logic with a portfolio-ready presentation."
          description="Everything in the MVP is centered on realistic scoring, usable coaching, and clear explanations."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {howItWorks.map((item) => (
              <div key={item.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <h2 className="text-lg font-medium text-white">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-white/65">{item.text}</p>
              </div>
            ))}
          </div>
        </SectionShell>

        <footer className="border-t border-white/10 pt-6 text-sm text-white/45">
          CipherScore MVP. Local-first password coaching for modern security habits.
        </footer>
      </section>
    </main>
  );
}
