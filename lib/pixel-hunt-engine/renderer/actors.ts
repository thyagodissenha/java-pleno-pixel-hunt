// Desenho de entidades individuais do mundo (jogador, inimigos, obstáculos,
// power-ups) — funções puramente `(ctx, ...) => void`. Fix2, T10 (ENGINE-29)
// — extraído de `renderer.ts`, sem mudar nenhuma lógica de desenho.

import { drawCharacterBody, pixelRect } from "@/lib/character-sprite";
import { clamp } from "@/lib/pixel-hunt-engine/geometry";
import { FINAL_CHOICE_PICKUP_RADIUS, isFinalChoicePowerUp } from "@/lib/pixel-hunt-engine/phases/normal-run/final-choice";
import type { ViewState } from "@/lib/pixel-hunt-engine/renderer";
import type { Actor, EngineWorld, Obstacle, ObstacleKind, PowerUp, PowerUpKind } from "@/lib/pixel-hunt-engine/types";

const powerUpLabels: Record<PowerUpKind, string> = {
  coffee: "Café",
  refactor: "Refactor",
  rollback: "Rollback",
  hotfix: "Hotfix",
  review: "Code Review",
  stamina: "Sprint",
  promotion: "Promoção",
  call: "Chamado",
};

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

export function drawActor(ctx: CanvasRenderingContext2D, actor: Actor, visualFrame: number) {
  const wobble = Math.sin(visualFrame / 7 + (actor.phase ?? 0)) * 2;
  const x = actor.x - actor.size / 2;
  const y = actor.y - actor.size / 2 + wobble;
  pixelRect(ctx, actor.x - actor.size * 0.42, actor.y + actor.size * 0.36, actor.size * 0.84, 5, "rgba(0, 0, 0, 0.34)");
  if (actor.kind === "boss") {
    pixelRect(ctx, x - 4, y + 12, actor.size + 8, actor.size - 8, "#450a0a");
    pixelRect(ctx, x, y + 8, actor.size, actor.size - 8, "#7f1d1d");
    pixelRect(ctx, x + 6, y, actor.size - 12, 10, "#f97316");
    pixelRect(ctx, x + 2, y + 4, 7, 7, "#facc15");
    pixelRect(ctx, x + actor.size - 9, y + 4, 7, 7, "#facc15");
    pixelRect(ctx, x + 8, y + 17, 6, 6, "#fef3c7");
    pixelRect(ctx, x + actor.size - 14, y + 17, 6, 6, "#fef3c7");
    pixelRect(ctx, x + 9, y + actor.size - 8, actor.size - 18, 5, "#111827");
  } else if (actor.kind === "data") {
    pixelRect(ctx, x + 2, y + 5, actor.size - 4, actor.size - 7, "#2563eb");
    pixelRect(ctx, x + 5, y + 2, actor.size - 10, 6, "#93c5fd");
    pixelRect(ctx, x + 6, y + 11, actor.size - 12, 3, "#dbeafe");
    pixelRect(ctx, x + 6, y + 17, actor.size - 12, 3, "#dbeafe");
  } else if (actor.kind === "qa") {
    pixelRect(ctx, x + 4, y, actor.size - 8, 8, "#fde047");
    pixelRect(ctx, x + 2, y + 8, actor.size - 4, actor.size - 8, "#ca8a04");
    pixelRect(ctx, x + 6, y + 13, 4, 4, "#111827");
    pixelRect(ctx, x + actor.size - 10, y + 13, 4, 4, "#111827");
    pixelRect(ctx, x + 4, y + actor.size - 5, actor.size - 8, 3, "#ef4444");
  } else if (actor.kind === "vip") {
    pixelRect(ctx, x + 6, y, actor.size - 12, 9, "#e0e7ff");
    pixelRect(ctx, x + 3, y + 9, actor.size - 6, actor.size - 9, "#6366f1");
    pixelRect(ctx, x + 5, y + 15, actor.size - 10, 5, "#facc15");
    pixelRect(ctx, x + actor.size - 6, y + 10, 8, 8, "#fef3c7");
  } else if (actor.kind === "incident") {
    pixelRect(ctx, x + 5, y + 2, actor.size - 10, actor.size - 4, "#ef4444");
    pixelRect(ctx, x + 2, y + 8, actor.size - 4, 5, "#facc15");
    pixelRect(ctx, x + 8, y + 15, actor.size - 16, 4, "#111827");
  } else if (actor.kind === "legacy") {
    pixelRect(ctx, x + 3, y + 3, actor.size - 6, actor.size - 6, "#57534e");
    pixelRect(ctx, x + 7, y + 7, actor.size - 14, 5, "#a8a29e");
    pixelRect(ctx, x + 8, y + 17, 5, 5, "#22c55e");
    pixelRect(ctx, x + actor.size - 13, y + 17, 5, 5, "#22c55e");
    pixelRect(ctx, x + 7, y + actor.size - 9, actor.size - 14, 4, "#1c1917");
  } else if (actor.kind === "daemon") {
    pixelRect(ctx, x + 3, y + 2, actor.size - 6, actor.size - 6, "#413659");
    pixelRect(ctx, x + 6, y + 8, 4, 4, "#ff5a4d");
    pixelRect(ctx, x + actor.size - 10, y + 8, 4, 4, "#7dff6a");
    pixelRect(ctx, x + 5, y + actor.size - 8, actor.size - 10, 3, "#2b2140");
  } else if (actor.kind === "cron") {
    if (actor.hp <= 0) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "#7dff6a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(actor.x, actor.y, 10 * clamp(1 - (actor.cooldown ?? 0) / 300, 0, 1), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else {
      pixelRect(ctx, x + 2, y, actor.size - 4, actor.size - 4, "#b0aa97");
      pixelRect(ctx, x + 4, y + 6, actor.size - 8, 8, "#101c14");
      pixelRect(ctx, x + 7, y + 9, 3, 3, "#7dff6a");
      pixelRect(ctx, x + actor.size - 10, y + 9, 3, 3, "#7dff6a");
    }
  } else if (actor.kind === "secretBoss") {
    drawMainframeBoss(ctx, actor, visualFrame);
  } else {
    pixelRect(ctx, x + 6, y, actor.size - 12, 8, "#f9a8d4");
    pixelRect(ctx, x + 3, y + 8, actor.size - 6, actor.size - 8, "#ec4899");
    pixelRect(ctx, x + 7, y + 14, 4, 4, "#111827");
    pixelRect(ctx, x + actor.size - 11, y + 14, 4, 4, "#111827");
  }
  if (actor.kind !== "user" && !(actor.kind === "cron" && actor.hp <= 0)) {
    pixelRect(ctx, actor.x - actor.label.length * 3.1, actor.y - actor.size / 2 - 19, actor.label.length * 6.2, 14, "rgba(2, 6, 23, 0.72)");
    ctx.fillStyle = "#f8fafc";
    ctx.font = "10px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText(actor.label, actor.x, actor.y - actor.size / 2 - 8);
  }
  const bar = actor.size;
  if (actor.kind === "cron" && actor.hp <= 0) {
    // Sem barra de vida enquanto está "derrubado" — só o anel fantasma.
  } else if (actor.kind === "boss" && actor.bossPhase) {
    const phaseColors = ["#22c55e", "#facc15", "#ef4444"];
    for (let phase = 1; phase <= 3; phase += 1) {
      const yOffset = actor.y + actor.size / 2 + 5 + (3 - phase) * 6;
      const fill = phase < actor.bossPhase
        ? 0
        : phase === actor.bossPhase
          ? actor.hp / actor.maxHp
          : 1;
      pixelRect(ctx, actor.x - bar / 2, yOffset, bar, 4, "#111827");
      pixelRect(ctx, actor.x - bar / 2, yOffset, bar * fill, 4, phaseColors[phase - 1]);
    }
  } else {
    pixelRect(ctx, actor.x - bar / 2, actor.y + actor.size / 2 + 5, bar, 4, "#111827");
    pixelRect(ctx, actor.x - bar / 2, actor.y + actor.size / 2 + 5, bar * (actor.hp / actor.maxHp), 4, "#84cc16");
  }
}

