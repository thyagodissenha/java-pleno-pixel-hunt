import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CHARACTER_ID, resolveCharacter } from "@/lib/characters";
import { createEngine } from "@/lib/pixel-hunt-engine/orchestrator";
import type { EnginePhase } from "@/lib/pixel-hunt-engine/phases/phase";
import type { PhaseGraph } from "@/lib/pixel-hunt-engine/types";

// fix1, T12/ENGINE-19: prova que `returnToMenu()` recria uma Phase
// desenhável quando chamado depois de `tick()` ter capturado uma exceção
// (ENGINE-12, que descarta `activePhase` para `null`) — sem isso, o próximo
// `tick()` nunca mais chamava `draw()`, congelando o canvas. Usa um
// `PhaseGraph` de teste minimalista (mesmo padrão de
// `orchestrator-phase-graph.test.ts`, T5) em vez de mockar
// `phases/normal-run` — esse módulo é removido na Fatia 3 (T16), então
// depender dele aqui seria frágil por design.
const drawSpy = vi.fn();
const enterSpy = vi.fn();

function crashingUpdatePhase(): EnginePhase {
  return {
    id: "test-node",
    enter: enterSpy,
    update: () => {
      throw new Error("boom from update");
    },
    draw: drawSpy,
    isComplete: () => false,
  };
}

function testGraph(): PhaseGraph {
  return {
    entry: "test-node",
    nodes: { "test-node": crashingUpdatePhase },
    transitions: {},
  };
}

function makeEngine() {
  return createEngine({ character: resolveCharacter(DEFAULT_CHARACTER_ID), canvasWidth: 960, canvasHeight: 540 });
}

// `returnToMenu()`'s fallback (quando `activePhase` é `null`) recria uma
// `NormalRunPhase` REAL, cujo `draw()` chama `renderer.drawFrame` de
// verdade — precisa de um ctx completo (mesmo padrão de
// `orchestrator-phase-graph.test.ts`, T5).
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

describe("Engine.returnToMenu — recovers from a crashed Phase (ENGINE-19)", () => {
  it("recreates activePhase after a crash so the next tick() draws again", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const engine = makeEngine();
    const ctx = fullFakeCtx();
    engine.start(testGraph());
    drawSpy.mockClear();

    // Força o crash — activePhase vira null internamente (ENGINE-12).
    const crashSnapshot = engine.tick(1000, { keys: new Set<string>(), pointer: { active: false, x: 0, y: 0 } }, ctx);
    expect(crashSnapshot.gameState).toBe("over");
    drawSpy.mockClear();

    // Sem returnToMenu, o próximo tick() já não chama draw() (activePhase null).
    engine.tick(1016, { keys: new Set<string>(), pointer: { active: false, x: 0, y: 0 } }, ctx);
    expect(drawSpy).not.toHaveBeenCalled();

    engine.returnToMenu();

    // Depois de returnToMenu(), o próximo tick() volta a chamar draw() — o
    // canvas não fica mais congelado. A Phase recriada é uma `NormalRunPhase`
    // REAL (não a de teste, que já foi descartada), então o `drawSpy` de
    // teste continua sem novas chamadas — o que importa é que a run continua
    // desenhável (`getActivePhaseId()` não-nulo).
    engine.tick(1032, { keys: new Set<string>(), pointer: { active: false, x: 0, y: 0 } }, ctx);
    expect(engine.getActivePhaseId()).not.toBeNull();

    consoleErrorSpy.mockRestore();
  });

  it("returnToMenu() in the normal flow (no prior crash) does not recreate activePhase unnecessarily", () => {
    const engine = makeEngine();
    const ctx = fullFakeCtx();
    engine.start(testGraph());
    const enterCallsBeforeReturnToMenu = enterSpy.mock.calls.length;
    drawSpy.mockClear();

    // Sem crash algum — só o fluxo normal de "voltar ao menu".
    engine.returnToMenu();

    // Se returnToMenu() tivesse recriado a Phase desnecessariamente (sem
    // crash prévio), enter() teria sido chamado de novo aqui.
    expect(enterSpy.mock.calls.length).toBe(enterCallsBeforeReturnToMenu);

    engine.tick(1000, { keys: new Set<string>(), pointer: { active: false, x: 0, y: 0 } }, ctx);
    // gameState volta a "menu" (started=false), draw() ainda roda porque a
    // Phase original (a de teste, não recriada) segue ativa.
    expect(drawSpy).toHaveBeenCalled();
  });
});
