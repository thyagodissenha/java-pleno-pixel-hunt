import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { CHARACTERS } from "@/lib/characters";
import { DEBUG_ACTION_EVENT } from "@/lib/debug";

const canvasContext = {
  fillRect: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  save: vi.fn(),
  strokeRect: vi.fn(),
  translate: vi.fn(),
};

const server = setupServer();

let animationFrames: FrameRequestCallback[];
let frameTime: number;

const power = CHARACTERS[0].specialPower;
if (!power) throw new Error("Expected the default character to have a special power for this test");

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

function advanceFrames(amount: number) {
  act(() => {
    for (let index = 0; index < amount; index += 1) {
      const callback = animationFrames.shift();
      frameTime += 33;
      callback?.(frameTime);
    }
  });
}

function startMatch() {
  act(() => {
    fireEvent.click(screen.getByRole("menuitem", { name: /^▶?\s*Jogar$/ }));
  });
}

function cooldownStatus() {
  return screen.getByRole("status", { name: "Cooldown do poder especial debug" }).textContent;
}

function playerPositionStatus() {
  const text = screen.getByRole("status", { name: "Posição do jogador debug" }).textContent ?? "";
  const [x, y] = text.split(",").map((value) => Number(value.trim()));
  return { x, y };
}

describe("character active power (Refactor Dash)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv("NODE_ENV", "development");
    server.use(
      http.get("http://localhost/api/scores", () => HttpResponse.json({ scores: [] })),
      http.post("http://localhost/api/scores", () => HttpResponse.json({ scores: [] })),
    );
    const interceptedFetch = globalThis.fetch;
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? new URL(input, "http://localhost") : input;
      return interceptedFetch(url, init);
    });
    animationFrames = [];
    frameTime = performance.now();
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      canvasContext as unknown as CanvasRenderingContext2D,
    );
  });

  afterEach(() => {
    cleanup();
    server.resetHandlers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("dashes the player and starts the cooldown when Q is pressed while playing and available (CHAR-03)", () => {
    render(<Home />);
    startMatch();

    fireEvent.keyDown(window, { key: "d" });
    advanceFrames(18);
    const before = playerPositionStatus();

    fireEvent.keyDown(window, { key: "q" });

    const after = playerPositionStatus();
    expect(after.x - before.x).toBeCloseTo(power.dashDistance, -1);
    expect(after.y).toBe(before.y);
    expect(cooldownStatus()).toBe(`${power.cooldownSeconds.toFixed(1)}s`);
  });

  it("ignores Q while the power is still on cooldown, without moving the player or resetting the cooldown (CHAR-04)", () => {
    render(<Home />);
    startMatch();

    fireEvent.keyDown(window, { key: "d" });
    advanceFrames(18);
    fireEvent.keyDown(window, { key: "q" });
    const afterFirstDash = playerPositionStatus();
    const cooldownAfterFirstDash = cooldownStatus();

    fireEvent.keyDown(window, { key: "q" });

    expect(playerPositionStatus()).toEqual(afterFirstDash);
    expect(cooldownStatus()).toBe(cooldownAfterFirstDash);
  });

  it("ignores a Q keydown fired as a repeat before any real activation, isolating the guard from the cooldown (CHAR-05)", () => {
    render(<Home />);
    startMatch();
    const before = playerPositionStatus();

    fireEvent.keyDown(window, { key: "q", repeat: true });

    expect(playerPositionStatus()).toEqual(before);
    expect(cooldownStatus()).toBe("0.0s");
  });

  it("does not fire more than once per real key press when Q is held down (CHAR-05)", () => {
    render(<Home />);
    startMatch();

    fireEvent.keyDown(window, { key: "d" });
    advanceFrames(18);
    fireEvent.keyDown(window, { key: "q" });
    const afterRealPress = playerPositionStatus();
    const cooldownAfterRealPress = cooldownStatus();

    fireEvent.keyDown(window, { key: "q", repeat: true });
    fireEvent.keyDown(window, { key: "q", repeat: true });
    fireEvent.keyDown(window, { key: "q", repeat: true });

    expect(playerPositionStatus()).toEqual(afterRealPress);
    expect(cooldownStatus()).toBe(cooldownAfterRealPress);
  });

  it("resets the cooldown to zero when a match reset happens (CHAR-06)", () => {
    render(<Home />);
    startMatch();
    fireEvent.keyDown(window, { key: "d" });
    advanceFrames(18);
    fireEvent.keyDown(window, { key: "q" });
    expect(cooldownStatus()).toBe(`${power.cooldownSeconds.toFixed(1)}s`);

    act(() => {
      fireEvent(window, new CustomEvent(DEBUG_ACTION_EVENT, { detail: "reset" }));
    });

    expect(cooldownStatus()).toBe("0.0s");
  });

  it("has no effect when Q is pressed outside gameState 'playing' (still at the menu) (CHAR-07)", () => {
    render(<Home />);
    const before = playerPositionStatus();
    const cooldownBefore = cooldownStatus();

    fireEvent.keyDown(window, { key: "q" });

    expect(playerPositionStatus()).toEqual(before);
    expect(cooldownStatus()).toBe(cooldownBefore);
  });
});
