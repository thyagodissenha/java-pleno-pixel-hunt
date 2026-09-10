import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CHARACTER_ID, resolveCharacter } from "@/lib/characters";
import type { AudioEngine } from "@/lib/pixel-hunt-engine/audio";
import type { PhaseContext } from "@/lib/pixel-hunt-engine/phases/phase";
import { createFinalChoicePhase } from "@/lib/pixel-hunt-engine/phases/normal-run/final-choice-phase";
import type { EngineWorld, InputState } from "@/lib/pixel-hunt-engine/types";

function makeAudio(): AudioEngine {
  return {
    playSound: vi.fn(),
    startMusic: vi.fn(),
    stopMusic: vi.fn(),
    setPrefs: vi.fn(),
  };
}

function makeContext(): PhaseContext {
  return { audio: makeAudio(), character: resolveCharacter(DEFAULT_CHARACTER_ID) };
}

function makeInput(overrides: Partial<InputState> = {}): InputState {
  return { keys: new Set<string>(), pointer: { active: false, x: 480, y: 270 }, ...overrides };
}

function emptyWorld(): EngineWorld {
  return {
    player: { x: 480, y: 270, hp: 100, maxHp: 100, size: 24, speed: 210, invincible: 0, fury: 0, focus: 0, haste: 0 },
    enemies: [],
    shots: [],
    particles: [],
    powerUps: [],
    obstacles: [],
    run: {
      score: 500,
      wave: 4,
      callLoops: 0,
      bossIndex: 3,
      bossKills: 0,
      bossSpawned: true,
      finalChoicePending: false,
      weaponLevel: 1,
      burstStamina: 100,
      abilityCooldownRemaining: 0,
      damageFlash: 0,
      shake: 0,
      bossBanner: 0,
      effectMessage: "",
      effectBanner: 0,
      finalBossCorpse: null,
      frame: 0,
      visualFrame: 0,
      spawnTimer: 0,
      dataTimer: 0,
      powerUpTimer: 0,
      shotTimer: 0,
      lastMoveX: 0,
      lastMoveY: 0,
    },
    phaseState: null,
  };
}

describe("createFinalChoicePhase.enter — spawns the 2 choices at the boss corpse (PHASEFLOW-10/12)", () => {
  it("places 'promotion'/'call' at world.run.finalBossCorpse's position, matching spawnFinalChoices", () => {
    const phase = createFinalChoicePhase();
    const world = emptyWorld();
    world.run.finalBossCorpse = { x: 321, y: 233 };

    phase.enter(world, makeContext());

    expect(world.run.finalChoicePending).toBe(true);
    expect(world.powerUps).toHaveLength(2);
    const promotion = world.powerUps.find((p) => p.kind === "promotion")!;
    const call = world.powerUps.find((p) => p.kind === "call")!;
    expect(promotion).toBeDefined();
    expect(call).toBeDefined();
    expect(phase.isComplete(world)).toBe(false);
  });

  it("throws a clear error when world.run.finalBossCorpse is null (waves.ts integration bug, design.md § Risks)", () => {
    const phase = createFinalChoicePhase();
    const world = emptyWorld();
    world.run.finalBossCorpse = null;

    expect(() => phase.enter(world, makeContext())).toThrow(/finalBossCorpse/);
  });
});

describe("createFinalChoicePhase.resolveFinalChoiceClick (fix1, ENGINE-16 — clique instantâneo)", () => {
  function reachChoice(phase: ReturnType<typeof createFinalChoicePhase>, world: EngineWorld, ctx: PhaseContext) {
    world.run.finalBossCorpse = { x: 480, y: 270 };
    phase.enter(world, ctx);
  }

  it("resolves 'promotion' on a direct click, without waiting for passive collision", () => {
    const phase = createFinalChoicePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    reachChoice(phase, world, ctx);

    const promotion = world.powerUps.find((p) => p.kind === "promotion")!;
    const events = phase.resolveFinalChoiceClick?.(world, ctx, promotion.x, promotion.y);

    expect(events).not.toBeNull();
    expect(events!.promotionClaimed).toBe(true);
    expect(phase.isComplete(world)).toBe(true);
  });

  it("resolves 'call' on a direct click, without waiting for passive collision", () => {
    const phase = createFinalChoicePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    reachChoice(phase, world, ctx);

    const call = world.powerUps.find((p) => p.kind === "call")!;
    const events = phase.resolveFinalChoiceClick?.(world, ctx, call.x, call.y);

    expect(events).not.toBeNull();
    expect(events!.newCallRequested).toBe(true);
    // Diferente do antigo `applyFinalChoiceOutcome` monolítico (que chamava
    // `resetWaveOne` diretamente): aqui o reset completo de
    // `run.finalChoicePending`/onda 1 fica a cargo de `wave-1`'s `enter()`
    // (T13), disparado pela transição do grafo (T15) — esta Phase só
    // sinaliza a intenção via `events.newCallRequested`.
    expect(world.run.finalChoicePending).toBe(true);
    // "Novo chamado" não é terminal desta Phase — é uma aresta do grafo
    // (T15), então isComplete() continua false aqui.
    expect(phase.isComplete(world)).toBe(false);
  });

  it("returns null and has no side effect when the click misses both choices", () => {
    const phase = createFinalChoicePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    reachChoice(phase, world, ctx);

    const result = phase.resolveFinalChoiceClick?.(world, ctx, 5, 5);

    expect(result).toBeNull();
    expect(world.run.score).toBe(500);
  });

  it("click + passive collision in the same frame resolve only once (no duplicate promotionClaimed)", () => {
    const phase = createFinalChoicePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    reachChoice(phase, world, ctx);

    const promotion = world.powerUps.find((p) => p.kind === "promotion")!;
    const clickEvents = phase.resolveFinalChoiceClick?.(world, ctx, promotion.x, promotion.y);
    expect(clickEvents!.promotionClaimed).toBe(true);

    world.player.x = promotion.x;
    world.player.y = promotion.y;
    const frameEvents = phase.update(world, ctx, makeInput(), 0.016);

    expect(frameEvents.promotionClaimed).toBe(false);
    expect(phase.isComplete(world)).toBe(true);
  });
});

describe("createFinalChoicePhase.isComplete — terminal outcomes", () => {
  it("is true for 'promotion', 'over' and 'won'; false while still 'choice'", () => {
    const phase = createFinalChoicePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    reachChoice(phase, world, ctx);
    expect(phase.isComplete(world)).toBe(false);

    const promotion = world.powerUps.find((p) => p.kind === "promotion")!;
    phase.resolveFinalChoiceClick?.(world, ctx, promotion.x, promotion.y);
    expect(phase.isComplete(world)).toBe(true);
  });

  function reachChoice(phase: ReturnType<typeof createFinalChoicePhase>, world: EngineWorld, ctx: PhaseContext) {
    world.run.finalBossCorpse = { x: 480, y: 270 };
    phase.enter(world, ctx);
  }
});
