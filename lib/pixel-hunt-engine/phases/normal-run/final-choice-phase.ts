// `createFinalChoicePhase()` — nó de grafo que resolve a tela de escolha
// final (promoção vs. novo chamado), Fatia 3 (T14, PHASEFLOW-10/12).
// Substitui o trecho de `NormalRunPhase` (hoje `phases/normal-run/index.ts`)
// que tratava `localGameState === "choice"`: `enter()` posiciona os 2
// power-ups via `spawnFinalChoices` (`final-choice.ts`, já existente);
// `update()` delega inteiramente a `physics.stepWorld` (o branch
// `choosingFinalReward` já existe lá e não muda — nenhuma lógica nova de
// física aqui); `resolveFinalChoiceClick()` delega a
// `resolveFinalChoiceClickPowerUp` (fix1, ENGINE-16). Nenhum import de
// `react`.

import { DEFAULT_CHARACTER_ID, resolveCharacter, type CharacterDefinition } from "@/lib/characters";
import { resolveFinalChoiceClickPowerUp, stepWorld } from "@/lib/pixel-hunt-engine/physics";
import { drawFrame, type ViewState } from "@/lib/pixel-hunt-engine/renderer";
import type { EnginePhase, PhaseContext } from "@/lib/pixel-hunt-engine/phases/phase";
import { spawnFinalChoices } from "@/lib/pixel-hunt-engine/phases/normal-run/final-choice";
import { biomeNames } from "@/lib/pixel-hunt-engine/phases/normal-run/wave-progression";
import { emptyFrameEvents } from "@/lib/pixel-hunt-engine/types";
import type { EngineWorld, FinalChoicePhaseState, FrameEvents, InputState } from "@/lib/pixel-hunt-engine/types";

// Mesmo papel que `readState` tinha em `phases/normal-run/index.ts` — só
// este módulo popula o membro `final-choice` do union `PhaseState`
// (`types.ts`).
function readState(world: EngineWorld): FinalChoicePhaseState {
  if (world.phaseState?.phase === "final-choice") return world.phaseState;
  const fresh: FinalChoicePhaseState = { phase: "final-choice", localGameState: "choice" };
  world.phaseState = fresh;
  return fresh;
}

/**
 * Porta `applyFinalChoiceOutcome()` (`phases/normal-run/index.ts`) — deriva
 * o `localGameState` resultante a partir dos `FrameEvents` de um desfecho de
 * escolha final. Reusado tanto por `update()` (colisão passiva, via
 * `stepWorld`) quanto por `resolveFinalChoiceClick()` (clique/toque
 * instantâneo, fix1 ENGINE-16) — a MESMA lógica nos dois caminhos, para
 * nunca duplicar (e nunca dessincronizar) o desfecho. Diferente do
 * original: "novo chamado" (`events.newCallRequested`) não reseta o mundo
 * aqui — isso agora é responsabilidade de `wave-1`'s `enter()` (T13), que a
 * transição do grafo (T15) chama a seguir.
 */
function applyFinalChoiceOutcome(events: FrameEvents, state: FinalChoicePhaseState) {
  if (events.promotionClaimed) state.localGameState = "promotion";
  else if (state.localGameState !== "over" && state.localGameState !== "won" && state.localGameState !== "promotion") {
    state.localGameState = "choice";
  }
}

export function createFinalChoicePhase(): EnginePhase {
  // Mesmo papel que a variável equivalente tinha em
  // `phases/normal-run/index.ts` — só para `draw()` montar o `ViewState`.
  let character: CharacterDefinition = resolveCharacter(DEFAULT_CHARACTER_ID);

  return {
    id: "final-choice",

    enter(world: EngineWorld, ctx: PhaseContext) {
      character = ctx.character;
      world.phaseState = { phase: "final-choice", localGameState: "choice" } satisfies FinalChoicePhaseState;

      const corpse = world.run.finalBossCorpse;
      if (!corpse) {
        // Bug de integração entre `waves.ts` (T13) e este módulo — a
        // transição `wave-N → final-choice` (T15) só deveria disparar
        // depois de `waves.ts`'s `update()` gravar `finalBossCorpse` no
        // mesmo frame (ver design.md § Risks). Falha alto e cedo em vez de
        // deixar `spawnFinalChoices` explodir com `undefined.x`.
        throw new Error(
          "final-choice-phase.enter(): world.run.finalBossCorpse está null — a transição do grafo entrou " +
            "em 'final-choice' sem a onda final ter gravado a posição do chefe primeiro.",
        );
      }
      spawnFinalChoices(world, corpse.x, corpse.y);
    },

    update(world: EngineWorld, ctx: PhaseContext, input: InputState, delta: number): FrameEvents {
      const state = readState(world);
      if (state.localGameState === "over" || state.localGameState === "won" || state.localGameState === "promotion") {
        return emptyFrameEvents();
      }

      const events = stepWorld(world, input, delta, ctx.audio);

      applyFinalChoiceOutcome(events, state);
      if (events.gameOver) state.localGameState = "over";
      if (events.gameWon) state.localGameState = "won";

      return events;
    },

    // Clique/toque direto num dos power-ups da escolha final (fix1,
    // ENGINE-16) — delega a busca espacial a
    // `physics.resolveFinalChoiceClickPowerUp`; se resolveu, aplica o MESMO
    // desfecho de `update()` via `applyFinalChoiceOutcome`.
    resolveFinalChoiceClick(world: EngineWorld, ctx: PhaseContext, x: number, y: number): FrameEvents | null {
      const state = readState(world);
      if (state.localGameState !== "choice") return null;

      const events = resolveFinalChoiceClickPowerUp(world, ctx.audio, x, y);
      if (!events) return null;

      applyFinalChoiceOutcome(events, state);
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

    // Reflete os 3 desfechos terminais possíveis da escolha final — "novo
    // chamado" (`newCallRequested`) NÃO é terminal aqui: é uma aresta de
    // grafo (`final-choice → wave-1`, T15), não um estado local desta Phase.
    isComplete(world: EngineWorld): boolean {
      const state = readState(world);
      return state.localGameState === "over" || state.localGameState === "won" || state.localGameState === "promotion";
    },

    // Réplica exata do ramo `run.finalChoicePending === true` de
    // `NormalRunPhase.hudLabels()` (Fatia 2, T12) — sempre verdadeiro
    // enquanto esta Phase está ativa (setado por `spawnFinalChoices` em
    // `enter()`).
    hudLabels(world: EngineWorld) {
      return {
        boss: "Diretoria caída",
        biome: biomeNames[Math.min(world.run.bossIndex, biomeNames.length - 1)] ?? "War Room",
        bossProgress: "Escolha final",
      };
    },
  };
}
