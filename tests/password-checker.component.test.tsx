// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PasswordChecker } from "@/components/password-checker";
import { installPrivacyProbe } from "./helpers/privacy-probe";

// Well-known SHA-1 test vector: SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
const PREFIX = "5BAA6";
const SUFFIX = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";

beforeEach(() => {
  // jsdom provides getRandomValues but not crypto.subtle, which the breach check needs.
  vi.stubGlobal("crypto", webcrypto);
});

afterEach(cleanup);

function field() {
  return screen.getByLabelText(/password or passphrase/i) as HTMLInputElement;
}

function type(value: string) {
  fireEvent.change(field(), { target: { value } });
}

async function meter() {
  return screen.findByRole("meter", { name: /password strength/i }, { timeout: 5000 });
}

function breachButton() {
  return screen.getByRole("button", { name: /check breach status|checking/i }) as HTMLButtonElement;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("PasswordChecker: strength feedback", () => {
  it("starts empty with an explanation instead of a score", () => {
    render(<PasswordChecker />);

    expect(screen.getByText(/enter a password to see an estimate/i)).toBeTruthy();
    expect(screen.queryByRole("meter")).toBeNull();
    expect(breachButton().disabled).toBe(true);
  });

  it("rates a top-10 password as very guessable and explains why", async () => {
    render(<PasswordChecker />);
    type("password");

    const strength = await meter();
    expect(strength.getAttribute("aria-valuenow")).toBe("0");
    expect(strength.getAttribute("aria-valuemin")).toBe("0");
    expect(strength.getAttribute("aria-valuemax")).toBe("4");
    expect(strength.getAttribute("aria-valuetext")).toMatch(/very guessable, score 0 of 4/i);
    expect(screen.getByText(/zxcvbn score 0 of 4/i)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Warnings" }).parentElement?.textContent).toMatch(
      /heavily used password/i
    );
  });

  it("rates a long random password at the top of the scale", async () => {
    render(<PasswordChecker />);
    type("tZ7#kQ9!vL2@mX5&Rw8nB");

    expect((await meter()).getAttribute("aria-valuenow")).toBe("4");
    expect(screen.getByText(/about 10/i).textContent).toMatch(/about 10\d+\.\d/);
  });

  it("does not present a cracking time or a 1-to-5 score", async () => {
    render(<PasswordChecker />);
    type("tZ7#kQ9!vL2@mX5&Rw8nB");
    await meter();

    expect(screen.queryByText(/estimated crack time/i)).toBeNull();
    expect(screen.queryByText(/\d+\s*\/\s*5/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/\b(centuries|years|months|days|hours)\b.*to crack/i);
    // The explanation says plainly why no time is given.
    expect(screen.getByText(/no .time to crack. is shown on purpose/i)).toBeTruthy();
  });

  it("reminds the user of NIST's 15-character minimum for short passwords only", async () => {
    render(<PasswordChecker />);

    type("Sh0rt!pw");
    await meter();
    expect(screen.getAllByText(/at least 15 characters/i).length).toBeGreaterThan(0);

    type("a-much-longer-unusual-phrase-zq");
    await waitFor(() => expect(screen.queryByText(/at least 15 characters/i)).toBeNull(), { timeout: 5000 });
  });

  it("says when only the first part of a very long input was analyzed", async () => {
    render(<PasswordChecker />);
    type("tZ7#kQ9!".repeat(20));

    await meter();
    expect(screen.getByText(/only the first 100 characters were analyzed/i)).toBeTruthy();
  });

  it("toggles password visibility with an accurate label", () => {
    render(<PasswordChecker />);
    expect(field().type).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(field().type).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(field().type).toBe("password");
  });

  it("does not echo the password anywhere in the rendered page", async () => {
    render(<PasswordChecker />);
    const secret = "hunter2-xyzzy-plugh";
    type(secret);
    await meter();

    expect(document.body.textContent).not.toContain(secret);
    expect(document.body.textContent).not.toContain("xyzzy");
  });
});

describe("PasswordChecker: privacy", () => {
  it("makes no network request and stores or logs nothing while analyzing", async () => {
    const probe = installPrivacyProbe();
    render(<PasswordChecker />);

    type("correct-horse-battery-staple-7");
    await meter();
    type("another-secret-value-!9");
    await waitFor(() => expect(screen.getByRole("meter")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));

    probe.expectNoSideEffects();
  });

  it("sends nothing until the breach check is requested, then only the 5-character prefix", async () => {
    const probe = installPrivacyProbe();
    probe.fetchSpy.mockImplementation(async () => jsonResponse({ matches: `AAAA:0\r\n${SUFFIX}:3730471` }));
    render(<PasswordChecker />);

    type("password");
    await meter();
    expect(probe.fetchSpy).not.toHaveBeenCalled();

    fireEvent.click(breachButton());
    expect(await screen.findByText(/3,730,471 times/)).toBeTruthy();

    expect(probe.fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = probe.fetchSpy.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(url).toBe(`/api/breach-check?prefix=${PREFIX}`);
    expect(Object.keys(init)).toEqual(["signal"]);
    const sent = JSON.stringify([url, Object.keys(init)]).toUpperCase();
    expect(sent).not.toContain("PASSWORD");
    expect(sent).not.toContain(SUFFIX);
    probe.expectNoSideEffects({ allowFetch: true });
  });

  it("reports a password that is not in the breach list without overclaiming", async () => {
    const probe = installPrivacyProbe();
    probe.fetchSpy.mockImplementation(async () => jsonResponse({ matches: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:2" }));
    render(<PasswordChecker />);

    type("tZ7#kQ9!vL2@mX5&Rw8nB");
    await meter();
    fireEvent.click(breachButton());

    const message = await screen.findByText(/not found in the breach list/i);
    expect(message.textContent).toMatch(/does not prove the password is strong/i);
  });

  it("shows service failures in an alert and offers no false verdict", async () => {
    const probe = installPrivacyProbe();
    probe.fetchSpy.mockImplementation(async () => jsonResponse({ error: "The breach service is unavailable." }, 502));
    render(<PasswordChecker />);

    type("password");
    await meter();
    fireEvent.click(breachButton());

    expect((await screen.findByRole("alert")).textContent).toBe("The breach service is unavailable.");
    expect(screen.queryByText(/times in leaked data/i)).toBeNull();
    expect(breachButton().disabled).toBe(false);
  });

  it("explains a network failure without exposing internals", async () => {
    const probe = installPrivacyProbe();
    probe.fetchSpy.mockImplementation(async () => {
      throw new TypeError("NetworkError ECONNREFUSED 127.0.0.1:3000");
    });
    render(<PasswordChecker />);

    type("password");
    await meter();
    fireEvent.click(breachButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/could not reach the breach check service/i);
    expect(alert.textContent).not.toMatch(/ECONNREFUSED|127\.0\.0\.1/);
  });

  it("discards a late breach answer after the password was edited", async () => {
    const probe = installPrivacyProbe();
    let answer!: (response: Response) => void;
    probe.fetchSpy.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        })
    );
    render(<PasswordChecker />);

    type("password");
    await meter();
    fireEvent.click(breachButton());
    await waitFor(() => expect(probe.fetchSpy).toHaveBeenCalledTimes(1));
    expect(breachButton().textContent).toMatch(/checking/i);
    const requestSignal = (probe.fetchSpy.mock.calls[0] as unknown as [string, { signal: AbortSignal }])[1].signal;

    type("password-edited-meanwhile");
    expect(requestSignal.aborted).toBe(true);
    await act(async () => {
      answer(jsonResponse({ matches: `${SUFFIX}:3730471` }));
      await Promise.resolve();
    });

    expect(screen.queryByText(/times in leaked data/i)).toBeNull();
    expect(breachButton().textContent).toMatch(/check breach status/i);
    expect(breachButton().disabled).toBe(false);
  });

  it("clears a previous breach verdict when the password changes", async () => {
    const probe = installPrivacyProbe();
    probe.fetchSpy.mockImplementation(async () => jsonResponse({ matches: `${SUFFIX}:12` }));
    render(<PasswordChecker />);

    type("password");
    await meter();
    fireEvent.click(breachButton());
    await screen.findByText(/12 times in leaked data/);

    type("password1");
    expect(screen.queryByText(/times in leaked data/i)).toBeNull();
  });
});
