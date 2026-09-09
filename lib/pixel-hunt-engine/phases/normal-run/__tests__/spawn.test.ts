import { describe, expect, it, vi } from "vitest";
import type { AudioEngine } from "@/lib/pixel-hunt-engine/audio";
import { obstacleCount } from "@/lib/obstacles";
import { spawnEnemy, spawnObstacles, spawnPowerUp } from "@/lib/pixel-hunt-engine/phases/normal-run/spawn";
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

describe("spawnEnemy", () => {
  it("spawns a 'user' with the stats table's base hp/speed/size for wave 1", () => {
    const world = makeWorld();
    const actor = spawnEnemy(world, "user", makeAudio());
    expect(actor.hp).toBe(28);
    expect(actor.speed).toBe(68);
    expect(actor.size).toBe(24);
    expect(actor.kind).toBe("user");
    expect(world.enemies).toContain(actor);
  });

  it("spawns a 'data' with the stats table's base hp/speed/size", () => {
    const world = makeWorld();
    const actor = spawnEnemy(world, "data", makeAudio());
    expect(actor.hp).toBe(16);
    expect(actor.speed).toBe(86);
    expect(actor.size).toBe(22);
  });

  it("spawns a non-final boss with wave-scaled hp and no bossPhase, and plays the 'boss' sound", () => {
    const world = makeWorld({ run: { ...makeWorld().run, wave: 2, bossIndex: 0 } });
    const audio = makeAudio();
    const actor = spawnEnemy(world, "boss", audio);
    expect(actor.hp).toBe(160 + 2 * 28);
    expect(actor.bossPhase).toBeUndefined();
    expect(audio.playSound).toHaveBeenCalledWith("boss");
    expect(world.run.bossBanner).toBe(120);
  });

  it("spawns the final boss (last bossIndex) with finalBossHp(1, wave) and bossPhase 1", () => {
    // bossNames tem 4 entradas — bossIndex 3 é o último (chefe final).
    const world = makeWorld({ run: { ...makeWorld().run, wave: 5, bossIndex: 3 } });
    const actor = spawnEnemy(world, "boss", makeAudio());
    expect(actor.hp).toBe(210 + 1 * 48 + 5 * 22);
    expect(actor.bossPhase).toBe(1);
    expect(actor.label).toBe("Diretoria");
  });

  it("scales hp by resets (callLoops) via scaledEnemyHp", () => {
    const world = makeWorld({ run: { ...makeWorld().run, callLoops: 1 } });
    const actor = spawnEnemy(world, "user", makeAudio());
    expect(actor.hp).toBe(Math.ceil(28 * 1.25));
  });
});

describe("spawnObstacles", () => {
  it("generates obstacleCount(callLoops) obstacles with no overlap between them, the player, or the world center", () => {
    const world = makeWorld({ run: { ...makeWorld().run, callLoops: 2 } });
    spawnObstacles(world);

    expect(world.obstacles).toHaveLength(obstacleCount(2));
    for (let i = 0; i < world.obstacles.length; i += 1) {
      for (let j = i + 1; j < world.obstacles.length; j += 1) {
        const a = world.obstacles[i];
        const b = world.obstacles[j];
        const overlaps =
          a.x < b.x + b.width + 26 &&
          a.x + a.width + 26 > b.x &&
          a.y < b.y + b.height + 26 &&
          a.y + a.height + 26 > b.y;
        expect(overlaps).toBe(false);
      }
    }
  });
});

describe("spawnPowerUp", () => {
  it("adds a power-up placed away from any obstacle", () => {
    const world = makeWorld();
    spawnPowerUp(world);
    expect(world.powerUps).toHaveLength(1);
  });
});
