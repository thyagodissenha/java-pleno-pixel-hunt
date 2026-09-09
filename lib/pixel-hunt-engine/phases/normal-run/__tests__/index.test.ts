import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CHARACTER_ID, resolveCharacter } from "@/lib/characters";
import type { AudioEngine } from "@/lib/pixel-hunt-engine/audio";
import type { PhaseContext } from "@/lib/pixel-hunt-engine/phases/phase";
import { createNormalRunPhase } from "@/lib/pixel-hunt-engine/phases/normal-run";
import { bossNames } from "@/lib/pixel-hunt-engine/phases/normal-run/wave-progression";
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
      score: 0,
      wave: 1,
      callLoops: 0,
      bossIndex: 0,
      bossKills: 0,
      bossSpawned: false,
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

describe("NormalRunPhase.enter", () => {
  it("resets wave 1 with 5 initial 'user' enemies and obstacles, marked incomplete", () => {
    const phase = createNormalRunPhase();
    const world = emptyWorld();
    phase.enter(world, makeContext());

    expect(world.enemies).toHaveLength(5);
    expect(world.enemies.every((enemy) => enemy.kind === "user")).toBe(true);
    expect(world.run.wave).toBe(1);
    expect(phase.isComplete(world)).toBe(false);
  });

  it("calling enter() twice in a row does not duplicate state (invalid double-activation)", () => {
    const phase = createNormalRunPhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    phase.enter(world, ctx);

    expect(world.enemies).toHaveLength(5);
    expect(world.obstacles.length).toBeGreaterThan(0);
    expect(world.run.wave).toBe(1);
  });
});

describe("NormalRunPhase.update — boss progress and final choice cycle", () => {
  it("advances wave/bossIndex when a non-final boss is defeated, without entering 'choice'", () => {
    const phase = createNormalRunPhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);

    // bossIndex 0 não é o chefe final (bossNames tem 4 entradas, final é o
    // índice 3) — força a presença do chefe já quase morto.
    world.enemies.push({
      x: 300, y: 270, vx: 0, vy: 0, hp: 1, maxHp: 200, speed: 0, size: 38, kind: "boss", label: "x",
    });
    world.run.bossSpawned = true;
    world.shots.push({ x: 300, y: 270, vx: 0, vy: 0, ttl: 50 });

    phase.update(world, ctx, makeInput(), 0.016);

    expect(world.run.bossIndex).toBe(1);
    expect(world.run.wave).toBe(2);
    expect(world.run.bossSpawned).toBe(false);
    expect(world.run.finalChoicePending).toBe(false);
    expect(phase.isComplete(world)).toBe(false);
  });

  it("runs a full cycle: defeating the final boss opens the final choice, and claiming 'promotion' completes the phase", () => {
    const phase = createNormalRunPhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);

    // bossIndex = bossNames.length - 1 é o chefe final.
    world.run.bossIndex = bossNames.length - 1;
    world.run.bossSpawned = true;
    world.enemies.push({
      x: 300, y: 270, vx: 0, vy: 0, hp: 1, maxHp: 400, speed: 0, size: 62, kind: "boss", label: "x",
      bossPhase: 3,
    });
    world.shots.push({ x: 300, y: 270, vx: 0, vy: 0, ttl: 50 });

    phase.update(world, ctx, makeInput(), 0.016);

    expect(world.run.finalChoicePending).toBe(true);
    expect(world.powerUps.map((p) => p.kind).sort()).toEqual(["call", "promotion"]);
    expect(phase.isComplete(world)).toBe(false);

    const promotion = world.powerUps.find((p) => p.kind === "promotion")!;
    world.player.x = promotion.x;
    world.player.y = promotion.y;

    phase.update(world, ctx, makeInput(), 0.016);

    expect(phase.isComplete(world)).toBe(true);
  });

  it("'call' claimed during the final choice resets to a fresh wave 1 and keeps the phase running (not complete)", () => {
    const phase = createNormalRunPhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    world.run.score = 500;
    world.run.callLoops = 0;
    world.run.bossIndex = bossNames.length - 1;
    world.run.bossSpawned = true;
    world.enemies.push({
      x: 300, y: 270, vx: 0, vy: 0, hp: 1, maxHp: 400, speed: 0, size: 62, kind: "boss", label: "x", bossPhase: 3,
    });
    world.shots.push({ x: 300, y: 270, vx: 0, vy: 0, ttl: 50 });
    phase.update(world, ctx, makeInput(), 0.016);

    const call = world.powerUps.find((p) => p.kind === "call")!;
    world.player.x = call.x;
    world.player.y = call.y;
    phase.update(world, ctx, makeInput(), 0.016);

    expect(phase.isComplete(world)).toBe(false);
    expect(world.run.finalChoicePending).toBe(false);
    expect(world.run.wave).toBe(1);
    expect(world.run.callLoops).toBe(1);
    // Score preservado (keepScore=true) — 500 iniciais + 500 do abate do
    // chefe final (`ENEMY_DEATH_SCORE.boss`).
    expect(world.run.score).toBe(1000);
    // "Novo Chamado" precisa repopular o elenco/obstáculos como `enter()`
    // faz — regressão: só chamava `resetWaveOne`, deixando o mundo vazio.
    expect(world.obstacles.length).toBeGreaterThan(0);
    expect(world.enemies.length).toBeGreaterThan(0);
    expect(world.enemies.filter((enemy) => enemy.kind === "user")).toHaveLength(5);
  });
});

