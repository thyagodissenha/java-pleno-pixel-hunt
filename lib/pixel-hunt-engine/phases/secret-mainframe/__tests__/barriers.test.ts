import { describe, expect, it, vi } from "vitest";
import { circleIntersectsRect, pointInRect, rectsOverlap } from "@/lib/obstacles";
import { CONFIG } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/config";
import {
  ESCAPE_CORRIDOR_Y_MIN,
  spawnBarriersForPhase,
} from "@/lib/pixel-hunt-engine/phases/secret-mainframe/hazards/barriers";
import { stepWorld } from "@/lib/pixel-hunt-engine/physics";
import type { AudioEngine } from "@/lib/pixel-hunt-engine/audio";
import type { EngineWorld } from "@/lib/pixel-hunt-engine/types";

function makeAudio(): AudioEngine {
  return { playSound: vi.fn(), startMusic: vi.fn(), stopMusic: vi.fn(), setPrefs: vi.fn() };
}

function makeWorld(): EngineWorld {
  return {
    player: { x: 480, y: 450, hp: 100, maxHp: 100, size: 24, speed: 170, invincible: 0, fury: 0, focus: 0, haste: 0 },
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

describe("spawnBarriersForPhase (SECBOSS-17)", () => {
  it("pushes 1/2/3/4 firewall obstacles for phases 1..4", () => {
    for (const phaseIndex of [1, 2, 3, 4] as const) {
      const world = makeWorld();
      spawnBarriersForPhase(world, phaseIndex);
      expect(world.obstacles).toHaveLength(CONFIG.PHASES[phaseIndex - 1].barriers);
      expect(world.obstacles).toHaveLength(phaseIndex);
      for (const obstacle of world.obstacles) {
        expect(obstacle.kind).toBe("firewall");
        expect(obstacle.width).toBe(CONFIG.BARRIER_WIDTH);
        expect(obstacle.height).toBe(CONFIG.BARRIER_HEIGHT);
      }
    }
  });
});

describe("barrier slot geometry — never fully encloses the player (SECBOSS-20, edge case §16.6)", () => {
  it("keeps every barrier above the escape corridor, for every phase and many random trials, guaranteeing a free horizontal route", () => {
    // Quick fix pós-feature: as posições agora são sorteadas por chamada —
    // repete muitas vezes para dar confiança estatística de que a
    // invariante vale por construção (zona de sorteio confinada acima do
    // corredor), não só "por sorte" numa única amostra.
    for (let trial = 0; trial < 30; trial += 1) {
      for (const phaseIndex of [1, 2, 3, 4] as const) {
        const world = makeWorld();
        spawnBarriersForPhase(world, phaseIndex);
        for (const obstacle of world.obstacles) {
          expect(obstacle.y + obstacle.height).toBeLessThan(ESCAPE_CORRIDOR_Y_MIN);
        }
      }
    }
  });
});

describe("quick fix pós-feature: barreiras sorteadas nunca se sobrepõem entre si", () => {
  it("never places two overlapping barriers, across phases and many random trials", () => {
    for (let trial = 0; trial < 30; trial += 1) {
      for (const phaseIndex of [1, 2, 3, 4] as const) {
        const world = makeWorld();
        spawnBarriersForPhase(world, phaseIndex);
        for (let i = 0; i < world.obstacles.length; i += 1) {
          for (let j = i + 1; j < world.obstacles.length; j += 1) {
            expect(rectsOverlap(world.obstacles[i], world.obstacles[j])).toBe(false);
          }
        }
      }
    }
  });

  it("still places the exact number of barriers required by the phase, even with the non-overlap constraint", () => {
    for (const phaseIndex of [1, 2, 3, 4] as const) {
      const world = makeWorld();
      spawnBarriersForPhase(world, phaseIndex);
      expect(world.obstacles).toHaveLength(CONFIG.PHASES[phaseIndex - 1].barriers);
    }
  });
});

describe("barrier collision — blocks the player and the player's shots (SECBOSS-19)", () => {
  it("blocks a player-sized circle centered on the barrier (obstacleBlocksCircle's own primitive)", () => {
    const world = makeWorld();
    spawnBarriersForPhase(world, 1);
    const barrier = world.obstacles[0];
    const centerX = barrier.x + barrier.width / 2;
    const centerY = barrier.y + barrier.height / 2;

    expect(circleIntersectsRect({ x: centerX, y: centerY, radius: 12 }, barrier)).toBe(true);
  });

  it("blocks a player shot landing on the barrier (pointInRect, same primitive updateShots uses)", () => {
    const world = makeWorld();
    spawnBarriersForPhase(world, 1);
    const barrier = world.obstacles[0];
    const shotPoint = { x: barrier.x + barrier.width / 2, y: barrier.y + barrier.height / 2 };

    expect(pointInRect(shotPoint, barrier)).toBe(true);
  });
});

describe("barrier collision — enemies pass through freely (SECBOSS-19, verified against physics.ts's real stepWorld)", () => {
  it("does not stop an enemy moving straight through a barrier's rectangle", () => {
    const world = makeWorld();
    spawnBarriersForPhase(world, 1);
    const barrier = world.obstacles[0];
    const centerX = barrier.x + barrier.width / 2;
    const centerY = barrier.y + barrier.height / 2;

    world.enemies.push({
      x: centerX - 40,
      y: centerY,
      vx: 400,
      vy: 0,
      hp: 30,
      maxHp: 30,
      speed: 96,
      size: 22,
      kind: "daemon",
      label: "Daemon",
      // `customMovement: true` faz `stepWorld` deixar vx/vy como estão
      // (a Phase que o spawna é quem move) — usado aqui só para congelar a
      // velocidade fixa do teste, sem `updateEnemyMovement` sobrescrevê-la
      // mirando no jogador.
      customMovement: true,
    });

    stepWorld(world, { keys: new Set(), pointer: { active: false, x: 0, y: 0 } }, 0.2, makeAudio());

    // `enemy.x += enemy.vx * delta` sem checagem de `obstacles` — a
    // posição avança livremente através do retângulo da barreira.
    expect(world.enemies[0].x).toBeGreaterThan(centerX - 40);
  });
});
