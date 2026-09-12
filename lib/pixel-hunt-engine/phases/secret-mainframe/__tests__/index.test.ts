import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CHARACTER_ID, resolveCharacter } from "@/lib/characters";
import type { AudioEngine } from "@/lib/pixel-hunt-engine/audio";
import type { PhaseContext } from "@/lib/pixel-hunt-engine/phases/phase";
import { CONFIG } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/config";
import * as renderer from "@/lib/pixel-hunt-engine/renderer";
import {
  createSecretMainframePhase,
  dropFirewallBreakRewards,
  resolveBossPatternsForCycle,
  spawnSecretEnemy,
  stepSecretEnemyAi,
  triggerBossMemorySurge,
} from "@/lib/pixel-hunt-engine/phases/secret-mainframe";
import { stepWorld } from "@/lib/pixel-hunt-engine/physics";
import type { EngineWorld, InputState, SecretBossShot, SecretMainframePhaseState } from "@/lib/pixel-hunt-engine/types";

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

    // 14 obstáculos fixos do datacenter + CONFIG.PHASES[0].barriers (1
    // barreira-firewall da fase 1) — migração (T15, SECBOSS-17): a partir
    // desta task `enter()` também ativa a composição de hazards da fase 1.
    expect(world.obstacles).toHaveLength(14 + CONFIG.PHASES[0].barriers);
    expect(world.obstacles.filter((obstacle) => obstacle.kind === "firewall")).toHaveLength(CONFIG.PHASES[0].barriers);
    const state = world.phaseState as SecretMainframePhaseState;
    expect(state.puddles).toHaveLength(CONFIG.PHASES[0].puddles);
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
  // SPEC_DEVIATION/migração (T13): este teste cobria o ciclo antigo de 1
  // barra (`boss.hp <= 0` matava direto via `onDeath`). A partir da T13, o
  // core do boss é invulnerável ao caminho genérico de dano em qualquer
  // modo (`syncBossHpSentinel`, `index.ts`) — o comportamento antigo deste
  // teste (um tiro derrota o boss) contradiz diretamente spec.md SECBOSS-01
  // ("o boss SHALL começar... invulnerável a tiros do jogador"). Substituído
  // pelo teste abaixo, que verifica exatamente essa invariante nova; a
  // vitória real (barra 4 esgotada em DPS) ganha cobertura própria na T17.
  it("does NOT defeat the secretBoss via player shots while the firewall is up (SHIELD) — core invulnerable (SECBOSS-01)", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    world.run.shotTimer = 999; // evita autotiro do jogador competindo com o tiro manual abaixo

    const boss = world.enemies.find((enemy) => enemy.kind === "secretBoss")!;
    world.shots.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, ttl: 50 });

    phase.update(world, ctx, makeInput(), 0.016);

    expect(phase.isComplete(world)).toBe(false);
    const state = world.phaseState as SecretMainframePhaseState;
    expect(state.firewall.mode).toBe("SHIELD");
    expect(state.firewall.barHp).toBe(CONFIG.BAR_HP);
    expect(world.enemies.some((enemy) => enemy.kind === "secretBoss")).toBe(true);
  });

  it("keeps the boss's shield visible while the firewall is up (SHIELD) and hides it once it breaks (BREAK_FX) — quick fix, feedback do usuário", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    world.run.shotTimer = 999;

    phase.update(world, ctx, makeInput(), 0.016);
    const boss = world.enemies.find((enemy) => enemy.kind === "secretBoss")!;
    expect((world.phaseState as SecretMainframePhaseState).firewall.mode).toBe("SHIELD");
    expect(boss.shieldVisible).toBe(true);

    const state = world.phaseState as SecretMainframePhaseState;
    state.firewall = {
      mode: "SHIELD",
      phaseIndex: 1,
      counter: CONFIG.SHIELD_NEED - CONFIG.W_PTS.normal,
      barHp: CONFIG.BAR_HP,
      barMaxHp: CONFIG.BAR_HP,
      breakFxTimer: 0,
      won: false,
    };
    const daemon = world.enemies.find((enemy) => enemy.kind === "daemon")!;
    daemon.hp = 1;
    world.shots.push({ x: daemon.x, y: daemon.y, vx: 0, vy: 0, ttl: 50 });

    phase.update(world, ctx, makeInput(), 0.016);

    expect(state.firewall.mode).toBe("BREAK_FX");
    expect(boss.shieldVisible).toBe(false);
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

describe("SecretMainframePhase.draw — view hooks wiring (fix cycle 2, SECBOSS-17/18/21/22/23/24)", () => {
  it("passes drawHudOverlay/drawGroundOverlay hooks to renderer.drawFrame (structural — no real canvas needed)", () => {
    const drawFrameSpy = vi.spyOn(renderer, "drawFrame").mockImplementation(() => {});
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);

    phase.draw({} as CanvasRenderingContext2D, world);

    expect(drawFrameSpy).toHaveBeenCalledTimes(1);
    const view = drawFrameSpy.mock.calls[0][2];
    expect(typeof view.drawHudOverlay).toBe("function");
    expect(typeof view.drawGroundOverlay).toBe("function");
    drawFrameSpy.mockRestore();
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

describe("spawnSecretEnemy — secretBoss hides the generic health bar (fix cycle 2, SECBOSS-01)", () => {
  it("sets hideHealthBar: true on the secretBoss (sentinel hp would otherwise always render ~full/green)", () => {
    const world = emptyWorld();
    const boss = spawnSecretEnemy(world, "secretBoss");
    expect(boss.hideHealthBar).toBe(true);
  });

  it("does not set hideHealthBar on any other SecretEnemyKind (additive, no regression)", () => {
    const world = emptyWorld();
    expect(spawnSecretEnemy(world, "daemon").hideHealthBar).toBeUndefined();
    expect(spawnSecretEnemy(world, "cron").hideHealthBar).toBeUndefined();
    expect(spawnSecretEnemy(world, "cobolSnake").hideHealthBar).toBeUndefined();
  });
});

function freshSecretPhaseState(): SecretMainframePhaseState {
  return {
    phase: "secret-mainframe",
    localGameState: "playing",
    secretBossShots: [],
    datacenterMoss: [],
    datacenterCracks: [],
    firewall: { mode: "SHIELD", phaseIndex: 1, counter: 0, barHp: CONFIG.BAR_HP, barMaxHp: CONFIG.BAR_HP, breakFxTimer: 0, won: false },
    puddles: [],
    memorySurgeUntil: 0,
    slowMoUntil: 0,
    stunUntil: 0,
  };
}

describe("spawnSecretEnemy — Cobra COBOL (SECBOSS-13, SECBOSS-14, SECBOSS-15)", () => {
  it("spawns with CONFIG.COBOL_SNAKE base hp/contact/score stats, customMovement and a render hook", () => {
    const world = emptyWorld();

    const cobolSnake = spawnSecretEnemy(world, "cobolSnake");

    expect(cobolSnake.kind).toBe("cobolSnake");
    expect(cobolSnake.hp).toBe(CONFIG.COBOL_SNAKE.hp);
    expect(cobolSnake.maxHp).toBe(CONFIG.COBOL_SNAKE.hp);
    expect(cobolSnake.customMovement).toBe(true);
    expect(typeof cobolSnake.render).toBe("function");
    expect(world.enemies).toContain(cobolSnake);
  });
});

describe("stepSecretEnemyAi — Cobra COBOL slither AI (SECBOSS-13)", () => {
  it("chases the player (velocity points toward the player) with a sinusoidal (slither) component", () => {
    const world = emptyWorld();
    world.player.x = 100;
    world.player.y = 100;
    const cobolSnake = spawnSecretEnemy(world, "cobolSnake");
    cobolSnake.x = 100;
    cobolSnake.y = 300;
    cobolSnake.phase = 0;
    const phaseState = freshSecretPhaseState();

    world.run.frame = 0;
    stepSecretEnemyAi(world, phaseState, 0.016);
    const vyAtFrame0 = cobolSnake.vy;
    const vxAtFrame0 = cobolSnake.vx;

    // Componente de perseguição: o jogador está acima (y menor), então a
    // velocidade vertical deve apontar para cima (negativa).
    expect(vyAtFrame0).toBeLessThan(0);

    world.run.frame = 30;
    stepSecretEnemyAi(world, phaseState, 0.016);
    const vxAtFrame30 = cobolSnake.vx;

    // Componente senoidal (slither): a velocidade horizontal muda ao longo
    // do tempo mesmo com jogador/inimigo parados no mesmo lugar — prova que
    // não é uma perseguição em linha reta pura.
    expect(vxAtFrame30).not.toBeCloseTo(vxAtFrame0, 5);

    // A posição de fato avança em direção ao jogador quando o passo de
    // física (`enemy.x += vx * delta`, physics.ts) é aplicado.
    const yBefore = cobolSnake.y;
    cobolSnake.y += cobolSnake.vy * 0.016;
    expect(cobolSnake.y).toBeLessThan(yBefore);
  });
});

describe("dropFirewallBreakRewards (T9, SECBOSS-26, 28, 29)", () => {
  it("drops a 'hotfix' heal and a 'cafeZip' buff at the given position, both non-expiring (SECBOSS-26)", () => {
    const world = emptyWorld();
    dropFirewallBreakRewards(world, 480, 200);
    expect(world.powerUps).toHaveLength(2);
    expect(world.powerUps.map((powerUp) => powerUp.kind).sort()).toEqual(["cafeZip", "hotfix"]);
    for (const powerUp of world.powerUps) {
      expect(powerUp.x).toBe(480);
      expect(powerUp.y).toBe(200);
      expect(powerUp.ttl).toBe(Infinity);
    }
  });

  it("drops are collectible even with a barrier obstacle covering the pickup spot (SECBOSS-28 — coleta não checa obstacles)", () => {
    const world = emptyWorld();
    world.player.x = 480;
    world.player.y = 200;
    dropFirewallBreakRewards(world, 480, 200); // drop na mesma posição do jogador
    world.obstacles.push({ x: 440, y: 170, width: 80, height: 60, kind: "firewall", label: "Firewall" });
    const events = stepWorld(world, makeInput(), 0.016, makeAudio());
    expect(events.powerUpCollected).toBe(true);
    expect(world.powerUps.length).toBeLessThan(2);
  });

  it("drops the heal pickup unconditionally, including on phase-4 breaks (SECBOSS-29 — sem exceção por fase)", () => {
    const world = emptyWorld();
    world.phaseState = freshSecretPhaseState();
    if (world.phaseState.phase === "secret-mainframe") world.phaseState.firewall.phaseIndex = 4;
    dropFirewallBreakRewards(world, 480, 200);
    expect(world.powerUps.some((powerUp) => powerUp.kind === "hotfix")).toBe(true);
    expect(world.powerUps.some((powerUp) => powerUp.kind === "cafeZip")).toBe(true);
  });
});

// T13 — integração da máquina de estados do firewall em update().
describe("SecretMainframePhase.update — firewall integration (T13)", () => {
  function firewallOf(world: EngineWorld): SecretMainframePhaseState["firewall"] {
    return (world.phaseState as SecretMainframePhaseState).firewall;
  }

  it("registers the normal weight (CONFIG.W_PTS.normal) when a daemon dies during SHIELD (SECBOSS-02)", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    world.run.shotTimer = 999;

    const daemon = world.enemies.find((enemy) => enemy.kind === "daemon")!;
    daemon.hp = 1;
    world.shots.push({ x: daemon.x, y: daemon.y, vx: 0, vy: 0, ttl: 50 });

    phase.update(world, ctx, makeInput(), 0.016);

    expect(firewallOf(world).counter).toBe(CONFIG.W_PTS.normal);
  });

  it("registers the elite weight (CONFIG.W_PTS.elite) when the Cobra COBOL dies during SHIELD (SECBOSS-03)", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    world.run.shotTimer = 999;

    // `spawnSecretEnemy` nasce numa borda aleatória (fora do mundo visível,
    // 960×540) — reposicionada aqui para dentro da arena, senão o tiro
    // pushado abaixo seria descartado por `shouldCullShot` (physics.ts)
    // antes de resolver a colisão.
    const cobolSnake = spawnSecretEnemy(world, "cobolSnake");
    cobolSnake.x = 300;
    cobolSnake.y = 300;
    cobolSnake.hp = 1;
    world.shots.push({ x: cobolSnake.x, y: cobolSnake.y, vx: 0, vy: 0, ttl: 50 });

    phase.update(world, ctx, makeInput(), 0.016);

    expect(firewallOf(world).counter).toBe(CONFIG.W_PTS.elite);
  });

  it("registers the reduced weight (CONFIG.W_PTS.respawned) when a previously-fallen cron dies again during SHIELD (SECBOSS-04)", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    world.run.shotTimer = 999;
    const state = world.phaseState as SecretMainframePhaseState;

    const cron = world.enemies.find((enemy) => enemy.kind === "cron")!;
    cron.hp = 1;
    world.shots.push({ x: cron.x, y: cron.y, vx: 0, vy: 0, ttl: 50 });
    phase.update(world, ctx, makeInput(), 0.016);
    expect(firewallOf(world).counter).toBe(CONFIG.W_PTS.normal); // 1ª morte: peso normal
    expect(cron.respawnedFromFallen).toBeUndefined();

    // Força o cooldown de revive a expirar neste próximo passo.
    cron.cooldown = 0;
    stepSecretEnemyAi(world, state, 0.016);
    expect(cron.respawnedFromFallen).toBe(true);
    expect(cron.hp).toBe(cron.maxHp);

    cron.hp = 1; // revivido volta com hp cheio — precisa ficar fraco de novo p/ morrer no 2º tiro
    world.run.shotTimer = 999;
    world.shots.push({ x: cron.x, y: cron.y, vx: 0, vy: 0, ttl: 50 });
    phase.update(world, ctx, makeInput(), 0.016);

    expect(firewallOf(world).counter).toBe(CONFIG.W_PTS.normal + CONFIG.W_PTS.respawned);
  });

  it("does NOT increment the firewall counter for kills happening during DPS (SECBOSS-05)", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    world.run.shotTimer = 999;
    const state = world.phaseState as SecretMainframePhaseState;
    state.firewall = { mode: "DPS", phaseIndex: 1, counter: 0, barHp: CONFIG.BAR_HP, barMaxHp: CONFIG.BAR_HP, breakFxTimer: 0, won: false };

    const daemon = world.enemies.find((enemy) => enemy.kind === "daemon")!;
    daemon.hp = 1;
    world.shots.push({ x: daemon.x, y: daemon.y, vx: 0, vy: 0, ttl: 50 });

    phase.update(world, ctx, makeInput(), 0.016);

    expect(firewallOf(world).counter).toBe(0);
  });

  it("triggers BREAK_FX (banner, shake, drops, stun/slow-mo windows) when the counter reaches CONFIG.SHIELD_NEED (SECBOSS-06)", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    world.run.shotTimer = 999;
    const state = world.phaseState as SecretMainframePhaseState;
    state.firewall = {
      mode: "SHIELD",
      phaseIndex: 1,
      counter: CONFIG.SHIELD_NEED - CONFIG.W_PTS.normal,
      barHp: CONFIG.BAR_HP,
      barMaxHp: CONFIG.BAR_HP,
      breakFxTimer: 0,
      won: false,
    };

    const daemon = world.enemies.find((enemy) => enemy.kind === "daemon")!;
    daemon.hp = 1;
    world.shots.push({ x: daemon.x, y: daemon.y, vx: 0, vy: 0, ttl: 50 });
    const frameBefore = world.run.frame;

    phase.update(world, ctx, makeInput(), 0.016);

    expect(firewallOf(world).mode).toBe("BREAK_FX");
    expect(firewallOf(world).counter).toBe(0); // overkill descartado (SECBOSS-07)
    expect(world.run.effectMessage).toBe("FIREWALL DOWN!");
    expect(world.run.shake).toBe(14);
    expect(world.powerUps.map((powerUp) => powerUp.kind).sort()).toEqual(["cafeZip", "hotfix"]);
    expect(state.stunUntil).toBeGreaterThan(frameBefore);
    expect(state.slowMoUntil).toBeGreaterThan(frameBefore);
    // Quick fix (feedback do usuário): explosão do escudo (partículas teal)
    // no mesmo frame da quebra, e o escudo visual do boss desliga.
    const shieldParticles = world.particles.filter((particle) => particle.color === "#2dd4bf");
    expect(shieldParticles.length).toBeGreaterThan(0);
    const boss = world.enemies.find((enemy) => enemy.kind === "secretBoss")!;
    expect(boss.shieldVisible).toBe(false);
  });

  it("discards firewall overkill on the transition and never carries it over to the next barrier (SECBOSS-07)", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    world.run.shotTimer = 999;
    const state = world.phaseState as SecretMainframePhaseState;
    state.firewall = {
      mode: "SHIELD",
      phaseIndex: 1,
      counter: CONFIG.SHIELD_NEED - CONFIG.W_PTS.elite,
      barHp: CONFIG.BAR_HP,
      barMaxHp: CONFIG.BAR_HP,
      breakFxTimer: 0,
      won: false,
    };

    const cobolSnake = spawnSecretEnemy(world, "cobolSnake");
    cobolSnake.x = 300;
    cobolSnake.y = 300;
    cobolSnake.hp = 1;
    world.shots.push({ x: cobolSnake.x, y: cobolSnake.y, vx: 0, vy: 0, ttl: 50 });

    phase.update(world, ctx, makeInput(), 0.016);

    expect(firewallOf(world).mode).toBe("BREAK_FX");
    expect(firewallOf(world).counter).toBe(0);
  });

  it("applies real damage to the active bar only during DPS, leaving it untouched during SHIELD/BREAK_FX (SECBOSS-01/09)", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    world.run.shotTimer = 999;
    const state = world.phaseState as SecretMainframePhaseState;
    state.firewall = { mode: "DPS", phaseIndex: 1, counter: 0, barHp: CONFIG.BAR_HP, barMaxHp: CONFIG.BAR_HP, breakFxTimer: 0, won: false };

    const boss = world.enemies.find((enemy) => enemy.kind === "secretBoss")!;
    world.shots.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, ttl: 50 });

    phase.update(world, ctx, makeInput(), 0.016);

    expect(firewallOf(world).barHp).toBe(CONFIG.BAR_HP - 18); // dano padrão do tiro do jogador (physics.ts)
    expect(world.enemies.some((enemy) => enemy.kind === "secretBoss")).toBe(true); // boss segue vivo
  });

  it("advances to the next phase's SHIELD when the active bar reaches 0 during DPS and the phase is below 4 (SECBOSS-09)", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    world.run.shotTimer = 999;
    const state = world.phaseState as SecretMainframePhaseState;
    state.firewall = { mode: "DPS", phaseIndex: 1, counter: 0, barHp: 1, barMaxHp: CONFIG.BAR_HP, breakFxTimer: 0, won: false };

    const boss = world.enemies.find((enemy) => enemy.kind === "secretBoss")!;
    world.shots.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, ttl: 50 });

    phase.update(world, ctx, makeInput(), 0.016);

    const updated = firewallOf(world);
    expect(updated.mode).toBe("SHIELD");
    expect(updated.phaseIndex).toBe(2);
    expect(updated.counter).toBe(0);
    expect(updated.barHp).toBe(CONFIG.BAR_HP);
  });

  it("announces the phase-transition banner ('FASE n — NOME') when the active bar reaches 0 during DPS (SECBOSS-25)", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    world.run.shotTimer = 999;
    const state = world.phaseState as SecretMainframePhaseState;
    state.firewall = { mode: "DPS", phaseIndex: 1, counter: 0, barHp: 1, barMaxHp: CONFIG.BAR_HP, breakFxTimer: 0, won: false };

    const boss = world.enemies.find((enemy) => enemy.kind === "secretBoss")!;
    world.shots.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, ttl: 50 });

    phase.update(world, ctx, makeInput(), 0.016);

    expect(firewallOf(world).phaseIndex).toBe(2); // pré-condição: a transição de fase de fato ocorreu
    expect(world.run.effectMessage).toBe("FASE 2 — CRON PURGE");
    expect(world.run.effectBanner).toBeGreaterThan(0);
  });

  it("player death takes priority over a firewall transition happening on the same frame (SECBOSS-11, edge case §16.1)", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    world.run.shotTimer = 999;
    world.player.hp = 1;
    const state = world.phaseState as SecretMainframePhaseState;
    state.firewall = {
      mode: "SHIELD",
      phaseIndex: 1,
      counter: CONFIG.SHIELD_NEED - CONFIG.W_PTS.normal,
      barHp: CONFIG.BAR_HP,
      barMaxHp: CONFIG.BAR_HP,
      breakFxTimer: 0,
      won: false,
    };
    // Um daemon sobreposto ao jogador aplica dano de toque via stepWorld —
    // suficiente para zerar o HP do jogador neste mesmo frame.
    const daemon = world.enemies.find((enemy) => enemy.kind === "daemon")!;
    daemon.x = world.player.x;
    daemon.y = world.player.y;
    daemon.hp = 1;
    world.shots.push({ x: daemon.x, y: daemon.y, vx: 0, vy: 0, ttl: 50 });

    const events = phase.update(world, ctx, makeInput(), 0.016);

    expect(events.gameOver).toBe(true);
    expect(phase.isComplete(world)).toBe(true);
    // A transição do firewall (que teria disparado BREAK_FX neste mesmo
    // frame) foi ignorada — o modo permanece exatamente como estava antes.
    expect(firewallOf(world).mode).toBe("SHIELD");
  });
});

