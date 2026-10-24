import { NextRequest, NextResponse } from "next/server";
import { isValidPrefix } from "@/lib/breach";

export const dynamic = "force-dynamic";

const RANGE_API = "https://api.pwnedpasswords.com/range/";
const UPSTREAM_TIMEOUT_MS = 8000;
/**
 * Real padded ranges measured 80-110 KB (about 2,000-2,700 rows) in October 2026, so this leaves
 * room for growth while refusing anything that cannot be a legitimate answer.
 */
const MAX_RANGE_BYTES = 512 * 1024;
/** One `SUFFIX:COUNT` row: the remaining 35 hex characters of the SHA-1 hash and a count. */
const RANGE_ROW = /^[0-9A-F]{35}:\d+$/;

/**
 * The browser treats "suffix not in the list" as "not breached", so an answer that is not a
 * range (an HTML error or captive-portal page, a truncated body) must be rejected here rather
 * than turned into a false clean verdict.
 */
function isRangeBody(body: string) {
  return body.length <= MAX_RANGE_BYTES && body.split(/\r?\n/).every((row) => row === "" || RANGE_ROW.test(row));
}

/**
 * Proxy for the Pwned Passwords range API. The only input is a 5-character SHA-1 prefix, which
 * on its own does not identify a password. This handler deliberately does not log anything:
 * not the prefix, not the upstream response, not errors.
 */
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const prefix = request.nextUrl.searchParams.get("prefix")?.toUpperCase() ?? "";

  if (!isValidPrefix(prefix)) {
    return json({ error: "A valid 5-character SHA-1 prefix is required." }, 400);
  }

  try {
    const response = await fetch(`${RANGE_API}${prefix}`, {
      headers: { "Add-Padding": "true" },
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    });

    if (!response.ok) {
      return json({ error: "The breach service returned an error." }, 502);
    }

    const body = await response.text();
    if (!isRangeBody(body)) {
      return json({ error: "The breach service returned an unexpected response." }, 502);
    }
    return json({ matches: body });
  } catch {
    return json({ error: "The breach service is unavailable." }, 502);
  }
}
