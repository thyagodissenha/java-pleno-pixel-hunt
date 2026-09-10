import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CHARACTER_ID, resolveCharacter } from "@/lib/characters";
import type { AudioEngine } from "@/lib/pixel-hunt-engine/audio";
import type { PhaseContext } from "@/lib/pixel-hunt-engine/phases/phase";
import { createWavePhase } from "@/lib/pixel-hunt-engine/phases/normal-run/waves";
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

describe("createWavePhase — id/enter (PHASEFLOW-10/11)", () => {
  it("produces an EnginePhase with id `wave-${N}` for N from 1 to bossNames.length", () => {
    for (let n = 1; n <= bossNames.length; n += 1) {
      expect(createWavePhase(n).id).toBe(`wave-${n}`);
    }
  });

  it("wave 1's enter() resets to a fresh run: 5 'user' enemies, obstacles, wave=1, incomplete", () => {
    const phase = createWavePhase(1);
    const world = emptyWorld();
    phase.enter(world, makeContext());

    expect(world.enemies).toHaveLength(5);
    expect(world.enemies.every((enemy) => enemy.kind === "user")).toBe(true);
    expect(world.obstacles.length).toBeGreaterThan(0);
    expect(world.run.wave).toBe(1);
    expect(world.run.bossIndex).toBe(0);
    expect(phase.isComplete(world)).toBe(false);
  });

  // Fix cycle-1, bug 2 (PHASEFLOW-13/14): regressão negativa — uma entrada
  // FRESCA em `wave-1` (início de jogo normal, ou "reset" de debug, ambos
  // com `callLoops === 0`) NUNCA deve mostrar o banner "NOVO CHAMADO:
  // pontuação mantida" — esse banner é exclusivo do loop de "novo chamado".
  it("a FRESH wave-1 entry (callLoops === 0) does NOT set the 'novo chamado' banner", () => {
    const phase = createWavePhase(1);
    const world = emptyWorld();
    world.run.callLoops = 0;

    phase.enter(world, makeContext());

    expect(world.run.effectMessage).toBe("");
    expect(world.run.effectBanner).toBe(0);
  });

  // Fix cycle-1, bug 2 (PHASEFLOW-13/14): regressão positiva — reproduz a
  // sequência real que a transição do grafo (`final-choice -> wave-1`)
  // entrega a `wave-1.enter()` depois de um "novo chamado": `callLoops` já
  // foi incrementado por `collectPowerUp` (physics.ts:171) ANTES da
  // transição rodar `enter()`. Antes do fix, `resetWaveOne` limpava
  // `effectMessage`/`effectBanner` para ""/0 e nada os setava de volta — o
  // jogador nunca via a confirmação "pontuação mantida".
  it("a 'novo chamado' loop re-entry (callLoops already incremented) sets the 'novo chamado' banner", () => {
    const phase = createWavePhase(1);
    const world = emptyWorld();
    world.run.callLoops = 1;

    phase.enter(world, makeContext());

    expect(world.run.effectMessage).toBe("NOVO CHAMADO: pontuação mantida");
    expect(world.run.effectBanner).toBe(100);
  });

  it("wave N>1's enter() only advances wave progression counters, without repopulating the initial cast", () => {
    const phase = createWavePhase(2);
    const world = emptyWorld();
    // Estado ao final da onda 1 (chefe recém-derrotado) — mesmo estado que a
    // transição do grafo (T15) entregaria a `wave-2.enter()`.
    world.run.wave = 1;
    world.run.bossIndex = 0;
    world.run.bossKills = 999;
    world.run.bossSpawned = true;

    phase.enter(world, makeContext());

    expect(world.run.wave).toBe(2);
    expect(world.run.bossIndex).toBe(1);
    expect(world.run.bossKills).toBe(0);
    expect(world.run.bossSpawned).toBe(false);
    expect(world.obstacles.length).toBeGreaterThan(0);
    expect(world.enemies).toHaveLength(0);
  });
});

describe("createWavePhase — update() boss defeat handoff (PHASEFLOW-11)", () => {
  it("a non-final boss's defeat does NOT set world.run.finalBossCorpse", () => {
    const phase = createWavePhase(1);
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);

    world.enemies.push({
      x: 300, y: 270, vx: 0, vy: 0, hp: 1, maxHp: 200, speed: 0, size: 38, kind: "boss", label: "x",
    });
    world.run.bossSpawned = true;
    world.shots.push({ x: 300, y: 270, vx: 0, vy: 0, ttl: 50 });

    const events = phase.update(world, ctx, makeInput(), 0.016);

    expect(events.bossDefeated).toBe(true);
    expect(world.run.finalBossCorpse).toBeNull();
    expect(phase.isComplete(world)).toBe(false);
  });

  it("the FINAL boss's defeat sets world.run.finalBossCorpse to its pre-death position", () => {
    const finalIndex = bossNames.length - 1;
    const phase = createWavePhase(finalIndex + 1);
    const world = emptyWorld();
    const ctx = makeContext();
    world.run.bossIndex = finalIndex;
    phase.enter(world, ctx);

    world.enemies.push({
      x: 321, y: 233, vx: 0, vy: 0, hp: 1, maxHp: 400, speed: 0, size: 62, kind: "boss", label: "x", bossPhase: 3,
    });
    world.run.bossSpawned = true;
    world.shots.push({ x: 321, y: 233, vx: 0, vy: 0, ttl: 50 });

    const events = phase.update(world, ctx, makeInput(), 0.016);

    expect(events.bossDefeated).toBe(true);
    expect(world.run.finalBossCorpse).toEqual({ x: 321, y: 233 });
    expect(phase.isComplete(world)).toBe(false);
  });

  it("player death (gameOver) marks the phase complete", () => {
    const phase = createWavePhase(1);
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    world.player.hp = 1;
    world.enemies.push({
      x: world.player.x, y: world.player.y, vx: 0, vy: 0, hp: 30, maxHp: 30, speed: 0, size: 24, kind: "user", label: "x", cooldown: 0,
    });

    phase.update(world, ctx, makeInput(), 0.5);

    expect(phase.isComplete(world)).toBe(true);
  });
});

describe("createWavePhase — hudLabels (parity with the old NormalRunPhase.hudLabels)", () => {
  it("reflects boss/biome/progress for the wave's own bossIndex", () => {
    const phase = createWavePhase(2);
    const world = emptyWorld();
    phase.enter(world, makeContext());

    const labels = phase.hudLabels?.(world);

    expect(labels?.boss).toBe(bossNames[1]);
    expect(labels?.bossProgress).toMatch(/\/\d+ mobs$/);
  });
});

describe("createWavePhase — handleDebugAction (spec PHASEFLOW: F1/F2/F3 during a wave)", () => {
  it("spawn_boss releases the boss immediately when it hasn't spawned yet", () => {
    const phase = createWavePhase(1);
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);

    phase.handleDebugAction?.("spawn_boss", world, ctx);

    expect(world.run.bossSpawned).toBe(true);
    expect(world.enemies.some((enemy) => enemy.kind === "boss")).toBe(true);
  });

  it("win_game marks the phase complete", () => {
    const phase = createWavePhase(1);
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);

    phase.handleDebugAction?.("win_game", world, ctx);

    expect(phase.isComplete(world)).toBe(true);
  });
});
