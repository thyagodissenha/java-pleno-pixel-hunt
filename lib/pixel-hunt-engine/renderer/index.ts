// Desenha o `EngineWorld` no canvas — puramente funções `(ctx, world) =>
// void`, sem mutar estado nem chamar `setState`. Fachada pública do motor
// (`drawFrame`/`ViewState`) — a lógica de desenho em si vive nos submódulos
// deste diretório, agrupados por área (fix2, T9-T13, ENGINE-29):
// `actors.ts` (jogador/inimigos/obstáculos/power-ups), `world.ts`
// (piso/grid/datacenter/escolha final/overlay da fase secreta),
// `overlays.ts` (dim/pausa/game-over/vitória), `phase-state.ts` (leitura do
// estado local da fase secreta).

import { pixelRect } from "@/lib/character-sprite";
import type { CharacterDefinition } from "@/lib/characters";
import type { GameState, MenuPanel } from "@/app/_hud/hud-props";
import { drawActor, drawObstacle, drawPlayer, drawPowerUp } from "@/lib/pixel-hunt-engine/renderer/actors";
import { drawDim, drawOverlay, drawVictoryOverlay } from "@/lib/pixel-hunt-engine/renderer/overlays";
import { readSecretPhaseState } from "@/lib/pixel-hunt-engine/renderer/phase-state";
import { drawFinalChoiceScene, drawGrid, drawSecretRunOverlay } from "@/lib/pixel-hunt-engine/renderer/world";
import type { EngineWorld, RunOrigin } from "@/lib/pixel-hunt-engine/types";

const WORLD = { width: 960, height: 540 };

export type ViewState = {
  character: CharacterDefinition;
  gameState: GameState;
  runOrigin: RunOrigin;
  menuPanel: MenuPanel;
};

export function drawFrame(ctx: CanvasRenderingContext2D, world: EngineWorld, view: ViewState): void {
  const { run } = world;
  const choosingFinalReward = view.gameState === "choice" || run.finalChoicePending;
  const shakeX = run.shake > 0 ? (Math.random() - 0.5) * run.shake : 0;
  const shakeY = run.shake > 0 ? (Math.random() - 0.5) * run.shake : 0;
  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawGrid(ctx, world, view);
  if (choosingFinalReward) drawFinalChoiceScene(ctx, world);
  if (!choosingFinalReward) world.obstacles.forEach((obstacle) => drawObstacle(ctx, obstacle));

  const secretPhaseState = view.runOrigin === "secret" ? readSecretPhaseState(world) : null;
  if (secretPhaseState && !choosingFinalReward) {
    drawSecretRunOverlay(ctx, secretPhaseState);
  }

  for (const particle of world.particles) {
    const size = Math.max(2, Math.min(8, particle.ttl / 6));
    pixelRect(ctx, particle.x, particle.y, size, size, particle.color);
  }
  if (!choosingFinalReward) {
    for (const shot of world.shots) {
      pixelRect(ctx, shot.x - shot.vx * 0.018 - 4, shot.y - shot.vy * 0.018 - 2, 8, 4, "#fde68a");
      pixelRect(ctx, shot.x - 5, shot.y - 3, 10, 6, "#facc15");
      pixelRect(ctx, shot.x + 3, shot.y - 1, 4, 2, "#fef9c3");
    }
    if (secretPhaseState) {
      for (const shot of secretPhaseState.secretBossShots) {
        ctx.save();
        ctx.shadowColor = "#ff5a4d";
        ctx.shadowBlur = 6;
        ctx.fillStyle = "#ff5a4d";
        ctx.beginPath();
        ctx.arc(shot.x, shot.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
  world.powerUps.forEach((powerUp) => drawPowerUp(ctx, powerUp));
  if (!choosingFinalReward) {
    [...world.enemies].sort((a, b) => a.y - b.y).forEach((actor) => drawActor(ctx, actor, run.visualFrame));
  }
  drawPlayer(ctx, world, view);
  ctx.restore();

  if (run.damageFlash > 0) {
    ctx.fillStyle = `rgba(239, 68, 68, ${Math.min(0.32, run.damageFlash / 55)})`;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  }

  if (run.bossBanner > 0 && view.gameState === "playing" && !run.finalChoicePending) {
    ctx.fillStyle = "rgba(2, 6, 23, 0.76)";
    ctx.fillRect(0, 26, WORLD.width, 58);
    ctx.fillStyle = "#facc15";
    ctx.font = "bold 28px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText("CHEFE ENTROU NA CALL", WORLD.width / 2, 64);
  }

  if (run.effectBanner > 0 && (view.gameState === "playing" || view.gameState === "choice")) {
    ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
    ctx.fillRect(WORLD.width / 2 - 230, WORLD.height - 72, 460, 34);
    ctx.fillStyle = "#7dd3fc";
    ctx.font = "bold 17px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText(run.effectMessage, WORLD.width / 2, WORLD.height - 50);
  }

  if (view.gameState === "menu" && view.menuPanel !== "home") {
    drawDim(ctx);
  } else if (view.gameState === "paused") {
    drawOverlay(ctx, "PAUSADO", "Respira. A daily espera.");
  } else if (view.gameState === "over") {
    drawOverlay(ctx, "PRODUÇÃO CAIU", `Pontuação final: ${run.score}`);
  } else if (view.gameState === "won") {
    drawVictoryOverlay(ctx, world);
  }
}