// T14 — slow-mo e stun do BREAK_FX.
describe("SecretMainframePhase.update — slow-mo & stun (T14)", () => {
  it("scales the effective delta passed to the simulation by CONFIG.SLOWMO_SCALE while slowMoUntil is active (SECBOSS-06)", () => {
    const phase = createSecretMainframePhase();
    const ctx = makeContext();

    const worldNormal = emptyWorld();
    phase.enter(worldNormal, ctx);
    const daemonNormal = worldNormal.enemies.find((enemy) => enemy.kind === "daemon")!;
    daemonNormal.cooldown = 100; // grande o bastante para não disparar o reset do cooldown neste passo
    phase.update(worldNormal, ctx, makeInput(), 1);
    const decayNormal = 100 - daemonNormal.cooldown;

    const worldSlow = emptyWorld();
    phase.enter(worldSlow, ctx);
    const stateSlow = worldSlow.phaseState as SecretMainframePhaseState;
    stateSlow.slowMoUntil = worldSlow.run.frame + 1000;
    const daemonSlow = worldSlow.enemies.find((enemy) => enemy.kind === "daemon")!;
    daemonSlow.cooldown = 100;
    phase.update(worldSlow, ctx, makeInput(), 1);
    const decaySlow = 100 - daemonSlow.cooldown;

    expect(decaySlow).toBeCloseTo(decayNormal * CONFIG.SLOWMO_SCALE, 5);
  });

  it("freezes every mob's movement while stunUntil is active, except the fallen cron's respawn cooldown (SECBOSS-06, edge case §16.5)", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    const state = world.phaseState as SecretMainframePhaseState;
    state.stunUntil = world.run.frame + 1000;

    const daemon = world.enemies.find((enemy) => enemy.kind === "daemon")!;
    const daemonXBefore = daemon.x;
    const daemonYBefore = daemon.y;

    const cron = world.enemies.find((enemy) => enemy.kind === "cron")!;
    cron.hp = 0; // "derrubado", aguardando revive
    cron.cooldown = 10;

    phase.update(world, ctx, makeInput(), 0.1);

    expect(daemon.vx).toBe(0);
    expect(daemon.vy).toBe(0);
    expect(daemon.x).toBe(daemonXBefore);
    expect(daemon.y).toBe(daemonYBefore);
    expect(cron.cooldown).toBeLessThan(10); // continua contando mesmo com o stun ativo
  });
});

