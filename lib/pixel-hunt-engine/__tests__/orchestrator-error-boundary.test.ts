import { describe, expect, it, vi } from "vitest";

// Injeta uma NormalRunPhase que lança em update()/draw() para provar que
// `Engine.tick()` nunca deixa a exceção escapar (ENGINE-12). Mockado no
// nível do módulo (não há um ponto de injeção de Phase na API pública do
// Orchestrator, por design — ver design.md § Data Models) para que
// `createEngine()` (que já entra numa NormalRunPhase na construção) e
// `engine.start()` peguem a versão que lança.
vi.mock("@/lib/pixel-hunt-engine/phases/normal-run", () => ({
  createNormalRunPhase: () => ({
    id: "normal-run" as const,
    enter: vi.fn(),
    update: () => {
      throw new Error("boom from update");
    },
    draw: vi.fn(),
    isComplete: () => false,
  }),
}));

describe("Engine.tick — error boundary (ENGINE-12)", () => {
  it("never lets a Phase.update() exception escape; returns gameState 'over' instead", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { createEngine } = await import("@/lib/pixel-hunt-engine/orchestrator");
    const { DEFAULT_CHARACTER_ID, resolveCharacter } = await import("@/lib/characters");

    const engine = createEngine({ character: resolveCharacter(DEFAULT_CHARACTER_ID), canvasWidth: 960, canvasHeight: 540 });
    const ctx = { save: () => {}, restore: () => {}, translate: () => {} } as unknown as CanvasRenderingContext2D;
    engine.start();

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
