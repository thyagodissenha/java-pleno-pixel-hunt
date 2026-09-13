// Funções puras (sem `react`) de desenho das prévias animadas do painel
// "Fases Secretas" (canvas 96x56, mesmo padrão já estabelecido pelas 2
// primeiras cenas). Extraídas de `NeonHud.tsx` (groundwork v1.4,
// IDCLIPV14-11) pra não inflar ainda mais um arquivo já com quase 900
// linhas — agrupa toda a arte de preview num lugar só, sem depender de
// React (testável isoladamente se algum dia precisar).
//
// `PREVIEW_DRAWERS` é o registro chaveado por `SecretPhaseDefinition.id` —
// `SecretPhasePreview` (NeonHud.tsx) faz o lookup, com fallback pro desenho
// do Mainframe se um `id` desconhecido aparecer (defesa-em-profundidade,
// nunca deveria acontecer na prática).

// Caveira pixel-art usada no preview do Hell Branch — mesmo bitmap/paleta de
// `SKULL`/`SKULL_C` em `_docs/game-design/Menu_IDCLIP.html`, escala menor
// (canvas 96x56 vs 200x120 do protótipo).
const SKULL_ROWS = [".WWWWW.", "WWWWWWW", "WKWWKWW", "WWWWWWW", ".WWWWW.", ".W.W.W."];
const SKULL_COLORS: Record<string, string> = { W: "#d8d0c0", K: "#201812" };

function drawSkull(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number) {
  for (let row = 0; row < SKULL_ROWS.length; row++) {
    for (let col = 0; col < SKULL_ROWS[row].length; col++) {
      const ch = SKULL_ROWS[row][col];
      if (ch === ".") continue;
      ctx.fillStyle = SKULL_COLORS[ch];
      ctx.fillRect(x + col * cell, y + row * cell, cell, cell);
    }
  }
}

// Reimplementação (escalada pra 96x56) de `prevMainframe(g,x,y,w,h,t)` do
// protótipo `_docs/game-design/Menu_IDCLIP.html` — rack de servidor com LEDs
// piscando, orbe pulsante, arcos de radar girando, partículas flutuantes.
function drawMainframePreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, "#0e1a12");
  gradient.addColorStop(1, "#13251b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(141, 224, 106, 0.12)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (h * i) / 4);
    ctx.lineTo(w, (h * i) / 4);
    ctx.stroke();
  }

  const cx = w / 2;
  const cy = h / 2;
  const rackW = 22;
  const rackH = 32;
  ctx.fillStyle = "#23282e";
  ctx.fillRect(cx - rackW / 2, cy - rackH / 2 - 2, rackW, rackH);
  ctx.strokeStyle = "#7a4526";
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - rackW / 2, cy - rackH / 2 - 2, rackW, rackH);

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      const on = Math.sin(t * 0.12 + row * 2 + col * 1.3) > 0.2;
      ctx.fillStyle = on ? (col % 2 ? "#7dff6a" : "#ff5a4d") : "#1a1f24";
      ctx.fillRect(cx - rackW / 2 + 2 + col * 4, cy - rackH / 2 + 2 + row * 6, 2.5, 2);
    }
  }

  ctx.save();
  ctx.shadowColor = "#7dff6a";
  ctx.shadowBlur = 6;
  ctx.fillStyle = "#7dff6a";
  ctx.beginPath();
  ctx.arc(cx, cy + rackH / 2 + 6, 2.5 + Math.sin(t * 0.05) * 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = "#5fd8c0";
  ctx.lineWidth = 1;
  ctx.shadowColor = "#5fd8c0";
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 16, t * 0.02, t * 0.02 + 2.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 16, t * 0.02 + Math.PI, t * 0.02 + Math.PI + 2.2);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "#4f9a3f";
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(2 + ((i * 7) % 8), 4 + i * 12, 2, 2);
    ctx.fillRect(w - 4 - ((i * 6) % 7), 8 + i * 11, 2, 2);
  }

  for (let i = 0; i < 3; i++) {
    const fx = 8 + ((i * 26 + Math.sin(t * 0.012 + i) * 10) % (w - 16));
    const fy = 8 + ((i * 14 + Math.cos(t * 0.008 + i * 2) * 7) % (h - 16));
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.5 * Math.max(0, Math.sin(t * 0.03 + i * 1.7));
    ctx.fillStyle = "#d4ff5e";
    ctx.shadowColor = "#d4ff5e";
    ctx.shadowBlur = 3;
    ctx.fillRect(fx, fy, 1.5, 1.5);
    ctx.restore();
  }
}

