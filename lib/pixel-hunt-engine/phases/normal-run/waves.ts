// `createWavePhase(waveNumber)` — fábrica genérica de fase-onda (Fatia 3,
// T13, PHASEFLOW-10/11). Substitui o trecho de `NormalRunPhase` (hoje
// `phases/normal-run/index.ts`) que trata "onda N em andamento": spawn do
// elenco inicial (onda 1) ou progressão de onda (onda N > 1), física via
// `physics.stepWorld`, progresso do chefe (`boss.ts`) e o handoff para
// `final-choice-phase.ts` via `world.run.finalBossCorpse` quando o chefe
// FINAL morre. Quem decide QUANDO trocar de onda é a transição do
// `normalRunGraph` (T15), não esta Phase — `isComplete()` é sempre `false`
// aqui. Nenhum import de `react`.

import { DEFAULT_CHARACTER_ID, resolveCharacter, type CharacterDefinition } from "@/lib/characters";
import { stepWorld } from "@/lib/pixel-hunt-engine/physics";
import { drawFrame, type ViewState } from "@/lib/pixel-hunt-engine/renderer";
import type { EnginePhase, PhaseContext } from "@/lib/pixel-hunt-engine/phases/phase";
import { countBossProgress, isFinalBoss } from "@/lib/pixel-hunt-engine/phases/normal-run/boss";
import { spawnEnemy, spawnObstacles, spawnPowerUp, type NormalEnemyKind } from "@/lib/pixel-hunt-engine/phases/normal-run/spawn";
import { biomeNames, bossKillTarget, bossNames, resetWaveOne } from "@/lib/pixel-hunt-engine/phases/normal-run/wave-progression";
import type { DebugAction, EngineWorld, FrameEvents, InputState, WavePhaseState } from "@/lib/pixel-hunt-engine/types";

const BURST_STAMINA_MAX = 100;

// Mesmo papel que `readState`/`fresh` tinham em `phases/normal-run/index.ts`
// — só este módulo popula o membro `wave` do union `PhaseState` (`types.ts`).
function readState(world: EngineWorld): WavePhaseState {
  if (world.phaseState?.phase === "wave") return world.phaseState;
  const fresh: WavePhaseState = { phase: "wave", localGameState: "playing" };
  world.phaseState = fresh;
  return fresh;
}

/** Porta o bloco de spawn por tempo de `NormalRunPhase.update()` (`app/page.tsx:1480-1510`, hoje `phases/normal-run/index.ts`'s `runSpawnTimers`). Cópia deliberada (não um import) — `phases/normal-run/index.ts` é removido na T16, então não há duplicação de longo prazo. */
function runSpawnTimers(world: EngineWorld, ctx: PhaseContext) {
  const usersAlive = world.enemies.filter((enemy) => enemy.kind === "user").length;
  const dataAlive = world.enemies.filter((enemy) => enemy.kind === "data").length;
  const specialKinds = new Set(["qa", "vip", "incident", "legacy"]);
  const specialAlive = world.enemies.filter((enemy) => specialKinds.has(enemy.kind)).length;
  const maxUsers = 7 + world.run.wave * 2;
  const maxData = 3 + Math.ceil(world.run.wave * 0.8);
  const maxSpecial = Math.min(2 + Math.floor(world.run.wave / 2), 5);

  if (world.run.spawnTimer <= 0 && usersAlive < maxUsers) {
    world.run.spawnTimer = Math.max(0.58, 1.45 - world.run.wave * 0.08);
    const specialPool: NormalEnemyKind[] = [
      ...(world.run.wave >= 2 ? (["qa"] as const) : []),
      ...(world.run.wave >= 3 ? (["vip"] as const) : []),
      ...(world.run.wave >= 4 ? (["incident"] as const) : []),
      ...(world.run.wave >= 5 ? (["legacy"] as const) : []),
    ];
    if (specialPool.length && specialAlive < maxSpecial && Math.random() < 0.34) {
      spawnEnemy(world, specialPool[Math.floor(Math.random() * specialPool.length)], ctx.audio);
    } else {
      spawnEnemy(world, "user", ctx.audio);
    }
  }
  if (world.run.dataTimer <= 0 && dataAlive < maxData) {
    world.run.dataTimer = Math.max(1.55, 4.1 - world.run.wave * 0.18);
    spawnEnemy(world, "data", ctx.audio);
  }
  if (world.run.powerUpTimer <= 0 && world.powerUps.length < 2) {
    world.run.powerUpTimer = 11 + Math.random() * 8;
    spawnPowerUp(world);
  }
}

