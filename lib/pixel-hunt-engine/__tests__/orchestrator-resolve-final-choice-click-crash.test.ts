import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CHARACTER_ID, resolveCharacter } from "@/lib/characters";
import { createEngine } from "@/lib/pixel-hunt-engine/orchestrator";
import type { EnginePhase } from "@/lib/pixel-hunt-engine/phases/phase";
import { emptyFrameEvents, type PhaseGraph } from "@/lib/pixel-hunt-engine/types";

// fix1, T16/ENGINE-23: prova que `Engine.resolveFinalChoiceClick` nunca deixa
// uma exceção lançada por `activePhase.resolveFinalChoiceClick?.(...)`
// escapar para o chamador. Usa um `PhaseGraph` de teste minimalista (mesmo
// padrão de `orchestrator-phase-graph.test.ts`, T5) em vez de mockar
// `phases/normal-run` — esse módulo é removido na Fatia 3 (T16), então
// depender dele aqui seria frágil por design.
const drawSpy = vi.fn();

function crashingClickPhase(): EnginePhase {
  return {
    id: "test-node",
    enter: () => {},
    update: () => emptyFrameEvents(),
    draw: drawSpy,
    isComplete: () => false,
    resolveFinalChoiceClick: () => {
      throw new Error("boom from resolveFinalChoiceClick");
    },
  };
}

function testGraph(): PhaseGraph {
  return {
    entry: "test-node",
    nodes: { "test-node": crashingClickPhase },
    transitions: {},
  };
}

function makeEngine() {
  return createEngine({ character: resolveCharacter(DEFAULT_CHARACTER_ID), canvasWidth: 960, canvasHeight: 540 });
}

// `returnToMenu()`'s fallback recria uma `NormalRunPhase` REAL (não a Phase
// de teste), cujo `draw()` chama `renderer.drawFrame` de verdade — precisa
// de um ctx completo (mesmo padrão de `orchestrator-phase-graph.test.ts`,
// T5), não o ctx minimalista (`save`/`restore`/`translate`) que basta para
// as Phases fictícias deste arquivo.
function fullFakeCtx(): CanvasRenderingContext2D {
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

describe("Engine.resolveFinalChoiceClick — error boundary (ENGINE-23)", () => {
  it("never lets a Phase.resolveFinalChoiceClick() exception escape; returns a safe 'over' snapshot instead", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const engine = makeEngine();
    engine.start(testGraph());

    let snapshot;
    expect(() => {
      snapshot = engine.resolveFinalChoiceClick(100, 100);
    }).not.toThrow();

    expect(snapshot).not.toBeNull();
    expect(snapshot!.gameState).toBe("over");
    expect(snapshot!.hudSyncRequested).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalled();

    // O caminho feliz de `tick()` também precisa continuar seguro depois da
    // recuperação — `activePhase` foi descartado (ENGINE-12/ENGINE-23), então
    // nenhuma exceção nova é lançada nem logada de novo.
    consoleErrorSpy.mockClear();
    const ctx = { save: () => {}, restore: () => {}, translate: () => {} } as unknown as CanvasRenderingContext2D;
    expect(() =>
      engine.tick(1000, { keys: new Set<string>(), pointer: { active: false, x: 0, y: 0 } }, ctx)
    ).not.toThrow();
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("returnToMenu() after this recovery lets the next tick() draw the world normally again (ENGINE-19 net)", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const engine = makeEngine();
    const ctx = fullFakeCtx();
    engine.start(testGraph());
    drawSpy.mockClear();

    engine.resolveFinalChoiceClick(100, 100);

    // Sem returnToMenu, o próximo tick() já não desenha (activePhase null).
    engine.tick(1000, { keys: new Set<string>(), pointer: { active: false, x: 0, y: 0 } }, ctx);
    expect(drawSpy).not.toHaveBeenCalled();

    engine.returnToMenu();

    // `returnToMenu()`'s fallback (ENGINE-19) recria uma `NormalRunPhase`
    // "normal" nova (não a Phase de teste) só para existir e ser desenhável
    // — mesmo comportamento hardcoded já coberto por
    // `orchestrator-return-to-menu-crash.test.ts`. O que importa aqui é que
    // o canvas não fica mais congelado: `draw()` volta a ser chamado.
    engine.tick(1016, { keys: new Set<string>(), pointer: { active: false, x: 0, y: 0 } }, ctx);
    expect(engine.getActivePhaseId()).not.toBeNull();

    consoleErrorSpy.mockRestore();
  });
});