// Reimplementação (escalada pra 96x56) de `prevHell(g,x,y,w,h,t)` do
// protótipo — hexagrama pulsante, caveira, velas piscando, brasas caindo.
function drawHellBranchPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, "#1a0d08");
  gradient.addColorStop(1, "#2a1208");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2 + 5;
  const radius = 15;
  ctx.save();
  ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 0.033);
  ctx.strokeStyle = "#7dffe0";
  ctx.lineWidth = 1;
  ctx.shadowColor = "#7dffe0";
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (let v = 0; v < 6; v++) {
    const a = (v / 6) * Math.PI * 2 - Math.PI / 2;
    const a2 = (((v + 2) % 6) / 6) * Math.PI * 2 - Math.PI / 2;
    ctx.moveTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
    ctx.lineTo(cx + Math.cos(a2) * radius, cy + Math.sin(a2) * radius);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ([[6, h - 14], [w - 12, h - 14]] as const).forEach(([bx, by], bi) => {
    ctx.fillStyle = "#a32020";
    ctx.fillRect(bx, by, 5, 10);
    ctx.fillStyle = "#e8e0d8";
    ctx.fillRect(bx, by + 3, 5, 1.5);
    for (let f = 0; f < 2; f++) {
      const flameHeight = 1.5 + (Math.sin(t * 0.15 + f * 2 + bi * 3) + 1) * 1.5;
      ctx.fillStyle = f % 2 ? "#ff7f2a" : "#ffd94d";
      ctx.fillRect(bx + 1 + f * 2, by - flameHeight, 1.5, flameHeight);
    }
  });

  drawSkull(ctx, cx - 5, 3, 1.4);

  for (let s = 0; s < 3; s++) {
    ctx.fillStyle = `rgba(60,60,60,${0.4 - ((t * 0.007 + s * 0.17) % 1) * 0.4})`;
    ctx.fillRect(10 + Math.sin(t * 0.03 + s) * 3, h - 12 - ((t * 0.4 + s * 19) % (h - 12)), 1.5, 1.5);
  }
}