// T15 — composição por fase (mobs, poderes do boss, hazards).
describe("resolveBossPatternsForCycle (T15, SECBOSS-30..33)", () => {
  it("fase 1: sempre burst radial (pattern 0)", () => {
    expect(resolveBossPatternsForCycle(1)).toEqual([0]);
  });

  it("fase 2: sempre volley mirado (pattern 1)", () => {
    expect(resolveBossPatternsForCycle(2)).toEqual([1]);
  });

  it("fase 3: sempre Memory Surge (pattern 2)", () => {
    expect(resolveBossPatternsForCycle(3)).toEqual([2]);
  });

  it("fase 4: sorteia entre 0 e 2 poderes por ciclo, cada um em [0,1,2] (SECBOSS-33)", () => {
    const randomSpy = vi.spyOn(Math, "random");
    randomSpy.mockReturnValueOnce(0.99); // count = floor(0.99*3) = 2
    randomSpy.mockReturnValueOnce(0); // pattern 1: 0
    randomSpy.mockReturnValueOnce(0.99); // pattern 2: floor(0.99*3)=2
    expect(resolveBossPatternsForCycle(4)).toEqual([0, 2]);
    randomSpy.mockRestore();
  });

  it("fase 4: pode sortear 0 poderes num ciclo (feint, sem disparo)", () => {
    const randomSpy = vi.spyOn(Math, "random");
    randomSpy.mockReturnValueOnce(0); // count = floor(0*3) = 0
    expect(resolveBossPatternsForCycle(4)).toEqual([]);
    randomSpy.mockRestore();
  });
});

