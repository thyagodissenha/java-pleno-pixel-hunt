import { describe, expect, it, vi } from "vitest";

// fix1, T12/ENGINE-19: prova que `returnToMenu()` recria uma Phase
// desenhável quando chamado depois de `tick()` ter capturado uma exceção
// (ENGINE-12, que descarta `activePhase` para `null`) — sem isso, o próximo
// `tick()` nunca mais chamava `draw()`, congelando o canvas. Mesma técnica
// de mock de `orchestrator-error-boundary.test.ts`: substitui
// `createNormalRunPhase` por uma versão que lança em `update()` na primeira
// chamada.
const drawSpy = vi.fn();
const enterSpy = vi.fn();

vi.mock("@/lib/pixel-hunt-engine/phases/normal-run", () => ({
  createNormalRunPhase: () => ({
    id: "normal-run" as const,
    enter: enterSpy,
    update: () => {
      throw new Error("boom from update");
    },
    draw: drawSpy,
    isComplete: () => false,
  }),
}));

describe("Engine.returnToMenu — recovers from a crashed Phase (ENGINE-19)", () => {
  it("recreates activePhase after a crash so the next tick() draws again", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { createEngine } = await import("@/lib/pixel-hunt-engine/orchestrator");
    const { DEFAULT_CHARACTER_ID, resolveCharacter } = await import("@/lib/characters");

    const engine = createEngine({ character: resolveCharacter(DEFAULT_CHARACTER_ID), canvasWidth: 960, canvasHeight: 540 });
    const ctx = { save: () => {}, restore: () => {}, translate: () => {} } as unknown as CanvasRenderingContext2D;
    engine.start();
    drawSpy.mockClear();

    // Força o crash — activePhase vira null internamente (ENGINE-12).
    const crashSnapshot = engine.tick(1000, { keys: new Set<string>(), pointer: { active: false, x: 0, y: 0 } }, ctx);
    expect(crashSnapshot.gameState).toBe("over");
    // draw() ainda foi chamado nesse frame (o erro veio de update(), draw()
    // nem chega a rodar por causa do try/catch envolvendo os dois).
    drawSpy.mockClear();

    // Sem returnToMenu, o próximo tick() já não chama draw() (activePhase null).
    engine.tick(1016, { keys: new Set<string>(), pointer: { active: false, x: 0, y: 0 } }, ctx);
    expect(drawSpy).not.toHaveBeenCalled();

    engine.returnToMenu();

    // Depois de returnToMenu(), o próximo tick() volta a chamar draw() — o
    // canvas não fica mais congelado. A Phase recriada é a mesma versão
    // mockada (lança em update()), então o snapshot ainda relata "over"; o
    // que importa aqui é que draw() volta a ser invocado.
    engine.tick(1032, { keys: new Set<string>(), pointer: { active: false, x: 0, y: 0 } }, ctx);
    expect(drawSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("returnToMenu() in the normal flow (no prior crash) does not recreate activePhase unnecessarily", async () => {
    const { createEngine } = await import("@/lib/pixel-hunt-engine/orchestrator");
    const { DEFAULT_CHARACTER_ID, resolveCharacter } = await import("@/lib/characters");

    const engine = createEngine({ character: resolveCharacter(DEFAULT_CHARACTER_ID), canvasWidth: 960, canvasHeight: 540 });
    const ctx = { save: () => {}, restore: () => {}, translate: () => {} } as unknown as CanvasRenderingContext2D;
    engine.start();
    const enterCallsBeforeReturnToMenu = enterSpy.mock.calls.length;
    drawSpy.mockClear();

    // Sem crash algum — só o fluxo normal de "voltar ao menu".
    engine.returnToMenu();

    // Se returnToMenu() tivesse recriado a Phase desnecessariamente (sem
    // crash prévio), enter() teria sido chamado de novo aqui.
    expect(enterSpy.mock.calls.length).toBe(enterCallsBeforeReturnToMenu);

    engine.tick(1000, { keys: new Set<string>(), pointer: { active: false, x: 0, y: 0 } }, ctx);
    // gameState volta a "menu" (started=false), draw() ainda roda porque a
    // Phase original (não recriada) segue ativa.
    expect(drawSpy).toHaveBeenCalled();
  });
});
