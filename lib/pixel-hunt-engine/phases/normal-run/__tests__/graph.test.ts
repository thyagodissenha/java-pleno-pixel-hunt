import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CHARACTER_ID, resolveCharacter } from "@/lib/characters";
import type { AudioEngine } from "@/lib/pixel-hunt-engine/audio";
import type { EnginePhase, PhaseContext } from "@/lib/pixel-hunt-engine/phases/phase";
import { normalRunGraph } from "@/lib/pixel-hunt-engine/phases/normal-run/graph";
import { bossNames } from "@/lib/pixel-hunt-engine/phases/normal-run/wave-progression";
import type { EngineWorld, InputState } from "@/lib/pixel-hunt-engine/types";

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

// Reproduz o MESMO padrão de transição que `orchestrator.ts`'s `tick()`
// aplica (T5): pergunta `graph.transitions[phase.id]` logo após
// `phase.update()`; se devolver um id, troca a Phase ativa e chama
// `enter()` no mesmo "frame" — sem depender do Orchestrator inteiro, só do
// `PhaseGraph` que T15 produz.
function step(state: { phase: EnginePhase }, world: EngineWorld, ctx: PhaseContext, input: InputState, delta: number) {
  const events = state.phase.update(world, ctx, input, delta);
  const nextId = normalRunGraph.transitions[state.phase.id]?.(world, events);
  if (nextId) {
    state.phase = normalRunGraph.nodes[nextId]();
    state.phase.enter(world, ctx);
  }
  return events;
}

/**
 * Força a morte do chefe atualmente em campo num único `step()`. Limpa
 * `world.enemies`/`world.shots` antes de plantar o chefe + tiro — sem isso,
 * o elenco de "user" que `wave-1.enter()` já spawnou (e que
 * `runSpawnTimers` continua alimentando a cada `update()`) faz o teste
 * ocasionalmente flaky: com múltiplos inimigos vivos, `resolveShotHitOnEnemy`
 * pode achar QUALQUER um deles dentro do raio de colisão antes de chegar ao
 * chefe, dependendo de quem `stepWorld` moveu pra perto do tiro naquele
 * frame.
 */
function killCurrentBoss(world: EngineWorld, bossPhase?: number) {
  world.enemies.length = 0;
  world.shots.length = 0;
  world.enemies.push({
    x: 300, y: 270, vx: 0, vy: 0, hp: 1, maxHp: 400, speed: 0, size: 62, kind: "boss", label: "x", bossPhase,
  });
  world.run.bossSpawned = true;
  world.shots.push({ x: 300, y: 270, vx: 0, vy: 0, ttl: 50 });
}

describe("normalRunGraph — structure (PHASEFLOW-10/13)", () => {
  it("has exactly bossNames.length + 1 nodes: wave-1..wave-N and final-choice", () => {
    const nodeIds = Object.keys(normalRunGraph.nodes).sort();
    const expected = [...Array.from({ length: bossNames.length }, (_, i) => `wave-${i + 1}`), "final-choice"].sort();

    expect(normalRunGraph.entry).toBe("wave-1");
    expect(nodeIds).toEqual(expected);
    expect(Object.keys(normalRunGraph.transitions).sort()).toEqual(expected);
  });
});