describe("NormalRunPhase.resolveFinalChoiceClick (fix1, ENGINE-16 — clique instantâneo)", () => {
  function reachFinalChoice(phase: ReturnType<typeof createNormalRunPhase>, world: EngineWorld, ctx: PhaseContext) {
    world.run.bossIndex = bossNames.length - 1;
    world.run.bossSpawned = true;
    world.enemies.push({
      x: 300, y: 270, vx: 0, vy: 0, hp: 1, maxHp: 400, speed: 0, size: 62, kind: "boss", label: "x", bossPhase: 3,
    });
    world.shots.push({ x: 300, y: 270, vx: 0, vy: 0, ttl: 50 });
    phase.update(world, ctx, makeInput(), 0.016);
  }

  it("resolves 'promotion' on a direct click, without waiting for passive collision", () => {
    const phase = createNormalRunPhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    reachFinalChoice(phase, world, ctx);

    const promotion = world.powerUps.find((p) => p.kind === "promotion")!;
    const snapshot = phase.resolveFinalChoiceClick?.(world, ctx, promotion.x, promotion.y);

    expect(snapshot).not.toBeNull();
    expect(snapshot!.promotionClaimed).toBe(true);
    expect(phase.isComplete(world)).toBe(true);
  });

  it("resolves 'call' on a direct click, without waiting for passive collision", () => {
    const phase = createNormalRunPhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    reachFinalChoice(phase, world, ctx);

    const call = world.powerUps.find((p) => p.kind === "call")!;
    const events = phase.resolveFinalChoiceClick?.(world, ctx, call.x, call.y);

    expect(events).not.toBeNull();
    expect(events!.newCallRequested).toBe(true);
    expect(world.run.finalChoicePending).toBe(false);
    expect(phase.isComplete(world)).toBe(false);
  });

  it("returns null and has no side effect outside the 'choice' state", () => {
    const phase = createNormalRunPhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);

    const result = phase.resolveFinalChoiceClick?.(world, ctx, world.player.x, world.player.y);

    expect(result).toBeNull();
    expect(world.run.score).toBe(0);
  });

  it("click + passive collision in the same frame resolve only once (no duplicate promotionClaimed)", () => {
    const phase = createNormalRunPhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    reachFinalChoice(phase, world, ctx);

    const promotion = world.powerUps.find((p) => p.kind === "promotion")!;
    // Clique resolve primeiro, no mesmo "evento" — remove o power-up do
    // array antes de qualquer colisão passiva do próximo update() ter
    // chance de coletá-lo de novo.
    const clickEvents = phase.resolveFinalChoiceClick?.(world, ctx, promotion.x, promotion.y);
    expect(clickEvents!.promotionClaimed).toBe(true);

    world.player.x = promotion.x;
    world.player.y = promotion.y;
    const frameEvents = phase.update(world, ctx, makeInput(), 0.016);

    expect(frameEvents.promotionClaimed).toBe(false);
    expect(phase.isComplete(world)).toBe(true);
  });
});

describe("NormalRunPhase.handleDebugAction", () => {
  it("spawn_boss releases the boss immediately when it hasn't spawned yet", () => {
    const phase = createNormalRunPhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);

    phase.handleDebugAction?.("spawn_boss", world, ctx);

    expect(world.run.bossSpawned).toBe(true);
    expect(world.enemies.some((enemy) => enemy.kind === "boss")).toBe(true);
  });

  it("win_game marks the phase complete", () => {
    const phase = createNormalRunPhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);

    phase.handleDebugAction?.("win_game", world, ctx);

    expect(phase.isComplete(world)).toBe(true);
  });
});
