import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CHARACTER_ID, resolveCharacter } from "@/lib/characters";
import { createEngine } from "@/lib/pixel-hunt-engine/orchestrator";
import type { EnginePhase } from "@/lib/pixel-hunt-engine/phases/phase";
import type { PhaseGraph } from "@/lib/pixel-hunt-engine/types";

// Injeta uma Phase que lança em update() para provar que `Engine.tick()`
// nunca deixa a exceção escapar (ENGINE-12). Usa um `PhaseGraph` de teste
// minimalista (mesmo padrão de `orchestrator-phase-graph.test.ts`, T5) em
// vez de mockar `phases/normal-run` — esse módulo é removido na Fatia 3
// (T16), então depender dele aqui seria frágil por design (e o mock, uma
// vez que `normalRunGraph` passa a apontar pra `waves.ts`/T13 em vez de
// `phases/normal-run`, deixaria de ter qualquer efeito real).
function crashingPhase(): EnginePhase {
  return {
    id: "test-node",
    enter: () => {},
    update: () => {
      throw new Error("boom from update");
    },
    draw: () => {},
    isComplete: () => false,
  };
}

function testGraph(): PhaseGraph {
  return {
    entry: "test-node",
    nodes: { "test-node": crashingPhase },
    transitions: {},
  };
}

describe("Engine.tick — error boundary (ENGINE-12)", () => {
  it("never lets a Phase.update() exception escape; returns gameState 'over' instead", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const engine = createEngine({ character: resolveCharacter(DEFAULT_CHARACTER_ID), canvasWidth: 960, canvasHeight: 540 });
    const ctx = { save: () => {}, restore: () => {}, translate: () => {} } as unknown as CanvasRenderingContext2D;
    engine.start(testGraph());

    let snapshot;
    expect(() => {
      snapshot = engine.tick(1000, { keys: new Set<string>(), pointer: { active: false, x: 0, y: 0 } }, ctx);
    }).not.toThrow();

    expect(snapshot!.gameState).toBe("over");
    expect(consoleErrorSpy).toHaveBeenCalled();

    // Um segundo tick, já sem Phase ativa, também não deve lançar nem
    // repetir o log (a Phase corrente foi descartada no boundary).
    consoleErrorSpy.mockClear();
    expect(() => engine.tick(1016, { keys: new Set<string>(), pointer: { active: false, x: 0, y: 0 } }, ctx)).not.toThrow();
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