describe("SecretMainframePhase.update — mob composition by phase (T15, SECBOSS-30..33)", () => {
  it("phase 1 spawns the dominant mob (daemon) when the spawn timer expires", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    const enemyCountBefore = world.enemies.length;
    world.run.spawnTimer = 0;

    phase.update(world, ctx, makeInput(), 0.016);

    expect(world.enemies.length).toBe(enemyCountBefore + 1);
    const newest = world.enemies[world.enemies.length - 1];
    expect(newest.kind).toBe(CONFIG.PHASES[0].dominantMob);
  });

  it("phase 2 spawns the dominant mob (cron) when the spawn timer expires", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    const state = world.phaseState as SecretMainframePhaseState;
    state.firewall = { mode: "SHIELD", phaseIndex: 2, counter: 0, barHp: CONFIG.BAR_HP, barMaxHp: CONFIG.BAR_HP, breakFxTimer: 0, won: false };
    const enemyCountBefore = world.enemies.length;
    world.run.spawnTimer = 0;

    phase.update(world, ctx, makeInput(), 0.016);

    expect(world.enemies.length).toBe(enemyCountBefore + 1);
    const newest = world.enemies[world.enemies.length - 1];
    expect(newest.kind).toBe(CONFIG.PHASES[1].dominantMob);
  });

  it("phase 3 spawns the dominant mob (Cobra COBOL) when the spawn timer expires", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    const state = world.phaseState as SecretMainframePhaseState;
    state.firewall = { mode: "SHIELD", phaseIndex: 3, counter: 0, barHp: CONFIG.BAR_HP, barMaxHp: CONFIG.BAR_HP, breakFxTimer: 0, won: false };
    const enemyCountBefore = world.enemies.length;
    world.run.spawnTimer = 0;

    phase.update(world, ctx, makeInput(), 0.016);

    expect(world.enemies.length).toBe(enemyCountBefore + 1);
    const newest = world.enemies[world.enemies.length - 1];
    expect(newest.kind).toBe(CONFIG.PHASES[2].dominantMob);
  });

  it("phase 4 (mixed) spawns a random mob among daemon/cron/cobolSnake when the spawn timer expires (SECBOSS-33)", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    const state = world.phaseState as SecretMainframePhaseState;
    state.firewall = { mode: "SHIELD", phaseIndex: 4, counter: 0, barHp: CONFIG.FINAL_BAR_HP, barMaxHp: CONFIG.FINAL_BAR_HP, breakFxTimer: 0, won: false };
    world.run.spawnTimer = 0;
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0); // força a escolha do índice 0 ("daemon")

    phase.update(world, ctx, makeInput(), 0.016);

    const newest = world.enemies[world.enemies.length - 1];
    expect(newest.kind).toBe("daemon");
    randomSpy.mockRestore();
  });

  it("resets the spawn timer to CONFIG.PHASES[n].dpsSpawnRate (not shieldSpawnRate) when the firewall mode is DPS (SECBOSS-08 — taxa de spawn cai a ~35%)", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    const state = world.phaseState as SecretMainframePhaseState;
    state.firewall = { mode: "DPS", phaseIndex: 1, counter: 0, barHp: CONFIG.BAR_HP, barMaxHp: CONFIG.BAR_HP, breakFxTimer: 0, won: false };
    world.run.spawnTimer = 0;

    phase.update(world, ctx, makeInput(), 0.016);

    expect(world.run.spawnTimer).toBe(CONFIG.PHASES[0].dpsSpawnRate);
    expect(world.run.spawnTimer).not.toBe(CONFIG.PHASES[0].shieldSpawnRate);
  });

  it("does not spawn a new mob when CONFIG.PHASES[n].mobCap is already reached, even counting stunned mobs (SECBOSS-34)", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    const state = world.phaseState as SecretMainframePhaseState;
    state.stunUntil = world.run.frame + 1000; // mobs estunados continuam contando para o teto

    const cap = CONFIG.PHASES[0].mobCap;
    while (world.enemies.filter((enemy) => enemy.kind !== "secretBoss").length < cap) {
      spawnSecretEnemy(world, "daemon");
    }
    const enemyCountBefore = world.enemies.length;
    world.run.spawnTimer = 0;

    phase.update(world, ctx, makeInput(), 0.016);

    expect(world.enemies.length).toBe(enemyCountBefore);
  });
});

