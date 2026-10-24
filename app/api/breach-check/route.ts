import { NextRequest, NextResponse } from "next/server";
import { isValidPrefix } from "@/lib/breach";

export const dynamic = "force-dynamic";

const RANGE_API = "https://api.pwnedpasswords.com/range/";
const UPSTREAM_TIMEOUT_MS = 8000;

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

    return json({ matches: await response.text() });
  } catch {
    return json({ error: "The breach service is unavailable." }, 502);
  }
}