export function createWavePhase(waveNumber: number): EnginePhase {
  // Mesmo papel que a variável equivalente tinha em
  // `phases/normal-run/index.ts` — só para `draw()` montar o `ViewState`
  // que `renderer.drawFrame` exige, não é estado de jogo.
  let character: CharacterDefinition = resolveCharacter(DEFAULT_CHARACTER_ID);
  const bossIndex = waveNumber - 1;

  return {
    id: `wave-${waveNumber}`,

    enter(world: EngineWorld, ctx: PhaseContext) {
      character = ctx.character;
      world.phaseState = { phase: "wave", localGameState: "playing" } satisfies WavePhaseState;

      if (waveNumber === 1) {
        // `keepScore: true` é seguro tanto pra início fresco (score/callLoops
        // já zerados por `createWorld`) quanto pro loop de "novo chamado"
        // (`final-choice → wave-1`, T15) — ver design.md § Tech Decisions.
        resetWaveOne(world, ctx, true);
        spawnObstacles(world);
        for (let i = 0; i < 5; i += 1) spawnEnemy(world, "user", ctx.audio);

        // Fix cycle-1, bug 2 (PHASEFLOW-13/14): `resetWaveOne` acima já
        // limpou `effectMessage`/`effectBanner` para ""/0. No código
        // pré-decomposição (`git show 065aafa:.../index.ts`,
        // `applyFinalChoiceOutcome`), o branch de "novo chamado" setava o
        // banner "NOVO CHAMADO: pontuação mantida" no MESMO bloco síncrono
        // que resetava o mundo — essa atribuição nunca migrou para cá
        // quando o reset se mudou para este `enter()` (T13). `callLoops` é
        // incrementado em `collectPowerUp` (physics.ts) ANTES da transição
        // do grafo chamar este `enter()`, e não é zerado por
        // `resetWaveOne(..., keepScore: true)` — então `callLoops > 0`
        // aqui distingue de forma confiável um reentrada por loop de "novo
        // chamado" de uma entrada fresca (início de jogo/reset de debug,
        // onde `callLoops` ainda é 0).
        if (world.run.callLoops > 0) {
          world.run.effectMessage = "NOVO CHAMADO: pontuação mantida";
          world.run.effectBanner = 100;
        }
      } else {
        // Porta o branch `events.bossDefeated && !isFinal` de
        // `NormalRunPhase.update()` — só atualiza a progressão de onda, sem
        // repopular o elenco inicial (o mesmo que o código monolítico fazia
        // ao avançar de onda).
        world.run.bossIndex = bossIndex;
        world.run.wave = waveNumber;
        world.run.bossKills = 0;
        world.run.bossSpawned = false;
        spawnObstacles(world);
      }
    },

    update(world: EngineWorld, ctx: PhaseContext, input: InputState, delta: number): FrameEvents {
      runSpawnTimers(world, ctx);

      // O chefe precisa ser removido do array antes de `stepWorld` retornar
      // (para não ficar "morto" na tela) — captura a posição aqui, antes da
      // chamada, para poder gravar `world.run.finalBossCorpse` (canal para
      // `final-choice-phase.enter()`, T14) caso `events.bossDefeated`
      // indique que era o chefe final desta onda.
      const bossBeforeStep = world.enemies.find((enemy) => enemy.kind === "boss");
      const bossPositionBeforeStep = bossBeforeStep ? { x: bossBeforeStep.x, y: bossBeforeStep.y } : null;

      const events = stepWorld(world, input, delta, ctx.audio);

      if (events.bossDefeated) {
        if (isFinalBoss(bossIndex)) {
          world.run.finalBossCorpse = bossPositionBeforeStep ?? { x: world.player.x, y: world.player.y };
        }
        // Onda não-final: nada a fazer aqui — a transição do grafo (T15)
        // decide trocar para `wave-${waveNumber + 1}`, cujo `enter()` já
        // cuida de `bossIndex`/`wave`/`bossKills`/`bossSpawned`/obstáculos.
      } else {
        countBossProgress(world, ctx.audio);
      }

      const state = readState(world);
      if (events.gameOver) state.localGameState = "over";
      if (events.gameWon) state.localGameState = "won";

      return events;
    },

    draw(ctx: CanvasRenderingContext2D, world: EngineWorld) {
      const state = readState(world);
      const view: ViewState = {
        character,
        gameState: state.localGameState,
        menuPanel: "home",
      };
      drawFrame(ctx, world, view);
    },

    // A transição do grafo (T15) decide quando sair desta onda (chefe
    // derrotado) — esta Phase só fica "completa" nos desfechos terminais que
    // não são uma transição de grafo (derrota do jogador, ou vitória forçada
    // via debug), mesmo critério que `NormalRunPhase.isComplete()` já usava
    // para "over"/"won".
    isComplete(world: EngineWorld): boolean {
      const state = readState(world);
      return state.localGameState === "over" || state.localGameState === "won";
    },

    handleDebugAction(action: DebugAction, world: EngineWorld, ctx: PhaseContext) {
      const state = readState(world);
      if (action === "spawn_boss") {
        if (!world.run.bossSpawned) {
          world.run.bossKills = bossKillTarget(world.run.wave, world.run.callLoops);
          world.run.bossSpawned = true;
          spawnEnemy(world, "boss", ctx.audio);
        }
      } else if (action === "add_powerup") {
        spawnPowerUp(world);
        world.run.effectMessage = "DEBUG: power-up liberado";
        world.run.effectBanner = 100;
      } else if (action === "max_stamina") {
        world.run.burstStamina = BURST_STAMINA_MAX;
      } else if (action === "win_game") {
        state.localGameState = "won";
      }
    },

    // Réplica exata de `NormalRunPhase.hudLabels()` (Fatia 2, T12) — os
    // ternários de `run.finalChoicePending` nunca disparam enquanto uma
    // wave-phase está ativa (só passa a `true` dentro de
    // `final-choice-phase.enter()`, T14), mantidos por fidelidade 1:1 ao
    // texto que `orchestrator.ts`'s `buildSnapshot()` já produzia.
    hudLabels(world: EngineWorld) {
      const { run } = world;
      const target = bossKillTarget(run.wave, run.callLoops);
      return {
        boss: run.finalChoicePending ? "Diretoria caída" : bossNames[run.bossIndex] ?? "Comitê Executivo",
        biome: biomeNames[Math.min(run.bossIndex, biomeNames.length - 1)] ?? "War Room",
        bossProgress: run.finalChoicePending
          ? "Escolha final"
          : run.bossSpawned
            ? "Chefe em combate"
            : `${Math.min(run.bossKills, target)}/${target} mobs`,
      };
    },
  };
}
