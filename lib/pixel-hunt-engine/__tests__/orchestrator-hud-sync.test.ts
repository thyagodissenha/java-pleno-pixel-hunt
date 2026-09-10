import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CHARACTER_ID, resolveCharacter } from "@/lib/characters";
import { createEngine } from "@/lib/pixel-hunt-engine/orchestrator";
import type { EnginePhase } from "@/lib/pixel-hunt-engine/phases/phase";
import { secretMainframeGraph } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/graph";
import { emptyFrameEvents, type FrameEvents, type PhaseGraph } from "@/lib/pixel-hunt-engine/types";

// Controla exatamente quais `FrameEvents` `update()` devolve em cada tick —
// a única forma de testar `Engine.tick()`/`EngineSnapshot.hudSyncRequested`
// (fix1, T10, ENGINE-17/ENGINE-18) sem depender de RNG de spawn/combate
// real. Usa um `PhaseGraph` de teste minimalista (mesmo padrão de
// `orchestrator-phase-graph.test.ts`, T5) em vez de mockar
// `phases/normal-run` — esse módulo é removido na Fatia 3 (T16).
const updateMock = vi.fn<(...args: unknown[]) => FrameEvents>();

function fakePhase(id: string, overrides: Partial<EnginePhase> = {}): EnginePhase {
  return {
    id,
    enter: () => {},
    update: updateMock,
    draw: () => {},
    isComplete: () => false,
    ...overrides,
  };
}

function testGraph(): PhaseGraph {
  return {
    entry: "test-node",
    nodes: { "test-node": () => fakePhase("test-node") },
    transitions: {},
  };
}

function emptyEvents(overrides: Partial<FrameEvents> = {}): FrameEvents {
  return { ...emptyFrameEvents(), ...overrides };
}

function fakeCtx(): CanvasRenderingContext2D {
  return { save: () => {}, restore: () => {}, translate: () => {} } as unknown as CanvasRenderingContext2D;
}

function idleInput() {
  return { keys: new Set<string>(), pointer: { active: false, x: 0, y: 0 } };
}

function makeEngine() {
  return createEngine({ character: resolveCharacter(DEFAULT_CHARACTER_ID), canvasWidth: 960, canvasHeight: 540 });
}

describe("Engine.tick — EngineSnapshot.hudSyncRequested (fix1, T10, ENGINE-17/ENGINE-18)", () => {
  it("is false when the frame's FrameEvents has no field true", () => {
    updateMock.mockReset().mockReturnValue(emptyEvents());
    const engine = makeEngine();
    engine.start(testGraph());

    const snapshot = engine.tick(1016, idleInput(), fakeCtx());

    expect(snapshot.hudSyncRequested).toBe(false);
  });

  it("is true when any FrameEvents field is true (e.g. powerUpCollected)", () => {
    updateMock.mockReset().mockReturnValue(emptyEvents({ powerUpCollected: true }));
    const engine = makeEngine();
    engine.start(testGraph());

    const snapshot = engine.tick(1016, idleInput(), fakeCtx());

    expect(snapshot.hudSyncRequested).toBe(true);
  });

  it("is true for any other discrete FrameEvents field too (playerHit)", () => {
    updateMock.mockReset().mockReturnValue(emptyEvents({ playerHit: true }));
    const engine = makeEngine();
    engine.start(testGraph());

    const snapshot = engine.tick(1016, idleInput(), fakeCtx());

    expect(snapshot.hudSyncRequested).toBe(true);
  });

  it("engine.tick() keeps advancing the world every call regardless of hudSyncRequested", () => {
    updateMock.mockReset().mockReturnValue(emptyEvents());
    const engine = makeEngine();
    engine.start(testGraph());

    engine.tick(1000, idleInput(), fakeCtx());
    engine.tick(1016, idleInput(), fakeCtx());

    expect(updateMock).toHaveBeenCalledTimes(2);
  });
});

describe("Engine — discrete actions outside tick() always report hudSyncRequested: true (fix1, T10)", () => {
  it("start(graph) reports hudSyncRequested: true", () => {
    updateMock.mockReset().mockReturnValue(emptyEvents());
    const engine = makeEngine();

    expect(engine.start(testGraph()).hudSyncRequested).toBe(true);
  });

  it("start(secretMainframeGraph) reports hudSyncRequested: true", () => {
    updateMock.mockReset().mockReturnValue(emptyEvents());
    const engine = makeEngine();

    expect(engine.start(secretMainframeGraph).hudSyncRequested).toBe(true);
  });

  it("handleDebugAction() reports hudSyncRequested: true", () => {
    updateMock.mockReset().mockReturnValue(emptyEvents());
    const engine = makeEngine();

    expect(engine.handleDebugAction("max_stamina").hudSyncRequested).toBe(true);
  });

  it("activateSpecialPower() reports hudSyncRequested: true when it has an effect", () => {
    updateMock.mockReset().mockReturnValue(emptyEvents());
    const engine = makeEngine();
    engine.start(testGraph());

    const snapshot = engine.activateSpecialPower();

    expect(snapshot).not.toBeNull();
    expect(snapshot!.hudSyncRequested).toBe(true);
  });
});
