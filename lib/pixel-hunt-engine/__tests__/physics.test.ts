import { describe, expect, it, vi } from "vitest";
import { CHARACTERS, resolveCharacter } from "@/lib/characters";
import type { AudioEngine } from "@/lib/pixel-hunt-engine/audio";
import {
  clearNearbyEnemies,
  computeBossVolleyPlan,
  finalBossHp,
  resolveFinalChoiceClickPowerUp,
  scaledEnemyHp,
  shoot,
  stepWorld,
  triggerActivePower,
} from "@/lib/pixel-hunt-engine/physics";
import { FINAL_CHOICE_CLICK_RADIUS } from "@/lib/pixel-hunt-engine/phases/normal-run/final-choice";
import type { Actor, EngineWorld, InputState, Obstacle, PowerUpKind } from "@/lib/pixel-hunt-engine/types";

function makeAudio(): AudioEngine {
  return {
    playSound: vi.fn(),
    startMusic: vi.fn(),
    stopMusic: vi.fn(),
    setPrefs: vi.fn(),
  };
}

function makeInput(overrides: Partial<InputState> = {}): InputState {
  return {
    keys: new Set<string>(),
    pointer: { active: false, x: 480, y: 270 },
    ...overrides,
  };
}

function makeWorld(overrides: Partial<EngineWorld> = {}): EngineWorld {
  return {
    player: {
      x: 480,
      y: 270,
      hp: 100,
      maxHp: 100,
      size: 24,
      speed: 210,
      invincible: 0,
      fury: 0,
      focus: 0,
      haste: 0,
    },
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
      shotTimer: 1,
      lastMoveX: 0,
      lastMoveY: 0,
    },
    phaseState: null,
    ...overrides,
  };
}

function makeEnemy(overrides: Partial<Actor> = {}): Actor {
  return {
    x: 480,
    y: 270,
    vx: 0,
    vy: 0,
    hp: 30,
    maxHp: 30,
    speed: 60,
    size: 24,
    kind: "user",
    label: "Usuário",
    ...overrides,
  };
}

function makeObstacle(overrides: Partial<Obstacle> = {}): Obstacle {
  return { x: 0, y: 0, width: 100, height: 100, kind: "desk", label: "Mesa", ...overrides };
}

describe("stepWorld", () => {
  it("runs without throwing in a plain Node/Vitest environment (no window/HTMLCanvasElement dependency)", () => {
    const world = makeWorld();
    expect(() => stepWorld(world, makeInput(), 0.016, makeAudio())).not.toThrow();
  });

  it("moves the player according to held movement keys", () => {
    const world = makeWorld({ player: { ...makeWorld().player, x: 480, y: 270 } });
    const input = makeInput({ keys: new Set(["d"]) });
    stepWorld(world, input, 0.5, makeAudio());
    expect(world.player.x).toBeGreaterThan(480);
  });

  it("moves the player towards an active pointer far enough away", () => {
    const world = makeWorld();
    const input = makeInput({ pointer: { active: true, x: 900, y: 270 } });
    stepWorld(world, input, 0.5, makeAudio());
    expect(world.player.x).toBeGreaterThan(480);
  });

  it("blocks player movement into an obstacle (player-obstacle collision)", () => {
    // Obstáculo colado à direita do jogador — mover para a direita deve ser bloqueado.
    const world = makeWorld({
      obstacles: [makeObstacle({ x: 500, y: 250, width: 200, height: 60 })],
    });
    const input = makeInput({ keys: new Set(["d"]) });
    const startX = world.player.x;
    stepWorld(world, input, 0.5, makeAudio());
    expect(world.player.x).toBe(startX);
  });

  it("allows player movement when no obstacle blocks the path", () => {
    const world = makeWorld({ obstacles: [makeObstacle({ x: -500, y: -500, width: 10, height: 10 })] });
    const input = makeInput({ keys: new Set(["d"]) });
    const startX = world.player.x;
    stepWorld(world, input, 0.5, makeAudio());
    expect(world.player.x).toBeGreaterThan(startX);
  });

  it("damages an enemy hit by a player shot, and removes the shot", () => {
    const world = makeWorld({
      enemies: [makeEnemy({ x: 300, y: 270, hp: 30, maxHp: 30 })],
      shots: [{ x: 300, y: 270, vx: 0, vy: 0, ttl: 50 }],
    });
    stepWorld(world, makeInput(), 0.016, makeAudio());
    expect(world.enemies[0].hp).toBeLessThan(30);
    expect(world.shots).toHaveLength(0);
  });

  it("kills an enemy whose hp drops to 0 or below from a shot, awarding score", () => {
    const world = makeWorld({
      enemies: [makeEnemy({ x: 300, y: 270, hp: 5, maxHp: 30, kind: "user" })],
      shots: [{ x: 300, y: 270, vx: 0, vy: 0, ttl: 50 }],
    });
    stepWorld(world, makeInput(), 0.016, makeAudio());
    expect(world.enemies).toHaveLength(0);
    expect(world.run.score).toBeGreaterThan(0);
  });

  it("plays a hit sound when a shot connects", () => {
    const audio = makeAudio();
    const world = makeWorld({
      enemies: [makeEnemy({ x: 300, y: 270, hp: 30 })],
      shots: [{ x: 300, y: 270, vx: 0, vy: 0, ttl: 50 }],
    });
    stepWorld(world, makeInput(), 0.016, audio);
    expect(audio.playSound).toHaveBeenCalledWith("hit");
  });

  it("damages the player on contact with a live enemy and reports playerHit", () => {
    const world = makeWorld({
      enemies: [makeEnemy({ x: 480, y: 270, hp: 30 })],
    });
    const events = stepWorld(world, makeInput(), 0.016, makeAudio());
    expect(world.player.hp).toBeLessThan(100);
    expect(events.playerHit).toBe(true);
  });

  it("does not damage the player while invincible", () => {
    const world = makeWorld({
      enemies: [makeEnemy({ x: 480, y: 270, hp: 30 })],
    });
    world.player.invincible = 1;
    const events = stepWorld(world, makeInput(), 0.016, makeAudio());
    expect(world.player.hp).toBe(100);
    expect(events.playerHit).toBe(false);
  });

  it("reports gameOver once player hp drops to 0 or below", () => {
    const world = makeWorld();
    world.player.hp = 1;
    world.enemies.push(makeEnemy({ x: 480, y: 270, hp: 30 }));
    const events = stepWorld(world, makeInput(), 0.016, makeAudio());
    expect(world.player.hp).toBe(0);
    expect(events.gameOver).toBe(true);
  });
});

