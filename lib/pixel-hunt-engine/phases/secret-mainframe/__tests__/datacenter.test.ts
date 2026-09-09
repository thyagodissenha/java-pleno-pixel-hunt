import { describe, expect, it, vi } from "vitest";
import {
  spawnDatacenterCracks,
  spawnDatacenterMoss,
  spawnDatacenterObstacles,
} from "@/lib/pixel-hunt-engine/phases/secret-mainframe/datacenter";
import type { EngineWorld } from "@/lib/pixel-hunt-engine/types";

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

describe("spawnDatacenterObstacles", () => {
  it("produces exactly the 14 fixed obstacles from the original layout", () => {
    const world = emptyWorld();
    spawnDatacenterObstacles(world);

    expect(world.obstacles).toHaveLength(14);
    expect(world.obstacles).toEqual([
      { kind: "rack", x: 36, y: 118, width: 32, height: 48, label: "Rack" },
      { kind: "rack", x: 120, y: 68, width: 32, height: 48, label: "Rack" },
      { kind: "rack", x: 812, y: 62, width: 32, height: 48, label: "Rack" },
      { kind: "rack", x: 872, y: 206, width: 32, height: 48, label: "Rack" },
      { kind: "crt", x: 676, y: 68, width: 36, height: 30, label: "CRT" },
      { kind: "crt", x: 56, y: 394, width: 36, height: 30, label: "CRT" },
      { kind: "chair", x: 628, y: 418, width: 24, height: 30, label: "Cadeira" },
      { kind: "chair", x: 752, y: 402, width: 24, height: 30, label: "Cadeira" },
      { kind: "fern", x: 16, y: 484, width: 36, height: 24, label: "Samambaia" },
      { kind: "fern", x: 300, y: 50, width: 36, height: 24, label: "Samambaia" },
      { kind: "fern", x: 600, y: 50, width: 36, height: 24, label: "Samambaia" },
      { kind: "fern", x: 906, y: 484, width: 36, height: 24, label: "Samambaia" },
      { kind: "shroom", x: 300, y: 138, width: 16, height: 14, label: "Cogumelo" },
      { kind: "shroom", x: 866, y: 174, width: 16, height: 14, label: "Cogumelo" },
    ]);
  });

  it("clears any pre-existing obstacles before spawning the fixed layout", () => {
    const world = emptyWorld();
    world.obstacles.push({ kind: "desk", x: 0, y: 0, width: 10, height: 10, label: "stale" });

    spawnDatacenterObstacles(world);

    expect(world.obstacles).toHaveLength(14);
    expect(world.obstacles.some((obstacle) => obstacle.label === "stale")).toBe(false);
  });
});

describe("spawnDatacenterMoss", () => {
  it("generates exactly 12 moss patches with radius in the expected range", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const moss = spawnDatacenterMoss();

    expect(moss).toHaveLength(12);
    for (const patch of moss) {
      expect(patch.r).toBeGreaterThanOrEqual(14);
      expect(patch.r).toBeLessThanOrEqual(40);
    }
  });
});

describe("spawnDatacenterCracks", () => {
  it("generates exactly 9 cracks, each a 6-point polyline", () => {
    const cracks = spawnDatacenterCracks();

    expect(cracks).toHaveLength(9);
    for (const crack of cracks) {
      expect(crack).toHaveLength(6);
    }
  });
});
