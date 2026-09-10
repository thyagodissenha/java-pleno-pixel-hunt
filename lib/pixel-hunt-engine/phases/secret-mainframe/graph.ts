// `PhaseGraph` de 1 nó só para a fase secreta ("O Mainframe") — Fatia 1
// (PHASEFLOW-07). Envolve `createSecretMainframePhase` (já existente) SEM
// tocar seu conteúdo. `transitions` vazio: nó terminal, sem arestas de
// saída — mesmo comportamento de hoje (`startSecretRun()` é um caminho
// paralelo que nunca "termina" sozinho, só via `returnToMenu()`/crash).

import { createSecretMainframePhase } from "@/lib/pixel-hunt-engine/phases/secret-mainframe";
import type { PhaseGraph } from "@/lib/pixel-hunt-engine/types";

export const secretMainframeGraph: PhaseGraph = {
  entry: "secret-mainframe",
  nodes: {
    "secret-mainframe": createSecretMainframePhase,
  },
  transitions: {},
};
