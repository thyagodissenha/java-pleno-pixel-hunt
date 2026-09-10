// Desenho específico da fase secreta "O Mainframe" (`idclip`) — Fatia 2
// (T9, PHASEFLOW-01/02): `drawMainframeBoss` (corpo do `secretBoss`) e o
// corpo do `cron` (grade normal quando vivo; só o "anel fantasma" quando
// "derrubado", `hp <= 0`) migram para cá, para viverem junto da Phase que
// os spawna e atribui via `Actor.render` (`phases/secret-mainframe/index.ts`'s
// `spawnSecretEnemy`) — mesmo padrão de "cada Phase é dona do que é
// específico dela" já usado por `onDeath`/`customMovement`.
//
// `renderer/actors.ts` ainda contém, nesta task, sua própria cópia destas
// duas funções (chamada pelos branches hardcoded `actor.kind === "cron"` /
// `"secretBoss"`) — T10 é quem remove essa cópia de `renderer/actors.ts` e
// troca a chamada por `actor.render`, deixando esta cópia aqui como única
// fonte de verdade. Reusa `pixelRect`, já exportado por
// `lib/character-sprite.ts` (mesmo helper que `renderer/actors.ts` usa).

import { pixelRect } from "@/lib/character-sprite";
import { clamp } from "@/lib/pixel-hunt-engine/geometry";
import type { Actor } from "@/lib/pixel-hunt-engine/types";

// "O Mainframe": máquina imóvel com grade de LEDs e núcleo que telegrafa
// o ataque (verde parado, amarelo/vermelho piscando ao mirar, branco no
// disparo) — porte fiel à maquete original da fase secreta.
export function drawMainframeBoss(ctx: CanvasRenderingContext2D, actor: Actor, visualFrame: number) {
  const bx = actor.x;
  const by = actor.y;
  const half = actor.size / 2;
  ctx.strokeStyle = "#20301f";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i += 1) {
    const ox = (i - 1.5) * (half * 0.6);
    ctx.beginPath();
    ctx.moveTo(bx + ox, by + half * 0.9);
    ctx.quadraticCurveTo(
      bx + ox + Math.sin(visualFrame / 20 + i) * 8,
      by + half * 1.6,
      bx + ox * 1.6 + Math.sin(visualFrame / 14 + i * 2) * 6,
      by + half * 2.1,
    );
    ctx.stroke();
  }
  pixelRect(ctx, bx - half - 4, by - half + 6, actor.size + 8, actor.size - 4, "#3a2a20");
  pixelRect(ctx, bx - half, by - half + 10, actor.size, actor.size - 10, "#23282e");
  ctx.strokeStyle = "#7a4526";
  ctx.lineWidth = 3;
  ctx.strokeRect(bx - half - 4, by - half + 6, actor.size + 8, actor.size - 4);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const on = actor.hp > 0 && Math.sin(visualFrame / 10 + row * 2 + col * 1.3) > 0.2;
      ctx.fillStyle = on ? (col % 2 ? "#7dff6a" : "#ff5a4d") : "#1a1f24";
      ctx.fillRect(
        Math.round(bx - half + 6 + (col * (actor.size - 12)) / 6),
        Math.round(by - half + 16 + row * 6),
        4,
        3,
      );
    }
  }
  const bossFightState = actor.bossState ?? "idle";
  const core = actor.hp <= 0
    ? "#39444c"
    : bossFightState === "tele"
      ? Math.sin(visualFrame / 3) > 0 ? "#ffd94d" : "#ff5a4d"
      : bossFightState === "atk"
        ? "#ffffff"
        : "#7dff6a";
  const coreRadius = actor.hp > 0
    ? 9 + (bossFightState === "tele" ? (actor.bossStateTimer ?? 0) * 8 : Math.sin(visualFrame / 20) * 2)
    : 6;
  ctx.save();
  ctx.shadowColor = core;
  ctx.shadowBlur = 16;
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(bx, by + 6, coreRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (actor.hp > 0 && bossFightState === "tele") {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = core;
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bx, by + 6, 24 + (actor.bossStateTimer ?? 0) * 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Corpo do `cron`: grade normal quando vivo; só o "anel fantasma" quando
 * "derrubado" (`hp <= 0`, ver `physics.ts`'s `resolveEnemyDeath`/`Actor.onDeath`
 * atribuído em `spawnSecretEnemy`, abaixo). Réplica exata do branch antigo
 * de `renderer/actors.ts`'s `drawActor`.
 */
export function drawCronBody(ctx: CanvasRenderingContext2D, actor: Actor, visualFrame: number) {
  if (actor.hp <= 0) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "#7dff6a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(actor.x, actor.y, 10 * clamp(1 - (actor.cooldown ?? 0) / 300, 0, 1), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const wobble = Math.sin(visualFrame / 7 + (actor.phase ?? 0)) * 2;
  const x = actor.x - actor.size / 2;
  const y = actor.y - actor.size / 2 + wobble;
  pixelRect(ctx, x + 2, y, actor.size - 4, actor.size - 4, "#b0aa97");
  pixelRect(ctx, x + 4, y + 6, actor.size - 8, 8, "#101c14");
  pixelRect(ctx, x + 7, y + 9, 3, 3, "#7dff6a");
  pixelRect(ctx, x + actor.size - 10, y + 9, 3, 3, "#7dff6a");
}
