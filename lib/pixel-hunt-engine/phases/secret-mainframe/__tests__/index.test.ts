import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CHARACTER_ID, resolveCharacter } from "@/lib/characters";
import type { AudioEngine } from "@/lib/pixel-hunt-engine/audio";
import type { PhaseContext } from "@/lib/pixel-hunt-engine/phases/phase";
import { createSecretMainframePhase } from "@/lib/pixel-hunt-engine/phases/secret-mainframe";
import type { EngineWorld, InputState, SecretBossShot } from "@/lib/pixel-hunt-engine/types";

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

describe("SecretMainframePhase.enter", () => {
  it("positions the player near the bottom edge and spawns 2 daemons + 1 cron + the secretBoss", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    phase.enter(world, makeContext());

    expect(world.player.x).toBe(480);
    expect(world.player.y).toBe(540 - 90);

    const daemons = world.enemies.filter((enemy) => enemy.kind === "daemon");
    const crons = world.enemies.filter((enemy) => enemy.kind === "cron");
    const bosses = world.enemies.filter((enemy) => enemy.kind === "secretBoss");
    expect(daemons).toHaveLength(2);
    expect(crons).toHaveLength(1);
    expect(bosses).toHaveLength(1);
    expect(world.enemies).toHaveLength(4);
    expect(bosses[0].hp).toBe(520);
    expect(bosses[0].maxHp).toBe(520);

    expect(world.obstacles).toHaveLength(14);
    expect(world.run.bossSpawned).toBe(true);
    expect(phase.isComplete(world)).toBe(false);
  });

  it("calling enter() twice in a row does not duplicate the roster (invalid double-activation)", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    phase.enter(world, ctx);

    expect(world.enemies).toHaveLength(4);
    expect(world.enemies.filter((enemy) => enemy.kind === "secretBoss")).toHaveLength(1);
  });
});

describe("SecretMainframePhase.isComplete", () => {
  it("reflects defeat of the secretBoss (won)", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);

    const boss = world.enemies.find((enemy) => enemy.kind === "secretBoss")!;
    boss.hp = 1;
    world.shots.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, ttl: 50 });

    phase.update(world, ctx, makeInput(), 0.016);

    expect(phase.isComplete(world)).toBe(true);
  });

  it("reflects player defeat (over)", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);

    world.player.hp = 1;
    // Um daemon sobrepondo o jogador causa dano de toque via stepWorld.
    const daemon = world.enemies.find((enemy) => enemy.kind === "daemon")!;
    daemon.x = world.player.x;
    daemon.y = world.player.y;

    phase.update(world, ctx, makeInput(), 0.016);

    expect(phase.isComplete(world)).toBe(true);
  });

  it("stops updating once the phase is complete (no exceptions, empty events)", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    world.player.hp = 0;
    phase.update(world, ctx, makeInput(), 0.016);
    expect(phase.isComplete(world)).toBe(true);

    const events = phase.update(world, ctx, makeInput(), 0.016);

    expect(events.gameOver).toBe(false);
    expect(events.gameWon).toBe(false);
  });
});

describe("SecretMainframePhase.update — meeting zone slowdown", () => {
  it("restores the player's original speed after stepping (temporary adjustment only)", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    const originalSpeed = world.player.speed;
    // Coloca o jogador dentro da primeira zona de reunião.
    world.player.x = 300;
    world.player.y = 330;

    phase.update(world, ctx, makeInput(), 0.016);

    expect(world.player.speed).toBe(originalSpeed);
  });
});

describe("SecretMainframePhase.update — secret boss shot damage (ENGINE-25 regression)", () => {
  it("sets events.playerHit when a secret boss shot hits the unprotected player", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    const state = world.phaseState as { secretBossShots: SecretBossShot[] };
    state.secretBossShots.push({ x: world.player.x, y: world.player.y, vx: 0, vy: 0 });

    const events = phase.update(world, ctx, makeInput(), 0.016);

    expect(events.playerHit).toBe(true);
    expect(world.player.hp).toBe(90);
  });

  it("does not apply damage twice when the player is already invincible", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    world.player.invincible = 1;
    const state = world.phaseState as { secretBossShots: SecretBossShot[] };
    state.secretBossShots.push({ x: world.player.x, y: world.player.y, vx: 0, vy: 0 });

    const events = phase.update(world, ctx, makeInput(), 0.016);

    expect(events.playerHit).toBe(false);
    expect(world.player.hp).toBe(100);
  });
});

describe("SecretMainframePhase.draw", () => {
  it("delegates to the renderer without throwing", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);

    const fakeCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      ellipse: vi.fn(),
      quadraticCurveTo: vi.fn(),
      setLineDash: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      rect: vi.fn(),
      strokeText: vi.fn(),
      measureText: vi.fn(() => ({ width: 0 })),
    } as unknown as CanvasRenderingContext2D;

    expect(() => phase.draw(fakeCtx, world)).not.toThrow();
  });
});
