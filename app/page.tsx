import { PasswordChecker } from "@/components/password-checker";
import { PasswordGenerator } from "@/components/password-generator";
import { SectionShell } from "@/components/section-shell";

const howItWorks = [
  {
    title: "Local-first analysis",
    text: "zxcvbn-ts runs in your browser and estimates how many guesses an attacker who knows common passwords, words and patterns would need. It does not print a crack time, because that depends on hardware and hashing it cannot know."
  },
  {
    title: "Unbiased secure generation",
    text: "Every character or word is chosen with crypto.getRandomValues and rejection sampling, so no value is more likely than another. Passphrases draw from the 7,776-word EFF large wordlist."
  },
  {
    title: "Optional breach awareness",
    text: "Only if you press the button, the first 5 characters of the password's SHA-1 hash go through this app's server to the Pwned Passwords range API. The password and the rest of the hash stay in your browser."
  }
];

const privacyItems = [
  "Strength analysis and password generation happen entirely in your browser.",
  "Nothing you type or generate is stored: no cookies, localStorage, sessionStorage, IndexedDB or database.",
  "Nothing is logged, and there are no analytics, ads or trackers.",
  "The breach check is opt-in. A Content-Security-Policy limits this page to requests to its own origin."
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 pb-16 pt-8 sm:px-8 lg:px-10 lg:pt-10">
        <div className="card relative overflow-hidden px-6 py-8 sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute inset-0 bg-mesh opacity-80" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/70">
                Privacy-first password tools
              </div>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                CipherScore helps people build stronger passwords without giving their secrets away.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 sm:text-base">
                A local-first password checker and generator. Strength is estimated with zxcvbn-ts, passwords come from
                the browser&rsquo;s secure random number generator, and passphrases from the EFF wordlist.
              </p>
            </div>
            <div className="grid max-w-md grid-cols-2 gap-3 text-sm text-white/75 sm:grid-cols-3 lg:min-w-[320px]">
              <div className="card animate-float px-4 py-4 motion-reduce:animate-none">
                <div className="text-xl font-semibold text-white">Local</div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/65">Analysis</div>
              </div>
              <div className="card animate-float px-4 py-4 [animation-delay:1.2s] motion-reduce:animate-none">
                <div className="text-xl font-semibold text-white">Optional</div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/65">Breach check</div>
              </div>
              <div className="card animate-float col-span-2 px-4 py-4 [animation-delay:2.4s] motion-reduce:animate-none sm:col-span-1">
                <div className="text-xl font-semibold text-white">None</div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/65">Stored or tracked</div>
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
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-white/80"
              >
                {item}
              </div>
            ))}
          </div>
        </SectionShell>

        <SectionShell
          eyebrow="How It Works"
          title="Security-focused logic with a portfolio-ready presentation."
          description="Estimates are labelled as estimates, randomness comes from the platform CSPRNG, and the limits are stated."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {howItWorks.map((item) => (
              <div key={item.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="text-lg font-medium text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/75">{item.text}</p>
              </div>
            ))}
          </div>
        </SectionShell>

        <footer className="border-t border-white/10 pt-6 text-sm leading-6 text-white/65">
          <p>CipherScore. Local-first password coaching, following NIST SP 800-63B-4 and OWASP guidance.</p>
          <p className="mt-1">
            Passphrases use the{" "}
            <a
              className="underline decoration-white/40 underline-offset-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              href="https://www.eff.org/dice"
              target="_blank"
              rel="noopener noreferrer"
            >
              EFF Large Wordlist
            </a>{" "}
            by the Electronic Frontier Foundation, licensed{" "}
            <a
              className="underline decoration-white/40 underline-offset-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              href="https://creativecommons.org/licenses/by/3.0/us/"
              target="_blank"
              rel="noopener noreferrer"
            >
              CC BY 3.0 US
            </a>
            .
          </p>
        </footer>
      </section>
    </main>
  );
}
