import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * Source-level tripwires for the privacy promises. They read the code as text, so they can be
 * fooled by deliberate obfuscation and they prove nothing about runtime behaviour. They exist to
 * make an accidental `console.log(password)`, `localStorage.setItem(...)` or a new tracker fail
 * the build. Runtime behaviour is covered by the component tests and the browser checks.
 */

const ROOT = process.cwd();
const SOURCE_DIRS = ["app", "components", "lib"];
const SKIPPED = [`lib${sep}wordlists${sep}`];

function listSources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return listSources(path);
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
}

const sources = SOURCE_DIRS.flatMap((dir) => listSources(join(ROOT, dir)))
  .map((path) => ({ file: relative(ROOT, path), code: stripComments(readFileSync(path, "utf8")) }))
  .filter(({ file }) => !SKIPPED.some((skipped) => file.includes(skipped)));

const FORBIDDEN: Array<[string, RegExp]> = [
  ["Math.random (insecure randomness)", /Math\s*\.\s*random/],
  ["localStorage", /\blocalStorage\s*[.[]/],
  ["sessionStorage", /\bsessionStorage\s*[.[]/],
  ["indexedDB", /\bindexedDB\s*\./],
  ["document.cookie", /\bdocument\s*\.\s*cookie/],
  ["server-side cookies", /\bcookies\s*\(/],
  ["console logging", /\bconsole\s*\./],
  ["navigator.sendBeacon", /sendBeacon/],
  ["XMLHttpRequest", /XMLHttpRequest/],
  ["WebSocket", /\bWebSocket\b/],
  ["EventSource", /\bEventSource\b/],
  ["history.pushState/replaceState", /\bhistory\s*\.\s*(push|replace)State/],
  ["router navigation (could put input in a URL)", /\brouter\s*\.\s*(push|replace)\b/],
  ["window.location", /\blocation\s*\.\s*(href|search|hash|assign|replace)/],
  ["raw HTML injection", /dangerouslySetInnerHTML|\.innerHTML\b/],
  ["eval", /\beval\s*\(|new\s+Function\s*\(/],
  [
    "analytics or tracking",
    /gtag|dataLayer|googletagmanager|plausible|posthog|mixpanel|sentry|hotjar|\bfbq\s*\(|amplitude|datadog|logrocket|fullstory/i
  ]
];

describe("source tripwires: forbidden APIs", () => {
  it("scans a meaningful number of files", () => {
    expect(sources.length).toBeGreaterThanOrEqual(10);
    expect(sources.map(({ file }) => file)).toContain(join("lib", "secure-random.ts"));
    expect(sources.map(({ file }) => file)).toContain(join("components", "password-generator.tsx"));
  });

  it.each(FORBIDDEN)("uses no %s", (_name, pattern) => {
    const offenders = sources.filter(({ code }) => pattern.test(code)).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});

describe("source tripwires: network access", () => {
  it("only the breach lookup and its proxy route reference fetch", () => {
    const files = sources.filter(({ code }) => /\bfetch\b/.test(code)).map(({ file }) => file);
    expect(files.sort()).toEqual([join("app", "api", "breach-check", "route.ts"), join("lib", "breach.ts")].sort());
  });

  it("the interface components never call the network or the hash function directly", () => {
    for (const { file, code } of sources.filter(({ file }) => file.startsWith("components"))) {
      expect(code, file).not.toMatch(/\bfetch\b|crypto\s*\.\s*subtle/);
    }
  });

  it("the only randomness primitive is crypto.getRandomValues, used in one module", () => {
    // A call, so interface copy that merely names the API does not count.
    const users = sources.filter(({ code }) => /getRandomValues\s*\(/.test(code)).map(({ file }) => file);
    expect(users).toEqual([join("lib", "secure-random.ts")]);
  });
});

describe("dependencies", () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    dependencies: Record<string, string>;
  };
  const runtime = Object.keys(manifest.dependencies);

  it("ships no analytics, telemetry or error-reporting packages", () => {
    const offenders = runtime.filter((name) =>
      /analytics|sentry|posthog|mixpanel|segment|gtag|hotjar|amplitude|datadog|logrocket|fullstory|telemetry|clarity/i.test(
        name
      )
    );
    expect(offenders).toEqual([]);
  });

  it("keeps the runtime dependency list small and known", () => {
    expect(runtime.sort()).toEqual(
      ["@zxcvbn-ts/core", "@zxcvbn-ts/language-common", "@zxcvbn-ts/language-en", "next", "react", "react-dom"].sort()
    );
  });
});

describe("security headers (next.config.mjs)", () => {
  async function headersFor(env: "production" | "development") {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", env);
    // @ts-expect-error -- next.config.mjs is plain JavaScript and ships no type declarations.
    const config = (await import("../next.config.mjs")).default as {
      headers: () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>>;
      poweredByHeader: boolean;
    };
    const [rule] = await config.headers();
    return {
      config,
      source: rule.source,
      byName: Object.fromEntries(rule.headers.map(({ key, value }) => [key, value]))
    };
  }

  it("restricts requests to the page's own origin and forbids framing, in production", async () => {
    const { byName, source } = await headersFor("production");
    const csp = byName["Content-Security-Policy"];

    expect(source).toBe("/(.*)");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toMatch(/connect-src 'self'(;|$)/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/\bws:|\bwss:|https?:\/\//);
  });

  it("only relaxes the policy for the development server", async () => {
    const { byName } = await headersFor("development");
    expect(byName["Content-Security-Policy"]).toContain("'unsafe-eval'");
    expect(byName["Content-Security-Policy"]).toMatch(/connect-src 'self' ws: wss:/);
  });

  it("sets the other hardening headers and hides the framework banner", async () => {
    const { byName, config } = await headersFor("production");

    expect(byName["Referrer-Policy"]).toBe("no-referrer");
    expect(byName["X-Content-Type-Options"]).toBe("nosniff");
    expect(byName["X-Frame-Options"]).toBe("DENY");
    expect(byName["Permissions-Policy"]).toMatch(/camera=\(\)/);
    expect(config.poweredByHeader).toBe(false);
  });
});
