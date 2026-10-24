/**
 * Optional breached-password lookup using the Pwned Passwords range API (k-anonymity).
 *
 * Only the first 5 hex characters of the password's SHA-1 hash ever leave the browser, and only
 * when the user clicks "Check breach status". The remaining 35 characters stay local and are
 * compared against the list of matching suffixes the service returns. SHA-1 is used here only
 * because that is the identifier the API defines; nothing is being stored or authenticated.
 */

export const BREACH_PREFIX_LENGTH = 5;

const PREFIX_PATTERN = /^[0-9A-F]{5}$/;

export class BreachCheckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BreachCheckError";
  }
}

export async function sha1Hex(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new BreachCheckError("Breach checks need a secure context (HTTPS or localhost).");
  }
  const digest = await subtle.digest("SHA-1", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export function isValidPrefix(prefix: string): boolean {
  return PREFIX_PATTERN.test(prefix);
}

/**
 * Looks for `suffix` in a range response (`SUFFIX:COUNT` per line). With the `Add-Padding`
 * header the service adds fake rows with a count of 0, which must not count as a match.
 * Returns how many times the password appears in known breaches (0 when absent).
 */
export function findBreachCount(rangeBody: string, suffix: string): number {
  const wanted = suffix.toUpperCase();
  for (const line of rangeBody.split(/\r?\n/)) {
    const [candidate, rawCount] = line.split(":");
    if (candidate?.trim().toUpperCase() === wanted) {
      const count = Number.parseInt(rawCount ?? "", 10);
      return Number.isFinite(count) && count > 0 ? count : 0;
    }
  }
  return 0;
}

export type BreachResult = { breached: boolean; count: number };

type FetchLike = (input: string, init?: { signal?: AbortSignal }) => Promise<Response>;

/**
 * Checks a password against the breach corpus through this app's `/api/breach-check` proxy.
 * The request contains the 5-character hash prefix and nothing else.
 */
export async function checkBreach(
  password: string,
  { signal, fetchImpl = fetch }: { signal?: AbortSignal; fetchImpl?: FetchLike } = {}
): Promise<BreachResult> {
  const hash = await sha1Hex(password);
  const prefix = hash.slice(0, BREACH_PREFIX_LENGTH);
  const suffix = hash.slice(BREACH_PREFIX_LENGTH);

  let response: Response;
  try {
    response = await fetchImpl(`/api/breach-check?prefix=${prefix}`, { signal });
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    throw new BreachCheckError("Could not reach the breach check service. Check your connection and try again.");
  }

  let payload: { matches?: unknown; error?: unknown };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    throw new BreachCheckError("The breach check service returned an unreadable response.");
  }

  if (!response.ok || typeof payload.matches !== "string") {
    throw new BreachCheckError(
      typeof payload.error === "string" ? payload.error : "Unable to check breach status."
    );
  }

  const count = findBreachCount(payload.matches, suffix);
  return { breached: count > 0, count };
}
