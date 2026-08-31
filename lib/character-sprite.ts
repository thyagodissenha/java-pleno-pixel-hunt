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
