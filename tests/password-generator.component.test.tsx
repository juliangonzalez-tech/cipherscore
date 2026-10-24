// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PasswordGenerator } from "@/components/password-generator";
import { EFF_LARGE_WORDLIST } from "@/lib/wordlists/eff-large";
import { installPrivacyProbe } from "./helpers/privacy-probe";

afterEach(cleanup);

/** The element that displays the generated value (its label changes with the mode). */
function output(): HTMLElement {
  return screen.getByLabelText(/^generated (password|passphrase)$/i);
}

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

function lengthInput() {
  return screen.getByRole("spinbutton", { name: /length/i }) as HTMLInputElement;
}

describe("PasswordGenerator: defaults", () => {
  it("generates a 20-character password containing every character type on first render", () => {
    render(<PasswordGenerator />);

    const password = output().textContent ?? "";
    expect(password).toHaveLength(20);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[2-9]/);
    expect(password).toMatch(/[^A-Za-z0-9]/);
    expect(password).not.toMatch(/[O0Il1|]/);
  });

  it("shows the entropy of the generation process, not a claim about the site", () => {
    render(<PasswordGenerator />);
    expect(screen.getByText(/bits of entropy/i).textContent).toMatch(/12\d\.\d bits of entropy/);
    expect(screen.getByText(/describes the generator, not how a site stores/i)).toBeTruthy();
  });

  it("generates a new value when asked", () => {
    render(<PasswordGenerator />);
    const first = output().textContent;

    fireEvent.click(screen.getByRole("button", { name: /generate new password/i }));

    expect(output().textContent).not.toBe(first);
    expect(output().textContent).toHaveLength(20);
  });
});