export function drawObstacle(ctx: CanvasRenderingContext2D, obstacle: Obstacle) {
  const x = Math.round(obstacle.x);
  const y = Math.round(obstacle.y);
  const width = Math.round(obstacle.width);
  const height = Math.round(obstacle.height);
  const palette: Record<ObstacleKind, { base: string; edge: string; accent: string; text: string }> = {
    desk: { base: "#78350f", edge: "#451a03", accent: "#f59e0b", text: "#fef3c7" },
    server: { base: "#334155", edge: "#0f172a", accent: "#38bdf8", text: "#e2e8f0" },
    firewall: { base: "#7f1d1d", edge: "#450a0a", accent: "#f97316", text: "#fee2e2" },
    board: { base: "#164e63", edge: "#083344", accent: "#facc15", text: "#ecfeff" },
    rack: { base: "#7a4526", edge: "#4b2a17", accent: "#4f9a3f", text: "#fef3c7" },
    crt: { base: "#cfc9b4", edge: "#8a8474", accent: "#16282c", text: "#e2e8f0" },
    chair: { base: "#22282c", edge: "#111827", accent: "#4f9a3f", text: "#e2e8f0" },
    fern: { base: "#3f8a3a", edge: "#245420", accent: "#6abf5e", text: "#dcfce7" },
    shroom: { base: "#c9563a", edge: "#7a2f1c", accent: "#e8dcc8", text: "#fde8dc" },
  };
  const colors = palette[obstacle.kind];

  pixelRect(ctx, x + 6, y + height - 2, width - 4, 8, "rgba(0, 0, 0, 0.28)");
  pixelRect(ctx, x, y, width, height, colors.edge);
  pixelRect(ctx, x + 4, y + 4, width - 8, height - 8, colors.base);
  pixelRect(ctx, x + 8, y + 8, width - 16, 4, colors.accent);

  if (obstacle.kind === "server") {
    for (let row = 0; row < 3; row += 1) {
      pixelRect(ctx, x + 10, y + 18 + row * 12, width - 20, 4, "#94a3b8");
      pixelRect(ctx, x + width - 18, y + 17 + row * 12, 5, 5, row % 2 ? "#facc15" : "#22c55e");
    }
  } else if (obstacle.kind === "firewall") {
    for (let brickY = y + 18; brickY < y + height - 8; brickY += 12) {
      for (let brickX = x + 8 + ((brickY / 12) % 2) * 12; brickX < x + width - 10; brickX += 24) {
        pixelRect(ctx, brickX, brickY, 16, 4, "#fca5a5");
      }
    }
  } else if (obstacle.kind === "board") {
    const notes = ["#facc15", "#38bdf8", "#fb7185", "#22c55e"];
    for (let i = 0; i < 4; i += 1) {
      pixelRect(ctx, x + 12 + i * 14, y + 19 + (i % 2) * 10, 9, 8, notes[i]);
    }
  } else if (obstacle.kind === "rack") {
    for (let row = 0; row < 4; row += 1) {
      pixelRect(ctx, x + 6, y + 16 + row * 8, width - 12, 4, "#23282e");
      pixelRect(ctx, x + width - 14, y + 17 + row * 8, 4, 3, row % 2 ? "#ff5a4d" : "#7dff6a");
    }
  } else if (obstacle.kind === "crt") {
    pixelRect(ctx, x + 6, y + 12, width - 12, height - 22, "#16282c");
    pixelRect(ctx, x + 9, y + 15, width - 18, height - 28, "#bfe8f2");
    pixelRect(ctx, x + width / 2 - 6, y + height - 10, 12, 6, "#8a8474");
  } else if (obstacle.kind === "chair") {
    pixelRect(ctx, x + 5, y + 6, width - 10, height * 0.42, "#39444c");
    pixelRect(ctx, x + width / 2 - 3, y + height * 0.48, 6, height * 0.3, "#111827");
    pixelRect(ctx, x + 4, y + height - 8, width - 8, 6, "#111827");
  } else if (obstacle.kind === "fern") {
    for (let i = -2; i <= 2; i += 1) {
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + width / 2, y + height - 4);
      ctx.lineTo(x + width / 2 + i * (width / 6), y + 4 + Math.abs(i) * 3);
      ctx.stroke();
    }
  } else if (obstacle.kind === "shroom") {
    pixelRect(ctx, x + 3, y + 2, width - 6, height * 0.45, colors.base);
    pixelRect(ctx, x + width / 2 - 3, y + height * 0.4, 6, height * 0.5, colors.accent);
    pixelRect(ctx, x + 6, y + 5, 3, 3, "#fde8dc");
    pixelRect(ctx, x + width - 12, y + 8, 3, 3, "#fde8dc");
  } else {
    pixelRect(ctx, x + 10, y + height - 12, 12, 8, "#451a03");
    pixelRect(ctx, x + width - 22, y + height - 12, 12, 8, "#451a03");
    pixelRect(ctx, x + width / 2 - 12, y + 16, 24, 8, "#fef3c7");
  }

  ctx.fillStyle = colors.text;
  ctx.font = "9px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText(obstacle.label, x + width / 2, y - 5);
}

