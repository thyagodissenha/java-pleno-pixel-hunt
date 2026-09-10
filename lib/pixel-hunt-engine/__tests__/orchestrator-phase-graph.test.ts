import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CHARACTER_ID, resolveCharacter } from "@/lib/characters";
import { createEngine } from "@/lib/pixel-hunt-engine/orchestrator";
import type { EnginePhase } from "@/lib/pixel-hunt-engine/phases/phase";
import { secretMainframeGraph } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/graph";
import { emptyFrameEvents, type FrameEvents, type PhaseGraph } from "@/lib/pixel-hunt-engine/types";

// PHASEFLOW-08/09 (T5) — testa o mecanismo genérico de `Engine.start(graph)`
// + execução de transição em `tick()` com um `PhaseGraph` de teste
// minimalista (3 nós fictícios), sem tocar em `orchestrator.ts` — prova que
// o Orchestrator não conhece "normal-run"/"secret-mainframe" por nome, só
// executa o grafo que recebe.

function fakeCtx(): CanvasRenderingContext2D {
  return {
    save: () => {},
    restore: () => {},
    translate: () => {},
    fillRect: () => {},
    fillText: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    arc: () => {},
    fill: () => {},
    ellipse: () => {},
    quadraticCurveTo: () => {},
    setLineDash: () => {},
    closePath: () => {},
    clip: () => {},
    rotate: () => {},
    scale: () => {},
    rect: () => {},
    strokeText: () => {},
    measureText: () => ({ width: 0 }) as TextMetrics,
  } as unknown as CanvasRenderingContext2D;
}

function idleInput() {
  return { keys: new Set<string>(), pointer: { active: false, x: 0, y: 0 } };
}

function makeEngine() {
  return createEngine({ character: resolveCharacter(DEFAULT_CHARACTER_ID), canvasWidth: 960, canvasHeight: 540 });
}

function events(overrides: Partial<FrameEvents> = {}): FrameEvents {
  return { ...emptyFrameEvents(), ...overrides };
}

function fakePhase(id: string, overrides: Partial<EnginePhase> = {}): EnginePhase {
  return {
    id,
    enter: () => {},
    update: () => emptyFrameEvents(),
    draw: () => {},
    isComplete: () => false,
    ...overrides,
  };
}

describe("Engine.start(graph) + tick() transitions — generic PhaseGraph mechanism (T5)", () => {
  it("advances a-node -> b-node -> c-node exactly when each transition's predicate fires", () => {
    let aEvents = emptyFrameEvents();
    let bEvents = emptyFrameEvents();

    const testGraph: PhaseGraph = {
      entry: "a-node",
      nodes: {
        "a-node": () => fakePhase("a-node", { update: () => aEvents }),
        "b-node": () => fakePhase("b-node", { update: () => bEvents }),
        "c-node": () => fakePhase("c-node"),
      },
      transitions: {
        "a-node": (_world, events) => (events.bossDefeated ? "b-node" : null),
        "b-node": (_world, events) => (events.gameWon ? "c-node" : null),
        // "c-node" tem nenhuma entrada — nó terminal, nunca transiciona.
      },
    };

    const engine = makeEngine();
    engine.start(testGraph);
    expect(engine.getActivePhaseId()).toBe("a-node");

    // Nenhum evento de saída ainda — permanece em "a-node".
    engine.tick(1000, idleInput(), fakeCtx());
    expect(engine.getActivePhaseId()).toBe("a-node");

    // "a-node" dispara bossDefeated — transiciona para "b-node" NO MESMO
    // frame em que update() retornou o evento (antes do próximo draw()).
    aEvents = events({ bossDefeated: true });
    engine.tick(1016, idleInput(), fakeCtx());
    expect(engine.getActivePhaseId()).toBe("b-node");

    // "b-node" ainda não disparou gameWon — permanece.
    engine.tick(1032, idleInput(), fakeCtx());
    expect(engine.getActivePhaseId()).toBe("b-node");

    // "b-node" dispara gameWon — transiciona para "c-node" (terminal).
    bEvents = events({ gameWon: true });
    engine.tick(1048, idleInput(), fakeCtx());
    expect(engine.getActivePhaseId()).toBe("c-node");

    // "c-node" não tem entrada em `transitions` — nunca sai daqui.
    engine.tick(1064, idleInput(), fakeCtx());
    expect(engine.getActivePhaseId()).toBe("c-node");
  });

  it("start(secretMainframeGraph) never transitions — its 1-node graph has an empty transitions map", () => {
    const engine = makeEngine();
    engine.start(secretMainframeGraph);
    expect(engine.getActivePhaseId()).toBe("secret-mainframe");

    for (let i = 0; i < 10; i += 1) {
      engine.tick(1000 + i * 16, idleInput(), fakeCtx());
    }

    expect(engine.getActivePhaseId()).toBe("secret-mainframe");
  });

  it("an exception thrown by a graph node's update() still falls into the ENGINE-12 boundary", () => {
    const crashingGraph: PhaseGraph = {
      entry: "boom-node",
      nodes: {
        "boom-node": () =>
          fakePhase("boom-node", {
            update: () => {
              throw new Error("boom from a graph node");
            },
          }),
      },
      transitions: {},
    };

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const engine = makeEngine();
    engine.start(crashingGraph);

    let snapshot;
    expect(() => {
      snapshot = engine.tick(1000, idleInput(), fakeCtx());
    }).not.toThrow();

    expect(snapshot!.gameState).toBe("over");
    expect(engine.getActivePhaseId()).toBeNull();

    consoleErrorSpy.mockRestore();
  });

  // Fatia 2 (T12, PHASEFLOW-02/04) — `buildSnapshot()` (orchestrator.ts)
  // troca `isSecret ? ... : ...` por `activePhase?.hudLabels?.(world)`; uma
  // Phase de teste minimalista sem `hudLabels` (`fakePhase`, acima, não
  // define esse campo) prova o fallback genérico.
  it("buildSnapshot() falls back to generic HUD labels when the active Phase has no hudLabels()", () => {
    const noHudLabelsGraph: PhaseGraph = {
      entry: "plain-node",
      nodes: { "plain-node": () => fakePhase("plain-node") },
      transitions: {},
    };

    const engine = makeEngine();
    engine.start(noHudLabelsGraph);
    const snapshot = engine.tick(1000, idleInput(), fakeCtx());

    expect(snapshot.boss).toBe("—");
    expect(snapshot.biome).toBe("—");
    expect(snapshot.bossProgress).toBe("—");
  });
});
