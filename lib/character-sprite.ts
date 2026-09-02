export function pixelRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function drawCharacterBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  options: { bodyColor: string; faceColor?: string; runOffset?: number },
) {
  const { bodyColor, faceColor = "#f5d0a9", runOffset = 0 } = options;
  pixelRect(ctx, x + 6, y, 12, 7, faceColor);
  pixelRect(ctx, x + 5, y - 3, 14, 4, "#78350f");
  pixelRect(ctx, x + 4, y + 7, 16, 13, bodyColor);
  pixelRect(ctx, x + 1, y + 10, 6, 5, "#78350f");
  pixelRect(ctx, x + 17, y + 10, 8, 5, "#78350f");
  pixelRect(ctx, x + 2, y + 20 + runOffset, 7, 5, "#111827");
  pixelRect(ctx, x + 15, y + 21 - runOffset, 7, 5, "#111827");
  pixelRect(ctx, x + 8, y + 9, 3, 3, "#111827");
  pixelRect(ctx, x + 14, y + 9, 3, 3, "#111827");
  pixelRect(ctx, x + 7, y + 15, 10, 3, "#fef3c7");
}

// Gerente de sprint em traje social, café na mão e fumaça animada — usado
// tanto no poster decorativo da tela inicial (PixelTitlePanels) quanto na
// cutscene de abertura (OpeningCutscene). `bx`/`by` ancoram os pés/base do
// personagem; `s` escala todo o desenho e `t` (segundos) anima a fumaça.
export function drawBossCharacter(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  s: number,
  t: number,
) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  const bodyW = 18 * s;
  const bodyH = 10 * s;
  ctx.fillStyle = "#e8eef4";
  ctx.fillRect(bx - bodyW / 2, by - 2 * s, bodyW, bodyH);
  ctx.fillStyle = "#c8d4e0";
  ctx.fillRect(bx - 3 * s, by - 2 * s, 6 * s, 2 * s);

  ctx.fillStyle = "#c41e1e";
  ctx.beginPath();
  ctx.moveTo(bx - 2 * s, by);
  ctx.lineTo(bx + 2 * s, by);
  ctx.lineTo(bx + 3 * s, by + 8 * s);
  ctx.lineTo(bx, by + 9 * s);
  ctx.lineTo(bx - 3 * s, by + 8 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#8b1515";
  ctx.fillRect(bx - 1.5 * s, by - 1 * s, 3 * s, 2 * s);

  ctx.fillStyle = "#d9a078";
  ctx.fillRect(bx - 2 * s, by - 6 * s, 4 * s, 4 * s);

  const headW = 14 * s;
  const headH = 12 * s;
  const hx = bx - headW / 2;
  const hy = by - 6 * s - headH;
  ctx.fillStyle = "#e8b98a";
  ctx.fillRect(hx + 2 * s, hy, headW - 4 * s, headH);
  ctx.fillRect(hx + 4 * s, hy - 2 * s, headW - 8 * s, 2 * s);
  ctx.fillRect(hx, hy + 2 * s, headW, headH - 4 * s);
  ctx.fillRect(hx + 2 * s, hy + headH - 2 * s, headW - 4 * s, 2 * s);

  ctx.fillStyle = "#f5d4a8";
  ctx.fillRect(hx + 3 * s, hy + 1 * s, 4 * s, 2 * s);

  ctx.fillStyle = "#d9a078";
  ctx.fillRect(hx - 1 * s, hy + 4 * s, 3 * s, 4 * s);
  ctx.fillRect(hx + headW - 2 * s, hy + 4 * s, 3 * s, 4 * s);

  ctx.fillStyle = "#3a2a1c";
  ctx.fillRect(hx + 2 * s, hy + 4 * s, 4 * s, 1.5 * s);
  ctx.fillRect(hx + headW - 6 * s, hy + 4 * s, 4 * s, 1.5 * s);
  ctx.fillRect(hx + 5 * s, hy + 3 * s, 1.5 * s, 1.5 * s);
  ctx.fillRect(hx + headW - 6.5 * s, hy + 3 * s, 1.5 * s, 1.5 * s);

  ctx.fillStyle = "#fff";
  ctx.fillRect(hx + 3 * s, hy + 6 * s, 3 * s, 2.5 * s);
  ctx.fillRect(hx + headW - 6 * s, hy + 6 * s, 3 * s, 2.5 * s);
  ctx.fillStyle = "#000";
  ctx.fillRect(hx + 4 * s, hy + 6.5 * s, 1.5 * s, 1.5 * s);
  ctx.fillRect(hx + headW - 5 * s, hy + 6.5 * s, 1.5 * s, 1.5 * s);
  ctx.fillStyle = "#ff3b3b";
  ctx.fillRect(hx + 3 * s, hy + 6 * s, 1 * s, 0.5 * s);
  ctx.fillRect(hx + headW - 4 * s, hy + 6 * s, 1 * s, 0.5 * s);

  ctx.fillStyle = "#c89070";
  ctx.fillRect(hx + headW / 2 - 1 * s, hy + 8 * s, 2 * s, 2 * s);

  ctx.fillStyle = "#2a0a0a";
  ctx.fillRect(hx + 3 * s, hy + 10.5 * s, headW - 6 * s, 3 * s);
  ctx.fillStyle = "#fff";
  ctx.fillRect(hx + 3.5 * s, hy + 10.5 * s, headW - 7 * s, 0.8 * s);
  ctx.fillRect(hx + 3.5 * s, hy + 12.7 * s, headW - 7 * s, 0.8 * s);
  ctx.fillStyle = "#c44040";
  ctx.fillRect(hx + 5 * s, hy + 12 * s, headW - 10 * s, 1 * s);

  ctx.fillStyle = "#c89070";
  ctx.fillRect(hx + 3 * s, hy + 2 * s, 3 * s, 0.5 * s);
  ctx.fillRect(hx + headW - 6 * s, hy + 2 * s, 3 * s, 0.5 * s);

  const fx = bx + bodyW / 2 - 2 * s;
  const fy = by - 4 * s;
  ctx.fillStyle = "#d9a078";
  ctx.fillRect(fx, fy, 5 * s, 4 * s);
  ctx.fillStyle = "#b88060";
  ctx.fillRect(fx, fy, 5 * s, 0.8 * s);
  ctx.fillRect(fx, fy + 1 * s, 5 * s, 0.5 * s);
  ctx.fillRect(fx, fy + 2 * s, 5 * s, 0.5 * s);
  ctx.fillRect(fx, fy + 3 * s, 5 * s, 0.5 * s);
  ctx.fillStyle = "#e8eef4";
  ctx.fillRect(fx - 1 * s, fy + 4 * s, 7 * s, 2 * s);

  // xícara de café no punho, com fumaça animada
  const cupX = fx + 0.5 * s;
  const cupY = fy - 2.5 * s;
  const cupW = 4.5 * s;
  const cupH = 4 * s;

  ctx.fillStyle = "#f0f0f0";
  ctx.fillRect(cupX, cupY, cupW, cupH);

  ctx.fillStyle = "#3e2723";
  ctx.fillRect(cupX + 0.5 * s, cupY + 0.5 * s, cupW - 1 * s, 1 * s);

  ctx.fillStyle = "#f0f0f0";
  ctx.fillRect(cupX + cupW, cupY + 1 * s, 1.5 * s, 2.5 * s);
  ctx.fillStyle = "#0f1f3a";
  ctx.fillRect(cupX + cupW + 0.4 * s, cupY + 1.4 * s, 0.7 * s, 1.7 * s);

  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  const steam1 = Math.sin(t * 4) * 2;
  const steam2 = Math.sin(t * 4 + 1.5) * 2;
  const steam3 = Math.sin(t * 4 + 3) * 2;

  ctx.fillRect(cupX + 1 * s, cupY - 1 * s + steam1, 1 * s, 1 * s);
  ctx.fillRect(cupX + 1.2 * s, cupY - 2 * s + steam1, 0.6 * s, 1 * s);

  ctx.fillRect(cupX + 2.5 * s, cupY - 1.5 * s + steam2, 1 * s, 1 * s);
  ctx.fillRect(cupX + 2.7 * s, cupY - 2.5 * s + steam2, 0.6 * s, 1 * s);

  ctx.fillRect(cupX + 1.8 * s, cupY - 3.5 * s + steam3, 1 * s, 1 * s);

  ctx.restore();
}
