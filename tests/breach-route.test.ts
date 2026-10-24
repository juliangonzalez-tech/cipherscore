import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/breach-check/route";

function request(query: string) {
  return new NextRequest(`http://localhost:3000/api/breach-check${query}`);
}

function stubUpstream(response: Response | (() => Promise<Response>)) {
  const upstream = vi.fn(typeof response === "function" ? response : async () => response);
  vi.stubGlobal("fetch", upstream);
  return upstream;
}

/** One row in the format the range API really uses: 35-character hash suffix, colon, count. */
const VALID_ROW = "1E4C9B93F3F0682250B6CF8331B7EE68FD8:9";

function spyOnConsole() {
  return (["log", "info", "warn", "error", "debug"] as const).map((method) => vi.spyOn(console, method));
}

describe("GET /api/breach-check: input validation", () => {
  it.each([
    ["no prefix", ""],
    ["an empty prefix", "?prefix="],
    ["a short prefix", "?prefix=5BAA"],
    ["a long prefix (a full hash would be a privacy leak)", "?prefix=5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8"],
    ["non-hex characters", "?prefix=ZZZZZ"],
    ["a path traversal attempt", "?prefix=..%2F..%2F"],
    ["an injected query string", "?prefix=5BAA6%26x%3D1"]
  ])("returns 400 for %s and never contacts the upstream service", async (_name, query) => {
    const upstream = stubUpstream(new Response("never"));

    const response = await GET(request(query));

    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("GET /api/breach-check: proxying", () => {
  it("forwards only the prefix, upper-cased, with padding enabled", async () => {
    const upstream = stubUpstream(new Response("1E4C9B93F3F0682250B6CF8331B7EE68FD8:9\r\n0018A45C4D1DEF81644B54AB7F969B88D65:0"));

    const response = await GET(request("?prefix=5baa6"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ matches: "1E4C9B93F3F0682250B6CF8331B7EE68FD8:9\r\n0018A45C4D1DEF81644B54AB7F969B88D65:0" });
    expect(upstream).toHaveBeenCalledTimes(1);
    const [url, init] = upstream.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.pwnedpasswords.com/range/5BAA6");
    expect((init.headers as Record<string, string>)["Add-Padding"]).toBe("true");
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    // No cookies, authorization or body are forwarded.
    expect(Object.keys(init.headers as object)).toEqual(["Add-Padding"]);
    expect(init.body).toBeUndefined();
  });

  it("marks every response as uncacheable", async () => {
    stubUpstream(new Response(`${VALID_ROW}`));
    expect((await GET(request("?prefix=5BAA6"))).headers.get("cache-control")).toBe("no-store");
  });

  it("returns 502 with a generic message when the upstream answers with an error", async () => {
    stubUpstream(new Response("boom", { status: 503 }));

    const response = await GET(request("?prefix=5BAA6"));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "The breach service returned an error." });
  });

  it("returns 502 without leaking details when the upstream is unreachable", async () => {
    stubUpstream(async () => {
      throw new Error("getaddrinfo ENOTFOUND api.pwnedpasswords.com 192.168.1.9");
    });

    const response = await GET(request("?prefix=5BAA6"));
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(text).not.toMatch(/ENOTFOUND|192\.168/);
  });

  it.each([
    ["an HTML page (for example a captive portal)", "<html><body>Sign in to Wi-Fi</body></html>"],
    ["a row with a short suffix", "1E4C9B93F3F0682250B6CF8331B7EE6:9"],
    ["a row without a count", "1E4C9B93F3F0682250B6CF8331B7EE68FD8"],
    ["valid rows followed by junk", `${VALID_ROW}\r\nnot a row`]
  ])("returns 502 instead of passing on %s, which the browser would read as 'not breached'", async (_name, body) => {
    stubUpstream(new Response(body));

    const response = await GET(request("?prefix=5BAA6"));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "The breach service returned an unexpected response." });
  });

  it("accepts a trailing line break and an empty range", async () => {
    stubUpstream(new Response(`${VALID_ROW}\r\n`));
    expect((await GET(request("?prefix=5BAA6"))).status).toBe(200);

    stubUpstream(new Response(""));
    expect((await GET(request("?prefix=5BAA6"))).status).toBe(200);
  });

  it("refuses an oversized answer instead of relaying it", async () => {
    // Real padded answers are roughly 40 KB; this is far beyond any legitimate range.
    stubUpstream(new Response(`${VALID_ROW}\r\n`.repeat(60_000)));

    const response = await GET(request("?prefix=5BAA6"));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "The breach service returned an unexpected response." });
  });
});

describe("GET /api/breach-check: logging", () => {
  it("writes nothing to the server console on success, bad input or upstream failure", async () => {
    const spies = spyOnConsole();

    stubUpstream(new Response(`${VALID_ROW}`));
    await GET(request("?prefix=5BAA6"));
    await GET(request("?prefix=nope"));
    stubUpstream(async () => {
      throw new Error("down");
    });
    await GET(request("?prefix=5BAA6"));

    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});
