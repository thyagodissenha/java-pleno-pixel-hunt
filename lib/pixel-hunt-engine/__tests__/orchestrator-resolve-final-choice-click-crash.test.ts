import { describe, expect, it, vi } from "vitest";

// fix1, T16/ENGINE-23: prova que `Engine.resolveFinalChoiceClick` nunca deixa
// uma exceção lançada por `activePhase.resolveFinalChoiceClick?.(...)` escapar
// para o chamador — mesma técnica de mock de
// `orchestrator-error-boundary.test.ts`, mas agora a Phase mockada lança
// dentro de `resolveFinalChoiceClick` (não de `update`).
const drawSpy = vi.fn();

vi.mock("@/lib/pixel-hunt-engine/phases/normal-run", () => ({
  createNormalRunPhase: () => ({
    id: "normal-run" as const,
    enter: vi.fn(),
    update: vi.fn(() => ({})),
    draw: drawSpy,
    isComplete: () => false,
    resolveFinalChoiceClick: () => {
      throw new Error("boom from resolveFinalChoiceClick");
    },
  }),
}));

describe("Engine.resolveFinalChoiceClick — error boundary (ENGINE-23)", () => {
  it("never lets a Phase.resolveFinalChoiceClick() exception escape; returns a safe 'over' snapshot instead", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { createEngine } = await import("@/lib/pixel-hunt-engine/orchestrator");
    const { DEFAULT_CHARACTER_ID, resolveCharacter } = await import("@/lib/characters");

    const engine = createEngine({ character: resolveCharacter(DEFAULT_CHARACTER_ID), canvasWidth: 960, canvasHeight: 540 });
    engine.start();

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

  it("returnToMenu() after this recovery lets the next tick() draw the world normally again (ENGINE-19 net)", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { createEngine } = await import("@/lib/pixel-hunt-engine/orchestrator");
    const { DEFAULT_CHARACTER_ID, resolveCharacter } = await import("@/lib/characters");

    const engine = createEngine({ character: resolveCharacter(DEFAULT_CHARACTER_ID), canvasWidth: 960, canvasHeight: 540 });
    const ctx = { save: () => {}, restore: () => {}, translate: () => {} } as unknown as CanvasRenderingContext2D;
    engine.start();
    drawSpy.mockClear();

    engine.resolveFinalChoiceClick(100, 100);

    // Sem returnToMenu, o próximo tick() já não desenha (activePhase null).
    engine.tick(1000, { keys: new Set<string>(), pointer: { active: false, x: 0, y: 0 } }, ctx);
    expect(drawSpy).not.toHaveBeenCalled();

    engine.returnToMenu();

    engine.tick(1016, { keys: new Set<string>(), pointer: { active: false, x: 0, y: 0 } }, ctx);
    expect(drawSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
