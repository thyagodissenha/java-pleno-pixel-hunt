import { describe, expect, it, vi } from "vitest";
import type { AudioEngine } from "@/lib/pixel-hunt-engine/audio";
import { bossKillTarget } from "@/lib/pixel-hunt-engine/phases/normal-run/wave-progression";
import { countBossProgress, finalBossHp, isFinalBoss } from "@/lib/pixel-hunt-engine/phases/normal-run/boss";
import type { EngineWorld } from "@/lib/pixel-hunt-engine/types";

function makeAudio(): AudioEngine {
  return {
    playSound: vi.fn(),
    startMusic: vi.fn(),
    stopMusic: vi.fn(),
    setPrefs: vi.fn(),
  };
}

function makeWorld(overrides: Partial<EngineWorld> = {}): EngineWorld {
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
    ...overrides,
  };
}

describe("finalBossHp", () => {
  it("returns 210 + phase*48 + wave*22 for phase 1", () => {
    expect(finalBossHp(1, 5)).toBe(210 + 48 + 110);
  });

  it("returns 210 + phase*48 + wave*22 for phase 2", () => {
    expect(finalBossHp(2, 3)).toBe(210 + 96 + 66);
  });
});

describe("isFinalBoss", () => {
  it("is false before the last boss index", () => {
    expect(isFinalBoss(0)).toBe(false);
    expect(isFinalBoss(2)).toBe(false);
  });

  it("is true at the last boss index (bossNames.length - 1)", () => {
    expect(isFinalBoss(3)).toBe(true);
  });
});

describe("countBossProgress", () => {
  it("does not release the boss one kill below the threshold", () => {
    const target = bossKillTarget(1, 0);
    const world = makeWorld({ run: { ...makeWorld().run, bossKills: target - 1 } });
    const released = countBossProgress(world, makeAudio());

    expect(released).toBe(false);
    expect(world.run.bossSpawned).toBe(false);
    expect(world.enemies).toHaveLength(0);
  });

  it("releases the boss exactly at the threshold, spawning it and marking bossSpawned", () => {
    const target = bossKillTarget(1, 0);
    const world = makeWorld({ run: { ...makeWorld().run, bossKills: target } });
    const released = countBossProgress(world, makeAudio());

    expect(released).toBe(true);
    expect(world.run.bossSpawned).toBe(true);
    expect(world.enemies).toHaveLength(1);
    expect(world.enemies[0].kind).toBe("boss");
  });

  it("does nothing if the boss is already spawned or a final choice is pending", () => {
    const target = bossKillTarget(1, 0);
    const spawnedWorld = makeWorld({ run: { ...makeWorld().run, bossKills: target, bossSpawned: true } });
    expect(countBossProgress(spawnedWorld, makeAudio())).toBe(false);

    const choiceWorld = makeWorld({ run: { ...makeWorld().run, bossKills: target, finalChoicePending: true } });
    expect(countBossProgress(choiceWorld, makeAudio())).toBe(false);
  });
});
