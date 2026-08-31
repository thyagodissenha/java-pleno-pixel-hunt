"use client";

import { useEffect, useRef } from "react";
import { CHARACTERS } from "@/lib/characters";
import { drawCharacterBody } from "@/lib/character-sprite";

type ColorMap = Record<string, string>;

const CANVAS_WIDTH = 960;
const CANVAS_ART_HEIGHT = 720;
// Faixa extra reservada no topo do canvas para "Build instável detectada",
// somada à altura original (720) sem afetar as posições dos painéis/título
// desenhados abaixo dela (ver o ctx.translate em loop()).
const KICKER_HEIGHT = 44;
// A última fileira de painéis (SQL/CI-CD) termina em y=700 dentro do bloco
// deslocado (620+80), ou seja y=744 no canvas final — deixando só 20px até
// a borda de baixo contra os 64px (20+KICKER_HEIGHT) até a borda de cima.
// Este padding só soma espaço vazio embaixo (nada é redesenhado/movido)
// até igualar as duas margens: 744 + 64 = 808.
const BOTTOM_PADDING = 44;
const CANVAS_HEIGHT = CANVAS_ART_HEIGHT + KICKER_HEIGHT + BOTTOM_PADDING;

const PAL = {
  bg: "#f5e6a3",
  titleRed: "#d42020",
  titleGreen: "#1f6b1f",
  titleDark: "#0d3d0d",
  panel: "#1a2a3a",
  panelBorder: "#000",
  neon: "#3dff7c",
  skin: "#e8b98a",
  hair: "#3a2a1c",
  shirt: "#25464f",
  red: "#ff3b3b",
  white: "#fff",
  blue: "#2a6fd4",
};

