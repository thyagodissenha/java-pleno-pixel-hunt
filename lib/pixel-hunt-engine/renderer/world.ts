// Desenho do "mundo" (piso, grid, datacenter, cena de escolha final,
// overlay de reunião/cobol-snake da fase secreta). Fix2, T12 (ENGINE-29) —
// extraído de `renderer.ts`, sem mudar nenhuma lógica de desenho.
// `drawSecretRunOverlay` é uma extração nova (não existia como função
// nomeada em `renderer.ts`): era um bloco de ~40 linhas inline dentro de
// `drawFrame`, mesmo padrão de `pixelRect`/`ctx.arc`/`ctx.fillText` de
// `drawDatacenterFloor` — provável origem real dos 35.7% de duplicação
// interna confirmados pelo SonarQube no fix1.

import { pixelRect } from "@/lib/character-sprite";
import { readSecretPhaseState } from "@/lib/pixel-hunt-engine/renderer/phase-state";
import type { ViewState } from "@/lib/pixel-hunt-engine/renderer";
import type { EngineWorld, SecretMainframePhaseState } from "@/lib/pixel-hunt-engine/types";

const WORLD = { width: 960, height: 540 };
const BIOME_COUNT = 4;

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
  if (view.runOrigin === "secret") {
    const phaseState = readSecretPhaseState(world);
    if (phaseState) {
      drawDatacenterFloor(ctx, phaseState);
      return;
    }
  }
  const theme = Math.min(world.run.bossIndex, BIOME_COUNT - 1);
  const floor = ["#101827", "#1b1620", "#071a2f", "#211414"][theme] ?? "#101827";
  const tile = ["#132033", "#261b2c", "#0d2745", "#321b1b"][theme] ?? "#132033";
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

/**
 * Desenha as zonas de "reunião" e o rastro/corpo do "cobol snake" da fase
 * secreta. Fix2, T12 — antes um bloco inline de ~40 linhas dentro de
 * `drawFrame` (`renderer.ts`); nomeado aqui sem mudar nenhum valor
 * desenhado.
 */
export function drawSecretRunOverlay(ctx: CanvasRenderingContext2D, phaseState: SecretMainframePhaseState) {
  for (const zone of phaseState.meetingZones) {
    pixelRect(ctx, zone.x - zone.r, zone.y - zone.r * 0.6, zone.r * 2, zone.r * 1.2, "rgba(22,78,99,0.22)");
    ctx.strokeStyle = "#7dff6a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(zone.x, zone.y, zone.r, zone.r * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#f8fafc";
    ctx.font = "9px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText("REUNIÃO", zone.x, zone.y - zone.r * 0.6 - 12);
  }
  const cobolSnake = phaseState.cobolSnake;
  for (let i = cobolSnake.hist.length - 1; i >= 0; i -= 3) {
    const point = cobolSnake.hist[i];
    const r = 10 - (i / cobolSnake.hist.length) * 7;
    ctx.fillStyle = i % 6 < 3 ? "#3f8a3a" : "#2e6e2e";
    ctx.beginPath();
    ctx.arc(point.x, point.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (cobolSnake.active) {
    ctx.fillStyle = "#2e6e2e";
    ctx.beginPath();
    ctx.arc(cobolSnake.x, cobolSnake.y, 11, 0, Math.PI * 2);
    ctx.fill();
    pixelRect(ctx, cobolSnake.x + (cobolSnake.dir > 0 ? 3 : -6), cobolSnake.y - 4, 3, 3, "#ffd94d");
    ctx.strokeStyle = "#ff5a4d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cobolSnake.x + cobolSnake.dir * 11, cobolSnake.y);
    ctx.lineTo(cobolSnake.x + cobolSnake.dir * 17, cobolSnake.y);
    ctx.stroke();
    ctx.fillStyle = "#f8fafc";
    ctx.font = "9px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText("COBOL SNAKE", cobolSnake.x, cobolSnake.y - 20);
  }
}