describe("triggerBossMemorySurge (T15, SECBOSS-32)", () => {
  it("invokes up to 2 mobs of the dominant kind, respecting CONFIG.PHASES[n].mobCap, and expands the puddles' radius", () => {
    const world = emptyWorld();
    const state: SecretMainframePhaseState = {
      phase: "secret-mainframe",
      localGameState: "playing",
      secretBossShots: [],
      datacenterMoss: [],
      datacenterCracks: [],
      firewall: { mode: "SHIELD", phaseIndex: 3, counter: 0, barHp: CONFIG.BAR_HP, barMaxHp: CONFIG.BAR_HP, breakFxTimer: 0, won: false },
      puddles: [{ x: 100, y: 100, baseRadius: CONFIG.PUDDLE_BASE_RADIUS, radius: CONFIG.PUDDLE_BASE_RADIUS }],
      memorySurgeUntil: 0,
      slowMoUntil: 0,
      stunUntil: 0,
    };
    world.phaseState = state;

    triggerBossMemorySurge(world, state);

    const cobolSnakes = world.enemies.filter((enemy) => enemy.kind === CONFIG.PHASES[2].dominantMob);
    expect(cobolSnakes).toHaveLength(2);
    expect(state.puddles[0].radius).toBe(CONFIG.PUDDLE_BASE_RADIUS + CONFIG.MEMORY_SURGE_RADIUS_BONUS);
    expect(state.memorySurgeUntil).toBeGreaterThan(world.run.frame);
  });

  it("respects CONFIG.PHASES[n].mobCap — invokes fewer than 2 mobs when the cap is nearly reached", () => {
    const world = emptyWorld();
    const cap = CONFIG.PHASES[2].mobCap;
    for (let i = 0; i < cap - 1; i += 1) spawnSecretEnemy(world, "daemon");
    const state: SecretMainframePhaseState = {
      phase: "secret-mainframe",
      localGameState: "playing",
      secretBossShots: [],
      datacenterMoss: [],
      datacenterCracks: [],
      firewall: { mode: "SHIELD", phaseIndex: 3, counter: 0, barHp: CONFIG.BAR_HP, barMaxHp: CONFIG.BAR_HP, breakFxTimer: 0, won: false },
      puddles: [],
      memorySurgeUntil: 0,
      slowMoUntil: 0,
      stunUntil: 0,
    };
    world.phaseState = state;
    const enemyCountBefore = world.enemies.length;

    triggerBossMemorySurge(world, state);

    expect(world.enemies.length).toBe(enemyCountBefore + 1); // só havia 1 vaga livre até o teto
  });

  it("re-triggering while the window is already active only restarts the timer, never stacking the radius (edge case §16.3)", () => {
    const world = emptyWorld();
    const state: SecretMainframePhaseState = {
      phase: "secret-mainframe",
      localGameState: "playing",
      secretBossShots: [],
      datacenterMoss: [],
      datacenterCracks: [],
      firewall: { mode: "SHIELD", phaseIndex: 3, counter: 0, barHp: CONFIG.BAR_HP, barMaxHp: CONFIG.BAR_HP, breakFxTimer: 0, won: false },
      puddles: [{ x: 100, y: 100, baseRadius: CONFIG.PUDDLE_BASE_RADIUS, radius: CONFIG.PUDDLE_BASE_RADIUS }],
      memorySurgeUntil: 0,
      slowMoUntil: 0,
      stunUntil: 0,
    };
    world.phaseState = state;

    triggerBossMemorySurge(world, state);
    const radiusAfterFirst = state.puddles[0].radius;
    triggerBossMemorySurge(world, state);

    expect(state.puddles[0].radius).toBe(radiusAfterFirst); // sem empilhar
  });
});