describe("finalBossHp / scaledEnemyHp (canonicalized in physics.ts, ENGINE-21)", () => {
  it("finalBossHp is exported from physics.ts and matches the documented formula (210 + phase*48 + wave*22)", () => {
    expect(finalBossHp(1, 5)).toBe(210 + 1 * 48 + 5 * 22);
    expect(finalBossHp(2, 3)).toBe(210 + 2 * 48 + 3 * 22);
  });

  it("scaledEnemyHp is exported from physics.ts and matches the documented formula (ceil(baseHp * (1 + resets*0.25)))", () => {
    expect(scaledEnemyHp(100, 0)).toBe(100);
    expect(scaledEnemyHp(100, 1)).toBe(125);
    expect(scaledEnemyHp(80, 2)).toBe(120);
  });
});

describe("resolveFinalChoiceClickPowerUp (fix1, fundação de ENGINE-16)", () => {
  it("resolves 'promotion' when the click lands within FINAL_CHOICE_CLICK_RADIUS", () => {
    const world = makeWorld({
      powerUps: [{ x: 500, y: 300, kind: "promotion", ttl: 99999, pulse: 0 }],
    });
    const events = resolveFinalChoiceClickPowerUp(world, makeAudio(), 500, 300);
    expect(events).not.toBeNull();
    expect(events!.promotionClaimed).toBe(true);
    expect(world.powerUps).toHaveLength(0);
  });

  it("resolves 'call' when the click lands within FINAL_CHOICE_CLICK_RADIUS", () => {
    const world = makeWorld({
      powerUps: [{ x: 500, y: 300, kind: "call", ttl: 99999, pulse: 0 }],
    });
    const events = resolveFinalChoiceClickPowerUp(world, makeAudio(), 500, 300);
    expect(events).not.toBeNull();
    expect(events!.newCallRequested).toBe(true);
    expect(world.powerUps).toHaveLength(0);
  });

  it("returns null and removes nothing when the click lands outside the radius", () => {
    const world = makeWorld({
      powerUps: [{ x: 500, y: 300, kind: "promotion", ttl: 99999, pulse: 0 }],
    });
    const events = resolveFinalChoiceClickPowerUp(world, makeAudio(), 500 + FINAL_CHOICE_CLICK_RADIUS + 10, 300);
    expect(events).toBeNull();
    expect(world.powerUps).toHaveLength(1);
  });

  it("returns null when there is no final-choice power-up present", () => {
    const world = makeWorld({ powerUps: [] });
    const events = resolveFinalChoiceClickPowerUp(world, makeAudio(), 500, 300);
    expect(events).toBeNull();
  });

  it("ignores non-final-choice power-ups even within the radius", () => {
    const world = makeWorld({
      powerUps: [{ x: 500, y: 300, kind: "coffee", ttl: 99999, pulse: 0 }],
    });
    const events = resolveFinalChoiceClickPowerUp(world, makeAudio(), 500, 300);
    expect(events).toBeNull();
    expect(world.powerUps).toHaveLength(1);
  });
});

