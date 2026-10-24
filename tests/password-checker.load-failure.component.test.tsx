// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PasswordChecker } from "@/components/password-checker";

// The estimator loads its dictionaries with a dynamic import, which can fail on a flaky
// connection. This file replaces the loader to exercise that path.
const loader = vi.hoisted(() => ({ fail: true }));

vi.mock("@/lib/strength", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/strength")>();
  return {
    ...actual,
    loadStrengthEstimator: () =>
      loader.fail ? Promise.reject(new Error("chunk failed to load")) : actual.loadStrengthEstimator()
  };
});

afterEach(cleanup);

function field() {
  return screen.getByLabelText(/password or passphrase/i) as HTMLInputElement;
}

describe("PasswordChecker: estimator load failure", () => {
  it("explains the failure, does not ask for input it already has, and recovers on retry", async () => {
    loader.fail = true;
    render(<PasswordChecker />);

    expect((await screen.findByRole("alert")).textContent).toMatch(/could not be loaded/i);
    fireEvent.change(field(), { target: { value: "password" } });
    expect(screen.queryByText(/enter a password to see an estimate/i)).toBeNull();
    expect(screen.queryByText(/analyzing/i)).toBeNull();
    expect(screen.queryByRole("meter")).toBeNull();

    loader.fail = false;
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    const meter = await screen.findByRole("meter", { name: /password strength/i }, { timeout: 5000 });
    expect(meter.getAttribute("aria-valuenow")).toBe("0");
    expect(screen.queryByText(/could not be loaded/i)).toBeNull();
  });
});