describe("SecretMainframePhase.update — Memory Surge radius reverts after its window expires (T15, edge case §16.3)", () => {
  it("reverts the puddles to their base radius once memorySurgeUntil elapses", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    const state = world.phaseState as SecretMainframePhaseState;
    world.run.frame = 10;
    state.puddles = state.puddles.map((puddle) => ({ ...puddle, radius: puddle.baseRadius + CONFIG.MEMORY_SURGE_RADIUS_BONUS }));
    state.memorySurgeUntil = 10; // já expirado (verificado no topo do próximo update())

    phase.update(world, ctx, makeInput(), 0.016);

    expect(state.puddles.every((puddle) => puddle.radius === puddle.baseRadius)).toBe(true);
    expect(state.memorySurgeUntil).toBe(0);
  });
});

describe("SecretMainframePhase.update — phase transition refreshes hazards (T15, SECBOSS-09/17)", () => {
  it("re-activates puddles/barriers with the new phase's composition on BAR_DOWN", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    world.run.shotTimer = 999;
    const state = world.phaseState as SecretMainframePhaseState;
    state.firewall = { mode: "DPS", phaseIndex: 1, counter: 0, barHp: 1, barMaxHp: CONFIG.BAR_HP, breakFxTimer: 0, won: false };

    const boss = world.enemies.find((enemy) => enemy.kind === "secretBoss")!;
    world.shots.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, ttl: 50 });

    phase.update(world, ctx, makeInput(), 0.016);

    const updated = world.phaseState as SecretMainframePhaseState;
    expect(updated.firewall.phaseIndex).toBe(2);
    expect(updated.puddles).toHaveLength(CONFIG.PHASES[1].puddles);
    expect(world.obstacles.filter((obstacle) => obstacle.kind === "firewall")).toHaveLength(CONFIG.PHASES[1].barriers);
  });
});

