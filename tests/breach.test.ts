import { describe, expect, it, vi } from "vitest";
import {
  BREACH_PREFIX_LENGTH,
  BreachCheckError,
  checkBreach,
  findBreachCount,
  isValidPrefix,
  sha1Hex
} from "@/lib/breach";

// Well-known test vector: SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
const PASSWORD = "password";
const PREFIX = "5BAA6";
const SUFFIX = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("sha1Hex", () => {
  it("matches the published SHA-1 test vectors", async () => {
    expect(await sha1Hex(PASSWORD)).toBe(`${PREFIX}${SUFFIX}`);
    expect(await sha1Hex("")).toBe("DA39A3EE5E6B4B0D3255BFEF95601890AFD80709");
  });

  it("hashes the UTF-8 encoding of unicode input", async () => {
    expect(await sha1Hex("pässwörd")).toMatch(/^[0-9A-F]{40}$/);
  });

  it("fails with a clear message when Web Crypto's subtle API is unavailable", async () => {
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
    await expect(sha1Hex(PASSWORD)).rejects.toThrow(BreachCheckError);
  });
});

describe("isValidPrefix", () => {
  it("accepts exactly five uppercase hex characters", () => {
    expect(BREACH_PREFIX_LENGTH).toBe(5);
    expect(isValidPrefix("5BAA6")).toBe(true);
    expect(isValidPrefix("00000")).toBe(true);
  });

  it.each(["", "5BAA", "5BAA61", "5baa6", "ZZZZZ", "5BAA6\n", " 5BAA6", "5BAA/", "../..", "5BAA6&x=1"])(
    "rejects %j",
    (value) => {
      expect(isValidPrefix(value)).toBe(false);
    }
  );
});

describe("findBreachCount", () => {
  const body = ["0018A45C4D1DEF81644B54AB7F969B88D65:1", `${SUFFIX}:3730471`, "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:2"].join("\n");

  it("returns the count for a matching suffix", () => {
    expect(findBreachCount(body, SUFFIX)).toBe(3730471);
  });

  it("returns 0 when the suffix is absent", () => {
    expect(findBreachCount(body, "A".repeat(35))).toBe(0);
    expect(findBreachCount("", SUFFIX)).toBe(0);
  });

  it("matches case-insensitively and tolerates CRLF line endings", () => {
    expect(findBreachCount(body.replace(/\n/g, "\r\n"), SUFFIX.toLowerCase())).toBe(3730471);
  });

  it("ignores padding rows, which the service returns with a count of 0", () => {
    expect(findBreachCount(`${SUFFIX}:0\nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:0`, SUFFIX)).toBe(0);
  });

  it("requires the whole suffix to match, not a prefix or substring", () => {
    expect(findBreachCount(`${SUFFIX.slice(0, 34)}:9`, SUFFIX)).toBe(0);
    expect(findBreachCount(`${SUFFIX}0:9`, SUFFIX)).toBe(0);
  });

  it("survives malformed lines", () => {
    expect(findBreachCount(`garbage\n:\n::::\n${SUFFIX}\n${SUFFIX}:abc`, SUFFIX)).toBe(0);
  });
});

describe("checkBreach", () => {
  it("sends only the 5-character prefix and reports a match", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ matches: `AAAAA:0\n${SUFFIX}:42` }));

    const result = await checkBreach(PASSWORD, { fetchImpl });

    expect(result).toEqual({ breached: true, count: 42 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(url).toBe(`/api/breach-check?prefix=${PREFIX}`);
    // Nothing besides the abort signal goes along: no body, headers, cookies or credentials.
    expect(Object.keys(init ?? {})).toEqual(["signal"]);
  });

  it("never lets the password or the hash suffix appear in anything that is sent", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ matches: "" }));

    await checkBreach(PASSWORD, { fetchImpl });

    const sent = JSON.stringify(fetchImpl.mock.calls);
    expect(sent).not.toContain(PASSWORD);
    expect(sent.toUpperCase()).not.toContain(SUFFIX);
    expect(sent.toUpperCase()).not.toContain(SUFFIX.slice(0, 8));
  });

  it("reports a clean result when the suffix is not in the returned range", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ matches: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:5" }));
    expect(await checkBreach(PASSWORD, { fetchImpl })).toEqual({ breached: false, count: 0 });
  });

  it("surfaces the service's error message", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "The breach service is unavailable." }, 502));
    await expect(checkBreach(PASSWORD, { fetchImpl })).rejects.toThrow("The breach service is unavailable.");
  });

  it("turns network failures into a readable error without echoing internals", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed: ECONNRESET 10.0.0.5:443");
    });
    const error = await checkBreach(PASSWORD, { fetchImpl }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BreachCheckError);
    expect((error as Error).message).not.toMatch(/ECONNRESET|10\.0\.0\.5/);
  });

  it("rejects an unreadable response and a response without a 'matches' string", async () => {
    await expect(
      checkBreach(PASSWORD, { fetchImpl: async () => new Response("<html>oops</html>", { status: 200 }) })
    ).rejects.toThrow(BreachCheckError);
    await expect(
      checkBreach(PASSWORD, { fetchImpl: async () => jsonResponse({ matches: 42 }) })
    ).rejects.toThrow(BreachCheckError);
  });

  it("propagates an abort instead of masking it as a network error", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () => {
      controller.abort();
      throw new DOMException("Aborted", "AbortError");
    });

    const error = await checkBreach(PASSWORD, { fetchImpl, signal: controller.signal }).catch(
      (caught: unknown) => caught
    );
    expect(error).toBeInstanceOf(DOMException);
    expect((error as DOMException).name).toBe("AbortError");
  });
});
