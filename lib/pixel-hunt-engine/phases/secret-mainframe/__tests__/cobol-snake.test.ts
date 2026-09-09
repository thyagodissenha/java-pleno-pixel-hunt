import { describe, expect, it, vi } from "vitest";
import { createCobolSnake, stepCobolSnake } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/cobol-snake";
import type { AudioEngine } from "@/lib/pixel-hunt-engine/audio";
import type { EngineWorld } from "@/lib/pixel-hunt-engine/types";

const WORLD_WIDTH = 960;

function makeAudio(): AudioEngine {
  return {
    playSound: vi.fn(),
    startMusic: vi.fn(),
    stopMusic: vi.fn(),
    setPrefs: vi.fn(),
  };
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

describe("createCobolSnake", () => {
  it("starts inactive, awaiting its first cooldown", () => {
    const snake = createCobolSnake();
    expect(snake.active).toBe(false);
    expect(snake.cd).toBeGreaterThan(0);
    expect(snake.hist).toEqual([]);
  });
});

describe("stepCobolSnake — activation after cooldown expires", () => {
  it("stays inactive while cd has not expired yet", () => {
    const world = emptyWorld();
    const snake = createCobolSnake();
    snake.cd = 1;
    stepCobolSnake(world, snake, makeAudio(), 0.2);

    expect(snake.active).toBe(false);
    expect(snake.cd).toBeCloseTo(0.8, 5);
  });

  it("activates once cd counts down to zero or below", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const world = emptyWorld();
    const snake = createCobolSnake();
    snake.cd = 0.1;

    stepCobolSnake(world, snake, makeAudio(), 0.2);

    expect(snake.active).toBe(true);
    expect(snake.t).toBe(0);
    expect(snake.dir).toBe(1); // Math.random() < 0.5 mockado para 0 → dir = 1
  });
});

describe("stepCobolSnake — deterministic trajectory while active", () => {
  it("moves along the expected sine path for a fixed dir/y0", () => {
    const world = emptyWorld();
    const snake = createCobolSnake();
    snake.active = true;
    snake.dir = 1;
    snake.y0 = 300;
    snake.t = 0;

    stepCobolSnake(world, snake, makeAudio(), 0.5);

    expect(snake.t).toBeCloseTo(0.5, 5);
    expect(snake.x).toBeCloseTo(-80 + 0.5 * 150, 5);
    expect(snake.y).toBeCloseTo(300 + Math.sin(0.5 * 3) * 46, 5);
    expect(snake.hist[0]).toEqual({ x: snake.x, y: snake.y });
  });

  it("moves in the opposite direction when dir is -1", () => {
    const world = emptyWorld();
    const snake = createCobolSnake();
    snake.active = true;
    snake.dir = -1;
    snake.y0 = 300;
    snake.t = 0;

    stepCobolSnake(world, snake, makeAudio(), 0.5);

    expect(snake.x).toBeCloseTo(WORLD_WIDTH + 80 - 0.5 * 150, 5);
  });
});

describe("stepCobolSnake — collision with the player", () => {
  it("damages the player and flags invincibility when within hit radius", () => {
    const world = emptyWorld();
    world.player.x = 500;
    world.player.y = 300;
    world.player.hp = 100;
    world.player.invincible = 0;
    const audio = makeAudio();
    const snake = createCobolSnake();
    snake.active = true;
    snake.dir = 1;
    // t chosen so the snake lands exactly on the player (delta=0 keeps t
    // unchanged for this step): x = -80 + t*150 = player.x, and y0 offsets
    // the sine term so y = player.y.
    snake.t = (world.player.x + 80) / 150;
    snake.y0 = world.player.y - Math.sin(snake.t * 3) * 46;

    stepCobolSnake(world, snake, audio, 0);

    expect(world.player.hp).toBe(80);
    expect(world.player.invincible).toBeGreaterThan(0);
    expect(audio.playSound).toHaveBeenCalledWith("hurt");
  });

  it("does not damage the player while player.invincible is active", () => {
    const world = emptyWorld();
    world.player.x = 500;
    world.player.y = 300;
    world.player.hp = 100;
    world.player.invincible = 1;
    const audio = makeAudio();
    const snake = createCobolSnake();
    snake.active = true;
    snake.dir = 1;
    snake.t = (world.player.x + 80) / 150;
    snake.y0 = world.player.y - Math.sin(snake.t * 3) * 46;

    stepCobolSnake(world, snake, audio, 0);

    expect(world.player.hp).toBe(100);
    expect(audio.playSound).not.toHaveBeenCalled();
  });

  it("deactivates and schedules a new cooldown once it leaves the arena", () => {
    const world = emptyWorld();
    const audio = makeAudio();
    const snake = createCobolSnake();
    snake.active = true;
    snake.dir = 1;
    snake.y0 = 300;
    snake.t = 10; // far past the right edge

    stepCobolSnake(world, snake, audio, 0);

    expect(snake.active).toBe(false);
    expect(snake.cd).toBeGreaterThanOrEqual(12);
  });
});
