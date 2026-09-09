import { describe, expect, it } from "vitest";
import { burst, clamp, distance, normalize } from "@/lib/pixel-hunt-engine/geometry";
import type { EngineWorld } from "@/lib/pixel-hunt-engine/types";

function makeWorld(overrides: Partial<EngineWorld> = {}): EngineWorld {
  return {
    player: { x: 0, y: 0, hp: 1, maxHp: 1, size: 1, speed: 1, invincible: 0, fury: 0, focus: 0, haste: 0 },
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

describe("clamp", () => {
  it("returns the value unchanged when within bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps to min when below the lower bound", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it("clamps to max when above the upper bound", () => {
    expect(clamp(42, 0, 10)).toBe(10);
  });
});

describe("distance", () => {
  it("computes the euclidean distance between two known points", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("is zero for the same point", () => {
    expect(distance({ x: 7, y: 2 }, { x: 7, y: 2 })).toBe(0);
  });
});

describe("normalize", () => {
  it("returns a unit vector preserving direction for a non-zero vector", () => {
    const result = normalize(3, 4);
    expect(result.x).toBeCloseTo(0.6);
    expect(result.y).toBeCloseTo(0.8);
    expect(Math.hypot(result.x, result.y)).toBeCloseTo(1);
  });

  it("falls back to a defined unit vector for the zero vector (no NaN)", () => {
    const result = normalize(0, 0);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(Number.isNaN(result.x)).toBe(false);
    expect(Number.isNaN(result.y)).toBe(false);
  });
});

describe("burst", () => {
  it("pushes the requested amount of particles into world.particles", () => {
    const world = makeWorld();
    burst(world, 10, 20, "#fff", 7);
    expect(world.particles).toHaveLength(7);
    for (const particle of world.particles) {
      expect(particle.x).toBe(10);
      expect(particle.y).toBe(20);
      expect(particle.color).toBe("#fff");
    }
  });

  it("defaults to 12 particles when amount is omitted", () => {
    const world = makeWorld();
    burst(world, 0, 0, "#000");
    expect(world.particles).toHaveLength(12);
  });
});
