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
import { drawFinalChoiceScene, drawGrid } from "@/lib/pixel-hunt-engine/renderer/world";
import type { EngineWorld } from "@/lib/pixel-hunt-engine/types";

const WORLD = { width: 960, height: 540 };

export type ViewState = {
  character: CharacterDefinition;
  gameState: GameState;
  menuPanel: MenuPanel;
  // Ganchos opcionais (Fatia 2, T11, PHASEFLOW-03) que substituem o antigo
  // `ViewOrigin` (o rótulo de apresentação que decidia se `drawFrame`/
  // `drawGrid` desenhavam o datacenter) — `drawFrame`/`drawGrid` chamam
  // estes callbacks nos MESMOS pontos onde antes checavam esse rótulo, sem
  // precisar saber o que desenham nem quem os forneceu. Só
  // `SecretMainframePhase` (`phases/secret-mainframe/index.ts`) os define
  // hoje; qualquer outra Phase pode reusar o mesmo mecanismo no futuro sem
  // editar `renderer/`.
  /** Substitui o chão genérico de `drawGrid` quando presente. */
  drawFloor?: (ctx: CanvasRenderingContext2D) => void;
  /** Chamado logo depois dos obstáculos (mesmo ponto onde a fase secreta
   * desenhava zonas de reunião/cobol snake). */
  drawGroundOverlay?: (ctx: CanvasRenderingContext2D) => void;
  /** Chamado no mesmo ponto em que os tiros normais são desenhados —
   * permite que uma Phase desenhe seus próprios projéteis. */
  drawExtraShots?: (ctx: CanvasRenderingContext2D) => void;
  // NOVO (feature fase-secreta-datacenter, T10): HUD persistente em
  // espaço de tela (pips das 4 barras, `FIREWALL x/100`/`CORE EXPOSTO!`) —
  // mesmo padrão dos 3 hooks acima, chamado incondicionalmente por
  // `drawFrame` (T11 usa isto para `drawSecretPhaseHud`).
  drawHudOverlay?: (ctx: CanvasRenderingContext2D) => void;
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
  // SPEC_DEVIATION (T10): tasks.md/design.md descrevem este loop como vivendo
  // em `renderer/world.ts` ("1 linha no loop de obstáculos de
  // renderer/world.ts"), mas o loop de obstáculos sempre viveu aqui em
  // `drawFrame` (renderer/index.ts) — `drawObstacle` (o desenho genérico) é
  // que fica em `renderer/actors.ts`. `Obstacle.render?` (types.ts, T1),
  // quando presente, substitui `drawObstacle` no mesmo ponto — mesmo padrão
  // de `Actor.render?` em `renderer/actors.ts`'s `drawActor`.
  if (!choosingFinalReward) {
    world.obstacles.forEach((obstacle) => {
      if (obstacle.render) obstacle.render(ctx, obstacle, run.visualFrame);
      else drawObstacle(ctx, obstacle);
    });
  }
  if (!choosingFinalReward) view.drawGroundOverlay?.(ctx);

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
    view.drawExtraShots?.(ctx);
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

  // NOVO (T10): chamado incondicionalmente, mesmo padrão dos hooks acima —
  // hoje só `SecretMainframePhase` o define (T13, `drawSecretPhaseHud`,
  // hud.ts, T11); nenhuma outra Phase é afetada.
  view.drawHudOverlay?.(ctx);

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