describe("normalRunGraph — full run simulation (PHASEFLOW-13)", () => {
  it("wave-N transition only fires on bossDefeated, and only to the next node", () => {
    const world = emptyWorld();
    const ctx = makeContext();
    const state = { phase: normalRunGraph.nodes[normalRunGraph.entry]() };
    state.phase.enter(world, ctx);

    // Sem chefe derrotado: nenhuma transição.
    expect(normalRunGraph.transitions["wave-1"](world, { playerHit: false, bossDefeated: false, gameOver: false, gameWon: false, bossPhaseAdvanced: false, promotionClaimed: false, newCallRequested: false, powerUpCollected: false })).toBeNull();
  });

  it("plays through wave-1 -> wave-4 -> final-choice -> 'promotion' ends the run (no further transition)", () => {
    const world = emptyWorld();
    const ctx = makeContext();
    const state = { phase: normalRunGraph.nodes[normalRunGraph.entry]() };
    state.phase.enter(world, ctx);
    expect(state.phase.id).toBe("wave-1");

    for (let n = 1; n < bossNames.length; n += 1) {
      killCurrentBoss(world);
      const events = step(state, world, ctx, makeInput(), 0.016);
      expect(events.bossDefeated).toBe(true);
      expect(state.phase.id).toBe(`wave-${n + 1}`);
      expect(world.run.wave).toBe(n + 1);
      expect(world.run.bossIndex).toBe(n);
    }

    // Chefe final (bossIndex = bossNames.length - 1).
    killCurrentBoss(world, 3);
    const finalEvents = step(state, world, ctx, makeInput(), 0.016);
    expect(finalEvents.bossDefeated).toBe(true);
    expect(state.phase.id).toBe("final-choice");
    expect(world.powerUps.map((p) => p.kind).sort()).toEqual(["call", "promotion"]);

    const promotion = world.powerUps.find((p) => p.kind === "promotion")!;
    world.player.x = promotion.x;
    world.player.y = promotion.y;
    const promotionEvents = step(state, world, ctx, makeInput(), 0.016);

    expect(promotionEvents.promotionClaimed).toBe(true);
    // "Promoção" é terminal DENTRO de `final-choice` — não é uma aresta do
    // grafo, então a Phase ativa continua sendo `final-choice`.
    expect(state.phase.id).toBe("final-choice");
    expect(state.phase.isComplete(world)).toBe(true);
  });

  it("'novo chamado' at the final choice loops back to wave-1 with callLoops incremented and a fresh cast", () => {
    const world = emptyWorld();
    const ctx = makeContext();
    const state = { phase: normalRunGraph.nodes[normalRunGraph.entry]() };
    state.phase.enter(world, ctx);
    world.run.score = 500;

    for (let n = 1; n < bossNames.length; n += 1) {
      killCurrentBoss(world);
      step(state, world, ctx, makeInput(), 0.016);
    }
    killCurrentBoss(world, 3);
    step(state, world, ctx, makeInput(), 0.016);
    expect(state.phase.id).toBe("final-choice");

    const call = world.powerUps.find((p) => p.kind === "call")!;
    world.player.x = call.x;
    world.player.y = call.y;
    const callEvents = step(state, world, ctx, makeInput(), 0.016);

    expect(callEvents.newCallRequested).toBe(true);
    // "Novo chamado" É uma aresta do grafo — troca a Phase ativa de volta
    // para `wave-1`, cujo `enter()` reseta a onda (score preservado,
    // `callLoops` incrementado, elenco/obstáculos repopulados) — mesmo
    // comportamento que `NormalRunPhase` monolítica tinha internamente.
    expect(state.phase.id).toBe("wave-1");
    expect(world.run.wave).toBe(1);
    expect(world.run.callLoops).toBe(1);
    // Score preservado (keepScore=true) — cada um dos 4 chefes abatidos
    // soma `ENEMY_DEATH_SCORE.boss` (500) ao score inicial de 500.
    expect(world.run.score).toBe(500 + bossNames.length * 500);
    expect(world.obstacles.length).toBeGreaterThan(0);
    expect(world.enemies.filter((enemy) => enemy.kind === "user")).toHaveLength(5);
    expect(state.phase.isComplete(world)).toBe(false);
    // Fix cycle-1, bug 2 (PHASEFLOW-13/14): end-to-end via a colisão real
    // (não `resolveFinalChoiceClick`) — o loop de "novo chamado" precisa
    // mostrar a confirmação "pontuação mantida" assim que `wave-1.enter()`
    // roda pela transição do grafo.
    expect(world.run.effectMessage).toBe("NOVO CHAMADO: pontuação mantida");
    expect(world.run.effectBanner).toBe(100);
  });
});