// Reimplementação (escalada pra 96x56) de `prevGrave(g,x,y,w,h,t)` do
// mockup v1.4 — abóbora brilhante, lua, lápides, fantasma flutuante.
function drawGraveyardPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, "#120a1c");
  gradient.addColorStop(1, "#1c1030");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.fillStyle = "#e8e0c8";
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(w - 14, 12, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#3a2a1a";
  ([[10, h - 14], [26, h - 12], [w - 22, h - 13]] as const).forEach(([gx, gy]) => {
    ctx.fillRect(gx, gy - 8, 7, 8);
    ctx.beginPath();
    ctx.arc(gx + 3.5, gy - 8, 3.5, Math.PI, 0);
    ctx.fill();
  });

  const cx = w / 2;
  const cy = h / 2 + 6;
  ctx.save();
  ctx.fillStyle = "#ff9a1f";
  ctx.shadowColor = "#ff9a1f";
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2a1608";
  const flicker = Math.sin(t * 0.2) > 0.3;
  ctx.fillRect(cx - 3, cy - 2, 1.6, 1.6);
  ctx.fillRect(cx + 1.4, cy - 2, 1.6, 1.6);
  if (flicker) ctx.fillRect(cx - 2, cy + 1, 4, 1.6);
  ctx.restore();

  ctx.save();
  const ghostY = cy - 18 + Math.sin(t * 0.05) * 3;
  ctx.globalAlpha = 0.55 + 0.2 * Math.sin(t * 0.07);
  ctx.fillStyle = "#d8f0ff";
  ctx.beginPath();
  ctx.arc(cx - 22, ghostY, 4.5, Math.PI, 0);
  ctx.lineTo(cx - 18, ghostY + 6);
  ctx.lineTo(cx - 26.5, ghostY + 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Reimplementação (escalada pra 96x56) de `prevMar(g,x,y,w,h,t)` do mockup
// v1.4 — convés inclinado, vela, ondas, canhão, tentáculo de kraken, sol.
function drawMarPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, "#0e2430");
  gradient.addColorStop(1, "#123048");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.fillStyle = "#f5d33b";
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(w - 16, 12, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  for (let i = 0; i < 4; i++) {
    const wy = h - 10 + i * 2 + Math.sin(t * 0.05 + i) * 1.5;
    ctx.strokeStyle = "rgba(200, 230, 240, 0.25)";
    ctx.beginPath();
    ctx.moveTo(0, wy);
    ctx.lineTo(w, wy);
    ctx.stroke();
  }

  const cx = w / 2;
  const deckY = h / 2 + 10 + Math.sin(t * 0.04) * 1.5;
  ctx.fillStyle = "#5a3a1e";
  ctx.beginPath();
  ctx.moveTo(cx - 20, deckY);
  ctx.lineTo(cx + 20, deckY);
  ctx.lineTo(cx + 14, deckY + 6);
  ctx.lineTo(cx - 14, deckY + 6);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#8a6238";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, deckY);
  ctx.lineTo(cx, deckY - 22);
  ctx.stroke();
  ctx.fillStyle = "#e8e0c8";
  ctx.beginPath();
  ctx.moveTo(cx, deckY - 22);
  ctx.lineTo(cx + 10, deckY - 4);
  ctx.lineTo(cx, deckY - 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#23282e";
  ctx.fillRect(cx - 16, deckY - 3, 5, 3);

  ctx.save();
  ctx.strokeStyle = "#1a6e7a";
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.75;
  const krakenX = cx + 18 + Math.sin(t * 0.06) * 2;
  const krakenY = deckY + 10;
  ctx.beginPath();
  ctx.moveTo(krakenX, krakenY);
  ctx.quadraticCurveTo(krakenX + 4, krakenY - 8, krakenX + 1, krakenY - 16 - Math.sin(t * 0.08) * 3);
  ctx.stroke();
  ctx.restore();
}

// Reimplementação (escalada pra 96x56) de `prevGlacier(g,x,y,w,h,t)` do
// mockup v1.4 — chão de gelo, cristais girando, pinguim andando, neve
// caindo, aquecedor.
function drawGlacierPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, "#0e1e2a");
  gradient.addColorStop(1, "#16303f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#bfe8f2";
  ctx.globalAlpha = 0.85;
  ctx.fillRect(0, h - 8, w, 8);
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(w / 2, h / 2 - 4);
  ctx.rotate(t * 0.01);
  ctx.strokeStyle = "#7ecbe0";
  ctx.lineWidth = 1;
  ctx.shadowColor = "#7ecbe0";
  ctx.shadowBlur = 4;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 0);
    ctx.lineTo(0, 8);
    ctx.lineTo(-6, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.rotate((Math.PI * 2) / 3);
  }
  ctx.restore();

  const penguinX = 10 + ((t * 0.3) % (w - 20));
  const penguinY = h - 16;
  ctx.fillStyle = "#1c2530";
  ctx.beginPath();
  ctx.ellipse(penguinX, penguinY, 3, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e8e0d8";
  ctx.beginPath();
  ctx.ellipse(penguinX, penguinY + 1, 1.6, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 5; i++) {
    const sx = (i * 19 + Math.sin(t * 0.02 + i) * 4) % w;
    const sy = (t * 0.25 + i * 11) % h;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(sx, sy, 1.2, 1.2);
  }

  ctx.save();
  ctx.fillStyle = "#ff7f2a";
  ctx.shadowColor = "#ff7f2a";
  ctx.shadowBlur = 4;
  ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 0.15);
  ctx.fillRect(w - 14, h - 18, 5, 8);
  ctx.restore();
}

