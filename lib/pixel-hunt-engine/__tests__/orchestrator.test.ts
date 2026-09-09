import { describe, expect, it } from "vitest";
import { DEFAULT_CHARACTER_ID, resolveCharacter } from "@/lib/characters";
import { createEngine } from "@/lib/pixel-hunt-engine/orchestrator";
import type { InputState } from "@/lib/pixel-hunt-engine/types";

function fakeCtx(): CanvasRenderingContext2D {
  return {
    save: () => {},
    restore: () => {},
    translate: () => {},
    fillRect: () => {},
    fillText: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    arc: () => {},
    fill: () => {},
    ellipse: () => {},
    quadraticCurveTo: () => {},
    setLineDash: () => {},
    closePath: () => {},
    clip: () => {},
    rotate: () => {},
    scale: () => {},
    rect: () => {},
    strokeText: () => {},
    measureText: () => ({ width: 0 }) as TextMetrics,
  } as unknown as CanvasRenderingContext2D;
}

function idleInput(): InputState {
  return { keys: new Set<string>(), pointer: { active: false, x: 480, y: 270 } };
}

function makeEngine() {
  return createEngine({ character: resolveCharacter(DEFAULT_CHARACTER_ID), canvasWidth: 960, canvasHeight: 540 });
}

describe("Engine — before start()", () => {
  it("reports 'menu' and renders the static initial world without throwing", () => {
    const engine = makeEngine();
    const ctx = fakeCtx();

    const snapshot = engine.tick(1000, idleInput(), ctx);

    expect(snapshot.gameState).toBe("menu");
    expect(snapshot.wave).toBe(1);
  });
});

describe("Engine — start → tick × N → snapshot", () => {
  it("produces a 'playing' snapshot with sane score/wave after several ticks", () => {
    const engine = makeEngine();
    const ctx = fakeCtx();
    engine.start();

    let now = 1000;
    let snapshot = engine.tick(now, idleInput(), ctx);
    expect(snapshot.gameState).toBe("playing");
    expect(snapshot.wave).toBe(1);
    expect(snapshot.score).toBe(0);

    for (let i = 0; i < 30; i += 1) {
      now += 16;
      snapshot = engine.tick(now, idleInput(), ctx);
    }

    expect(snapshot.gameState).toBe("playing");
    expect(snapshot.wave).toBeGreaterThanOrEqual(1);
    expect(snapshot.score).toBeGreaterThanOrEqual(0);
    expect(snapshot.enemyCount).toBeGreaterThan(0);
  });
});

describe("Engine — start()/startSecretRun() never leave two Phases active", () => {
  it("only the last call's Phase is active", () => {
    const engine = makeEngine();
    const ctx = fakeCtx();

    engine.start();
    expect(engine.getActivePhaseId()).toBe("normal-run");

    engine.startSecretRun();
    expect(engine.getActivePhaseId()).toBe("secret-mainframe");

    const snapshot = engine.tick(1000, idleInput(), ctx);
    expect(snapshot.biome).toBe("Datacenter Esquecido");
    expect(snapshot.boss).toBe("O Mainframe");
  });
});

describe("Engine — pause()/resume()", () => {
  it("stops the world from advancing while paused, resumes on resume()", () => {
    const engine = makeEngine();
    const ctx = fakeCtx();
    engine.start();
    engine.tick(1000, idleInput(), ctx);

    engine.pause();
    const beforePause = engine.tick(1016, idleInput(), ctx);
    expect(beforePause.gameState).toBe("paused");
    const scoreWhilePaused = beforePause.score;
    const afterMorePause = engine.tick(1200, idleInput(), ctx);
    expect(afterMorePause.score).toBe(scoreWhilePaused);

    engine.resume();
    const resumed = engine.tick(1216, idleInput(), ctx);
    expect(resumed.gameState).toBe("playing");
  });
});

describe("Engine.handleDebugAction", () => {
  it("spawn_boss outside 'playing' starts a run first, then spawns the boss at full HP", () => {
    const engine = makeEngine();
    const ctx = fakeCtx();
    engine.tick(1000, idleInput(), ctx); // still "menu"

    const snapshot = engine.handleDebugAction("spawn_boss");

    expect(snapshot.gameState).toBe("playing");
    expect(snapshot.bossEncountered).toBe(true);
    expect(snapshot.debug.bossHealth).not.toBeNull();
    expect(snapshot.debug.bossHealth?.hp).toBe(snapshot.debug.bossHealth?.maxHp);
    expect(engine.getRunOrigin()).toBe("debug");
  });

  it("add_powerup reports the power-up count spawned in the arena", () => {
    const engine = makeEngine();
    engine.handleDebugAction("reset");

    const snapshot = engine.handleDebugAction("add_powerup");

    expect(snapshot.debug.powerUpCount).toBeGreaterThan(0);
  });

  it("max_stamina fills burst stamina to 100%", () => {
    const engine = makeEngine();
    const ctx = fakeCtx();
    engine.start();
    // Drena um pouco a estamina simulando burst ativo.
    for (let i = 0; i < 5; i += 1) {
      engine.tick(1000 + i * 16, { keys: new Set([" "]), pointer: { active: false, x: 480, y: 270 } }, ctx);
    }

    const snapshot = engine.handleDebugAction("max_stamina");

    expect(snapshot.burstStaminaPct).toBe(100);
  });

  it("win_game marks the run as won", () => {
    const engine = makeEngine();
    engine.start();

    const snapshot = engine.handleDebugAction("win_game");

    expect(snapshot.gameState).toBe("won");
  });

  it("toggle_menu does not change game state or start a run", () => {
    const engine = makeEngine();

    const snapshot = engine.handleDebugAction("toggle_menu");

    expect(snapshot.gameState).toBe("menu");
    expect(engine.getActivePhaseId()).toBe("normal-run");
  });

  it("win_game/max_stamina during an active secret run is a no-op — does not corrupt runOrigin or the secret run's state", () => {
    const engine = makeEngine();
    const ctx = fakeCtx();
    engine.startSecretRun();
    engine.tick(1000, idleInput(), ctx);
    expect(engine.getActivePhaseId()).toBe("secret-mainframe");
    expect(engine.getRunOrigin()).toBe("secret");

    const snapshot = engine.handleDebugAction("win_game");

    // SecretMainframePhase não implementa handleDebugAction — a ação não
    // teve nenhum efeito real, então runOrigin deve permanecer "secret"
    // (não "debug"), e a run secreta continua ativa e rodando (não "won").
    expect(engine.getActivePhaseId()).toBe("secret-mainframe");
    expect(engine.getRunOrigin()).toBe("secret");
    expect(snapshot.gameState).not.toBe("won");

    const afterMaxStamina = engine.handleDebugAction("max_stamina");
    expect(engine.getRunOrigin()).toBe("secret");
    expect(afterMaxStamina.gameState).not.toBe("won");
  });
});

describe("Engine.setCharacter / setAudioPrefs", () => {
  it("does not throw when swapping preferences before a run starts", () => {
    const engine = makeEngine();
    expect(() => engine.setAudioPrefs({ muted: true, volume: 0 })).not.toThrow();
    expect(() => engine.setCharacter(DEFAULT_CHARACTER_ID)).not.toThrow();
  });
});
