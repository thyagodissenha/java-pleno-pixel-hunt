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
  // used by PixelTitlePanels' decorative title-screen canvas
  beginPath: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  lineTo: vi.fn(),
  moveTo: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  stroke: vi.fn(),
  strokeText: vi.fn(),
};

const server = setupServer();

let animationFrames: FrameRequestCallback[];
let frameTime: number;

const rawPower = CHARACTERS[0].specialPower;
if (!rawPower) throw new Error("Expected the default character to have a special power for this test");
// Narrows CharacterSpecialPower's kind-discriminated union so the dash-specific assertions
// below (power.dashDistance) type-check; the default character (Dev Pleno) is a dash power.
if (rawPower.kind !== "dash") throw new Error("Expected the default character's power to be a dash power for this test");
const power = rawPower;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

function advanceFrames(amount: number) {
  act(() => {
    for (let index = 0; index < amount; index += 1) {
      frameTime += 33;
      // Drain every callback queued for this tick (not just one) so an
      // independent rAF loop (e.g. PixelTitlePanels' decorative canvas)
      // mounted alongside the game loop can't steal frame slots meant
      // for it, the way a single shift() per tick would.
      const pending = animationFrames.splice(0, animationFrames.length);
      pending.forEach((callback) => callback(frameTime));
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

function playerEffectsStatus() {
  const text = screen.getByRole("status", { name: "Efeitos do jogador debug" }).textContent ?? "";
  const [haste, invincible] = text.split(",").map((value) => Number(value.trim()));
  return { haste, invincible };
}

function typeKeys(keys: string) {
  for (const key of keys) fireEvent.keyDown(window, { key });
}

function selectCharacterAndStart(characterId: string) {
  const character = CHARACTERS.find((entry) => entry.id === characterId);
  if (!character) throw new Error(`Unknown character id ${characterId}`);
  typeKeys("iddqd");
  fireEvent.click(screen.getByRole("radio", { name: new RegExp(character.name) }));
  fireEvent.click(screen.getByRole("button", { name: "Jogar" }));
  return character;
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

describe("power activation banner (announceEffect reuse, HUD-07/HUD-08)", () => {
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

  it("draws the 'REFACTOR DASH: ativado' banner via announceEffect when Q activates the power while playing (HUD-07)", () => {
    render(<Home />);
    startMatch();
    canvasContext.fillText.mockClear();

    fireEvent.keyDown(window, { key: "q" });
    advanceFrames(1);

    expect(canvasContext.fillText).toHaveBeenCalledWith(
      `${power.name.toUpperCase()}: ativado`,
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("does not draw a new banner when Q is pressed again while the power is on cooldown (HUD-08)", () => {
    render(<Home />);
    startMatch();

    fireEvent.keyDown(window, { key: "q" });
    // Let the first banner fully decay (effectBanner counts down from 100 by delta*60 per
    // frame, ~2/frame at the capped 33ms delta) so the still-visible-banner redraw from the
    // first activation can't be mistaken for a second announceEffect call below. 60 frames is
    // ~2s, well under the Dev Pleno's 15s cooldown, so the power stays on cooldown throughout.
    advanceFrames(60);
    expect(cooldownStatus()).not.toBe("0.0s");
    canvasContext.fillText.mockClear();

    fireEvent.keyDown(window, { key: "q" });
    advanceFrames(1);

    expect(canvasContext.fillText).not.toHaveBeenCalledWith(
      `${power.name.toUpperCase()}: ativado`,
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("does not draw the banner when Q is pressed outside gameState 'playing' (still at the menu) (HUD-08)", () => {
    render(<Home />);
    canvasContext.fillText.mockClear();

    fireEvent.keyDown(window, { key: "q" });

    expect(canvasContext.fillText).not.toHaveBeenCalledWith(
      `${power.name.toUpperCase()}: ativado`,
      expect.any(Number),
      expect.any(Number),
    );
  });
});

describe("character active power generic dispatch by kind (haste, shield)", () => {
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

  it("applies player.haste for the Estagiário's duration and starts its own cooldown when Q is pressed (CHAR-16)", () => {
    render(<Home />);
    const estagiario = selectCharacterAndStart("estagiario");
    const hastePower = estagiario.specialPower;
    if (!hastePower || hastePower.kind !== "haste") throw new Error("Expected Estagiário to have a haste power");

    fireEvent.keyDown(window, { key: "q" });

    // player.haste starts at 0 for a fresh match, so Math.max(0, durationSeconds) === durationSeconds
    // here — this assertion is unchanged by the CHAR-24 fix (Math.max instead of direct assignment)
    // and doubles as the "no prior buff" regression case for it.
    expect(playerEffectsStatus().haste).toBeCloseTo(hastePower.durationSeconds, 1);
    expect(cooldownStatus()).toBe(`${hastePower.cooldownSeconds.toFixed(1)}s`);
  });

  // CHAR-24: player.haste = Math.max(player.haste, power.durationSeconds) must never shrink a
  // longer buff already in effect. The "coffee" arena power-up grants a flat 6s of haste
  // (app/page.tsx, `player.haste = 6` on pickup) — longer than the Estagiário's own 4s power —
  // which is exactly the scenario CHAR-24 protects against. spawnPowerUp() picks its kind and
  // position via Math.random(), so this test pins Math.random()'s sequence (x, y, kind index,
  // pulse) to place a "coffee" power-up exactly on top of the player's spawn position, fires the
  // "add_powerup" debug action to spawn it, advances a frame so the pickup collision (distance 0
  // is within the pickup radius) applies it, and only then presses Q — giving a deterministic,
  // real end-to-end reproduction of the "shrink" bug instead of a math-only stand-in.
  it("does not shrink player.haste when a longer coffee buff is already active (CHAR-24)", () => {
    render(<Home />);
    const estagiario = selectCharacterAndStart("estagiario");
    const hastePower = estagiario.specialPower;
    if (!hastePower || hastePower.kind !== "haste") throw new Error("Expected Estagiário to have a haste power");

    // WORLD is 960x540 (app/page.tsx) and the player spawns at its center (480, 270).
    // spawnPowerUp() computes x = 70 + r*(960-140), y = 70 + r*(540-140), so r=0.5 for both
    // lands the power-up exactly on the player. kinds[0] is "coffee" (floor(0 * 6) === 0).
    const randomQueue = [0.5, 0.5, 0, 0];
    const originalRandom = Math.random;
    const randomSpy = vi.spyOn(Math, "random").mockImplementation(() =>
      randomQueue.length > 0 ? randomQueue.shift()! : originalRandom(),
    );

    act(() => {
      fireEvent(window, new CustomEvent(DEBUG_ACTION_EVENT, { detail: "add_powerup" }));
    });
    advanceFrames(1);
    randomSpy.mockRestore();

    const hasteAfterCoffee = playerEffectsStatus().haste;
    expect(hasteAfterCoffee).toBeGreaterThan(hastePower.durationSeconds);

    fireEvent.keyDown(window, { key: "q" });

    expect(playerEffectsStatus().haste).toBeGreaterThanOrEqual(hastePower.durationSeconds);
    expect(playerEffectsStatus().haste).toBeCloseTo(hasteAfterCoffee, 0);
  });

  it("applies player.invincible for the SRE's duration and starts its own cooldown when Q is pressed (CHAR-17)", () => {
    render(<Home />);
    const sre = selectCharacterAndStart("sre");
    const shieldPower = sre.specialPower;
    if (!shieldPower || shieldPower.kind !== "shield") throw new Error("Expected SRE to have a shield power");

    fireEvent.keyDown(window, { key: "q" });

    expect(playerEffectsStatus().invincible).toBeGreaterThanOrEqual(shieldPower.durationSeconds);
    expect(cooldownStatus()).toBe(`${shieldPower.cooldownSeconds.toFixed(1)}s`);
  });

  it("blocks a repeated Q while a haste power is on cooldown, without moving the effect or resetting the cooldown (CHAR-18, mirrors CHAR-04)", () => {
    render(<Home />);
    selectCharacterAndStart("estagiario");

    fireEvent.keyDown(window, { key: "q" });
    const effectsAfterFirst = playerEffectsStatus();
    const cooldownAfterFirst = cooldownStatus();

    fireEvent.keyDown(window, { key: "q" });

    expect(playerEffectsStatus()).toEqual(effectsAfterFirst);
    expect(cooldownStatus()).toBe(cooldownAfterFirst);
  });

  it("has no effect for a shield power when Q is pressed outside gameState 'playing' (CHAR-18, mirrors CHAR-07)", () => {
    render(<Home />);
    typeKeys("iddqd");
    fireEvent.click(screen.getByRole("radio", { name: new RegExp("SRE") }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao início" }));

    fireEvent.keyDown(window, { key: "q" });

    expect(playerEffectsStatus()).toEqual({ haste: 0, invincible: 0 });
    expect(cooldownStatus()).toBe("0.0s");
  });

  it("keeps the Dev Pleno dash working exactly as before generic dispatch was introduced (regression)", () => {
    render(<Home />);
    startMatch();

    fireEvent.keyDown(window, { key: "d" });
    advanceFrames(18);
    const before = playerPositionStatus();

    fireEvent.keyDown(window, { key: "q" });

    const after = playerPositionStatus();
    expect(after.x - before.x).toBeCloseTo(power.dashDistance, -1);
    expect(cooldownStatus()).toBe(`${power.cooldownSeconds.toFixed(1)}s`);
  });
});

type CapturedFill = { color: string; args: [number, number, number, number] };

type TestCanvasContext = {
  fillRect: (this: { fillStyle: string }, x: number, y: number, w: number, h: number) => void;
  fillText: typeof canvasContext.fillText;
  restore: typeof canvasContext.restore;
  save: typeof canvasContext.save;
  strokeRect: typeof canvasContext.strokeRect;
  translate: typeof canvasContext.translate;
};

describe("character visual differentiation (body color, in-game label)", () => {
  let captured: CapturedFill[];
  let testCanvasContext: TestCanvasContext;

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
    captured = [];
    // Wrapper technique: a plain (non-arrow) fillRect reads `this.fillStyle` at call time,
    // since pixelRect() does `ctx.fillStyle = color; ctx.fillRect(...)` right before calling —
    // this lets the test observe which color each fillRect call was drawn with.
    testCanvasContext = {
      ...canvasContext,
      fillRect: function (this: { fillStyle: string }, x: number, y: number, w: number, h: number) {
        captured.push({ color: this.fillStyle, args: [x, y, w, h] });
      },
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      testCanvasContext as unknown as CanvasRenderingContext2D,
    );
  });

  afterEach(() => {
    cleanup();
    server.resetHandlers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("draws the active character's shirt with their bodyColor instead of the fixed #0ea5e9 (CHAR-19)", () => {
    render(<Home />);
    selectCharacterAndStart("estagiario");
    // Discard any fillRect calls captured so far (e.g. the character selector's static
    // portrait, drawn when the "skins" panel opens/selects) so the assertion below can
    // only be satisfied by the in-game drawPlayer() draw that follows.
    captured.length = 0;
    advanceFrames(1);

    const shirt = captured.find(
      (fill) => fill.color === "#2dd4bf" && fill.args[2] === 16 && fill.args[3] === 13,
    );
    expect(shirt).toBeDefined();
  });

  it("labels the player in-game with the active character's name instead of the fixed 'Java Pleno' (CHAR-20)", () => {
    render(<Home />);
    selectCharacterAndStart("estagiario");
    advanceFrames(1);

    expect(testCanvasContext.fillText).toHaveBeenCalledWith(
      "Estagiário",
      expect.any(Number),
      expect.any(Number),
    );
  });
});
