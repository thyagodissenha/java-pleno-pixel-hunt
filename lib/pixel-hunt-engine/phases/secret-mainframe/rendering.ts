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
import type { Actor, Obstacle, Puddle } from "@/lib/pixel-hunt-engine/types";

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
  // NOVO (quick fix pós-feature, feedback do usuário): anel de escudo,
  // visível o tempo todo enquanto `actor.shieldVisible` (setado por
  // `index.ts`'s `update()` conforme `state.firewall.mode === "SHIELD"`) —
  // some assim que o firewall quebra (a explosão de partículas fica a
  // cargo do `burst(...)` na transição, em `index.ts`, mesma cor teal).
  if (actor.shieldVisible) {
    const shieldRadius = half + 14 + Math.sin(visualFrame / 16) * 2;
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = "#2dd4bf";
    ctx.shadowColor = "#2dd4bf";
    ctx.shadowBlur = 12;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bx, by, shieldRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#2dd4bf";
    ctx.fill();
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

// Rastro visual da Cobra COBOL como `Actor` completo (T7) — cada instância
// guarda seu próprio histórico de posições num `WeakMap`, já que
// `Actor.render?` (types.ts) só recebe `(ctx, actor, visualFrame)`, sem um
// canal próprio para estado de desenho acumulado entre frames (mesmo
// problema que `hist`/`CobolSnake.hist` resolvia via campo dedicado no
// hazard antigo, agora aposentado — `cobol-snake.ts`, removido na T18).
const COBOL_SNAKE_TRAIL_MAX = 18;
const cobolSnakeTrails = new WeakMap<Actor, Array<{ x: number; y: number }>>();

/**
 * Corpo + rastro segmentado da Cobra COBOL como `Actor` completo (spec.md
 * SECBOSS-13 — parte visual). Substitui visualmente o desenho do hazard
 * `cobol-snake.ts` (removido na T18): mesma paleta verde "COBOL", mas
 * seguindo `actor.x`/`actor.y` (movido por `stepSecretEnemyAi`, T7) em vez
 * de campos próprios de hazard.
 */
export function drawCobolSnakeBody(ctx: CanvasRenderingContext2D, actor: Actor, visualFrame: number) {
  let trail = cobolSnakeTrails.get(actor);
  if (!trail) {
    trail = [];
    cobolSnakeTrails.set(actor, trail);
  }
  if (actor.hp > 0) {
    trail.unshift({ x: actor.x, y: actor.y });
    if (trail.length > COBOL_SNAKE_TRAIL_MAX) trail.pop();
  }

  for (let i = trail.length - 1; i >= 0; i -= 1) {
    const point = trail[i];
    const r = 9 - (i / trail.length) * 6;
    ctx.fillStyle = i % 6 < 3 ? "#3f8a3a" : "#2e6e2e";
    ctx.beginPath();
    ctx.arc(point.x, point.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (actor.hp <= 0) return;

  const facing = actor.vx >= 0 ? 1 : -1;
  ctx.fillStyle = "#2e6e2e";
  ctx.beginPath();
  ctx.arc(actor.x, actor.y, 11, 0, Math.PI * 2);
  ctx.fill();
  pixelRect(ctx, actor.x + (facing > 0 ? 3 : -6), actor.y - 4, 3, 3, "#ffd94d");
  ctx.strokeStyle = Math.sin(visualFrame / 5) > 0 ? "#ff5a4d" : "#7dff6a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(actor.x + facing * 11, actor.y);
  ctx.lineTo(actor.x + facing * 17, actor.y);
  ctx.stroke();
}

/**
 * Visual da barreira-firewall (muro de tijolos ferrugem com chamas flicker
 * no topo) — usado como `Obstacle.render` pelas barreiras spawnadas por
 * `hazards/barriers.ts` (T5/T12, spec.md SECBOSS-19 parte visual).
 */
export function drawFirewallBarrier(ctx: CanvasRenderingContext2D, obstacle: Obstacle, visualFrame: number): void {
  const x = Math.round(obstacle.x);
  const y = Math.round(obstacle.y);
  const width = Math.round(obstacle.width);
  const height = Math.round(obstacle.height);

  pixelRect(ctx, x, y, width, height, "#45120f");
  pixelRect(ctx, x + 2, y + 2, width - 4, height - 4, "#7f1d1d");

  // Fileiras de tijolos, alternando o offset (padrão clássico de alvenaria).
  const brickHeight = 6;
  const brickWidth = 16;
  for (let row = 0; row * brickHeight < height - 4; row += 1) {
    const rowOffset = row % 2 === 0 ? 0 : brickWidth / 2;
    for (let bx = -brickWidth; bx < width; bx += brickWidth) {
      pixelRect(
        ctx,
        x + 2 + bx + rowOffset,
        y + 2 + row * brickHeight,
        brickWidth - 2,
        brickHeight - 2,
        "#a13a2e",
      );
    }
  }

  // Chamas flicker no topo — mesma técnica de `visualFrame`/`Math.sin` já
  // usada por `drawMainframeBoss`/`drawCobolSnakeBody` acima.
  for (let i = 0; i < Math.max(2, Math.floor(width / 20)); i += 1) {
    const flameX = x + 10 + i * 20;
    const flicker = Math.sin(visualFrame / 4 + i * 1.7) * 4;
    ctx.save();
    ctx.shadowColor = "#ff5a4d";
    ctx.shadowBlur = 8;
    ctx.fillStyle = i % 2 === 0 ? "#ff5a4d" : "#ffd94d";
    ctx.beginPath();
    ctx.moveTo(flameX, y);
    ctx.quadraticCurveTo(flameX - 4, y - 8 - flicker, flameX, y - 14 - flicker);
    ctx.quadraticCurveTo(flameX + 4, y - 8 - flicker, flameX, y);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Visual das poças de vazamento de memória (`hazards/puddles.ts`) — fix
 * cycle 2: o code-review apontou que `Puddle` nunca ganhou um desenho
 * próprio (o hazard funciona — `applyPuddleSlow` já lenta o jogador — mas
 * fica invisível em tela, contradizendo o § Success Criteria do spec.md).
 * Mancha "vazamento" esverdeada-doentia, simples de propósito (sem o
 * polimento de `drawFirewallBarrier`/`drawMainframeBoss` acima) — só
 * suficiente para o jogador enxergar onde a lentidão se aplica. Chamada a
 * partir de `ViewState.drawGroundOverlay` (`index.ts`'s `draw()`), no mesmo
 * ponto onde os obstáculos do datacenter são desenhados.
 */
export function drawPuddles(ctx: CanvasRenderingContext2D, puddles: Puddle[]): void {
  for (const puddle of puddles) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#4d7c0f";
    ctx.beginPath();
    ctx.arc(puddle.x, puddle.y, puddle.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = "#84cc16";
    ctx.beginPath();
    ctx.arc(puddle.x, puddle.y, puddle.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
