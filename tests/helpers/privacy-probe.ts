import { expect, vi } from "vitest";

/**
 * Watches every channel a password could leak through in a browser-like environment: network
 * requests (fetch, XMLHttpRequest, sendBeacon), persistent storage (Web Storage, cookies) and
 * the console (including React warnings, which are logged with console.error).
 *
 * Call it from a jsdom test *before* rendering. `fetch` is replaced with a mock that fails if it
 * is not given an implementation, so an unexpected request surfaces loudly.
 */
export function installPrivacyProbe() {
  const fetchSpy = vi.fn(async (..._args: unknown[]): Promise<Response> => {
    throw new Error("Unexpected network request");
  });
  vi.stubGlobal("fetch", fetchSpy);

  const xhrOpen = vi.spyOn(XMLHttpRequest.prototype, "open");
  const sendBeacon = vi.fn(() => true);
  Object.defineProperty(navigator, "sendBeacon", { value: sendBeacon, configurable: true, writable: true });
  const storageWrites = vi.spyOn(Storage.prototype, "setItem");
  const consoleSpies = (["log", "info", "warn", "error", "debug", "trace"] as const).map((method) => ({
    method,
    spy: vi.spyOn(console, method)
  }));

  return {
    fetchSpy,
    /** Fails if anything was sent, stored or logged. Set `allowFetch` for flows that may fetch. */
    expectNoSideEffects({ allowFetch = false }: { allowFetch?: boolean } = {}) {
      if (!allowFetch) expect(fetchSpy).not.toHaveBeenCalled();
      expect(xhrOpen).not.toHaveBeenCalled();
      expect(sendBeacon).not.toHaveBeenCalled();
      expect(storageWrites).not.toHaveBeenCalled();
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
      expect(document.cookie).toBe("");
      for (const { method, spy } of consoleSpies) {
        expect(spy, `console.${method} was called`).not.toHaveBeenCalled();
      }
    }
  };
}