const M_HEART = [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."];
const M_KEYBOARD = ["XXXXXXXX", "X......X", "XXXXXXXX"];
const M_MUG = [".XXXX.", "XXXXX.", "XXXXX.", ".XXX."];
const M_ZOMBIE = ["..GGG..", "..GGG..", "..GRG..", "..GGG..", ".GGGGG.", "G.GGG.G", ".G...G."];
const M_CLOUD = ["..WWW..", ".WWWWW.", "WWWWWWW", ".WWWWW."];
const M_ROCKET = ["..R..", ".RRR.", "RRRRR", ".RRR.", "..R..", ".YYY.", "YYY.."];
const M_EXPLOSION = ["..OOO..", ".OOOOO.", "OOOOOOO", ".OOOOO.", "..OOO.."];
const M_DB = [".BBB.", "BBBBB", "BBBBB", "BBBBB", ".BBB."];
const M_CHECK = ["..G..", ".GG.", "GGG."];
const M_ROBOT = [".GGG.", "GGGGG", "G.G.G", "GGGGG", ".G.G."];

const COL: ColorMap = {
  H: PAL.hair,
  F: PAL.skin,
  E: "#000",
  S: PAL.shirt,
  G: "#4a6b4a",
  W: "#fff",
  R: "#d42020",
  Y: "#ffe94d",
  O: "#ff8c3d",
  B: PAL.blue,
};

/**
 * Poster decorativo animado da tela inicial (painéis + título), portado do
 * estudo em /estudo-tela-inicial. Puramente visual — o menu real
 * (.title-menu-actions) continua HTML/acessível, sobreposto por CSS.
 */
export function PixelTitlePanels() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let rafId = 0;
    let cancelled = false;

    function txt(
      str: string,
      x: number,
      y: number,
      size: number,
      color: string,
      align: CanvasTextAlign = "left",
      glow = 0
    ) {
      if (!ctx) return;
      ctx.save();
      ctx.font = `${size}px "Press Start 2P", monospace`;
      ctx.textAlign = align;
      ctx.textBaseline = "top";
      if (glow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = glow;
      }
      ctx.fillStyle = color;
      ctx.fillText(str, x, y);
      ctx.restore();
    }

    function panel(x: number, y: number, w: number, h: number, border = 4) {
      if (!ctx) return;
      ctx.fillStyle = PAL.panelBorder;
      ctx.fillRect(x - border, y - border, w + border * 2, h + border * 2);
      ctx.fillStyle = PAL.panel;
      ctx.fillRect(x, y, w, h);
    }

    function drawPixelMap(map: string[], x: number, y: number, s: number, colors: string | ColorMap) {
      if (!ctx) return;
      for (let r = 0; r < map.length; r++) {
        for (let c = 0; c < map[r].length; c++) {
          const ch = map[r][c];
          if (ch === ".") continue;
          ctx.fillStyle = typeof colors === "string" ? colors : colors[ch] || "#fff";
          ctx.fillRect(x + c * s, y + r * s, s, s);
        }
      }
    }

    function drawPanelDev(x: number, y: number, w: number, h: number, t: number) {
      if (!ctx) return;
      panel(x, y, w, h);
      ctx.fillStyle = "#2a3a4a";
      ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
      for (let i = 0; i < 3; i++) {
        drawPixelMap(M_HEART, x + 10 + i * 18, y + 10, 2, "#ff3b3b");
      }
      ctx.fillStyle = "#1a3a1a";
      ctx.fillRect(x + 70, y + 12, 60, 8);
      ctx.fillStyle = "#3dff7c";
      ctx.fillRect(x + 70, y + 12, 45, 8);
      const dx = x + w / 2 - 20;
      const dy = y + h / 2 - 10;
      // O mesmo modelo (drawCharacterBody) e cor do "Dev Pleno" usados de
      // verdade na arena (app/page.tsx), não um pixel-art à parte — só
      // desenhado 75% maior aqui via transform do canvas (ancorado nos
      // "pés", dx+12/dy+25) para não mexer no tamanho real do gameplay.
      const heroScale = 1.75;
      const heroAnchorX = dx + 12;
      const heroAnchorY = dy + 25;
      ctx.save();
      ctx.translate(heroAnchorX, heroAnchorY);
      ctx.scale(heroScale, heroScale);
      ctx.translate(-heroAnchorX, -heroAnchorY);
      drawCharacterBody(ctx, dx, dy, { bodyColor: CHARACTERS[0].bodyColor });
      ctx.restore();
      drawPixelMap(M_KEYBOARD, dx + 30, dy + 10, 3, "#888");
      ctx.fillStyle = "#ff8c3d";
      ctx.fillRect(dx + 54 + Math.sin(t * 10) * 3, dy + 12, 6, 4);
      ctx.fillStyle = "#ffe94d";
      ctx.fillRect(dx + 58 + Math.sin(t * 10) * 3, dy + 13, 4, 2);
      drawPixelMap(M_MUG, dx - 15, dy + 15, 3, COL);
      ctx.fillStyle = "#2a5a2a";
      ctx.fillRect(x + 10, y + h - 30, 15, 20);
      ctx.fillStyle = "#5a3a1a";
      ctx.fillRect(x + 12, y + h - 10, 11, 6);
    }

    function drawPanelBoss(x: number, y: number, w: number, h: number, t: number) {
      if (!ctx) return;
      panel(x, y, w, h);

      ctx.fillStyle = "#1a3a6a";
      ctx.fillRect(x + 4, y + 4, w - 8, 28);
      ctx.fillStyle = "#d42020";
      ctx.fillRect(x + 10, y + 10, 14, 14);
      txt("MEETING CALL", x + 32, y + 12, 11, PAL.white);
      ctx.fillStyle = "#19c8ff";
      ctx.fillRect(x + w - 90, y + 10, 14, 14);
      ctx.fillStyle = "#ffe94d";
      ctx.fillRect(x + w - 70, y + 10, 14, 14);
      ctx.fillStyle = "#ff3b3b";
      ctx.fillRect(x + w - 50, y + 10, 14, 14);

      ctx.fillStyle = "#0f1f3a";
      ctx.fillRect(x + 4, y + 32, w - 8, h - 36);

      const bx = x + w * 0.78;
      const by = y + h / 2 + 22;
      const s = 3.6;

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

      const spW = 130;
      const spH = 55;
      const spX = x + 15;
      const spY = y + 45;

      ctx.fillStyle = "#fff";
      ctx.fillRect(spX, spY, spW, spH);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.strokeRect(spX, spY, spW, spH);

      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(spX + spW - 10, spY + spH - 10);
      ctx.lineTo(spX + spW + 20, spY + spH + 10);
      ctx.lineTo(spX + spW - 10, spY + spH - 25);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(spX + spW - 10, spY + spH - 10);
      ctx.lineTo(spX + spW + 20, spY + spH + 10);
      ctx.lineTo(spX + spW - 10, spY + spH - 25);
      ctx.stroke();

      const shake = Math.sin(t * 20) * 0.6;
      txt("PRECISO", spX + 10 + shake, spY + 8, 9, "#000");
      txt("DISSO PRA", spX + 10 - shake, spY + 22, 9, "#000");
      txt("ONTEM!", spX + 10 + shake, spY + 36, 10, "#d42020");

      const barY = y + h - 32;
      ctx.fillStyle = "#0a1528";
      ctx.fillRect(x + 4, barY, w - 8, 28);
      const icons = [
        { x: x + 40, color: "#fff" },
        { x: x + 90, color: "#fff" },
        { x: x + 140, color: "#fff" },
        { x: x + w - 70, color: "#ff3b3b" },
      ];
      icons.forEach((ic) => {
        if (!ctx) return;
        ctx.fillStyle = ic.color;
        ctx.fillRect(ic.x, barY + 6, 20, 16);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.strokeRect(ic.x, barY + 6, 20, 16);
      });
    }

    function drawPanelUsers(x: number, y: number, w: number, h: number, t: number) {
      if (!ctx) return;
      panel(x, y, w, h);
      ctx.fillStyle = "#1a2a3a";
      ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
      ctx.fillStyle = "#2a4a6a";
      ctx.fillRect(x + w - 80, y + 20, 70, 80);
      txt("HELP", x + w - 75, y + 30, 8, PAL.white);
      txt("DESK", x + w - 75, y + 45, 8, PAL.white);
      for (let i = 0; i < 4; i++) {
        const zx = x + 20 + i * 30 + Math.sin(t * 3 + i) * 3;
        const zy = y + h / 2 + 10;
        drawPixelMap(M_ZOMBIE, zx, zy, 4, COL);
      }
      ctx.fillStyle = "#fff";
      ctx.fillRect(x + 10, y + 10, 100, 25);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 10, y + 10, 100, 25);
      txt("USUÁRIOS!", x + 15, y + 15, 9, "#000");
    }

    function drawPanelCloud(x: number, y: number, w: number, h: number, t: number) {
      if (!ctx) return;
      panel(x, y, w, h);
      ctx.fillStyle = "#5ca0ff";
      ctx.fillRect(x + 4, y + 4, w - 8, h - 8);

      // velocidades e fases diferentes por elemento para um movimento
      // independente e orgânico, em vez de tudo balançando em uníssono
      const floatCloudY = Math.sin(t * 1.2) * 4;
      const floatCloudX = Math.sin(t * 0.8) * 3;

      const floatNum1 = Math.sin(t * 1.8 + 1) * 6;
      const floatNum2 = Math.sin(t * 2.0 + 2) * 5;
      const floatNum3 = Math.sin(t * 1.5 + 3) * 7;
      const floatNum4 = Math.sin(t * 1.9 + 4) * 4;

      const floatCube = Math.sin(t * 1.6 + 2.5) * 5;

      const cx = x + w / 2 - 30 + floatCloudX;
      const cy = y + h / 2 - 20 + floatCloudY;
      drawPixelMap(M_CLOUD, cx, cy, 6, COL);

      ctx.fillStyle = "#fff";
      txt("1", cx - 25, cy + 10 + floatNum1, 10, PAL.white);
      txt("0", cx + 55, cy - 5 + floatNum2, 10, PAL.white);
      txt("1", cx + 65, cy + 25 + floatNum3, 10, PAL.white);
      txt("0", cx - 35, cy + 35 + floatNum4, 10, PAL.white);

      ctx.fillStyle = "#2a6fd4";
      ctx.fillRect(x + 20, y + 30 + floatCube, 20, 20);
      ctx.fillRect(x + w - 40, y + h - 50 + floatNum3, 20, 20);
      ctx.fillRect(x + 30, y + h - 40 + floatNum1, 20, 20);
    }

    function drawPanelDeploy(x: number, y: number, w: number, h: number, t: number) {
      if (!ctx) return;
      panel(x, y, w, h);
      ctx.fillStyle = "#0a1a2a";
      ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
      ctx.fillStyle = "#1a2a1a";
      ctx.fillRect(x + 10, y + 10, w / 2 - 20, h - 20);
      txt("$ deploy --prod", x + 15, y + 15, 7, PAL.neon);
      txt("> building...", x + 15, y + 27, 7, PAL.neon);
      txt("> tests...", x + 15, y + 39, 7, PAL.neon);
      txt("> packaging...", x + 15, y + 51, 7, PAL.neon);
      txt("> deploying...", x + 15, y + 63, 7, PAL.neon);
      txt("SUCCESS!", x + 15, y + 78, 9, PAL.neon, "left", 6);
      const rx = x + w / 2 + 20;
      const ry = y + h / 2 + Math.sin(t * 5) * 5;
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(-0.3);
      drawPixelMap(M_ROCKET, -15, -20, 4, COL);
      ctx.fillStyle = "#ff8c3d";
      ctx.fillRect(-8, 22 + Math.random() * 5, 16, 8);
      ctx.fillStyle = "#ffe94d";
      ctx.fillRect(-5, 22 + Math.random() * 5, 10, 5);
      ctx.restore();
      ctx.fillStyle = "#fff";
      ctx.fillRect(rx - 25, ry - 5, 50, 15);
      ctx.fillStyle = "#000";
      txt("DEPLOY", rx, ry - 2, 8, "#000", "center");
    }

    function drawPanelIncident(x: number, y: number, w: number, h: number, t: number) {
      if (!ctx) return;
      panel(x, y, w, h);
      ctx.fillStyle = "#1a0a0a";
      ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
      const scale = 1 + Math.sin(t * 8) * 0.1;
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(scale, scale);
      drawPixelMap(M_EXPLOSION, -40, -40, 8, COL);
      ctx.restore();
      txt("PROD INCIDENT!", x + 20, y + 15, 12, PAL.red, "left", 8);
      ctx.fillStyle = "#ff3b3d";
      ctx.beginPath();
      ctx.moveTo(x + w - 60, y + h - 60);
      ctx.lineTo(x + w - 30, y + h - 60);
      ctx.lineTo(x + w - 45, y + h - 30);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff";
      txt("!", x + w - 45, y + h - 50, 16, PAL.white, "center");
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(x + w - 100, y + h - 50, 25, 35);
      ctx.fillRect(x + w - 70, y + h - 50, 25, 35);
      ctx.fillStyle = "#ff3b3b";
      ctx.fillRect(x + w - 95, y + h - 45, 5, 5);
      ctx.fillRect(x + w - 95, y + h - 35, 5, 5);
      ctx.fillRect(x + w - 65, y + h - 45, 5, 5);
    }

    function drawPanelSQL(x: number, y: number, w: number, h: number, t: number) {
      if (!ctx) return;
      panel(x, y, w, h);
      ctx.fillStyle = "#1a2a3a";
      ctx.fillRect(x + 4, y + 4, w - 8, h - 8);

      // DB pulsando
      const dbPulse = 1 + Math.sin(t * 3) * 0.1;
      ctx.save();
      ctx.translate(x + 36, y + h / 2);
      ctx.scale(dbPulse, dbPulse);
      drawPixelMap(M_DB, -16, -20, 8, COL);
      ctx.restore();
      txt("SQL", x + 25, y + h / 2 + 10, 10, PAL.white, "center");

      // Query com cursor piscando
      ctx.fillStyle = "#fff";
      ctx.fillRect(x + 80, y + 20, 100, 30);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 80, y + 20, 100, 30);
      txt("SELECT * FROM", x + 85, y + 25, 7, "#000");
      txt("PROBLEMS;", x + 85, y + 37, 7, "#000");
      if (Math.floor(t * 2) % 2 === 1) {
        ctx.fillStyle = "#000";
        ctx.fillRect(x + 165, y + 37, 6, 7);
      }

      // Kafka: pacotes se movendo
      const kafkaOffset = (t * 50) % 130;
      ctx.fillStyle = "#ff8c3d";
      for (let i = 0; i < 3; i++) {
        let px = x + 20 + i * 45 + kafkaOffset;
        if (px > x + w - 20) px -= 135;
        ctx.fillRect(px, y + h - 25, 22, 12);
        ctx.fillStyle = "#000";
        ctx.fillRect(px + 5, y + h - 22, 12, 6);
        ctx.fillStyle = "#ff8c3d";
      }
      txt("KAFKA", x + w / 2, y + h - 10, 9, PAL.white, "center");

      // Envelopes flutuando
      const envY = y + 30 + Math.sin(t * 2) * 3;
      ctx.fillStyle = "#ffe94d";
      ctx.fillRect(x + w - 50, envY, 20, 15);
      ctx.fillRect(x + w - 50, envY + 25, 20, 15);
    }

    function drawPanelCICD(x: number, y: number, w: number, h: number, t: number) {
      if (!ctx) return;
      panel(x, y, w, h);
      ctx.fillStyle = "#1a2a3a";
      ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
      txt("CI/CD", x + 15, y + 15, 12, PAL.white);

      const stages = ["CODE", "BUILD", "TEST", "DEPLOY"];
      const sy = y + h / 2;
      const progress = (Math.sin(t * 1.2) + 1) / 2;
      const activeStage = Math.floor(progress * 4);

      for (let i = 0; i < 4; i++) {
        const sx = x + 25 + i * 55;
        const isActive = i <= activeStage;

        if (isActive) {
          drawPixelMap(M_CHECK, sx, sy - 10, 6, { ...COL, G: "#3dff7c" });
        } else {
          ctx.fillStyle = "#333";
          ctx.fillRect(sx, sy - 10, 24, 24);
          ctx.strokeStyle = "#555";
          ctx.lineWidth = 2;
          ctx.strokeRect(sx, sy - 10, 24, 24);
        }

        txt(stages[i], sx + 5, sy + 15, 7, isActive ? PAL.white : "#888", "center");

        if (i < 3) {
          ctx.fillStyle = isActive ? "#3dff7c" : "#333";
          ctx.fillRect(sx + 25, sy - 2, 15, 4);
          if (isActive && i === activeStage) {
            const dotX = sx + 25 + ((Math.sin(t * 6) + 1) / 2) * 15;
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.arc(dotX, sy, 3, 0, 7);
            ctx.fill();
          }
        }
      }

      // Robô com antena piscando e leve flutuação
      const robotY = y + h - 50 + Math.sin(t * 3) * 2;
      drawPixelMap(M_ROBOT, x + w - 50, robotY, 5, COL);
      if (Math.floor(t * 4) % 2 === 0) {
        ctx.fillStyle = "#ff3b3b";
        ctx.fillRect(x + w - 30, robotY - 5, 4, 4);
      }
    }

    function drawTitle(t: number) {
      if (!ctx || !cv) return;
      const cx = cv.width / 2;
      const cy = 180;
      const lines = ["JAVA PLENO", "PIXEL HUNT"];
      const size = 72;
      ctx.save();
      ctx.font = `bold ${size}px "Press Start 2P", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillStyle = PAL.titleDark;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], cx + 6, cy + i * (size + 10) + 6);
      }
      ctx.strokeStyle = PAL.titleGreen;
      ctx.lineWidth = 8;
      ctx.lineJoin = "round";
      for (let i = 0; i < lines.length; i++) {
        ctx.strokeText(lines[i], cx, cy + i * (size + 10));
      }
      ctx.fillStyle = PAL.titleRed;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], cx, cy + i * (size + 10));
      }
      ctx.globalAlpha = 0.3 + Math.sin(t * 3) * 0.2;
      ctx.fillStyle = "#ff6060";
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], cx - 2, cy + i * (size + 10) - 2);
      }
      ctx.restore();
    }

    function drawBuildAlert(x: number, y: number, w: number, h: number, t: number) {
      if (!ctx) return;
      void t;
      // Clip com margem de 5px em cada lado — não vaza para os painéis.
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 5, y + 5, w - 10, h - 10);
      ctx.clip();

      const fontSize = 18;
      const glitch = Math.random() > 0.82;
      const shakeX = glitch ? (Math.random() - 0.5) * 10 : 0;
      const shakeY = glitch ? (Math.random() - 0.5) * 8 : 0;

      const glitchColors = ["rgba(255, 0, 0, 0.85)", "rgba(0, 120, 255, 0.85)", "rgba(255, 255, 255, 0.95)"];
      const color1 = glitchColors[Math.floor(Math.random() * 3)];
      const color2 = glitchColors[Math.floor(Math.random() * 3)];

      ctx.save();
      ctx.translate(x + w / 2 + shakeX, y + h / 2 + shakeY);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `bold ${fontSize}px "Press Start 2P", monospace`;

      if (glitch) {
        ctx.fillStyle = color1;
        ctx.fillText("BUILD INSTÁVEL", -5, 0);
        ctx.fillStyle = color2;
        ctx.fillText("BUILD INSTÁVEL", 5, 0);
      }

      ctx.fillStyle = "#fff";
      ctx.fillText("BUILD INSTÁVEL", 0, 0);
      ctx.restore();

      if (Math.random() > 0.88) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        const ly = y + 5 + Math.random() * (h - 10);
        ctx.fillRect(x + 5, ly, w - 10, 2);
      }

      if (Math.random() > 0.9) {
        const blockColor = glitchColors[Math.floor(Math.random() * 3)];
        ctx.fillStyle = blockColor;
        const bx = x + 5 + Math.random() * (w - 10) * 0.7;
        const by = y + 5 + Math.random() * (h - 10);
        ctx.fillRect(bx, by, 30 + Math.random() * 60, 3);
      }

      ctx.restore();
    }

    function loop(ms: number) {
      // cv.isConnected is a synchronous DOM-truth check — unlike `cancelled`
      // (set from this effect's own cleanup), it can't be stale relative to
      // an unmount that already happened, so it catches a queued frame
      // firing after the canvas left the document even if cleanup timing
      // ever changes.
      if (!ctx || !cv || cancelled || !cv.isConnected) return;
      const t = ms / 1000;

      ctx.fillStyle = PAL.bg;
      ctx.fillRect(0, 0, cv.width, cv.height);

      // "Build instável" mora dentro do quadro (moldura do canvas) em vez
      // de flutuar acima dele. Reservamos essa faixa deslocando TODO o
      // resto do desenho para baixo com um translate — nenhum
      // painel/título muda de tamanho ou proporção, só a origem.
      drawBuildAlert(0, 0, cv.width, KICKER_HEIGHT, t);

      ctx.save();
      ctx.translate(0, KICKER_HEIGHT);

      const pw = 280;
      const ph = 180;
      drawPanelDev(20, 20, pw, ph, t);
      drawPanelBoss(cv.width - pw - 20, 20, pw, ph, t);
      drawPanelUsers(20, 220, pw, ph, t);
      drawPanelCloud(cv.width - pw - 20, 220, pw, ph, t);
      drawPanelDeploy(20, 420, pw, ph, t);
      drawPanelIncident(cv.width - pw - 20, 420, pw, ph, t);
      drawPanelSQL(20, 620, pw, 80, t);
      drawPanelCICD(cv.width - pw - 20, 620, pw, 80, t);

      drawTitle(t);

      ctx.restore();

      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);

    return () => {
      // Belt-and-suspenders alongside cancelAnimationFrame(rafId): in the
      // test suite's rAF mock, cancelAnimationFrame is a no-op, so a frame
      // already queued at unmount time would otherwise still fire once and
      // re-queue itself, leaking this loop into later tests indefinitely.
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      aria-hidden="true"
      className="retro-title-canvas"
    />
  );
}