export function drawPowerUp(ctx: CanvasRenderingContext2D, powerUp: PowerUp) {
  const bob = Math.sin(powerUp.pulse) * 3;
  const finalChoice = isFinalChoicePowerUp(powerUp.kind);
  const x = powerUp.x - 13;
  const y = powerUp.y - 13 + bob;
  const ring = (finalChoice ? 44 : 20) + Math.sin(powerUp.pulse) * (finalChoice ? 7 : 4);
  const color: Record<PowerUpKind, string> = {
    coffee: "#a16207",
    refactor: "#14b8a6",
    rollback: "#38bdf8",
    hotfix: "#ef4444",
    review: "#a855f7",
    stamina: "#22c55e",
    promotion: "#facc15",
    call: "#38bdf8",
  };
  ctx.strokeStyle = color[powerUp.kind];
  ctx.lineWidth = finalChoice ? 3 : 2;
  ctx.strokeRect(Math.round(powerUp.x - ring / 2), Math.round(powerUp.y - ring / 2 + bob), Math.round(ring), Math.round(ring));
  if (finalChoice) {
    ctx.strokeStyle = "rgba(248, 250, 252, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      Math.round(powerUp.x - FINAL_CHOICE_PICKUP_RADIUS / 2),
      Math.round(powerUp.y - FINAL_CHOICE_PICKUP_RADIUS / 2 + bob),
      FINAL_CHOICE_PICKUP_RADIUS,
      FINAL_CHOICE_PICKUP_RADIUS,
    );
  }
  pixelRect(ctx, x, y, 26, 26, "#020617");
  pixelRect(ctx, x + 3, y + 3, 20, 20, color[powerUp.kind]);
  if (powerUp.kind === "coffee") {
    pixelRect(ctx, x + 8, y + 7, 9, 12, "#fef3c7");
    pixelRect(ctx, x + 17, y + 10, 4, 6, "#fef3c7");
  } else if (powerUp.kind === "refactor") {
    pixelRect(ctx, x + 7, y + 8, 12, 4, "#ecfeff");
    pixelRect(ctx, x + 7, y + 15, 12, 4, "#ecfeff");
  } else if (powerUp.kind === "rollback") {
    pixelRect(ctx, x + 7, y + 8, 12, 4, "#082f49");
    pixelRect(ctx, x + 7, y + 8, 4, 12, "#082f49");
  } else if (powerUp.kind === "hotfix") {
    pixelRect(ctx, x + 11, y + 6, 4, 14, "#fef2f2");
    pixelRect(ctx, x + 6, y + 11, 14, 4, "#fef2f2");
  } else if (powerUp.kind === "review") {
    pixelRect(ctx, x + 7, y + 8, 12, 4, "#faf5ff");
    pixelRect(ctx, x + 7, y + 14, 8, 4, "#faf5ff");
  } else {
    pixelRect(ctx, x + 6, y + 7, 14, 5, "#dcfce7");
    pixelRect(ctx, x + 6, y + 14, 9, 5, "#dcfce7");
  }
  if (powerUp.kind === "promotion") {
    pixelRect(ctx, x + 6, y + 6, 14, 6, "#7f1d1d");
    pixelRect(ctx, x + 9, y + 12, 8, 9, "#fef3c7");
  } else if (powerUp.kind === "call") {
    pixelRect(ctx, x + 7, y + 6, 12, 15, "#082f49");
    pixelRect(ctx, x + 10, y + 9, 6, 3, "#dbeafe");
    pixelRect(ctx, x + 10, y + 15, 6, 3, "#dbeafe");
  }
  ctx.fillStyle = "#f8fafc";
  ctx.font = "10px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText(powerUpLabels[powerUp.kind], powerUp.x, y - 7);
}

