import { describe, expect, it, vi } from "vitest";
import type { FrameEvents } from "@/lib/pixel-hunt-engine/types";

// Mocka NormalRunPhase (mesmo padrão de orchestrator-error-boundary.test.ts
// e orchestrator-final-choice-click.test.ts) para controlar exatamente quais
// `FrameEvents` `update()` devolve em cada tick — a única forma de testar
// `Engine.tick()`/`EngineSnapshot.hudSyncRequested` (fix1, T10, ENGINE-17/
// ENGINE-18) sem depender de RNG de spawn/combate real.
const updateMock = vi.fn<(...args: unknown[]) => FrameEvents>();

vi.mock("@/lib/pixel-hunt-engine/phases/normal-run", () => ({
  createNormalRunPhase: () => ({
    id: "normal-run" as const,
    enter: vi.fn(),
    update: updateMock,
    draw: vi.fn(),
    isComplete: () => false,
  }),
}));

function emptyEvents(overrides: Partial<FrameEvents> = {}): FrameEvents {
  return {
    playerHit: false,
    bossDefeated: false,
    gameOver: false,
    gameWon: false,
    bossPhaseAdvanced: false,
    promotionClaimed: false,
    newCallRequested: false,
    powerUpCollected: false,
    ...overrides,
  };
}

function fakeCtx(): CanvasRenderingContext2D {
  return { save: () => {}, restore: () => {}, translate: () => {} } as unknown as CanvasRenderingContext2D;
}

function idleInput() {
  return { keys: new Set<string>(), pointer: { active: false, x: 0, y: 0 } };
}

async function makeEngine() {
  const { createEngine } = await import("@/lib/pixel-hunt-engine/orchestrator");
  const { DEFAULT_CHARACTER_ID, resolveCharacter } = await import("@/lib/characters");
  return createEngine({ character: resolveCharacter(DEFAULT_CHARACTER_ID), canvasWidth: 960, canvasHeight: 540 });
}

describe("Engine.tick — EngineSnapshot.hudSyncRequested (fix1, T10, ENGINE-17/ENGINE-18)", () => {
  it("is false when the frame's FrameEvents has no field true", async () => {
    updateMock.mockReset().mockReturnValue(emptyEvents());
    const engine = await makeEngine();
    engine.start();

    const snapshot = engine.tick(1016, idleInput(), fakeCtx());

    expect(snapshot.hudSyncRequested).toBe(false);
  });

  it("is true when any FrameEvents field is true (e.g. powerUpCollected)", async () => {
    updateMock.mockReset().mockReturnValue(emptyEvents({ powerUpCollected: true }));
    const engine = await makeEngine();
    engine.start();

    const snapshot = engine.tick(1016, idleInput(), fakeCtx());

    expect(snapshot.hudSyncRequested).toBe(true);
  });

  it("is true for any other discrete FrameEvents field too (playerHit)", async () => {
    updateMock.mockReset().mockReturnValue(emptyEvents({ playerHit: true }));
    const engine = await makeEngine();
    engine.start();

    const snapshot = engine.tick(1016, idleInput(), fakeCtx());

    expect(snapshot.hudSyncRequested).toBe(true);
  });

  it("engine.tick() keeps advancing the world every call regardless of hudSyncRequested", async () => {
    updateMock.mockReset().mockReturnValue(emptyEvents());
    const engine = await makeEngine();
    engine.start();

    engine.tick(1000, idleInput(), fakeCtx());
    engine.tick(1016, idleInput(), fakeCtx());

    expect(updateMock).toHaveBeenCalledTimes(2);
  });
});

describe("Engine — discrete actions outside tick() always report hudSyncRequested: true (fix1, T10)", () => {
  it("start() reports hudSyncRequested: true", async () => {
    updateMock.mockReset().mockReturnValue(emptyEvents());
    const engine = await makeEngine();

    expect(engine.start().hudSyncRequested).toBe(true);
  });

  it("startSecretRun() reports hudSyncRequested: true", async () => {
    updateMock.mockReset().mockReturnValue(emptyEvents());
    const engine = await makeEngine();

    expect(engine.startSecretRun().hudSyncRequested).toBe(true);
  });

  it("handleDebugAction() reports hudSyncRequested: true", async () => {
    updateMock.mockReset().mockReturnValue(emptyEvents());
    const engine = await makeEngine();

    expect(engine.handleDebugAction("max_stamina").hudSyncRequested).toBe(true);
  });

  it("activateSpecialPower() reports hudSyncRequested: true when it has an effect", async () => {
    updateMock.mockReset().mockReturnValue(emptyEvents());
    const engine = await makeEngine();
    engine.start();

    const snapshot = engine.activateSpecialPower();

    expect(snapshot).not.toBeNull();
    expect(snapshot!.hudSyncRequested).toBe(true);
  });
});
