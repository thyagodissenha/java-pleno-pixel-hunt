import { describe, expect, it, vi } from "vitest";
import type { FrameEvents } from "@/lib/pixel-hunt-engine/types";

// Mocka NormalRunPhase (mesmo padrão de orchestrator-error-boundary.test.ts —
// não há ponto de injeção de Phase na API pública do Orchestrator, por
// design) para testar SÓ a delegação de `Engine.resolveFinalChoiceClick`
// (fix1, T7): a lógica real de "achou o power-up dentro do raio" já está
// coberta em `phases/normal-run/__tests__/index.test.ts` (T6) e
// `__tests__/physics.test.ts` (T5).
const resolveFinalChoiceClickMock = vi.fn<(...args: unknown[]) => FrameEvents | null>();
const updateMock = vi.fn();

vi.mock("@/lib/pixel-hunt-engine/phases/normal-run", () => ({
  createNormalRunPhase: () => ({
    id: "normal-run" as const,
    enter: vi.fn(),
    update: updateMock,
    draw: vi.fn(),
    isComplete: () => false,
    resolveFinalChoiceClick: resolveFinalChoiceClickMock,
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

async function makeEngine() {
  const { createEngine } = await import("@/lib/pixel-hunt-engine/orchestrator");
  const { DEFAULT_CHARACTER_ID, resolveCharacter } = await import("@/lib/characters");
  return createEngine({ character: resolveCharacter(DEFAULT_CHARACTER_ID), canvasWidth: 960, canvasHeight: 540 });
}

describe("Engine.resolveFinalChoiceClick (fix1, T7 — delegação à Phase ativa)", () => {
  it("delegates to NormalRunPhase and returns a non-null snapshot when the click resolves", async () => {
    resolveFinalChoiceClickMock.mockReset().mockReturnValue(emptyEvents({ promotionClaimed: true }));
    const engine = await makeEngine();
    engine.start();

    const snapshot = engine.resolveFinalChoiceClick(120, 200);

    expect(snapshot).not.toBeNull();
    expect(resolveFinalChoiceClickMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), 120, 200);
  });

  it("returns null when the active Phase's resolveFinalChoiceClick misses (no power-up in range)", async () => {
    resolveFinalChoiceClickMock.mockReset().mockReturnValue(null);
    const engine = await makeEngine();
    engine.start();

    expect(engine.resolveFinalChoiceClick(0, 0)).toBeNull();
  });

  it("returns null when SecretMainframePhase is active (it does not implement the method) — throws no error", async () => {
    resolveFinalChoiceClickMock.mockReset().mockReturnValue(emptyEvents({ promotionClaimed: true }));
    const engine = await makeEngine();
    engine.startSecretRun();

    expect(() => engine.resolveFinalChoiceClick(120, 200)).not.toThrow();
    expect(engine.resolveFinalChoiceClick(120, 200)).toBeNull();
    // A Phase mockada (normal-run) não está ativa — a chamada não deve nem
    // alcançá-la.
    expect(resolveFinalChoiceClickMock).not.toHaveBeenCalled();
  });

  it("returns null when no Phase is active (post-crash, ENGINE-12 boundary already discarded activePhase)", async () => {
    updateMock.mockReset().mockImplementation(() => {
      throw new Error("boom from update");
    });
    resolveFinalChoiceClickMock.mockReset().mockReturnValue(emptyEvents({ promotionClaimed: true }));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const engine = await makeEngine();
    const ctx = { save: () => {}, restore: () => {}, translate: () => {} } as unknown as CanvasRenderingContext2D;
    engine.start();

    engine.tick(1000, { keys: new Set<string>(), pointer: { active: false, x: 0, y: 0 } }, ctx);

    expect(engine.resolveFinalChoiceClick(120, 200)).toBeNull();
    expect(resolveFinalChoiceClickMock).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
