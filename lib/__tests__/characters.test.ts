import { describe, expect, it } from "vitest";
import {
  CHARACTERS,
  DEFAULT_CHARACTER_ID,
  type CharacterDefinition,
  resolveCharacter,
  resolveDashDirection,
} from "@/lib/characters";

describe("CHARACTERS registry", () => {
  it("contains exactly one character with the Dev Pleno definition", () => {
    expect(CHARACTERS).toHaveLength(1);
    expect(CHARACTERS[0]).toMatchObject({
      id: "dev-pleno",
      name: "Dev Pleno",
      maxHp: 100,
      speed: 210,
      size: 24,
      specialPower: {
        id: "refactor-dash",
        name: "Refactor Dash",
        cooldownSeconds: 6,
        dashDistance: 140,
      },
    });
  });

  it("points DEFAULT_CHARACTER_ID at the first registry entry", () => {
    expect(DEFAULT_CHARACTER_ID).toBe(CHARACTERS[0].id);
  });

  it("validates every registry entry has positive maxHp/speed/size and non-negative power cooldown", () => {
    for (const character of CHARACTERS) {
      expect(character.maxHp).toBeGreaterThan(0);
      expect(character.speed).toBeGreaterThan(0);
      expect(character.size).toBeGreaterThan(0);
      if (character.specialPower) {
        expect(character.specialPower.cooldownSeconds).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("resolveCharacter", () => {
  it("falls back to the first registry entry when id is undefined", () => {
    expect(resolveCharacter(undefined)).toBe(CHARACTERS[0]);
  });

  it("falls back to the first registry entry when id does not exist", () => {
    expect(resolveCharacter("id-inexistente")).toBe(CHARACTERS[0]);
  });

  it("resolves generically by id against an injected registry with a second entry that exists only in this test", () => {
    const testOnlyCharacter: CharacterDefinition = {
      id: "test-only",
      name: "Test Only",
      maxHp: 50,
      speed: 100,
      size: 10,
      specialPower: {
        id: "test-power",
        name: "Test Power",
        description: "Poder fictício usado apenas neste teste.",
        cooldownSeconds: 3,
        dashDistance: 42,
      },
    };
    const testRegistry: readonly CharacterDefinition[] = [CHARACTERS[0], testOnlyCharacter];

    // Exercises the real resolveCharacter implementation (not a re-implementation in the
    // test) with an injected 2-entry registry, proving it resolves the second entry
    // generically without any change to app/page.tsx or the CHARACTERS array itself.
    const resolved = resolveCharacter(testOnlyCharacter.id, testRegistry);

    expect(resolved).toBe(testOnlyCharacter);
    expect(resolved).toEqual(testOnlyCharacter);
    expect(resolveCharacter(CHARACTERS[0].id, testRegistry)).toBe(CHARACTERS[0]);
  });
});

describe("resolveDashDirection", () => {
  it("normalizes a non-zero movement direction into a unit vector", () => {
    const result = resolveDashDirection({ x: 3, y: 4 }, { x: 0, y: 0 }, []);
    expect(result.x).toBeCloseTo(0.6);
    expect(result.y).toBeCloseTo(0.8);
    expect(Math.hypot(result.x, result.y)).toBeCloseTo(1);
  });

  it("aims at the nearest enemy when stationary and enemies are on screen", () => {
    const player = { x: 0, y: 0 };
    const nearEnemy = { x: 10, y: 0 };
    const farEnemy = { x: 0, y: 100 };
    const result = resolveDashDirection({ x: 0, y: 0 }, player, [farEnemy, nearEnemy]);
    expect(result.x).toBeCloseTo(1);
    expect(result.y).toBeCloseTo(0);
  });

  it("falls back to (0, -1) when stationary with no enemies on screen", () => {
    const result = resolveDashDirection({ x: 0, y: 0 }, { x: 0, y: 0 }, []);
    expect(result).toEqual({ x: 0, y: -1 });
  });

  it("falls back to (0, -1) instead of a zero vector when the nearest enemy is exactly at the player's position", () => {
    const player = { x: 50, y: 50 };
    const result = resolveDashDirection({ x: 0, y: 0 }, player, [{ x: 50, y: 50 }]);
    expect(result).toEqual({ x: 0, y: -1 });
    expect(Number.isNaN(result.x)).toBe(false);
    expect(Number.isNaN(result.y)).toBe(false);
  });
});
