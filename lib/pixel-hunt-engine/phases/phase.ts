// Contrato `EnginePhase` — o único ponto de acoplamento entre o
// `Orchestrator` (lib/pixel-hunt-engine/orchestrator.ts) e qualquer fase do
// jogo, hoje ou futura (ver design.md § Data Models). Abstração nova,
// não porta nenhum código existente. Nenhum import de `react`.

import type { CharacterDefinition } from "@/lib/characters";
import type { AudioEngine } from "@/lib/pixel-hunt-engine/audio";
import type { DebugAction, EngineWorld, FrameEvents, InputState } from "@/lib/pixel-hunt-engine/types";

export type PhaseContext = {
  audio: AudioEngine;
  character: CharacterDefinition;
};

export type EnginePhase = {
  readonly id: "normal-run" | "secret-mainframe";
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
};
