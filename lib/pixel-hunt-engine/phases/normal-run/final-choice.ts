// Escolha final (promoção vs. novo chamado) que aparece depois de derrotar
// o chefe final. Porta `spawnFinalChoices`, `isFinalChoicePowerUp`
// (`app/page.tsx:193-195`, `932-961`). Nenhum import de `react`.

import { clamp } from "@/lib/pixel-hunt-engine/geometry";
import type { EngineWorld, PowerUpKind } from "@/lib/pixel-hunt-engine/types";

const WORLD = { width: 960, height: 540 };
const FINAL_CHOICE_OFFSET_X = 104;
const FINAL_CHOICE_OFFSET_Y = 76;

/** Raio de coleta (passiva, por colisão) dos power-ups da escolha final — movida de `physics.ts`/`renderer.ts` (fix1 T4, dedupe ENGINE-20). */
export const FINAL_CHOICE_PICKUP_RADIUS = 68;

/** Raio de clique instantâneo (fix1, fundação de ENGINE-16) — mesmo valor do pré-refactor (ver `git show 06093ed:app/page.tsx:163`). */
export const FINAL_CHOICE_CLICK_RADIUS = 52;

/** Porta `isFinalChoicePowerUp()` (`app/page.tsx:193-195`). */
export function isFinalChoicePowerUp(kind: PowerUpKind) {
  return kind === "promotion" || kind === "call";
}

/**
 * Porta `spawnFinalChoices()` (`app/page.tsx:932-961`) — limpa a arena e
 * posiciona as duas escolhas ("promotion"/"call") perto de `(x, y)` (o
 * ponto de morte do chefe final), com o mesmo clamp de borda de hoje. Não
 * toca em `gameState`/`stateRef` (não existem no motor) — a Phase ativa
 * (`NormalRunPhase`, T10) deriva o estado "choice" a partir de
 * `world.run.finalChoicePending`.
 */
export function spawnFinalChoices(world: EngineWorld, x: number, y: number) {
  const { run } = world;
  run.finalChoicePending = true;
  run.bossSpawned = true;
  run.finalBossCorpse = { x, y };
  run.bossBanner = 0;
  run.shake = 0;
  run.effectMessage = "ESCOLHA O SEU DESTINO CORPORATIVO";
  run.effectBanner = 100;

  world.enemies.length = 0;
  world.shots.length = 0;
  world.powerUps.length = 0;
  world.obstacles.length = 0;

  const choiceCenterX = clamp(world.player.x, FINAL_CHOICE_OFFSET_X + 40, WORLD.width - FINAL_CHOICE_OFFSET_X - 40);
  const choiceY = clamp(world.player.y - FINAL_CHOICE_OFFSET_Y, 120, WORLD.height - 110);
  const choices: Array<{ kind: PowerUpKind; x: number; y: number }> = [
    { kind: "promotion", x: choiceCenterX - FINAL_CHOICE_OFFSET_X, y: choiceY },
    { kind: "call", x: choiceCenterX + FINAL_CHOICE_OFFSET_X, y: choiceY },
  ];
  for (const choice of choices) {
    world.powerUps.push({
      x: choice.x,
      y: choice.y,
      kind: choice.kind,
      ttl: 99999,
      pulse: Math.random() * Math.PI * 2,
    });
  }
}
