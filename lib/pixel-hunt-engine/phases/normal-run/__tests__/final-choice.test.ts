import { describe, expect, it } from "vitest";
import { isFinalChoicePowerUp, spawnFinalChoices } from "@/lib/pixel-hunt-engine/phases/normal-run/final-choice";
import type { EngineWorld } from "@/lib/pixel-hunt-engine/types";

function makeWorld(overrides: Partial<EngineWorld> = {}): EngineWorld {
  return {
    player: { x: 480, y: 270, hp: 100, maxHp: 100, size: 24, speed: 210, invincible: 0, fury: 0, focus: 0, haste: 0 },
    enemies: [{ x: 1, y: 1, vx: 0, vy: 0, hp: 1, maxHp: 1, speed: 1, size: 1, kind: "user", label: "x" }],
    shots: [{ x: 1, y: 1, vx: 0, vy: 0, ttl: 1 }],
    particles: [],
    powerUps: [],
    obstacles: [{ x: 1, y: 1, width: 1, height: 1, kind: "desk", label: "x" }],
    run: {
      score: 0,
      wave: 1,
      callLoops: 0,
      bossIndex: 3,
      bossKills: 0,
      bossSpawned: false,
      finalChoicePending: false,
      weaponLevel: 1,
      burstStamina: 100,
      abilityCooldownRemaining: 0,
      damageFlash: 0,
      shake: 10,
      bossBanner: 10,
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

describe("isFinalChoicePowerUp", () => {
  it("is true only for 'promotion' and 'call'", () => {
    expect(isFinalChoicePowerUp("promotion")).toBe(true);
    expect(isFinalChoicePowerUp("call")).toBe(true);
    expect(isFinalChoicePowerUp("coffee")).toBe(false);
    expect(isFinalChoicePowerUp("hotfix")).toBe(false);
  });
});

describe("spawnFinalChoices", () => {
  it("places 'promotion' and 'call' offset from a centered player position, clears the arena, and marks run flags", () => {
    const world = makeWorld({ player: { ...makeWorld().player, x: 480, y: 270 } });
    spawnFinalChoices(world, 480, 270);

    expect(world.run.finalChoicePending).toBe(true);
    expect(world.run.bossSpawned).toBe(true);
    expect(world.run.finalBossCorpse).toEqual({ x: 480, y: 270 });
    expect(world.enemies).toHaveLength(0);
    expect(world.shots).toHaveLength(0);
    expect(world.obstacles).toHaveLength(0);

    expect(world.powerUps).toHaveLength(2);
    const promotion = world.powerUps.find((p) => p.kind === "promotion")!;
    const call = world.powerUps.find((p) => p.kind === "call")!;
    expect(promotion.x).toBe(480 - 104);
    expect(call.x).toBe(480 + 104);
    expect(promotion.y).toBe(270 - 76);
    expect(call.y).toBe(promotion.y);
  });

  it("clamps the choice position near the world edge instead of pushing choices off-screen", () => {
    // Jogador colado na borda esquerda: sem o clamp, `x - 104` ficaria bem
    // negativo (fora da arena, 960x540).
    const world = makeWorld({ player: { ...makeWorld().player, x: 10, y: 10 } });
    spawnFinalChoices(world, 10, 10);

    const promotion = world.powerUps.find((p) => p.kind === "promotion")!;
    const call = world.powerUps.find((p) => p.kind === "call")!;
    // choiceCenterX clamped to FINAL_CHOICE_OFFSET_X + 40 = 144
    expect(promotion.x).toBe(144 - 104);
    expect(call.x).toBe(144 + 104);
    // choiceY clamped to 120 (player.y - 76 = -66, below the 120 floor)
    expect(promotion.y).toBe(120);
  });
});
