import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CHARACTER_ID, resolveCharacter } from "@/lib/characters";
import { createEngine } from "@/lib/pixel-hunt-engine/orchestrator";
import type { EnginePhase } from "@/lib/pixel-hunt-engine/phases/phase";
import { normalRunGraph } from "@/lib/pixel-hunt-engine/phases/normal-run/graph";
import { secretMainframeGraph } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/graph";
import { emptyFrameEvents, type FrameEvents, type PhaseGraph } from "@/lib/pixel-hunt-engine/types";

// Testa SÓ a delegação de `Engine.resolveFinalChoiceClick` (fix1, T7): a
// lógica real de "achou o power-up dentro do raio" já está coberta em
// `phases/normal-run/__tests__/final-choice-phase.test.ts` (T14) e
// `__tests__/physics.test.ts` (T5). Usa um `PhaseGraph` de teste minimalista
// (mesmo padrão de `orchestrator-phase-graph.test.ts`, T5) em vez de mockar
// `phases/normal-run` — esse módulo é removido na Fatia 3 (T16), então
// depender dele aqui seria frágil por design.
const resolveFinalChoiceClickMock = vi.fn<(...args: unknown[]) => FrameEvents | null>();
const updateMock = vi.fn<(...args: unknown[]) => FrameEvents>().mockReturnValue(emptyFrameEvents());

function fakePhase(id: string, overrides: Partial<EnginePhase> = {}): EnginePhase {
  return {
    id,
    enter: () => {},
    update: updateMock,
    draw: () => {},
    isComplete: () => false,
    resolveFinalChoiceClick: resolveFinalChoiceClickMock,
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

function makeEngine() {
  return createEngine({ character: resolveCharacter(DEFAULT_CHARACTER_ID), canvasWidth: 960, canvasHeight: 540 });
}

describe("Engine.resolveFinalChoiceClick (fix1, T7 — delegação à Phase ativa)", () => {
  it("delegates to the active Phase and returns a non-null snapshot when the click resolves", () => {
    resolveFinalChoiceClickMock.mockReset().mockReturnValue(emptyEvents({ promotionClaimed: true }));
    const engine = makeEngine();
    engine.start(testGraph());

    const snapshot = engine.resolveFinalChoiceClick(120, 200);

    expect(snapshot).not.toBeNull();
    expect(resolveFinalChoiceClickMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), 120, 200);
  });

  it("returns null when the active Phase's resolveFinalChoiceClick misses (no power-up in range)", () => {
    resolveFinalChoiceClickMock.mockReset().mockReturnValue(null);
    const engine = makeEngine();
    engine.start(testGraph());

    expect(engine.resolveFinalChoiceClick(0, 0)).toBeNull();
  });

  it("returns null when a Phase without resolveFinalChoiceClick is active (e.g. SecretMainframePhase) — throws no error", () => {
    resolveFinalChoiceClickMock.mockReset().mockReturnValue(emptyEvents({ promotionClaimed: true }));
    const engine = makeEngine();
    engine.start(secretMainframeGraph);

    expect(() => engine.resolveFinalChoiceClick(120, 200)).not.toThrow();
    expect(engine.resolveFinalChoiceClick(120, 200)).toBeNull();
    // A Phase mockada não está ativa — a chamada não deve nem alcançá-la.
    expect(resolveFinalChoiceClickMock).not.toHaveBeenCalled();
  });

  it("returns null when no Phase is active (post-crash, ENGINE-12 boundary already discarded activePhase)", () => {
    updateMock.mockReset().mockImplementation(() => {
      throw new Error("boom from update");
    });
    resolveFinalChoiceClickMock.mockReset().mockReturnValue(emptyEvents({ promotionClaimed: true }));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const engine = makeEngine();
    const ctx = { save: () => {}, restore: () => {}, translate: () => {} } as unknown as CanvasRenderingContext2D;
    engine.start(testGraph());

    engine.tick(1000, { keys: new Set<string>(), pointer: { active: false, x: 0, y: 0 } }, ctx);

    expect(engine.resolveFinalChoiceClick(120, 200)).toBeNull();
    expect(resolveFinalChoiceClickMock).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});

// Fix cycle-1, bug 1 (PHASEFLOW-13/14): regressão do softlock — um clique
// direto no power-up "novo chamado" (`resolveFinalChoiceClick`, sem passar
// por `tick()`/colisão) precisa disparar a MESMA transição de grafo que
// `tick()` já roda após `update()`. Antes do fix, `resolveFinalChoiceClick`
// nunca consultava `graph.transitions`, então o jogo travava
// permanentemente em `final-choice` mesmo com `newCallRequested` resolvido.
// Usa um `PhaseGraph` de teste com uma aresta REAL `final-choice -> wave-1`
// (mesmo formato de `normalRunGraph`) para provar que o Orchestrator, e não
// a Phase, é quem aciona a transição.
describe("Engine.resolveFinalChoiceClick — graph transition (fix cycle-1, bug 1, PHASEFLOW-13/14)", () => {
  // Reusa a transição REAL de `normalRunGraph.transitions["final-choice"]`
  // (`graph.ts`) em vez de reimplementá-la — só os `nodes` (a Phase em si)
  // são test doubles, mesmo padrão já usado pelo resto deste arquivo. Assim
  // o teste falha se o Orchestrator deixar de consultar a transição real do
  // grafo, e não apenas uma condição reescrita à mão.
  function graphWithFinalChoiceLoop(): PhaseGraph {
    return {
      entry: "final-choice",
      nodes: {
        "final-choice": () => fakePhase("final-choice"),
        "wave-1": () => fakePhase("wave-1", { resolveFinalChoiceClick: undefined }),
      },
      transitions: {
        "final-choice": normalRunGraph.transitions["final-choice"],
        "wave-1": () => null,
      },
    };
  }

  it("transitions the active Phase from 'final-choice' to 'wave-1' in the SAME call, without a further tick()", () => {
    resolveFinalChoiceClickMock.mockReset().mockReturnValue(emptyEvents({ newCallRequested: true }));
    const engine = makeEngine();
    engine.start(graphWithFinalChoiceLoop());
    expect(engine.getActivePhaseId()).toBe("final-choice");

    engine.resolveFinalChoiceClick(120, 200);

    expect(engine.getActivePhaseId()).toBe("wave-1");
  });

  it("does NOT transition when the click resolves without 'novo chamado' (e.g. 'promoção')", () => {
    resolveFinalChoiceClickMock.mockReset().mockReturnValue(emptyEvents({ promotionClaimed: true }));
    const engine = makeEngine();
    engine.start(graphWithFinalChoiceLoop());

    engine.resolveFinalChoiceClick(120, 200);

    expect(engine.getActivePhaseId()).toBe("final-choice");
  });
});
