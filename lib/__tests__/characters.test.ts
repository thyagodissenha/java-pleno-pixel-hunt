import { describe, expect, it } from "vitest";
import {
  CHARACTERS,
  DEFAULT_CHARACTER_ID,
  type CharacterDefinition,
  resolveCharacter,
  resolveDashDirection,
} from "@/lib/characters";

describe("CHARACTERS registry", () => {
  it("contains exactly three characters: Dev Pleno (dash), Estagiário (haste), SRE (shield)", () => {
    expect(CHARACTERS).toHaveLength(3);
    expect(CHARACTERS[0]).toMatchObject({
      id: "dev-pleno",
      name: "Dev Pleno",
      maxHp: 100,
      speed: 210,
      size: 24,
      bodyColor: "#0ea5e9",
      specialPower: {
        id: "refactor-dash",
        name: "Refactor Dash",
        cooldownSeconds: 6,
        kind: "dash",
        dashDistance: 140,
      },
    });
    expect(CHARACTERS[1]).toMatchObject({
      id: "estagiario",
      name: "Estagiário",
      maxHp: 70,
      speed: 260,
      size: 20,
      bodyColor: "#2dd4bf",
      specialPower: {
        name: "Já Terminei!",
        cooldownSeconds: 10,
        kind: "haste",
        durationSeconds: 4,
      },
    });
    expect(CHARACTERS[2]).toMatchObject({
      id: "sre",
      name: "SRE",
      maxHp: 130,
      speed: 190,
      size: 28,
      bodyColor: "#64748b",
      specialPower: {
        name: "Modo Incident Response",
        cooldownSeconds: 30,
        kind: "shield",
        durationSeconds: 2.5,
      },
    });
  });

  it("gives the Estagiário lower maxHp, higher speed and smaller size than the Dev Pleno (CHAR-13)", () => {
    const devPleno = CHARACTERS[0];
    const estagiario = CHARACTERS[1];
    expect(estagiario.maxHp).toBeLessThan(devPleno.maxHp);
    expect(estagiario.speed).toBeGreaterThan(devPleno.speed);
    expect(estagiario.size).toBeLessThan(devPleno.size);
  });

  it("gives the SRE higher maxHp, equal-or-lower speed and larger size than the Dev Pleno (CHAR-14)", () => {
    const devPleno = CHARACTERS[0];
    const sre = CHARACTERS[2];
    expect(sre.maxHp).toBeGreaterThan(devPleno.maxHp);
    expect(sre.speed).toBeLessThanOrEqual(devPleno.speed);
    expect(sre.size).toBeGreaterThan(devPleno.size);
  });

  it("points DEFAULT_CHARACTER_ID at the first registry entry", () => {
    expect(DEFAULT_CHARACTER_ID).toBe(CHARACTERS[0].id);
  });

  it("validates every registry entry has positive maxHp/speed/size, non-negative power cooldown, and positive kind-specific fields", () => {
    for (const character of CHARACTERS) {
      expect(character.maxHp).toBeGreaterThan(0);
      expect(character.speed).toBeGreaterThan(0);
      expect(character.size).toBeGreaterThan(0);
      if (character.specialPower) {
        expect(character.specialPower.cooldownSeconds).toBeGreaterThanOrEqual(0);
        if (character.specialPower.kind === "dash") {
          expect(character.specialPower.dashDistance).toBeGreaterThan(0);
        } else {
          expect(character.specialPower.durationSeconds).toBeGreaterThan(0);
        }
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
      bodyColor: "#000000",
      specialPower: {
        id: "test-power",
        name: "Test Power",
        description: "Poder fictício usado apenas neste teste.",
        cooldownSeconds: 3,
        kind: "dash",
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
