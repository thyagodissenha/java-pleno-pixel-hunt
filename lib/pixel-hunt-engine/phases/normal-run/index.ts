// Monta `NormalRunPhase` — o fluxo principal do jogo (ondas → chefe →
// escolha final → novo chamado), implementando `EnginePhase` (`phase.ts`,
// T3). Cola a lógica de orquestração hoje espalhada em
// `app/page.tsx:677-2517` para esse fluxo: `enter` reseta a onda 1
// (`wave-progression.ts`, T6) e spawna o elenco inicial
// (`spawn.ts`, T7); `update` decide o spawn por tempo (T7), delega a física
// para `physics.stepWorld` (T5) e reage aos `FrameEvents` retornados —
// progresso do chefe (`boss.ts`, T8) e escolha final (`final-choice.ts`,
// T9); `draw` delega para `renderer.drawFrame` (T4). Nenhum import de
// `react`.

import { DEFAULT_CHARACTER_ID, resolveCharacter, type CharacterDefinition } from "@/lib/characters";
import { resolveFinalChoiceClickPowerUp, stepWorld } from "@/lib/pixel-hunt-engine/physics";
import { drawFrame, type ViewState } from "@/lib/pixel-hunt-engine/renderer";
import type { EnginePhase, PhaseContext } from "@/lib/pixel-hunt-engine/phases/phase";
import { countBossProgress, isFinalBoss } from "@/lib/pixel-hunt-engine/phases/normal-run/boss";
import { spawnFinalChoices } from "@/lib/pixel-hunt-engine/phases/normal-run/final-choice";
import { spawnEnemy, spawnObstacles, spawnPowerUp, type NormalEnemyKind } from "@/lib/pixel-hunt-engine/phases/normal-run/spawn";
import { bossKillTarget, bossNames, resetWaveOne } from "@/lib/pixel-hunt-engine/phases/normal-run/wave-progression";
import { emptyFrameEvents } from "@/lib/pixel-hunt-engine/types";
import type { DebugAction, EngineWorld, FrameEvents, InputState, NormalRunPhaseState } from "@/lib/pixel-hunt-engine/types";

const BURST_STAMINA_MAX = 100;

// `EngineWorld.phaseState` — só este módulo popula o membro `normal-run` do
// union `PhaseState` (`types.ts`, fix2 ENGINE-28). Só guarda o que não cabe
// em nenhum outro lugar já lido puramente de `world`: o estado "de tela"
// desta Phase (`playing`/`choice`/`over`/`won`/`promotion`), que
// `isComplete`/`draw` precisam ler sem depender de um campo privado da
// instância (a Phase é reaproveitada entre runs).
function readState(world: EngineWorld): NormalRunPhaseState {
  if (world.phaseState?.phase === "normal-run") return world.phaseState;
  const fresh: NormalRunPhaseState = { phase: "normal-run", localGameState: "playing" };
  world.phaseState = fresh;
  return fresh;
}

/**
 * Extraído de `update()` (fix1, T6) — trata o desfecho de "promotion"/"call"
 * da escolha final e deriva o `localGameState` resultante ("choice" ->
 * "playing"/"promotion"). Reusado tanto por `update()` (colisão passiva,
 * via `stepWorld`) quanto por `resolveFinalChoiceClick()` (clique/toque
 * instantâneo, fix1 ENGINE-16) — a MESMA lógica de transição nos dois
 * caminhos, para nunca duplicar (e nunca dessincronizar) o desfecho da
 * escolha final. `events.gameOver`/`events.gameWon` continuam tratados por
 * quem chama (não fazem parte do desfecho da escolha final).
 */
function applyFinalChoiceOutcome(
  world: EngineWorld,
  ctx: PhaseContext,
  events: FrameEvents,
  state: NormalRunPhaseState,
) {
  if (events.newCallRequested) {
    resetWaveOne(world, ctx, true);
    spawnObstacles(world);
    for (let i = 0; i < 5; i += 1) spawnEnemy(world, "user", ctx.audio);
    world.run.effectMessage = "NOVO CHAMADO: pontuação mantida";
    world.run.effectBanner = 100;
  }
  if (events.promotionClaimed) state.localGameState = "promotion";

  if (state.localGameState !== "over" && state.localGameState !== "won" && state.localGameState !== "promotion") {
    state.localGameState = world.run.finalChoicePending ? "choice" : "playing";
  }
}

