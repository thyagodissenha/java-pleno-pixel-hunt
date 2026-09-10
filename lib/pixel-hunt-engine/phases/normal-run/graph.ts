// `normalRunGraph` real (Fatia 3, T15, PHASEFLOW-10/13) — substitui por
// completo o grafo de 1 nó da Fatia 1 (T4). `wave-1`..`wave-${bossNames.
// length}` + `final-choice`: gerados NUM LOOP (não literal) sobre
// `bossNames.length` (design.md § Tech Decisions) — se o roster de chefes
// crescer, o grafo escala sozinho. Nenhum import de `react`.

import type { EnginePhase } from "@/lib/pixel-hunt-engine/phases/phase";
import { isFinalBoss } from "@/lib/pixel-hunt-engine/phases/normal-run/boss";
import { createFinalChoicePhase } from "@/lib/pixel-hunt-engine/phases/normal-run/final-choice-phase";
import { createWavePhase } from "@/lib/pixel-hunt-engine/phases/normal-run/waves";
import { bossNames } from "@/lib/pixel-hunt-engine/phases/normal-run/wave-progression";
import type { EngineWorld, FrameEvents, PhaseGraph, PhaseId } from "@/lib/pixel-hunt-engine/types";

const FINAL_CHOICE_NODE: PhaseId = "final-choice";

/**
 * Transição de um nó `wave-N`: só dispara quando o chefe DESTA onda morreu
 * (`events.bossDefeated`) — enquanto isso não acontece, permanece (`null`).
 * Quando dispara, `isFinalBoss(waveNumber - 1)` decide o destino: a onda
 * seguinte (`wave-${waveNumber + 1}`) ou `final-choice`, se era o chefe
 * final.
 */
function waveTransition(waveNumber: number) {
  return (_world: EngineWorld, events: FrameEvents): PhaseId | null => {
    if (!events.bossDefeated) return null;
    return isFinalBoss(waveNumber - 1) ? FINAL_CHOICE_NODE : `wave-${waveNumber + 1}`;
  };
}

/**
 * Transição de `final-choice`: só dispara em "novo chamado"
 * (`events.newCallRequested`), voltando pra `wave-1` (loop). "promoção" NÃO
 * transiciona — é um desfecho terminal tratado inteiramente dentro da
 * própria `final-choice-phase` (`localGameState: "promotion"`, lido por
 * `isComplete()`/`currentGameState()`), não uma saída de nó do grafo.
 */
function finalChoiceTransition(_world: EngineWorld, events: FrameEvents): PhaseId | null {
  return events.newCallRequested ? "wave-1" : null;
}

function buildNormalRunGraph(): PhaseGraph {
  const nodes: Record<PhaseId, () => EnginePhase> = {};
  const transitions: Record<PhaseId, (world: EngineWorld, events: FrameEvents) => PhaseId | null> = {};

  for (let n = 1; n <= bossNames.length; n += 1) {
    nodes[`wave-${n}`] = () => createWavePhase(n);
    transitions[`wave-${n}`] = waveTransition(n);
  }

  nodes[FINAL_CHOICE_NODE] = () => createFinalChoicePhase();
  transitions[FINAL_CHOICE_NODE] = finalChoiceTransition;

  return { entry: "wave-1", nodes, transitions };
}

export const normalRunGraph: PhaseGraph = buildNormalRunGraph();