describe("collectPowerUp via stepWorld (fix1, ENGINE-18 — FrameEvents.powerUpCollected)", () => {
  const allPowerUpKinds: PowerUpKind[] = [
    "coffee",
    "refactor",
    "rollback",
    "hotfix",
    "review",
    "stamina",
    "promotion",
    "call",
  ];

  it.each(allPowerUpKinds)("sets events.powerUpCollected = true when a '%s' power-up is collected", (kind) => {
    const world = makeWorld({
      powerUps: [{ x: 480, y: 270, kind, ttl: 999, pulse: 0 }],
    });
    const events = stepWorld(world, makeInput(), 0.016, makeAudio());
    expect(events.powerUpCollected).toBe(true);
  });

  it("does not set events.powerUpCollected when no power-up is collected this frame", () => {
    const world = makeWorld({ powerUps: [] });
    const events = stepWorld(world, makeInput(), 0.016, makeAudio());
    expect(events.powerUpCollected).toBe(false);
  });
});

describe("shoot", () => {
  it("fires a shot from the player position", () => {
    const world = makeWorld();
    shoot(world, makeInput(), makeAudio());
    expect(world.shots).toHaveLength(1);
  });
});

describe("clearNearbyEnemies", () => {
  it("removes non-boss enemies within radius and awards score", () => {
    const world = makeWorld({
      enemies: [makeEnemy({ x: 480, y: 270, hp: 10 }), makeEnemy({ x: 800, y: 270, hp: 10 })],
    });
    clearNearbyEnemies(world, 50);
    expect(world.enemies).toHaveLength(1);
    expect(world.enemies[0].x).toBe(800);
    expect(world.run.score).toBeGreaterThan(0);
  });

  it("never removes a boss enemy", () => {
    const world = makeWorld({
      enemies: [makeEnemy({ x: 480, y: 270, hp: 10, kind: "boss" })],
    });
    clearNearbyEnemies(world, 500);
    expect(world.enemies).toHaveLength(1);
  });
});

describe("triggerActivePower", () => {
  it("dash character: dashes the player and clears nearby enemies", () => {
    const character = resolveCharacter("dev-pleno", CHARACTERS); // dash + clearRadius
    const world = makeWorld({
      enemies: [makeEnemy({ x: 480, y: 270, hp: 10 })],
    });
    world.run.lastMoveX = 1;
    world.run.lastMoveY = 0;
    const startX = world.player.x;
    triggerActivePower(world, character);
    expect(world.player.x).not.toBe(startX);
    expect(world.enemies).toHaveLength(0); // cleared by the dash's clearRadius
    expect(world.run.abilityCooldownRemaining).toBeGreaterThan(0);
  });

  it("haste character: grants temporary haste", () => {
    const character = resolveCharacter("estagiario", CHARACTERS); // haste
    const world = makeWorld();
    triggerActivePower(world, character);
    expect(world.player.haste).toBeGreaterThan(0);
    expect(world.run.abilityCooldownRemaining).toBeGreaterThan(0);
  });

  it("shield character: grants temporary invincibility", () => {
    const character = resolveCharacter("sre", CHARACTERS); // shield
    const world = makeWorld();
    triggerActivePower(world, character);
    expect(world.player.invincible).toBeGreaterThan(0);
  });

  it("does nothing while the ability is on cooldown", () => {
    const character = resolveCharacter("estagiario", CHARACTERS);
    const world = makeWorld();
    world.run.abilityCooldownRemaining = 5;
    triggerActivePower(world, character);
    expect(world.player.haste).toBe(0);
  });
});

describe("computeBossVolleyPlan (GOLIVESPLIT-04 — wave-4 non-final boss volley pattern)", () => {
  it("returns pattern=3 (bossIndex % 4) and volleySize=5 for the wave-4 boss (bossIndex:3, no bossPhase)", () => {
    const world = makeWorld({ run: { ...makeWorld().run, bossIndex: 3, wave: 4 } });
    const boss = makeEnemy({ kind: "boss", label: "Chefe", cooldown: 0 });
    const plan = computeBossVolleyPlan(boss, world.run);
    expect(plan).not.toBeNull();
    expect(plan!.pattern).toBe(3);
    expect(plan!.volleySize).toBe(5);
  });

  it("stepWorld spawns 'incident' (P1) shots for the wave-4 boss volley", () => {
    const world = makeWorld({
      run: { ...makeWorld().run, bossIndex: 3, wave: 4 },
      enemies: [makeEnemy({ kind: "boss", label: "Chefe", cooldown: 0, x: 480, y: 100 })],
    });
    stepWorld(world, makeInput(), 0.016, makeAudio());
    const spawnedIncidents = world.enemies.filter((e) => e.kind === "incident");
    expect(spawnedIncidents.length).toBeGreaterThan(0);
    expect(spawnedIncidents.every((e) => e.label === "P1")).toBe(true);
  });
});
