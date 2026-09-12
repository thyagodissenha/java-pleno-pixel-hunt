import { describe, expect, it } from "vitest";
import { CONFIG } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/config";
import {
  applyPuddleSlow,
  spawnPuddlesForPhase,
  triggerMemorySurge,
} from "@/lib/pixel-hunt-engine/phases/secret-mainframe/hazards/puddles";
import { distance } from "@/lib/pixel-hunt-engine/geometry";
import type { EngineWorld, Obstacle, Puddle } from "@/lib/pixel-hunt-engine/types";

function makeWorld(playerX: number, playerY: number): EngineWorld {
  return {
    player: { x: playerX, y: playerY, hp: 100, maxHp: 100, size: 24, speed: CONFIG.PLAYER_SPEED_NORMAL, invincible: 0, fury: 0, focus: 0, haste: 0 },
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

describe("spawnPuddlesForPhase (SECBOSS-17)", () => {
  it("returns 2/4/6/8 puddles for phases 1..4, matching CONFIG.PHASES", () => {
    expect(spawnPuddlesForPhase(1)).toHaveLength(CONFIG.PHASES[0].puddles);
    expect(spawnPuddlesForPhase(2)).toHaveLength(CONFIG.PHASES[1].puddles);
    expect(spawnPuddlesForPhase(3)).toHaveLength(CONFIG.PHASES[2].puddles);
    expect(spawnPuddlesForPhase(4)).toHaveLength(CONFIG.PHASES[3].puddles);

    expect(spawnPuddlesForPhase(1)).toHaveLength(2);
    expect(spawnPuddlesForPhase(2)).toHaveLength(4);
    expect(spawnPuddlesForPhase(3)).toHaveLength(6);
    expect(spawnPuddlesForPhase(4)).toHaveLength(8);
  });

  it("spawns puddles with radius equal to their base radius (no Memory Surge active yet)", () => {
    for (const puddle of spawnPuddlesForPhase(3)) {
      expect(puddle.radius).toBe(puddle.baseRadius);
      expect(puddle.radius).toBe(CONFIG.PUDDLE_BASE_RADIUS);
    }
  });
});

describe("quick fix pós-feature: poças sorteadas nunca se sobrepõem entre si nem com barreiras", () => {
  it("never places two overlapping puddles — even accounting for the Memory Surge radius bonus — across phases and many random trials", () => {
    const spacingRadius = CONFIG.PUDDLE_BASE_RADIUS + CONFIG.MEMORY_SURGE_RADIUS_BONUS;
    for (let trial = 0; trial < 30; trial += 1) {
      for (const phaseIndex of [1, 2, 3, 4] as const) {
        const puddles = spawnPuddlesForPhase(phaseIndex);
        for (let i = 0; i < puddles.length; i += 1) {
          for (let j = i + 1; j < puddles.length; j += 1) {
            expect(distance(puddles[i], puddles[j])).toBeGreaterThanOrEqual(spacingRadius * 2);
          }
        }
      }
    }
  });

  it("never places a puddle overlapping a given obstacle (barrier), across many random trials", () => {
    const barrier: Obstacle = {
      kind: "firewall",
      x: 400,
      y: 200,
      width: CONFIG.BARRIER_WIDTH,
      height: CONFIG.BARRIER_HEIGHT,
      label: "Firewall",
    };
    const spacingRadius = CONFIG.PUDDLE_BASE_RADIUS + CONFIG.MEMORY_SURGE_RADIUS_BONUS;
    for (let trial = 0; trial < 30; trial += 1) {
      const puddles = spawnPuddlesForPhase(4, [barrier]);
      for (const puddle of puddles) {
        const closestX = Math.max(barrier.x, Math.min(puddle.x, barrier.x + barrier.width));
        const closestY = Math.max(barrier.y, Math.min(puddle.y, barrier.y + barrier.height));
        expect(Math.hypot(puddle.x - closestX, puddle.y - closestY)).toBeGreaterThanOrEqual(spacingRadius);
      }
    }
  });

  it("still returns the exact number of puddles required by the phase, even with the non-overlap constraint", () => {
    for (const phaseIndex of [1, 2, 3, 4] as const) {
      expect(spawnPuddlesForPhase(phaseIndex)).toHaveLength(CONFIG.PHASES[phaseIndex - 1].puddles);
    }
  });
});

describe("applyPuddleSlow (SECBOSS-18)", () => {
  it("slows the player to CONFIG.PLAYER_SPEED_IN_PUDDLE when inside a puddle's radius", () => {
    const puddles = spawnPuddlesForPhase(1);
    const world = makeWorld(puddles[0].x, puddles[0].y);

    applyPuddleSlow(world, puddles);

    expect(world.player.speed).toBe(CONFIG.PLAYER_SPEED_IN_PUDDLE);
  });

  it("restores CONFIG.PLAYER_SPEED_NORMAL when outside every puddle", () => {
    const puddles = spawnPuddlesForPhase(1);
    const world = makeWorld(-9999, -9999);

    applyPuddleSlow(world, puddles);

    expect(world.player.speed).toBe(CONFIG.PLAYER_SPEED_NORMAL);
  });

  it("never touches world.enemies — mobs are not affected by puddles", () => {
    const puddles = spawnPuddlesForPhase(1);
    const world = makeWorld(puddles[0].x, puddles[0].y);
    world.enemies.push({
      x: puddles[0].x,
      y: puddles[0].y,
      vx: 0,
      vy: 0,
      hp: 30,
      maxHp: 30,
      speed: 96,
      size: 22,
      kind: "daemon",
      label: "Daemon",
    });

    applyPuddleSlow(world, puddles);

    expect(world.enemies[0].speed).toBe(96);
  });
});

describe("triggerMemorySurge (SECBOSS-21, edge case §16.3)", () => {
  it("expands every puddle's radius by CONFIG.MEMORY_SURGE_RADIUS_BONUS over its base radius", () => {
    const puddles = spawnPuddlesForPhase(3);
    const surged = triggerMemorySurge(puddles);

    for (const puddle of surged) {
      expect(puddle.radius).toBe(puddle.baseRadius + CONFIG.MEMORY_SURGE_RADIUS_BONUS);
    }
  });

  it("does not stack the radius bonus when re-triggered while already active", () => {
    const puddles = spawnPuddlesForPhase(3);
    const once = triggerMemorySurge(puddles);
    const twice = triggerMemorySurge(once);

    for (let i = 0; i < twice.length; i += 1) {
      expect(twice[i].radius).toBe(once[i].radius);
      expect(twice[i].radius).toBe(puddles[i].baseRadius + CONFIG.MEMORY_SURGE_RADIUS_BONUS);
    }
  });

  it("does not mutate the input array (pure function)", () => {
    const puddles: Puddle[] = spawnPuddlesForPhase(1);
    const originalRadius = puddles[0].radius;

    triggerMemorySurge(puddles);

    expect(puddles[0].radius).toBe(originalRadius);
  });
});
