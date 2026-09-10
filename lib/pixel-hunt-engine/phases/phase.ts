// Contrato `EnginePhase` — o único ponto de acoplamento entre o
// `Orchestrator` (lib/pixel-hunt-engine/orchestrator.ts) e qualquer fase do
// jogo, hoje ou futura (ver design.md § Data Models). Abstração nova,
// não porta nenhum código existente. Nenhum import de `react`.

import type { CharacterDefinition } from "@/lib/characters";
import type { AudioEngine } from "@/lib/pixel-hunt-engine/audio";
import type { DebugAction, EngineWorld, FrameEvents, InputState, PhaseId } from "@/lib/pixel-hunt-engine/types";

export type PhaseContext = {
  audio: AudioEngine;
  character: CharacterDefinition;
};

export type EnginePhase = {
  // PHASEFLOW-06: era a union fechada `"normal-run" | "secret-mainframe"` —
  // `PhaseId` (tipo aberto, `types.ts`) permite que qualquer `PhaseGraph`
  // futuro declare seus próprios nós sem editar este arquivo. Strings
  // literais como `"normal-run"`/`"secret-mainframe"` continuam atribuíveis
  // (literal de string é atribuível a `string`).
  readonly id: PhaseId;
  enter(world: EngineWorld, ctx: PhaseContext): void;
  update(world: EngineWorld, ctx: PhaseContext, input: InputState, delta: number): FrameEvents;
  draw(ctx: CanvasRenderingContext2D, world: EngineWorld): void;
  isComplete(world: EngineWorld): boolean;
  handleDebugAction?(action: DebugAction, world: EngineWorld, ctx: PhaseContext): void;
  // Resolve um clique/toque direto num power-up da escolha final, sem
  // esperar a colisão passiva jogador↔powerup em `stepWorld` (fix1,
  // ENGINE-16 — restaura o clique instantâneo do código pré-refactor).
  // Opcional: só `NormalRunPhase` implementa (a escolha final não existe na
  // fase secreta). Retorna `null` quando a fase não trata o ponto (fora do
  // raio, ou fora do estado em que a escolha final está ativa).
  resolveFinalChoiceClick?(world: EngineWorld, ctx: PhaseContext, x: number, y: number): FrameEvents | null;
  // Textos de HUD (chefe atual/bioma/progresso do chefe) — Fatia 2 (T12,
  // PHASEFLOW-02/04). `orchestrator.ts`'s `buildSnapshot()` chama isso em
  // vez do antigo `isSecret ? ... : ...` (removido nesta task). Opcional:
  // uma Phase de teste minimalista (sem `hudLabels`) faz `buildSnapshot()`
  // cair no fallback genérico ("—").
  hudLabels?(world: EngineWorld): { boss: string; biome: string; bossProgress: string };
};
