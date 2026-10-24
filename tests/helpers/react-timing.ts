import { act } from "@testing-library/react";

/**
 * Runs `interact` as a real DOM event outside act(), lets React finish its synchronous work
 * (microtasks), and returns before any later task. That is the page a browser could paint, or
 * another script could read, right after the interaction. Testing Library's `fireEvent` wraps
 * everything in act(), which also runs the follow-up renders and so hides exactly this state.
 */
export async function interactAndReadBeforeNextTask(interact: () => void) {
  const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = env.IS_REACT_ACT_ENVIRONMENT;
  env.IS_REACT_ACT_ENVIRONMENT = false;
  try {
    interact();
    for (let tick = 0; tick < 5; tick += 1) await Promise.resolve();
  } finally {
    env.IS_REACT_ACT_ENVIRONMENT = previous;
  }
}

/** Lets scheduled follow-up work finish so it cannot leak into the next test. */
export async function settle() {
  await act(async () => {});
}

/** Sets an input's value the way typing does, so React sees a real `input` event. */
export function typeNatively(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