export function drawPlayer(ctx: CanvasRenderingContext2D, world: EngineWorld, view: ViewState) {
  const { player, run } = world;
  const blink = player.invincible > 0 && Math.floor(run.frame / 4) % 2 === 0;
  const run2 = Math.floor(run.visualFrame / 8) % 2;
  const x = player.x - player.size / 2;
  const y = player.y - player.size / 2;
  pixelRect(ctx, x - 2, y + 23, 28, 5, "rgba(0, 0, 0, 0.35)");
  if (player.focus > 0) {
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 3;
    ctx.strokeRect(Math.round(x - 5), Math.round(y - 5), 34, 34);
  }
  if (player.fury > 0) {
    pixelRect(ctx, x - 4, y + 5, 4, 14, "#f97316");
    pixelRect(ctx, x + 24, y + 5, 4, 14, "#f97316");
  }
  drawCharacterBody(ctx, x, y, {
    bodyColor: player.fury > 0 ? "#f97316" : view.character.bodyColor,
    faceColor: blink ? "#fee2e2" : "#f5d0a9",
    runOffset: run2,
  });
  pixelRect(ctx, x + 20, y + 6, 16, 7, "#facc15");
  pixelRect(ctx, x + 34, y + 8, 7, 3, "#fde68a");
  if (view.gameState !== "choice" && run.shotTimer < 0.06) pixelRect(ctx, x + 40, y + 7, 10, 5, "#f97316");
  ctx.fillStyle = "#f8fafc";
  ctx.font = "10px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText(view.character.name, player.x, player.y - 20);
  if (run.callLoops > 0) {
    ctx.fillStyle = "#facc15";
    ctx.font = "bold 14px 'Courier New', monospace";
    ctx.fillText(`+${run.callLoops}`, player.x, player.y - 36);
  }
}