// T16 — modificadores da fase 4 (HP×2, dano×2, telegraph+15%).
describe("spawnSecretEnemy — phase-4 HP multiplier (T16, SECBOSS-35)", () => {
  it("doubles a freshly spawned mob's hp during phase 4, but not the secretBoss's own hp (already ×2 via CONFIG.FINAL_BAR_HP)", () => {
    const worldPhase1 = emptyWorld();
    worldPhase1.phaseState = {
      phase: "secret-mainframe",
      localGameState: "playing",
      secretBossShots: [],
      datacenterMoss: [],
      datacenterCracks: [],
      firewall: { mode: "SHIELD", phaseIndex: 1, counter: 0, barHp: CONFIG.BAR_HP, barMaxHp: CONFIG.BAR_HP, breakFxTimer: 0, won: false },
      puddles: [],
      memorySurgeUntil: 0,
      slowMoUntil: 0,
      stunUntil: 0,
    };
    const daemonPhase1 = spawnSecretEnemy(worldPhase1, "daemon");

    const worldPhase4 = emptyWorld();
    worldPhase4.phaseState = {
      ...(worldPhase1.phaseState as SecretMainframePhaseState),
      firewall: { mode: "SHIELD", phaseIndex: 4, counter: 0, barHp: CONFIG.FINAL_BAR_HP, barMaxHp: CONFIG.FINAL_BAR_HP, breakFxTimer: 0, won: false },
    };
    const daemonPhase4 = spawnSecretEnemy(worldPhase4, "daemon");
    const bossPhase4 = spawnSecretEnemy(worldPhase4, "secretBoss");

    expect(daemonPhase4.hp).toBe(daemonPhase1.hp * 2);
    expect(bossPhase4.hp).toBe(bossPhase4.maxHp); // spawn normal, sem duplicar (a "HP" funcional é a barra)
  });
});

describe("SecretMainframePhase.update — phase-4 damage multipliers (T16, SECBOSS-35)", () => {
  it("doubles the secretBoss shot damage on phase 4", () => {
    const phase = createSecretMainframePhase();
    const ctx = makeContext();

    const worldNormal = emptyWorld();
    phase.enter(worldNormal, ctx);
    const stateNormal = worldNormal.phaseState as SecretMainframePhaseState;
    stateNormal.secretBossShots.push({ x: worldNormal.player.x, y: worldNormal.player.y, vx: 0, vy: 0 });
    phase.update(worldNormal, ctx, makeInput(), 0.016);
    const damageNormal = 100 - worldNormal.player.hp;

    const worldPhase4 = emptyWorld();
    phase.enter(worldPhase4, ctx);
    const statePhase4 = worldPhase4.phaseState as SecretMainframePhaseState;
    statePhase4.firewall = { mode: "SHIELD", phaseIndex: 4, counter: 0, barHp: CONFIG.FINAL_BAR_HP, barMaxHp: CONFIG.FINAL_BAR_HP, breakFxTimer: 0, won: false };
    statePhase4.secretBossShots.push({ x: worldPhase4.player.x, y: worldPhase4.player.y, vx: 0, vy: 0 });
    phase.update(worldPhase4, ctx, makeInput(), 0.016);
    const damagePhase4 = 100 - worldPhase4.player.hp;

    expect(damagePhase4).toBe(damageNormal * 2);
  });

  it("doubles mob touch (contact) damage on phase 4 (SECBOSS-14/16)", () => {
    const phase = createSecretMainframePhase();
    const ctx = makeContext();

    const worldNormal = emptyWorld();
    phase.enter(worldNormal, ctx);
    worldNormal.run.shotTimer = 999;
    const daemonNormal = worldNormal.enemies.find((enemy) => enemy.kind === "daemon")!;
    daemonNormal.x = worldNormal.player.x;
    daemonNormal.y = worldNormal.player.y;
    phase.update(worldNormal, ctx, makeInput(), 0.016);
    const damageNormal = 100 - worldNormal.player.hp;
    expect(damageNormal).toBeGreaterThan(0);

    const worldPhase4 = emptyWorld();
    phase.enter(worldPhase4, ctx);
    worldPhase4.run.shotTimer = 999;
    const statePhase4 = worldPhase4.phaseState as SecretMainframePhaseState;
    statePhase4.firewall = { mode: "SHIELD", phaseIndex: 4, counter: 0, barHp: CONFIG.FINAL_BAR_HP, barMaxHp: CONFIG.FINAL_BAR_HP, breakFxTimer: 0, won: false };
    const daemonPhase4 = worldPhase4.enemies.find((enemy) => enemy.kind === "daemon")!;
    daemonPhase4.x = worldPhase4.player.x;
    daemonPhase4.y = worldPhase4.player.y;
    phase.update(worldPhase4, ctx, makeInput(), 0.016);
    const damagePhase4 = 100 - worldPhase4.player.hp;

    expect(damagePhase4).toBe(damageNormal * 2);
  });

  it("still doubles mob touch damage on phase 4 when a hotfix heal is collected on the SAME frame (fix cycle 2 regression — SECBOSS-14/16/35)", () => {
    // Bug: `stepWorld` runs `updatePowerUps` BEFORE `resolveEnemyPlayerCollisions`
    // (physics.ts), so a hotfix (+32, capped at maxHp) collected the same
    // frame the player is touched raises the NET hp delta enough that the
    // old `touchDamageThisFrame = playerHpBeforeStep - world.player.hp`
    // guard (`> 0`) silently failed, and the phase-4 double never applied.
    const phase = createSecretMainframePhase();
    const ctx = makeContext();
    const world = emptyWorld();
    phase.enter(world, ctx);
    world.run.shotTimer = 999;
    world.player.hp = 50; // margem para a cura de +32 não ser truncada por maxHp
    const state = world.phaseState as SecretMainframePhaseState;
    state.firewall = { mode: "SHIELD", phaseIndex: 4, counter: 0, barHp: CONFIG.FINAL_BAR_HP, barMaxHp: CONFIG.FINAL_BAR_HP, breakFxTimer: 0, won: false };

    const daemon = world.enemies.find((enemy) => enemy.kind === "daemon")!; // ENEMY_TOUCH_DAMAGE.daemon = 10 (physics.ts)
    daemon.x = world.player.x;
    daemon.y = world.player.y;
    world.powerUps.push({ x: world.player.x, y: world.player.y, kind: "hotfix", ttl: Infinity, pulse: 0 });

    phase.update(world, ctx, makeInput(), 0.016);

    // Sem o fix: hp final seria 50 + 32 (heal) - 10 (toque simples, dobro
    // nunca aplicado) = 72. Com o fix: o dobro (20 no total) é aplicado por
    // cima da cura: 50 + 32 - 20 = 62.
    expect(world.player.hp).toBe(62);
  });
});

