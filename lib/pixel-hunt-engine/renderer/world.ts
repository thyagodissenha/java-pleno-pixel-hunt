// Desenho do "mundo" (piso, grid, datacenter, cena de escolha final).
// Fix2, T12 (ENGINE-29) — extraído de `renderer.ts`, sem mudar nenhuma
// lógica de desenho.

import { pixelRect } from "@/lib/character-sprite";
import type { ViewState } from "@/lib/pixel-hunt-engine/renderer";
import type { EngineWorld, SecretMainframePhaseState } from "@/lib/pixel-hunt-engine/types";

const WORLD = { width: 960, height: 540 };
const BIOME_COUNT = 5;

const DATACENTER_PUDDLES = [
  { x: 560, y: 200, rx: 60, ry: 20 },
  { x: 520, y: 390, rx: 52, ry: 18 },
  { x: 330, y: 440, rx: 44, ry: 16 },
];

export function drawFinalChoiceScene(ctx: CanvasRenderingContext2D, world: EngineWorld) {
  const finalBossCorpse = world.run.finalBossCorpse;
  if (!finalBossCorpse) return;
  const x = finalBossCorpse.x - 50;
  const y = finalBossCorpse.y - 24;
  pixelRect(ctx, finalBossCorpse.x - 70, finalBossCorpse.y + 42, 140, 8, "rgba(0, 0, 0, 0.4)");
  pixelRect(ctx, x, y + 16, 98, 58, "#450a0a");
  pixelRect(ctx, x + 6, y + 22, 86, 46, "#7f1d1d");
  pixelRect(ctx, x + 16, y + 8, 64, 16, "#f97316");
  pixelRect(ctx, x + 14, y + 34, 12, 8, "#fef3c7");
  pixelRect(ctx, x + 72, y + 34, 12, 8, "#fef3c7");
  pixelRect(ctx, x + 30, y + 54, 38, 5, "#111827");
  pixelRect(ctx, x - 18, y + 58, 120, 8, "#020617");
  ctx.fillStyle = "#facc15";
  ctx.font = "bold 18px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText("DIRETORIA CAIU", WORLD.width / 2, 72);
  ctx.fillStyle = "#bfdbfe";
  ctx.font = "14px 'Courier New', monospace";
  ctx.fillText("Escolha a sua próxima mentira corporativa", WORLD.width / 2, 96);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "12px 'Courier New', monospace";
  ctx.fillText("Encoste no powerup ou toque nele para confirmar", WORLD.width / 2, 120);
  ctx.fillStyle = "#fde68a";
  ctx.fillText("Promoção encerra · Chamado reinicia mantendo pontos", WORLD.width / 2, 140);
}

export function drawDatacenterFloor(ctx: CanvasRenderingContext2D, phaseState: SecretMainframePhaseState) {
  for (let x = 0; x < WORLD.width; x += 32) {
    for (let y = 0; y < WORLD.height; y += 32) {
      const h = ((x / 32) * 7 + (y / 32) * 13) % 5;
      ctx.fillStyle = h < 2 ? "#5c6a72" : h < 4 ? "#52606a" : "#4d5a63";
      ctx.fillRect(x, y, 32, 32);
      ctx.strokeStyle = "#39444c";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, 30, 30);
    }
  }
  ctx.strokeStyle = "#2b3438";
  ctx.lineWidth = 2;
  for (const crack of phaseState.datacenterCracks) {
    ctx.beginPath();
    ctx.moveTo(crack[0].x, crack[0].y);
    for (const point of crack) ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }
  for (const moss of phaseState.datacenterMoss) {
    ctx.fillStyle = "#3f8a3a";
    ctx.beginPath();
    ctx.ellipse(moss.x, moss.y, moss.r, moss.r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    pixelRect(ctx, moss.x - moss.r * 0.4, moss.y - 3, 4, 3, "#6abf5e");
  }
  for (const puddle of DATACENTER_PUDDLES) {
    ctx.fillStyle = "#5aa8c0";
    ctx.beginPath();
    ctx.ellipse(puddle.x, puddle.y, puddle.rx, puddle.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9fd8e8";
    ctx.beginPath();
    ctx.ellipse(puddle.x, puddle.y - 2, puddle.rx * 0.85, puddle.ry * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawGrid(ctx: CanvasRenderingContext2D, world: EngineWorld, view: ViewState) {
  // `view.drawFloor` (Fatia 2, T11, PHASEFLOW-03), quando presente,
  // substitui o chão genérico abaixo — hoje, só `SecretMainframePhase`
  // (`phases/secret-mainframe/index.ts`) o define, para desenhar o chão do
  // datacenter em vez deste. `drawGrid` não sabe (nem precisa saber) o que
  // o callback desenha.
  if (view.drawFloor) {
    view.drawFloor(ctx);
    return;
  }
  const theme = Math.min(world.run.bossIndex, BIOME_COUNT - 1);
  const floor = ["#101827", "#1b1620", "#071a2f", "#211414", "#1a1408"][theme] ?? "#101827";
  const tile = ["#132033", "#261b2c", "#0d2745", "#321b1b", "#2b2210"][theme] ?? "#132033";
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  for (let x = 0; x < WORLD.width; x += 32) {
    for (let y = 0; y < WORLD.height; y += 32) {
      if ((x / 32 + y / 32) % 2 === 0) {
        ctx.fillStyle = tile;
        ctx.fillRect(x, y, 32, 32);
      }
    }
  }
  ctx.fillStyle = "#22304b";
  for (let x = 16; x < WORLD.width; x += 96) {
    for (let y = 18; y < WORLD.height; y += 96) {
      ctx.fillRect(x, y, 3, 3);
    }
  }
}

// O antigo `drawSecretRunOverlay` (zonas de "reunião" + rastro/corpo do
// hazard "cobol snake") viveu brevemente em
// `phases/secret-mainframe/rendering.ts` até ser removido por completo na
// T18 (feature fase-secreta-datacenter): o hazard `cobol-snake.ts` foi
// aposentado — a Cobra COBOL virou um `Actor` completo (T7, desenhada por
// `drawCobolSnakeBody`) e as zonas de reunião foram substituídas pelas
// poças de vazamento de memória (`hazards/puddles.ts`, T4/T15).
