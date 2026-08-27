import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDebugKeyHandler,
  DEBUG_ACTION_EVENT,
  isDebugAllowed,
  type DebugAction,
} from "@/lib/debug";

describe("debug utilities", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    window.history.replaceState({}, "", "/");
  });

  it("allows debug actions outside production", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(isDebugAllowed()).toBe(true);
  });

  it("allows the explicit debug query flag in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(isDebugAllowed("?debug=1")).toBe(true);
  });

  it("blocks debug actions in production without the query flag", () => {
    vi.stubEnv("NODE_ENV", "production");
    const actions: DebugAction[] = [];
    const handler = createDebugKeyHandler();
    const collectAction = (event: Event) => {
      actions.push((event as CustomEvent<DebugAction>).detail);
    };
    window.addEventListener("keydown", handler);
    window.addEventListener(DEBUG_ACTION_EVENT, collectAction);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "F2", cancelable: true }));
    window.removeEventListener("keydown", handler);
    window.removeEventListener(DEBUG_ACTION_EVENT, collectAction);

    expect(actions).toEqual([]);
  });

  it.each([
    ["F1", "toggle_menu"],
    ["F2", "spawn_boss"],
    ["F3", "add_powerup"],
  ] as const)("maps %s to %s in development", (key, expectedAction) => {
    vi.stubEnv("NODE_ENV", "development");
    const actions: DebugAction[] = [];
    const handler = createDebugKeyHandler();
    window.addEventListener("keydown", handler);
    window.addEventListener(DEBUG_ACTION_EVENT, (event) => {
      actions.push((event as CustomEvent<DebugAction>).detail);
    }, { once: true });

    window.dispatchEvent(new KeyboardEvent("keydown", { key, cancelable: true }));
    window.removeEventListener("keydown", handler);

    expect(actions).toEqual([expectedAction]);
  });
});