describe("PasswordGenerator: configuration", () => {
  it("honours a new length from the number field", () => {
    render(<PasswordGenerator />);

    fireEvent.change(lengthInput(), { target: { value: "32" } });

    expect(output().textContent).toHaveLength(32);
  });

  it("keeps the slider and the number field in sync", () => {
    render(<PasswordGenerator />);

    fireEvent.change(screen.getByRole("slider", { name: /length/i }), { target: { value: "45" } });

    expect(lengthInput().value).toBe("45");
    expect(output().textContent).toHaveLength(45);
  });

  it("respects switched-off character types", () => {
    render(<PasswordGenerator />);
    for (const name of [/uppercase/i, /numbers/i, /symbols/i]) {
      fireEvent.click(screen.getByRole("switch", { name }));
    }

    for (let attempt = 0; attempt < 20; attempt += 1) {
      fireEvent.click(screen.getByRole("button", { name: /generate new password/i }));
      expect(output().textContent).toMatch(/^[a-z]{20}$/);
    }
  });

  it("explains an out-of-range length in an alert and generates nothing", () => {
    render(<PasswordGenerator />);

    fireEvent.change(lengthInput(), { target: { value: "5" } });

    expect(screen.getByRole("alert").textContent).toMatch(/length must be a whole number from 8 to 128/i);
    expect(lengthInput().getAttribute("aria-invalid")).toBe("true");
    expect(lengthInput().getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
    expect(output().textContent).toBe("Nothing to show yet.");
    expect((screen.getByRole("button", { name: /copy/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /generate new/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["", "abc", "12.5", "-4", "129"])("rejects the length %j with an alert", (value) => {
    render(<PasswordGenerator />);

    fireEvent.change(lengthInput(), { target: { value } });

    expect(screen.getByRole("alert").textContent).toMatch(/length must be/i);
    expect(output().textContent).toBe("Nothing to show yet.");
  });

  it("recovers as soon as the length is valid again", () => {
    render(<PasswordGenerator />);
    fireEvent.change(lengthInput(), { target: { value: "5" } });
    fireEvent.change(lengthInput(), { target: { value: "16" } });

    expect(screen.queryByRole("alert")).toBeNull();
    expect(output().textContent).toHaveLength(16);
  });

  it("tells the user when no character type is selected instead of silently ignoring the click", () => {
    render(<PasswordGenerator />);
    for (const name of [/lowercase/i, /uppercase/i, /numbers/i, /symbols/i]) {
      fireEvent.click(screen.getByRole("switch", { name }));
    }

    expect(screen.getByRole("alert").textContent).toMatch(/select at least one character type/i);
    expect(output().textContent).toBe("Nothing to show yet.");

    fireEvent.click(screen.getByRole("switch", { name: /numbers/i }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(output().textContent).toMatch(/^[2-9]{20}$/);
  });

  it("reminds the user of NIST's 15-character minimum for shorter passwords", () => {
    render(<PasswordGenerator />);

    fireEvent.change(lengthInput(), { target: { value: "12" } });
    expect(screen.getByText(/at least 15 characters/i)).toBeTruthy();

    fireEvent.change(lengthInput(), { target: { value: "15" } });
    expect(screen.queryByText(/at least 15 characters/i)).toBeNull();
  });
});

describe("PasswordGenerator: passphrase mode", () => {
  it("switches to a six-word EFF passphrase", () => {
    render(<PasswordGenerator />);

    fireEvent.click(screen.getByRole("radio", { name: "Passphrase" }));
    fireEvent.change(screen.getByLabelText(/separator/i), { target: { value: " " } });

    const words = (output().textContent ?? "").split(" ");
    expect(words).toHaveLength(6);
    const known = new Set(EFF_LARGE_WORDLIST);
    for (const word of words) expect(known.has(word)).toBe(true);
    expect(output().getAttribute("aria-labelledby")).toBeTruthy();
    expect(screen.getByText(/77\.5 bits of entropy/)).toBeTruthy();
  });

  it("supports word count, capitalization and an appended number", () => {
    render(<PasswordGenerator />);
    fireEvent.click(screen.getByRole("radio", { name: "Passphrase" }));
    fireEvent.change(screen.getByLabelText(/separator/i), { target: { value: " " } });
    fireEvent.change(screen.getByLabelText(/^words$/i), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("switch", { name: /capitalize/i }));
    fireEvent.click(screen.getByRole("switch", { name: /add a number/i }));

    const parts = (output().textContent ?? "").split(" ");
    expect(parts).toHaveLength(9);
    for (const word of parts.slice(0, 8)) expect(word).toMatch(/^[A-Z]/);
    expect(parts[8]).toMatch(/^\d{1,2}$/);
    expect(screen.getByText(/110\.0 bits of entropy/)).toBeTruthy();
  });

  it("goes back to passwords", () => {
    render(<PasswordGenerator />);
    fireEvent.click(screen.getByRole("radio", { name: "Passphrase" }));
    fireEvent.click(screen.getByRole("radio", { name: "Password" }));

    expect(output().textContent).toHaveLength(20);
  });
});

describe("PasswordGenerator: copy and reveal", () => {
  it("copies exactly the displayed value and announces it", async () => {
    const writeText = vi.fn(async () => undefined);
    stubClipboard(writeText);
    render(<PasswordGenerator />);
    const shown = output().textContent;

    fireEvent.click(screen.getByRole("button", { name: /copy password to clipboard/i }));

    // (<output> also has an implicit "status" role, so look the announcement up by its text.)
    expect(await screen.findByText(/the password was copied to your clipboard/i)).toBeTruthy();
    expect(screen.getByText(/copied to your clipboard/i).getAttribute("role")).toBe("status");
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(shown);
  });

  it("explains a clipboard failure in an alert and selects the text for manual copying", async () => {
    stubClipboard(async () => {
      throw new DOMException("Denied", "NotAllowedError");
    });
    render(<PasswordGenerator />);
    const shown = output().textContent;

    fireEvent.click(screen.getByRole("button", { name: /copy password to clipboard/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/blocked clipboard access/i);
    await waitFor(() => expect(window.getSelection()?.toString()).toBe(shown));
  });

  it("handles a browser with no clipboard API at all", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    render(<PasswordGenerator />);

    fireEvent.click(screen.getByRole("button", { name: /copy password to clipboard/i }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/blocked clipboard access/i);
  });

  it("can hide the value on screen while still copying the real one", async () => {
    const writeText = vi.fn(async () => undefined);
    stubClipboard(writeText);
    render(<PasswordGenerator />);
    const real = output().textContent as string;

    fireEvent.click(screen.getByRole("button", { name: /hide generated password/i }));
    expect(output().textContent).toBe("•".repeat(20));

    fireEvent.click(screen.getByRole("button", { name: /copy password to clipboard/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(real));

    fireEvent.click(screen.getByRole("button", { name: /show generated password/i }));
    expect(output().textContent).toBe(real);
  });
});

describe("PasswordGenerator: privacy and randomness", () => {
  it("sends, stores and logs nothing through a full session of use", async () => {
    const probe = installPrivacyProbe();
    const writeText = vi.fn(async () => undefined);
    stubClipboard(writeText);

    render(<PasswordGenerator />);
    fireEvent.click(screen.getByRole("button", { name: /generate new password/i }));
    fireEvent.change(lengthInput(), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("switch", { name: /symbols/i }));
    fireEvent.click(screen.getByRole("radio", { name: "Passphrase" }));
    fireEvent.click(screen.getByRole("switch", { name: /add a number/i }));
    fireEvent.click(screen.getByRole("button", { name: /hide generated/i }));
    fireEvent.click(screen.getByRole("button", { name: /copy passphrase to clipboard/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(/^words$/i), { target: { value: "5" } });

    // The only outward action is the explicit copy to the clipboard the user asked for.
    expect(writeText).toHaveBeenCalledTimes(1);
    probe.expectNoSideEffects();
  });

  it("does not place the password in the page address", () => {
    const before = window.location.href;
    render(<PasswordGenerator />);
    fireEvent.click(screen.getByRole("button", { name: /generate new password/i }));

    expect(window.location.href).toBe(before);
    expect(window.location.href).not.toContain(output().textContent as string);
  });

  it("draws from crypto.getRandomValues and never from Math.random", () => {
    const getRandomValues = vi.spyOn(globalThis.crypto, "getRandomValues");
    const mathRandom = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not be used");
    });

    render(<PasswordGenerator />);
    fireEvent.click(screen.getByRole("button", { name: /generate new password/i }));

    expect(getRandomValues.mock.calls.length).toBeGreaterThanOrEqual(40);
    expect(mathRandom).not.toHaveBeenCalled();
  });

  it("refuses to generate when secure randomness is unavailable, and says so", () => {
    vi.stubGlobal("crypto", undefined);
    render(<PasswordGenerator />);

    expect(screen.getByRole("alert").textContent).toMatch(/cannot provide secure random numbers/i);
    expect(output().textContent).toBe("Nothing to show yet.");
  });
});