describe("stepSecretEnemyAi — phase-4 telegraph +15% (T16, SECBOSS-35)", () => {
  it("does not yet transition idle->tele at a timer value that would trigger it outside phase 4", () => {
    const world = emptyWorld();
    const boss = spawnSecretEnemy(world, "secretBoss");
    boss.bossState = "idle";
    boss.bossStateTimer = 2.3; // > 2.2 (limiar base), < 2.2*1.15=2.53 (limiar da fase 4)

    const statePhase1: SecretMainframePhaseState = {
      phase: "secret-mainframe",
      localGameState: "playing",
      secretBossShots: [],
      datacenterMoss: [],
      datacenterCracks: [],
      firewall: { mode: "SHIELD", phaseIndex: 1, counter: 0, barHp: CONFIG.BAR_HP, barMaxHp: CONFIG.BAR_HP, breakFxTimer: 0, won: false },
      puddles: [],
      memorySurgeUntil: 0,
      slowMoUntil: 0,
      stunUntil: 0,
    };
    stepSecretEnemyAi(world, statePhase1, 0);
    expect(boss.bossState).toBe("tele"); // fase 1: limiar 2.2, já passou

    boss.bossState = "idle";
    boss.bossStateTimer = 2.3;
    const statePhase4: SecretMainframePhaseState = {
      ...statePhase1,
      firewall: { mode: "SHIELD", phaseIndex: 4, counter: 0, barHp: CONFIG.FINAL_BAR_HP, barMaxHp: CONFIG.FINAL_BAR_HP, breakFxTimer: 0, won: false },
    };
    stepSecretEnemyAi(world, statePhase4, 0);
    expect(boss.bossState).toBe("idle"); // fase 4: limiar 2.53 (+15%), ainda não passou
  });
});

// T17 — vitória, morte e prioridade de transições.
describe("SecretMainframePhase.update — victory (T17, SECBOSS-10)", () => {
  it("credits +5000 score, sets events.gameWon, removes the secretBoss and ends the fight (localGameState = won) when bar 4 is depleted in DPS", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    world.run.shotTimer = 999;
    const scoreBefore = world.run.score;
    const state = world.phaseState as SecretMainframePhaseState;
    state.firewall = { mode: "DPS", phaseIndex: 4, counter: 0, barHp: 1, barMaxHp: CONFIG.FINAL_BAR_HP, breakFxTimer: 0, won: false };

    const boss = world.enemies.find((enemy) => enemy.kind === "secretBoss")!;
    world.shots.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, ttl: 50 });

    const events = phase.update(world, ctx, makeInput(), 0.016);

    expect(events.gameWon).toBe(true);
    expect(world.run.score).toBe(scoreBefore + 5000);
    expect(world.enemies.some((enemy) => enemy.kind === "secretBoss")).toBe(false);
    expect(phase.isComplete(world)).toBe(true);
    const updated = world.phaseState as SecretMainframePhaseState;
    expect(updated.localGameState).toBe("won");
    expect(updated.firewall.won).toBe(true);
  });

  it("does not declare victory while bar 4 is still above 0", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    world.run.shotTimer = 999;
    const state = world.phaseState as SecretMainframePhaseState;
    state.firewall = { mode: "DPS", phaseIndex: 4, counter: 0, barHp: CONFIG.FINAL_BAR_HP, barMaxHp: CONFIG.FINAL_BAR_HP, breakFxTimer: 0, won: false };

    const boss = world.enemies.find((enemy) => enemy.kind === "secretBoss")!;
    world.shots.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, ttl: 50 });

    const events = phase.update(world, ctx, makeInput(), 0.016);

    expect(events.gameWon).toBe(false);
    expect(phase.isComplete(world)).toBe(false);
    expect(world.enemies.some((enemy) => enemy.kind === "secretBoss")).toBe(true);
  });
});

describe("SecretMainframePhase.update — death vs. bar-depletion priority (T17, SECBOSS-11, edge case §16.1)", () => {
  it("player death takes priority over a bar-4 depletion (victory) happening on the same frame", () => {
    const phase = createSecretMainframePhase();
    const world = emptyWorld();
    const ctx = makeContext();
    phase.enter(world, ctx);
    world.run.shotTimer = 999;
    world.player.hp = 1;
    const state = world.phaseState as SecretMainframePhaseState;
    state.firewall = { mode: "DPS", phaseIndex: 4, counter: 0, barHp: 1, barMaxHp: CONFIG.FINAL_BAR_HP, breakFxTimer: 0, won: false };

    const boss = world.enemies.find((enemy) => enemy.kind === "secretBoss")!;
    world.shots.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, ttl: 50 });
    // Um daemon sobreposto ao jogador aplica dano de toque via stepWorld —
    // suficiente para zerar o HP do jogador neste mesmo frame em que o
    // tiro também esgotaria a barra 4.
    const daemon = world.enemies.find((enemy) => enemy.kind === "daemon")!;
    daemon.x = world.player.x;
    daemon.y = world.player.y;

    const events = phase.update(world, ctx, makeInput(), 0.016);

    expect(events.gameOver).toBe(true);
    expect(events.gameWon).toBe(false);
    expect(phase.isComplete(world)).toBe(true);
    const updated = world.phaseState as SecretMainframePhaseState;
    expect(updated.localGameState).toBe("over");
    // A barra 4 não avançou/esgotou — a transição de firewall foi ignorada.
    expect(updated.firewall.won).toBe(false);
    expect(updated.firewall.barHp).toBe(1);
    expect(world.enemies.some((enemy) => enemy.kind === "secretBoss")).toBe(true);
  });
});