/** Porta o bloco de spawn por tempo de `update()` (`app/page.tsx:1480-1510`). */
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

export function createNormalRunPhase(): EnginePhase {
  // Guardado à parte de `world.phaseState` só para `draw()` montar o
  // `ViewState` que `renderer.drawFrame` (T4) exige — não é estado de jogo
  // (não precisa sobreviver a um `enter()` novo nem ser lido por
  // `isComplete`), por isso não vive em `world`.
  let character: CharacterDefinition = resolveCharacter(DEFAULT_CHARACTER_ID);

  return {
    id: "normal-run",

    enter(world: EngineWorld, ctx: PhaseContext) {
      character = ctx.character;
      resetWaveOne(world, ctx, false);
      world.phaseState = { phase: "normal-run", localGameState: "playing" } satisfies NormalRunPhaseState;
      spawnObstacles(world);
      for (let i = 0; i < 5; i += 1) spawnEnemy(world, "user", ctx.audio);
    },

    update(world: EngineWorld, ctx: PhaseContext, input: InputState, delta: number): FrameEvents {
      const state = readState(world);
      if (state.localGameState === "over" || state.localGameState === "won" || state.localGameState === "promotion") {
        return emptyFrameEvents();
      }

      if (!world.run.finalChoicePending) {
        runSpawnTimers(world, ctx);
      }

      // O chefe precisa ser removido do array antes de `stepWorld` retornar
      // (para não ficar "morto" na tela) — captura a posição aqui, antes da
      // chamada, para poder posicionar a escolha final (`final-choice.ts`,
      // T9) caso `events.bossDefeated` indique que era o chefe final.
      const bossBeforeStep = world.enemies.find((enemy) => enemy.kind === "boss");
      const bossPositionBeforeStep = bossBeforeStep ? { x: bossBeforeStep.x, y: bossBeforeStep.y } : null;
      const bossIndexBeforeStep = world.run.bossIndex;

      const events = stepWorld(world, input, delta, ctx.audio);

      if (events.bossDefeated) {
        if (isFinalBoss(bossIndexBeforeStep)) {
          const corpse = bossPositionBeforeStep ?? { x: world.player.x, y: world.player.y };
          spawnFinalChoices(world, corpse.x, corpse.y);
        } else {
          world.run.bossIndex += 1;
          world.run.wave += 1;
          world.run.bossKills = 0;
          world.run.bossSpawned = false;
          spawnObstacles(world);
          // Porta o branch defensivo de `app/page.tsx:1841-1851` — hoje
          // inalcançável na prática (`isFinalBoss` já teria desviado para
          // `spawnFinalChoices` antes de chegar aqui), mantido por
          // fidelidade 1:1 ao comportamento atual.
          if (world.run.bossIndex >= bossNames.length) {
            state.localGameState = "won";
          }
        }
      } else {
        countBossProgress(world, ctx.audio);
      }

      applyFinalChoiceOutcome(world, ctx, events, state);

      if (events.gameOver) state.localGameState = "over";
      if (events.gameWon) state.localGameState = "won";

      return events;
    },

    // Clique/toque direto num dos power-ups da escolha final (fix1,
    // ENGINE-16) — mesmo padrão de `handleDebugAction`, só efetivo quando
    // `localGameState === "choice"` (guard). Delega a busca espacial a
    // `physics.resolveFinalChoiceClickPowerUp`; se resolveu, aplica o MESMO
    // desfecho de `update()` via `applyFinalChoiceOutcome` — nenhuma lógica
    // de transição duplicada entre os dois caminhos.
    resolveFinalChoiceClick(world: EngineWorld, ctx: PhaseContext, x: number, y: number): FrameEvents | null {
      const state = readState(world);
      if (state.localGameState !== "choice") return null;

      const events = resolveFinalChoiceClickPowerUp(world, ctx.audio, x, y);
      if (!events) return null;

      applyFinalChoiceOutcome(world, ctx, events, state);
      return events;
    },

    draw(ctx: CanvasRenderingContext2D, world: EngineWorld) {
      const state = readState(world);
      const view: ViewState = {
        character,
        gameState: state.localGameState,
        runOrigin: "normal",
        menuPanel: "home",
      };
      drawFrame(ctx, world, view);
    },

    isComplete(world: EngineWorld): boolean {
      const state = readState(world);
      return state.localGameState === "over" || state.localGameState === "won" || state.localGameState === "promotion";
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
  };
}
