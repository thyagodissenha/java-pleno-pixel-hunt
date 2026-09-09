import { describe, expect, it } from "vitest";
import { DEFAULT_CHARACTER_ID, resolveCharacter } from "@/lib/characters";
import type { PhaseContext } from "@/lib/pixel-hunt-engine/phases/phase";
import {
  bossKillTarget,
  resetWaveOne,
  scaledEnemyHp,
  shotLanesForWeaponLevel,
  weaponLevelForWave,
} from "@/lib/pixel-hunt-engine/phases/normal-run/wave-progression";
import type { EngineWorld } from "@/lib/pixel-hunt-engine/types";

function makeWorld(overrides: Partial<EngineWorld> = {}): EngineWorld {
  return {
    player: {
      x: 10,
      y: 10,
      hp: 1,
      maxHp: 1,
      size: 1,
      speed: 1,
      invincible: 3,
      fury: 3,
      focus: 3,
      haste: 3,
    },
    enemies: [{ x: 0, y: 0, vx: 0, vy: 0, hp: 5, maxHp: 5, speed: 1, size: 1, kind: "user", label: "x" }],
    shots: [{ x: 0, y: 0, vx: 0, vy: 0, ttl: 5 }],
    particles: [{ x: 0, y: 0, vx: 0, vy: 0, ttl: 5, color: "#fff" }],
    powerUps: [{ x: 0, y: 0, kind: "coffee", ttl: 5, pulse: 0 }],
    obstacles: [],
    run: {
      score: 500,
      wave: 4,
      callLoops: 2,
      bossIndex: 3,
      bossKills: 7,
      bossSpawned: true,
      finalChoicePending: true,
      weaponLevel: 3,
      burstStamina: 40,
      abilityCooldownRemaining: 5,
      damageFlash: 10,
      shake: 10,
      bossBanner: 10,
      effectMessage: "old",
      effectBanner: 10,
      finalBossCorpse: { x: 1, y: 1 },
      frame: 999,
      visualFrame: 999,
      spawnTimer: 5,
      dataTimer: 5,
      powerUpTimer: 5,
      shotTimer: 5,
      lastMoveX: 1,
      lastMoveY: 1,
    },
    phaseState: null,
    ...overrides,
  };
}

function makeContext(): PhaseContext {
  return {
    audio: { playSound: () => undefined, startMusic: () => undefined, stopMusic: () => undefined, setPrefs: () => undefined },
    character: resolveCharacter(DEFAULT_CHARACTER_ID),
  };
}

describe("bossKillTarget / scaledEnemyHp / weaponLevelForWave / shotLanesForWeaponLevel", () => {
  it.each([
    [1, 0, 14],
    [2, 0, 18],
    [4, 0, 26],
    [1, 3, 29],
    [4, 2, 36],
  ])("bossKillTarget(wave=%i, resets=%i) === %i", (wave, resets, expected) => {
    expect(bossKillTarget(wave, resets)).toBe(expected);
  });

  it.each([
    [100, 0, 100],
    [100, 1, 125],
    [80, 2, 120],
  ])("scaledEnemyHp(baseHp=%i, resets=%i) === %i", (baseHp, resets, expected) => {
    expect(scaledEnemyHp(baseHp, resets)).toBe(expected);
  });

  it.each([
    [1, 1],
    [2, 2],
    [3, 2],
    [4, 3],
    [5, 3],
  ])("weaponLevelForWave(wave=%i) === %i", (wave, expected) => {
    expect(weaponLevelForWave(wave)).toBe(expected);
  });

  it("shotLanesForWeaponLevel returns a single centered lane below level 2", () => {
    expect(shotLanesForWeaponLevel(1)).toEqual([0]);
  });

  it("shotLanesForWeaponLevel returns two lanes at level 2", () => {
    expect(shotLanesForWeaponLevel(2)).toEqual([-0.1, 0.1]);
  });

  it("shotLanesForWeaponLevel returns three lanes at level 3+", () => {
    expect(shotLanesForWeaponLevel(3)).toEqual([-0.16, 0, 0.16]);
    expect(shotLanesForWeaponLevel(4)).toEqual([-0.16, 0, 0.16]);
  });
});

describe("resetWaveOne", () => {
  it("resets wave, timers, boss progress and player stats to a fresh wave 1", () => {
    const world = makeWorld();
    const ctx = makeContext();
    resetWaveOne(world, ctx);

    expect(world.run.wave).toBe(1);
    expect(world.run.bossIndex).toBe(0);
    expect(world.run.bossKills).toBe(0);
    expect(world.run.bossSpawned).toBe(false);
    expect(world.run.finalChoicePending).toBe(false);
    expect(world.run.finalBossCorpse).toBeNull();
    expect(world.run.weaponLevel).toBe(1);
    expect(world.run.burstStamina).toBe(100);
    expect(world.run.score).toBe(0);
    expect(world.run.callLoops).toBe(0);

    expect(world.player.hp).toBe(world.player.maxHp);
    expect(world.player.maxHp).toBe(ctx.character.maxHp);
    expect(world.player.speed).toBe(ctx.character.speed);
    expect(world.player.size).toBe(ctx.character.size);
    expect(world.player.invincible).toBe(0);
    expect(world.player.fury).toBe(0);
    expect(world.player.focus).toBe(0);
    expect(world.player.haste).toBe(0);

    expect(world.enemies).toHaveLength(0);
    expect(world.shots).toHaveLength(0);
    expect(world.particles).toHaveLength(0);
    expect(world.powerUps).toHaveLength(0);
  });

  it("preserves score and callLoops when keepScore is true (new-call flow)", () => {
    const world = makeWorld();
    const ctx = makeContext();
    resetWaveOne(world, ctx, true);

    expect(world.run.score).toBe(500);
    expect(world.run.callLoops).toBe(2);
  });

  it("does not touch frame/visualFrame (they persist across the whole engine lifetime, not per-run)", () => {
    const world = makeWorld();
    resetWaveOne(world, makeContext());
    expect(world.run.frame).toBe(999);
    expect(world.run.visualFrame).toBe(999);
  });
});