// Reimplementação (escalada pra 96x56) de `prevOrbital(g,x,y,w,h,t)` do
// mockup v1.4 — estrelas, planeta, casco da estação, brecha com sucção,
// astronauta flutuando, eclusa.
function drawOrbitalPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.fillStyle = "#05070d";
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 12; i++) {
    const sx = (i * 37) % w;
    const sy = (i * 53) % h;
    ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.4 * Math.sin(t * 0.05 + i)})`;
    ctx.fillRect(sx, sy, 1, 1);
  }

  ctx.save();
  ctx.fillStyle = "#ff5a4d";
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(w - 16, h - 14, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const cx = w / 2;
  const cy = h / 2 - 4;
  ctx.fillStyle = "#4a4f58";
  ctx.fillRect(cx - 18, cy - 5, 36, 10);
  ctx.strokeStyle = "#7dffe0";
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - 18, cy - 5, 36, 10);

  ctx.save();
  ctx.fillStyle = "#0b0d12";
  ctx.beginPath();
  ctx.arc(cx + 10, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 0.1);
  ctx.strokeStyle = "#bfe8f2";
  ctx.beginPath();
  ctx.arc(cx + 10, cy, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  const astroX = cx - 26 + Math.sin(t * 0.02) * 4;
  const astroY = cy - 16 + Math.cos(t * 0.015) * 3;
  ctx.fillStyle = "#e8e0d8";
  ctx.beginPath();
  ctx.arc(astroX, astroY, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7dffe0";
  ctx.fillRect(astroX - 1, astroY + 2, 2, 4);
  ctx.restore();

  ctx.fillStyle = "#23282e";
  ctx.fillRect(cx - 4, cy + 6, 8, 4);
}

// Reimplementação (escalada pra 96x56) de `prevCastle(g,x,y,w,h,t)` do
// mockup v1.4 — muralha, torre com bandeira, catapulta lançando projétil,
// rei no alto, tocha.
function drawCastlePreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, "#1c1408");
  gradient.addColorStop(1, "#2a1e0e");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  const baseY = h - 10;
  ctx.fillStyle = "#5a4a38";
  ctx.fillRect(6, baseY - 18, w - 12, 18);
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(6 + i * ((w - 12) / 6), baseY - 22, (w - 12) / 6 - 3, 4);
  }

  ctx.fillStyle = "#4a3a2a";
  ctx.fillRect(w / 2 - 8, baseY - 32, 16, 32);
  ctx.beginPath();
  ctx.moveTo(w / 2 - 8, baseY - 32);
  ctx.lineTo(w / 2, baseY - 40);
  ctx.lineTo(w / 2 + 8, baseY - 32);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.strokeStyle = "#f5d33b";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w / 2, baseY - 40);
  ctx.lineTo(w / 2, baseY - 46);
  ctx.stroke();
  ctx.fillStyle = "#a32020";
  ctx.globalAlpha = 0.85 + 0.15 * Math.sin(t * 0.1);
  ctx.beginPath();
  ctx.moveTo(w / 2, baseY - 46);
  ctx.lineTo(w / 2 + 6, baseY - 43);
  ctx.lineTo(w / 2, baseY - 40);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#3a2a1a";
  ctx.fillRect(14, baseY - 6, 8, 6);
  const arc = ((t * 0.02) % 1) * Math.PI;
  const projX = 14 + Math.sin(arc) * 20;
  const projY = baseY - 6 - Math.sin(arc) * 14;
  ctx.save();
  ctx.fillStyle = "#e8e0d8";
  ctx.beginPath();
  ctx.arc(projX, projY, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#ff7f2a";
  ctx.shadowColor = "#ff7f2a";
  ctx.shadowBlur = 4;
  ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 0.18);
  ctx.fillRect(w - 16, baseY - 26, 3, 6);
  ctx.restore();
}

// Reimplementação (escalada pra 96x56) de `prevArcade(g,x,y,w,h,t)` do
// mockup v1.4 — gabinete CRT, glitch piscando, boss-espelho duplo,
// scanlines, ficha caindo, texto "1UP".
function drawArcadePreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  ctx.fillStyle = "#23282e";
  ctx.fillRect(cx - 20, cy - 16, 40, 32);
  const glitch = Math.sin(t * 0.3) > 0.6;
  ctx.fillStyle = glitch ? "#ff3ba3" : "#3bfff5";
  ctx.fillRect(cx - 16, cy - 12, 32, 24);

  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = "#000";
  for (let i = -12; i < 12; i += 2) {
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy + i);
    ctx.lineTo(cx + 16, cy + i);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = "#e8e0d8";
  ctx.beginPath();
  ctx.arc(cx - 5, cy - 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(cx + 5 + (glitch ? 1.5 : 0), cy - 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const coinY = 8 + ((t * 0.6) % (h - 16));
  ctx.save();
  ctx.fillStyle = "#f5d33b";
  ctx.beginPath();
  ctx.arc(w - 12, coinY, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 0.12);
  ctx.fillStyle = "#3bfff5";
  ctx.font = "6px monospace";
  ctx.fillText("1UP", 4, 6);
  ctx.restore();
}

export const PREVIEW_DRAWERS: Record<
  string,
  (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void
> = {
  mainframe: drawMainframePreview,
  "hell-branch": drawHellBranchPreview,
  "graveyard-shift": drawGraveyardPreview,
  "mar-stack-overflow": drawMarPreview,
  glacier: drawGlacierPreview,
  "estacao-orbital": drawOrbitalPreview,
  "castelo-monolito": drawCastlePreview,
  "meta-arcade": drawArcadePreview,
};
