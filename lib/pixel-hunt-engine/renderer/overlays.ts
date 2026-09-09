// Overlays de tela cheia (dim/pausa/game-over/vitória) desenhados por cima
// do mundo. Fix2, T11 (ENGINE-29) — extraído de `renderer.ts`, sem mudar
// nenhuma lógica de desenho.

import { pixelRect } from "@/lib/character-sprite";
import type { EngineWorld } from "@/lib/pixel-hunt-engine/types";

const WORLD = { width: 960, height: 540 };

export function drawDim(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(8, 13, 24, 0.76)";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
}

export function drawOverlay(ctx: CanvasRenderingContext2D, title: string, text: string) {
  drawDim(ctx);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 42px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText(title, WORLD.width / 2, WORLD.height / 2 - 32);
  ctx.font = "18px 'Courier New', monospace";
  ctx.fillStyle = "#bfdbfe";
  ctx.fillText(text, WORLD.width / 2, WORLD.height / 2 + 8);
  ctx.font = "14px 'Courier New', monospace";
  ctx.fillStyle = "#fde68a";
  ctx.fillText("Enter ou toque para jogar", WORLD.width / 2, WORLD.height / 2 + 44);
}

export function drawVictoryOverlay(ctx: CanvasRenderingContext2D, world: EngineWorld) {
  const visualFrame = world.run.visualFrame;
  ctx.fillStyle = "rgba(5, 10, 22, 0.82)";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  for (let i = 0; i < 46; i += 1) {
    const x = (i * 73 + visualFrame * (1 + (i % 4))) % WORLD.width;
    const y = (i * 41 + visualFrame * (2 + (i % 3))) % WORLD.height;
    const colors = ["#facc15", "#38bdf8", "#fb7185", "#22c55e", "#a855f7"];
    pixelRect(ctx, x, y, 6, 10, colors[i % colors.length]);
  }
  const cx = WORLD.width / 2;
  pixelRect(ctx, cx - 50, 126, 100, 76, "#facc15");
  pixelRect(ctx, cx - 34, 110, 68, 24, "#fde68a");
  pixelRect(ctx, cx - 70, 138, 22, 42, "#ca8a04");
  pixelRect(ctx, cx + 48, 138, 22, 42, "#ca8a04");
  pixelRect(ctx, cx - 14, 202, 28, 34, "#ca8a04");
  pixelRect(ctx, cx - 42, 236, 84, 16, "#92400e");
  ctx.fillStyle = "#facc15";
  ctx.font = "bold 44px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText("GO-LIVE DOMINADO", cx, 306);
  ctx.fillStyle = "#bfdbfe";
  ctx.font = "18px 'Courier New', monospace";
  ctx.fillText(`Você limpou a firma com ${world.run.score} pontos`, cx, 342);
  ctx.fillStyle = "#fde68a";
  ctx.font = "14px 'Courier New', monospace";
  ctx.fillText("Salve seu nome no HIGH SCORES", cx, 378);
}
