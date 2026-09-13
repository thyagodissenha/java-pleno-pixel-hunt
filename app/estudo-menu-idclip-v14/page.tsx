"use client";

import { useEffect, useRef } from "react";

// Rota de estudo isolada (_docs/specs/features/estudo-menu-idclip-v14/spec.md) — porta
// QUASE VERBATIM o canvas+JS de `_docs/game-design/IDCLIP v1.4.html` (mesma lógica, mesmos
// números de tuning, todos os cheats/Konami/easter-egg funcionando), só adaptado pro molde
// "use client" + useEffect já usado por `app/estudo-tela-inicial/page.tsx`. `window.onPhaseSelect`
// (MFLAUNCH-01) redireciona só "O Mainframe" (id 0, única fase com PhaseGraph real) pro jogo real
// via `/?autostart=mainframe` — as outras 7 fases continuam com o fallback de toast do próprio
// mockup, sem PhaseGraph por trás. NÃO editar o painel `menu-secreto-idclip-v14` (React/DOM, já
// verificado) a partir daqui — esta página é intencionalmente uma cópia paralela, não um substituto.

declare global {
  interface Window {
    onPhaseSelect?: (id: number) => void;
  }
}

type Phase = {
  id: number;
  name: string;
  sub: string;
  col: string;
  col2: string;
  tags: string[];
  time: string;
  diff: number;
  unlock: string;
  cheat: string;
};

type FloatWord = { s: string; x: number; y: number; c: string; v: number; ph: number };
type Drag = { dy: number } | null;
type MenuState = {
  sel: number;
  unlocked: boolean[];
  buzz: number;
  load: Phase | null;
  loadT: number;
  toast: string;
  toastT: number;
  idclipFlash: number;
  egg: number;
};

const W = 960;
const H = 544;

const PH: Phase[] = [
  { id: 0, name: "O MAINFRAME", sub: "DATACENTER ESQUECIDO", col: "#d4ff5e", col2: "#5fd8c0",
    tags: ["4 FASES", "FIREWALL 100", "MOBS 3+ELITE"], time: "6-9 MIN", diff: 4,
    unlock: "ONDA 5 · 0 RESETS", cheat: "IDCLIP" },
  { id: 1, name: "HELL BRANCH", sub: "E1M1 HANGAR DE DEPLOYS", col: "#ff7f2a", col2: "#f53b3b",
    tags: ["4 SETORES", "TOKENS R/W/R", "BLACKOUT"], time: "8-12 MIN", diff: 5,
    unlock: "ONDA 6 · DOOM.WAD", cheat: "IDCLIP" },
  { id: 2, name: "GRAVEYARD SHIFT", sub: "A NOITE DOS DEADLINES VIVOS", col: "#b678ff", col2: "#59d31f",
    tags: ["TRICK OR TREAT", "FULL MOON", "FOG SAMHAIN"], time: "10-14 MIN", diff: 5,
    unlock: "2 SECRETAS · IDBOO · ???", cheat: "IDBOO" },
  { id: 3, name: "MAR DE STACK OVERFLOW", sub: "A BAÍA DOS COPY-PASTAS", col: "#f5d33b", col2: "#1a6e7a",
    tags: ["MARÉ", "ABORDAGENS", "KRAKEN"], time: "8-10 MIN", diff: 3,
    unlock: "LURE-ONLY · IDYARR", cheat: "IDYARR" },
  { id: 4, name: "GLACIER DE CHANGE FREEZE", sub: "O ANDAR CONGELADO", col: "#bfe8f2", col2: "#3b66f5",
    tags: ["INÉRCIA", "BLIZZARD", "CALOR"], time: "8-12 MIN", diff: 4,
    unlock: "TAG NO-HIT · IDMELT", cheat: "IDMELT" },
  { id: 5, name: "ESTAÇÃO ORBITAL", sub: "VÁCUO DE PRODUÇÃO", col: "#7dffe0", col2: "#ff5a4d",
    tags: ["ZERO-G", "SUCÇÃO", "ECLUSAS"], time: "10-14 MIN", diff: 5,
    unlock: "MAINFRAME SEM HEAL · IDORBIT", cheat: "IDORBIT" },
  { id: 6, name: "CASTELO DO MONOLITO", sub: "SIEGE DE LEGACY", col: "#f5d33b", col2: "#a32020",
    tags: ["SIEGE", "ÓLEO FERVENTE", "DRAGÃO"], time: "10-12 MIN", diff: 4,
    unlock: "HELL BRANCH PURIST · IDSIEGE", cheat: "IDSIEGE" },
  { id: 7, name: "META.ARCADE", sub: "O FLIPERAMA QUE JOGAVA DE VOLTA", col: "#ff3ba3", col2: "#3bfff5",
    tags: ["GÊNERO ROTATIVO", "GLITCH CRT", "BOSS-ESPELHO"], time: "12-15 MIN", diff: 5,
    unlock: "KONAMI CODE · IDCOIN", cheat: "IDCOIN" },
];

const SKULL = [".WWWWW.", "WWWWWWW", "WKWWKWW", "WWWWWWW", ".WWWWW.", ".W.W.W."];
const SKULL_C: Record<string, string> = { W: "#d8d0c0", K: "#201812" };

const WORDS: Array<[string, number, number, string]> = [
  ["JAVA", 120, 500, "#3f6e5a"], ["MEETING", 700, 480, "#5a3f3f"], ["CALL PRA ONTEM!", 420, 520, "#5a5a3f"],
  ["USUÁRIOS!", 820, 300, "#3f5a6e"], ["101", 90, 300, "#3f6e5a"], ["010", 880, 120, "#3f6e5a"],
  ["$ deploy --prod", 300, 90, "#6e3f3f"], ["tests... success!", 600, 70, "#3f6e3f"], ["DEPLOY", 60, 140, "#6e6e3f"],
  ["PROD INCIDENT!", 760, 520, "#6e3f3f"], ["git push --force", 150, 420, "#4a3f6e"], ["TODO: fix later", 500, 470, "#3f5a5a"],
  ["TRICK OR TREAT", 240, 240, "#5a3f6e"], ["03:33", 700, 240, "#3f3f5a"], ["SAMHAIN.EXE", 420, 340, "#4a2a5a"],
  ["KRAKEN.DBT", 180, 200, "#1a6e7a"], ["FREEZE.EXE", 700, 380, "#3b66f5"], ["SLA SENTINEL", 300, 150, "#7dffe0"],
  ["O REI MONOLITO", 650, 100, "#a32020"], ["HIGH SCORE", 120, 460, "#ff3ba3"],
];

const CX = 100, CW = 760, CH = 160, CGAP = 20;
const VIEW_Y = 96, VIEW_H = 406;
const CONTENT_H = PH.length * CH + (PH.length - 1) * CGAP;
const SB_X = 876, SB_W = 8;
const GP = { dx: 60, dy: 88 };

const KONAMI = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];

const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export default function EstudoMenuIdclipV14() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    function txt(
      g: CanvasRenderingContext2D,
      s: string,
      x: number,
      y: number,
      size: number,
      col: string,
      align: CanvasTextAlign = "left",
      glow = 0,
    ) {
      g.save();
      g.font = `${size}px "Press Start 2P", monospace`;
      g.textAlign = align;
      g.textBaseline = "top";
      if (glow) {
        g.shadowColor = col;
        g.shadowBlur = glow;
      }
      g.fillStyle = col;
      g.fillText(s, x, y);
      g.restore();
    }

    function drawMap(g: CanvasRenderingContext2D, map: string[], x: number, y: number, s: number, cols: Record<string, string>) {
      for (let r = 0; r < map.length; r++) {
        for (let c = 0; c < map[r].length; c++) {
          const ch = map[r][c];
          if (ch === ".") continue;
          g.fillStyle = cols[ch];
          g.fillRect(x + c * s, y + r * s, s, s);
        }
      }
    }

    const floats: Array<FloatWord> = WORDS.map(([s, x, y, c]) => ({
      s, x, y, c, v: 6 + Math.random() * 8, ph: Math.random() * 7,
    }));

    const menu: MenuState = {
      sel: 0,
      // Hell Branch (índice 1) bloqueada por padrão nesta rota de estudo — diferente do
      // mockup original (`IDCLIP v1.4.html:67`, onde vem desbloqueada) e permanentemente
      // sem desbloqueio, já que não tem cheat próprio mapeado (usa o mesmo `idclip` do
      // Mainframe, não um idboo/idyarr/etc. exclusivo como as outras 6 fases bloqueadas).
      unlocked: [true, false, false, false, false, false, false, false],
      buzz: 0, load: null, loadT: 0, toast: "", toastT: 0, idclipFlash: 0, egg: 0,
    };
    let scroll = 0, scrollT = 0, drag: Drag = null, suppressClick = false;
    let tG = 0, lastMs = 0, buf = "";

    function toast(s: string) {
      menu.toast = s;
      menu.toastT = 2.8;
    }

    // MFLAUNCH-01/04: só "O Mainframe" (id 0) tem PhaseGraph real por trás —
    // ao confirmá-lo aqui, depois da loading do mockup, redireciona pro jogo
    // real (`/?autostart=mainframe`, ver app/page.tsx) em vez de duplicar o
    // motor (createEngine/canvas/HUD) nesta rota de estudo. As outras 7
    // fases continuam com o fallback de toast do próprio mockup, inalterado.
    function handlePhaseSelect(id: number) {
      if (id === 0) {
        window.location.assign("/?autostart=mainframe");
        return;
      }
      toast("HOOK: onPhaseSelect(" + id + ") — plugue o loader aqui");
    }

    const cardYC = (i: number) => i * (CH + CGAP);
    const eggContent = () => ({ x: CX + 20 + GP.dx, y: cardYC(2) + 20 + GP.dy });

    function ensureVisible(i: number) {
      const y = cardYC(i);
      if (y < scrollT) scrollT = y;
      if (y + CH > scrollT + VIEW_H) scrollT = y + CH - VIEW_H;
    }

    function thumbRect() {
      const thH = (VIEW_H * VIEW_H) / CONTENT_H;
      const thY = VIEW_Y + (scroll / (CONTENT_H - VIEW_H)) * (VIEW_H - thH);
      return { x: SB_X, y: thY, w: SB_W, h: thH };
    }

    function cardAt(mx: number, my: number) {
      if (my < VIEW_Y || my > VIEW_Y + VIEW_H) return -1;
      const myC = my - VIEW_Y + scroll;
      for (let i = 0; i < PH.length; i++) {
        const y = cardYC(i);
        if (mx >= CX && mx <= CX + CW && myC >= y && myC <= y + CH) return i;
      }
      return -1;
    }

    function confirmSel() {
      if (menu.load) return;
      if (!menu.unlocked[menu.sel]) {
        menu.buzz = 0.4;
        toast("BLOQUEADO — " + PH[menu.sel].unlock);
        return;
      }
      menu.load = PH[menu.sel];
      menu.loadT = 0;
    }

    // ============ PREVIEWS (200x120) — 8 visuais únicos ============
    function prevMainframe(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number) {
      g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, "#0e1a12"); gr.addColorStop(1, "#13251b");
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.strokeStyle = "rgba(141,224,106,.12)"; g.lineWidth = 1;
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x, y + (h * i) / 4); g.lineTo(x + w, y + (h * i) / 4); g.stroke(); }
      const cx = x + w / 2;
      g.fillStyle = "#23282e"; g.fillRect(cx - 24, y + 28, 48, 72);
      g.strokeStyle = "#7a4526"; g.lineWidth = 2; g.strokeRect(cx - 24, y + 28, 48, 72);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
        g.fillStyle = Math.sin(t * 6 + r * 2 + c * 1.3) > 0.2 ? (c % 2 ? "#7dff6a" : "#ff5a4d") : "#1a1f24";
        g.fillRect(cx - 19 + c * 7, y + 34 + r * 6, 4, 3);
      }
      g.save(); g.shadowColor = "#7dff6a"; g.shadowBlur = 12; g.fillStyle = "#7dff6a";
      g.beginPath(); g.arc(cx, y + 84, 6 + Math.sin(t * 3) * 1.5, 0, 7); g.fill(); g.restore();
      g.save(); g.globalAlpha = 0.8; g.strokeStyle = "#5fd8c0"; g.lineWidth = 2; g.shadowColor = "#5fd8c0"; g.shadowBlur = 8;
      g.beginPath(); g.arc(cx, y + 68, 32, t * 1.2, t * 1.2 + 2.2); g.stroke();
      g.beginPath(); g.arc(cx, y + 68, 32, t * 1.2 + Math.PI, t * 1.2 + Math.PI + 2.2); g.stroke(); g.restore();
      g.fillStyle = "#4f9a3f";
      for (let i = 0; i < 6; i++) {
        g.fillRect(x + 4 + ((i * 13) % 14), y + 8 + i * 18, 4, 3);
        g.fillRect(x + w - 8 - ((i * 11) % 12), y + 14 + i * 17, 4, 3);
      }
      for (let i = 0; i < 4; i++) {
        const fx = x + 16 + ((i * 53 + Math.sin(t * 0.7 + i) * 22) % (w - 32));
        const fy = y + 16 + ((i * 29 + Math.cos(t * 0.5 + i * 2) * 14) % (h - 32));
        g.save(); g.globalAlpha = 0.3 + 0.5 * Math.max(0, Math.sin(t * 2 + i * 1.7)); g.fillStyle = "#d4ff5e";
        g.shadowColor = "#d4ff5e"; g.shadowBlur = 6; g.fillRect(fx, fy, 3, 3); g.restore();
      }
      g.restore();
    }

    function prevHell(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number) {
      g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, "#1a0d08"); gr.addColorStop(1, "#2a1208");
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      const cx = x + w / 2, cy = y + h / 2 + 10, pr = 36;
      g.save(); g.globalAlpha = 0.5 + 0.3 * Math.sin(t * 2); g.strokeStyle = "#7dffe0"; g.lineWidth = 2;
      g.shadowColor = "#7dffe0"; g.shadowBlur = 10;
      g.beginPath(); g.arc(cx, cy, pr, 0, 7); g.stroke();
      g.beginPath();
      for (let v = 0; v < 6; v++) {
        const a = (v / 6) * Math.PI * 2 - Math.PI / 2;
        const a2 = (((v + 2) % 6) / 6) * Math.PI * 2 - Math.PI / 2;
        g.moveTo(cx + Math.cos(a) * pr, cy + Math.sin(a) * pr);
        g.lineTo(cx + Math.cos(a2) * pr, cy + Math.sin(a2) * pr);
      }
      g.stroke();
      g.beginPath(); g.arc(cx, cy, pr * 0.35, 0, 7); g.stroke(); g.restore();
      ([[x + 14, y + h - 32], [x + w - 26, y + h - 32]] as const).forEach((b, bi) => {
        g.fillStyle = "#a32020"; g.fillRect(b[0], b[1], 12, 22);
        g.fillStyle = "#e8e0d8"; g.fillRect(b[0], b[1] + 7, 12, 3);
        for (let f = 0; f < 3; f++) {
          const fh = 3 + (((Math.sin(t * 9 + f * 2 + bi * 3) + 1) * 3) | 0);
          g.fillStyle = f % 2 ? "#ff7f2a" : "#ffd94d";
          g.fillRect(b[0] + 2 + f * 3, b[1] - fh, 3, fh);
        }
      });
      drawMap(g, SKULL, cx - 9, y + 6, 3, SKULL_C);
      for (let s = 0; s < 5; s++) {
        g.fillStyle = "rgba(60,60,60," + (0.4 - ((t * 0.4 + s * 0.17) % 1) * 0.4) + ")";
        g.fillRect(x + 20 + Math.sin(t + s) * 4, y + h - 36 - ((t * 26 + s * 19) % (h - 26)), 3, 3);
      }
      g.restore();
    }

    function prevGrave(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number) {
      g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, "#140f1e"); gr.addColorStop(1, "#241634");
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.save(); g.shadowColor = "#f5e6b8"; g.shadowBlur = 14; g.fillStyle = "#f5e6b8";
      g.beginPath(); g.arc(x + w - 30, y + 24, 14, 0, 7); g.fill(); g.restore();
      g.fillStyle = "#d8c898"; g.fillRect(x + w - 35, y + 19, 4, 4); g.fillRect(x + w - 26, y + 28, 3, 3);
      g.fillStyle = "#1a1424"; g.fillRect(x, y + h - 26, w, 26);
      ([[x + 24, 0], [x + 80, 5], [x + 140, 2]] as const).forEach((tb) => {
        g.fillStyle = "#6e6e80";
        g.beginPath();
        g.moveTo(tb[0] - 9, y + h - 26);
        g.lineTo(tb[0] - 9, y + h - 44 - tb[1]);
        g.arc(tb[0], y + h - 44 - tb[1], 9, Math.PI, 0);
        g.lineTo(tb[0] + 9, y + h - 26);
        g.fill();
      });
      const px = x + GP.dx, py = y + GP.dy;
      g.fillStyle = "#ff7f2a"; g.beginPath(); g.ellipse(px, py, 14, 11, 0, 0, 7); g.fill();
      g.fillStyle = "#c05a12"; g.fillRect(px - 2, py - 15, 5, 5);
      g.save(); g.shadowColor = "#ffd94d"; g.shadowBlur = 7 + 3 * Math.sin(t * 4); g.fillStyle = "#ffd94d";
      g.fillRect(px - 7, py - 4, 4, 4); g.fillRect(px + 3, py - 4, 4, 4); g.fillRect(px - 5, py + 2, 11, 3); g.restore();
      const gx = x + w - 50, gy = y + 54 + Math.sin(t * 1.4) * 10;
      g.save(); g.globalAlpha = 0.75; g.fillStyle = "#d8d8e8";
      g.beginPath(); g.arc(gx, gy, 10, Math.PI, 0); g.fillRect(gx - 10, gy, 20, 10);
      g.fillRect(gx - 8, gy + 10, 5, 4); g.fillRect(gx + 3, gy + 10, 5, 4); g.restore();
      g.fillStyle = "#201812"; g.fillRect(gx - 5, gy - 4, 3, 3); g.fillRect(gx + 2, gy - 4, 3, 3);
      g.fillStyle = "#2a1a2a";
      g.fillRect(x + 24 + ((t * 40) % (w - 48)), y + 16 + Math.sin(t * 3) * 5, 7, 3);
      g.fillRect(x + w - 36 - ((t * 30) % (w - 72)), y + 30 + Math.cos(t * 2.4) * 5, 7, 3);
      for (let f = 0; f < 3; f++) {
        g.fillStyle = "rgba(138,127,163,.3)";
        g.beginPath();
        g.ellipse(x + 36 + f * 64 + Math.sin(t * 0.5 + f) * 12, y + h - 16, 40, 9, 0, 0, 7);
        g.fill();
      }
      g.restore();
    }

    function prevMar(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number) {
      g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, "#1a4a5a"); gr.addColorStop(0.5, "#0e3040"); gr.addColorStop(1, "#061620");
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      const tilt = Math.sin(t * 1.2) * 4;
      g.save(); g.translate(x + w / 2, y + h / 2); g.rotate((tilt * Math.PI) / 180); g.translate(-w / 2, -h / 2);
      g.fillStyle = "#6b4423"; g.fillRect(0, h - 26, w, 26);
      g.strokeStyle = "#4a2f18"; g.lineWidth = 1;
      for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(0, h - 26 + i * 4); g.lineTo(w, h - 26 + i * 4); g.stroke(); }
      g.fillStyle = "#4a2f18"; g.fillRect(w / 2 - 2, 20, 4, h - 46);
      g.fillStyle = "#e8dcc8";
      g.beginPath();
      g.moveTo(w / 2 + 2, 24);
      g.quadraticCurveTo(w / 2 + 30 + Math.sin(t * 2) * 4, 50, w / 2 + 2, h - 30);
      g.fill();
      g.restore();
      for (let wv = 0; wv < 3; wv++) {
        g.save(); g.globalAlpha = 0.6 - 0.15 * wv; g.fillStyle = "#1a6e7a";
        g.beginPath(); g.moveTo(x, y + h - 12 + wv * 4);
        for (let i = 0; i <= w; i += 8) g.lineTo(x + i, y + h - 12 + wv * 4 + Math.sin(t * 2 + i * 0.1 + wv) * 4);
        g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.fill(); g.restore();
      }
      const shot = (t * 1.5) % 2;
      g.fillStyle = "#2b1a10"; g.fillRect(x + 20, y + h - 38, 16, 8);
      if (shot < 0.3) {
        g.save(); g.shadowColor = "#ff7f2a"; g.shadowBlur = 8; g.fillStyle = "#ffd94d";
        g.fillRect(x + 38, y + h - 36, 4, 4); g.restore();
      }
      g.save(); g.strokeStyle = "#4a2a5a"; g.lineWidth = 6; g.lineCap = "round";
      g.beginPath(); g.moveTo(x + w - 10, y + h);
      g.quadraticCurveTo(x + w - 30 + Math.sin(t * 1.5) * 8, y + h - 30, x + w - 50 + Math.sin(t * 1.5) * 12, y + h - 50);
      g.stroke();
      g.fillStyle = "#7dffe0"; g.beginPath(); g.arc(x + w - 50 + Math.sin(t * 1.5) * 12, y + h - 54, 3, 0, 7); g.fill(); g.restore();
      g.save(); g.shadowColor = "#f5d33b"; g.shadowBlur = 12; g.fillStyle = "#f5d33b";
      g.beginPath(); g.arc(x + 40, y + 40, 10, 0, 7); g.fill(); g.restore();
      g.restore();
    }

    function prevGlacier(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number) {
      g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, "#c8e8f2"); gr.addColorStop(1, "#3b66f5");
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.fillStyle = "#bfe8f2"; g.fillRect(x, y + h - 22, w, 22);
      g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        g.beginPath(); g.moveTo(x + i * 28, y + h - 22);
        g.lineTo(x + i * 28 + Math.sin(i) * 6, y + h); g.stroke();
      }
      const cx = x + w / 2, cy = y + 50;
      g.save(); g.globalAlpha = 0.8; g.strokeStyle = "#ffffff"; g.lineWidth = 2;
      g.shadowColor = "#bfe8f2"; g.shadowBlur = 8;
      for (let a = 0; a < 6; a++) {
        const ang = (a / 6) * Math.PI * 2 + t * 0.3;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(ang) * 30, cy + Math.sin(ang) * 30); g.stroke();
        g.beginPath();
        g.moveTo(cx + Math.cos(ang) * 18, cy + Math.sin(ang) * 18);
        g.lineTo(cx + Math.cos(ang + 0.4) * 24, cy + Math.sin(ang + 0.4) * 24);
        g.stroke();
      }
      g.restore();
      const px = x + 40 + ((t * 20) % (w - 80)), py = y + h - 34;
      g.fillStyle = "#0a0a14"; g.beginPath(); g.ellipse(px, py + 4, 8, 10, 0, 0, 7); g.fill();
      g.fillStyle = "#e8e0d8"; g.beginPath(); g.ellipse(px, py + 6, 5, 7, 0, 0, 7); g.fill();
      g.fillStyle = "#f5d33b"; g.fillRect(px - 1, py + 2, 2, 2);
      g.fillStyle = "#0a0a14"; g.fillRect(px - 3, py - 1, 2, 2); g.fillRect(px + 1, py - 1, 2, 2);
      for (let s = 0; s < 14; s++) {
        g.fillStyle = "rgba(255,255,255," + (0.3 + Math.random() * 0.4) + ")";
        const sx = x + ((s * 67 + Math.sin(t * 0.5 + s) * 20) % w);
        const sy = y + ((t * 30 + s * 31) % h);
        g.fillRect(sx, sy, 2, 2);
      }
      if (Math.sin(t * 0.4) > 0.6) { g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(x, y, w, h); }
      g.fillStyle = "#6a4028"; g.fillRect(x + w - 32, y + h - 30, 14, 8);
      g.fillStyle = "#a35a30"; g.fillRect(x + w - 30, y + h - 26, 10, 4);
      g.fillStyle = "rgba(255,127,42,.8)"; g.beginPath(); g.arc(x + w - 25, y + h - 32, 4 + Math.sin(t * 5), 0, 7); g.fill();
      g.restore();
    }

    function prevOrbital(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number) {
      g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
      g.fillStyle = "#050810"; g.fillRect(x, y, w, h);
      for (let s = 0; s < 30; s++) {
        const sx = x + ((s * 83 + t * 8) % w), sy = y + ((s * 47) % h);
        g.fillStyle = "rgba(255,255,255," + (0.3 + Math.sin(t * 2 + s) * 0.4 + 0.3) + ")";
        g.fillRect(sx, sy, 2, 2);
      }
      g.save(); g.shadowColor = "#3b66f5"; g.shadowBlur = 20; g.fillStyle = "#1a3a6a";
      g.beginPath(); g.arc(x + w - 30, y + h - 20, 40, 0, 7); g.fill(); g.restore();
      g.fillStyle = "#6e6e6e"; g.fillRect(x + 20, y + 40, w - 40, 44);
      g.fillStyle = "#4a4f52"; g.fillRect(x + 20, y + 40, w - 40, 4); g.fillRect(x + 20, y + 80, w - 40, 4);
      for (let i = 0; i < 8; i++) {
        g.fillStyle = "#201812";
        g.fillRect(x + 26 + i * 20, y + 48, 10, 10);
        g.fillRect(x + 26 + i * 20, y + 64, 10, 10);
        g.fillStyle = Math.sin(t * 3 + i) > 0.3 ? "#7dffe0" : "#201812";
        g.fillRect(x + 29 + i * 20, y + 51, 4, 3);
      }
      g.save(); g.strokeStyle = "#ff5a4d"; g.lineWidth = 2; g.shadowColor = "#ff5a4d"; g.shadowBlur = 8;
      const bx = x + w / 2 - 10;
      g.strokeRect(bx, y + 48, 20, 14);
      for (let p = 0; p < 4; p++) {
        const a = t * 3 + p * 1.5;
        const px = bx + 10 + Math.cos(a) * 30;
        const py = y + 55 + Math.sin(a) * 20;
        g.fillStyle = "#bfe8f2"; g.fillRect(px, py, 2, 2);
      }
      g.restore();
      const ax = x + 50 + Math.sin(t * 0.8) * 20, ay = y + 60 + Math.cos(t * 0.6) * 6;
      g.fillStyle = "#e8e0d8"; g.beginPath(); g.arc(ax, ay, 7, 0, 7); g.fill();
      g.fillStyle = "#3b66f5"; g.fillRect(ax - 3, ay - 2, 6, 3);
      g.fillStyle = "#e8e0d8"; g.fillRect(ax - 6, ay + 6, 12, 8);
      g.fillStyle = "#201812"; g.fillRect(x + w - 30, y + 50, 10, 24);
      g.fillStyle = "#ff5a4d"; g.fillRect(x + w - 31, y + 48, 12, 2); g.fillRect(x + w - 31, y + 74, 12, 2);
      g.restore();
    }

    function prevCastle(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number) {
      g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, "#3a2a20"); gr.addColorStop(1, "#1a1218");
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.fillStyle = "#6e6a5e"; g.fillRect(x, y + h - 32, w, 32);
      for (let i = 0; i < 10; i++) g.fillRect(x + i * 22, y + h - 42, 16, 10);
      g.strokeStyle = "#4a4838"; g.lineWidth = 1;
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(x, y + h - 32 + i * 6); g.lineTo(x + w, y + h - 32 + i * 6); g.stroke(); }
      g.fillStyle = "#5e5a4e"; g.fillRect(x + 10, y + 16, 30, h - 48);
      g.fillStyle = "#a32020";
      g.beginPath();
      g.moveTo(x + 40, y + 18);
      g.lineTo(x + 64 + Math.sin(t * 3) * 4, y + 22);
      g.lineTo(x + 40, y + 28);
      g.fill();
      g.fillStyle = "#3a2a1c"; g.fillRect(x + 39, y + 14, 2, 22);
      for (let i = 0; i < 3; i++) {
        g.fillStyle = Math.sin(t * 2 + i) > 0.3 ? "#f5d33b" : "#201812";
        g.fillRect(x + 20, y + 26 + i * 14, 10, 6);
      }
      const cx = x + w / 2 + 30, cy = y + h - 36;
      g.fillStyle = "#4a2a1c"; g.fillRect(cx - 12, cy, 24, 6);
      const arm = -1.2 + Math.sin(t * 2) * 0.6;
      g.save(); g.translate(cx, cy); g.rotate(arm);
      g.fillStyle = "#3a2a1c"; g.fillRect(0, -2, 30, 4); g.restore();
      const phase = (t * 1.2) % 2;
      if (phase < 1) {
        const pt = phase;
        const bx = cx + Math.cos(arm) * 30 * (1 - pt) + Math.cos(-0.3) * 30 * pt;
        const by = cy + Math.sin(arm) * 30 * (1 - pt) + Math.sin(-0.3) * 30 * pt + pt * pt * 40;
        g.fillStyle = "#ff7f2a"; g.beginPath(); g.arc(bx, by, 4, 0, 7); g.fill();
        g.fillStyle = "#ffd94d"; g.fillRect(bx - 2, by - 2, 4, 4);
      }
      g.fillStyle = "#f5d33b"; g.fillRect(x + w - 44, y + 14, 20, 4);
      g.fillRect(x + w - 44, y + 8, 4, 8); g.fillRect(x + w - 36, y + 8, 4, 8); g.fillRect(x + w - 28, y + 8, 4, 8);
      g.fillStyle = "#a32020"; g.fillRect(x + w - 44, y + 18, 20, 24);
      g.fillStyle = "#e8dcc8"; g.beginPath(); g.arc(x + w - 34, y + 16, 5, 0, 7); g.fill();
      const fx = x + w - 52, fy = y + 24;
      g.fillStyle = "#3a2a1c"; g.fillRect(fx, fy, 3, 16);
      for (let f = 0; f < 3; f++) {
        const fh = 3 + (((Math.sin(t * 10 + f) + 1) * 3) | 0);
        g.fillStyle = f % 2 ? "#ff7f2a" : "#ffd94d";
        g.fillRect(fx - 1 + f, fy - fh, 3, fh);
      }
      g.restore();
    }

    function prevArcade(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number) {
      g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
      g.fillStyle = "#0a0a0a"; g.fillRect(x, y, w, h);
      g.fillStyle = "#2a2a2a"; g.fillRect(x + 20, y + 8, w - 40, h - 16);
      g.strokeStyle = "#1a1a1a"; g.lineWidth = 2; g.strokeRect(x + 20, y + 8, w - 40, h - 16);
      g.fillStyle = "#141418"; g.fillRect(x + 28, y + 16, w - 56, h - 36);
      const glitch = Math.sin(t * 4) > 0.7;
      g.save(); g.beginPath(); g.rect(x + 28, y + 16, w - 56, h - 36); g.clip();
      if (glitch) { g.fillStyle = "rgba(255,59,163,.2)"; g.fillRect(x + 28 + Math.sin(t * 20) * 6, y + 16, w - 56, h - 36); }
      const sx = x + w / 2 + Math.sin(t * 0.8) * 20, sy = y + h / 2 - 10 + Math.cos(t * 0.6) * 6;
      g.globalAlpha = 0.7; g.fillStyle = "#ff3ba3";
      g.beginPath(); g.arc(sx, sy, 8, 0, 7); g.fill();
      g.fillRect(sx - 6, sy + 6, 12, 12);
      g.globalAlpha = 0.4; g.fillStyle = "#3bfff5";
      const sx2 = x + w / 2 + Math.sin(t * 0.8 - 0.5) * 20, sy2 = y + h / 2 - 10 + Math.cos(t * 0.6 - 0.5) * 6;
      g.beginPath(); g.arc(sx2, sy2, 6, 0, 7); g.fill();
      g.fillRect(sx2 - 5, sy2 + 5, 10, 10);
      g.globalAlpha = 1;
      for (let s = 0; s < 3; s++) {
        const bsx = sx - 20 - ((t * 80 + s * 30) % 80);
        g.fillStyle = "#f5d33b"; g.fillRect(bsx, sy + 2, 4, 2);
      }
      g.restore();
      g.fillStyle = "rgba(0,0,0,.3)";
      for (let scanY = y + 16; scanY < y + h - 20; scanY += 2) g.fillRect(x + 28, scanY, w - 56, 1);
      g.fillStyle = "#4a4a4a"; g.fillRect(x + 30, y + h - 16, 20, 4); g.fillRect(x + w - 50, y + h - 16, 20, 4);
      g.fillStyle = "#a32020"; g.beginPath(); g.arc(x + w - 30, y + h - 12, 4, 0, 7); g.fill();
      const coinY = (t * 40) % 40;
      g.fillStyle = "#f5d33b"; g.beginPath(); g.ellipse(x + w - 16, y + 8 + coinY, 4, 6, 0, 0, 7); g.fill();
      g.fillStyle = "#a35a30"; g.fillRect(x + w - 17, y + 8 + coinY, 2, 6);
      if (Math.floor(t * 2) % 2 === 0) {
        g.fillStyle = "#f5d33b";
        g.fillRect(x + 32, y + 12, 4, 3); g.fillRect(x + 38, y + 12, 4, 3); g.fillRect(x + 44, y + 12, 4, 3);
      }
      g.restore();
    }

    const PREVS = [prevMainframe, prevHell, prevGrave, prevMar, prevGlacier, prevOrbital, prevCastle, prevArcade];

    // ============ INPUT ============
    function onKeyDownCheat(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "enter"].includes(k)) e.preventDefault();
      if (k === "arrowup" || k === "w") { menu.sel = (menu.sel + PH.length - 1) % PH.length; ensureVisible(menu.sel); }
      if (k === "arrowdown" || k === "s") { menu.sel = (menu.sel + 1) % PH.length; ensureVisible(menu.sel); }
      if (k === "enter") confirmSel();
      if (/^[a-z]$/.test(k)) {
        buf = (buf + k).slice(-7);
        if (buf.endsWith("idclip")) { menu.idclipFlash = 1; toast("IDCLIP ATIVO — SELEÇÃO DE FASE"); }
        if (buf.endsWith("idboo") && !menu.unlocked[2]) {
          menu.unlocked[2] = true; menu.idclipFlash = 1;
          toast("IDBOO — GRAVEYARD SHIFT LIBERADO. Ele sabe que você chamou.");
        }
        if (buf.endsWith("idyarr") && !menu.unlocked[3]) {
          menu.unlocked[3] = true; menu.idclipFlash = 1;
          toast("IDYARR — MAR DE STACK OVERFLOW LIBERADO. Yo-ho-ho, dev.");
        }
        if (buf.endsWith("idmelt") && !menu.unlocked[4]) {
          menu.unlocked[4] = true; menu.idclipFlash = 1;
          toast("IDMELT — GLACIER DE CHANGE FREEZE LIBERADO. Aquece aí.");
        }
        if (buf.endsWith("idorbit") && !menu.unlocked[5]) {
          menu.unlocked[5] = true; menu.idclipFlash = 1;
          toast("IDORBIT — ESTAÇÃO ORBITAL LIBERADA. Gravidade off.");
        }
        if (buf.endsWith("idsiege") && !menu.unlocked[6]) {
          menu.unlocked[6] = true; menu.idclipFlash = 1;
          toast("IDSIEGE — CASTELO DO MONOLITO LIBERADO. Arma as catapultas.");
        }
        if (buf.endsWith("idcoin") && !menu.unlocked[7]) {
          menu.unlocked[7] = true; menu.idclipFlash = 1;
          toast("IDCOIN — META.ARCADE LIBERADO. Insira ficha.");
        }
      }
    }

    let konamiIdx = 0;
    function onKeyDownKonami(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if (k === KONAMI[konamiIdx]) {
        konamiIdx++;
        if (konamiIdx === KONAMI.length) {
          konamiIdx = 0;
          if (!menu.unlocked[7]) {
            menu.unlocked[7] = true; menu.idclipFlash = 1;
            toast("KONAMI CODE! META.ARCADE LIBERADO — 1UP");
          }
        }
      } else if (k === KONAMI[0]) konamiIdx = 1;
      else konamiIdx = 0;
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      scrollT = clampN(scrollT + e.deltaY * 0.5, 0, CONTENT_H - VIEW_H);
    }

    function mousePos(e: MouseEvent) {
      const r = cv!.getBoundingClientRect();
      return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
    }

    function onMouseDown(e: MouseEvent) {
      const m = mousePos(e);
      const th = thumbRect();
      if (m.x >= th.x - 4 && m.x <= th.x + th.w + 4 && m.y >= th.y && m.y <= th.y + th.h) {
        drag = { dy: m.y - th.y };
        suppressClick = true;
        return;
      }
      if (m.x >= SB_X - 4 && m.x <= SB_X + SB_W + 4 && m.y >= VIEW_Y && m.y <= VIEW_Y + VIEW_H) {
        scrollT = clampN(((m.y - VIEW_Y) / VIEW_H) * CONTENT_H - VIEW_H / 2, 0, CONTENT_H - VIEW_H);
        drag = { dy: thumbRect().h / 2 };
        suppressClick = true;
      }
    }

    function onMouseUp() {
      drag = null;
    }

    function onMouseMove(e: MouseEvent) {
      const m = mousePos(e);
      if (drag) {
        const th = thumbRect();
        scroll = scrollT = clampN(((m.y - drag.dy - VIEW_Y) / (VIEW_H - th.h)) * (CONTENT_H - VIEW_H), 0, CONTENT_H - VIEW_H);
        return;
      }
      const i = cardAt(m.x, m.y);
      if (i >= 0) menu.sel = i;
    }

    function onClick(e: MouseEvent) {
      if (suppressClick) { suppressClick = false; return; }
      const m = mousePos(e);
      const myC = m.y - VIEW_Y + scroll;
      const ep = eggContent();
      if (Math.hypot(m.x - ep.x, myC - ep.y) < 16) {
        menu.egg++;
        if (menu.egg >= 3 && !menu.unlocked[2]) {
          menu.unlocked[2] = true;
          toast("A ABÓBORA SORRIU DE VOLTA — GRAVEYARD SHIFT LIBERADO");
        } else if (menu.egg < 3) toast("a abóbora piscou... (" + menu.egg + "/3)");
        return;
      }
      const i = cardAt(m.x, m.y);
      if (i >= 0) { menu.sel = i; confirmSel(); }
    }

    // ============ DRAW ============
    let raf = 0;
    let cancelled = false;

    function frame(ms: number) {
      if (cancelled) return;
      const rdt = Math.min(0.05, Math.max(0.001, (ms - lastMs) / 1000));
      lastMs = ms;
      tG += rdt;
      menu.buzz = Math.max(0, menu.buzz - rdt);
      menu.toastT = Math.max(0, menu.toastT - rdt);
      menu.idclipFlash = Math.max(0, menu.idclipFlash - rdt * 2);
      scroll += (scrollT - scroll) * Math.min(1, rdt * 12);
      if (menu.load) {
        menu.loadT += rdt;
        if (menu.loadT >= 1.4) {
          const id = menu.load.id;
          menu.load = null;
          if (window.onPhaseSelect) window.onPhaseSelect(id);
          else toast("HOOK: onPhaseSelect(" + id + ") — plugue o loader aqui");
        }
      }
      ctx!.clearRect(0, 0, W, H);
      const bg = ctx!.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 600);
      bg.addColorStop(0, "#101a1c"); bg.addColorStop(1, "#070b0d");
      ctx!.fillStyle = bg; ctx!.fillRect(0, 0, W, H);
      for (const f of floats) {
        f.y -= f.v * rdt;
        if (f.y < -20) f.y = H + 20;
        ctx!.save(); ctx!.globalAlpha = 0.22;
        txt(ctx!, f.s, f.x + Math.sin(tG * 0.5 + f.ph) * 8, f.y, 10, f.c);
        ctx!.restore();
      }
      txt(ctx!, "JAVA PLENO PIXEL HUNT", W / 2, 20, 24, "#7dff6a", "center", 16);
      const ug = ctx!.createLinearGradient(W / 2 - 260, 0, W / 2 + 260, 0);
      ug.addColorStop(0, "#3dff7c"); ug.addColorStop(1, "#19c8ff");
      ctx!.fillStyle = ug; ctx!.fillRect(W / 2 - 260, 52, 520, 3);
      txt(ctx!, "SELEÇÃO DE FASE · " + PH.length + " FASES · CHEATS IDCLIP", W / 2, 62, 9, "#19c8ff", "center", 6);
      ctx!.save();
      ctx!.beginPath(); ctx!.rect(60, VIEW_Y, 840, VIEW_H); ctx!.clip();
      for (let i = 0; i < PH.length; i++) {
        const p = PH[i], sel = menu.sel === i;
        let x = CX;
        const y = VIEW_Y + cardYC(i) - scroll;
        if (y > VIEW_Y + VIEW_H || y + CH < VIEW_Y) continue;
        if (sel && menu.buzz > 0) x += (Math.random() - 0.5) * 6 * menu.buzz * 10;
        ctx!.fillStyle = "rgba(8,14,16,.9)"; ctx!.fillRect(x, y, CW, CH);
        ctx!.save();
        if (sel) { ctx!.shadowColor = p.col; ctx!.shadowBlur = 14 + 6 * Math.sin(tG * 5); }
        ctx!.strokeStyle = sel ? p.col : "#2a3a34"; ctx!.lineWidth = sel ? 3 : 2;
        ctx!.strokeRect(x, y, CW, CH); ctx!.strokeRect(x + 5, y + 5, CW - 10, CH - 10); ctx!.restore();
        PREVS[i](ctx!, x + 20, y + 20, 200, 120, tG);
        txt(ctx!, "FASE 0" + (i + 1), x + 240, y + 16, 7, p.col2);
        txt(ctx!, p.name, x + 240, y + 30, 14, p.col, "left", 8);
        txt(ctx!, p.sub, x + 240, y + 54, 8, "#8aa89a");
        p.tags.forEach((tg, k) => {
          const tagX = x + 240 + k * 118;
          ctx!.strokeStyle = p.col2; ctx!.lineWidth = 1; ctx!.strokeRect(tagX, y + 74, 110, 18);
          txt(ctx!, tg, tagX + 55, y + 79, 7, p.col2, "center");
        });
        txt(ctx!, "DIFF", x + 240, y + 102, 8, "#8aa89a");
        for (let d = 0; d < 5; d++) {
          ctx!.fillStyle = d < p.diff ? p.col : "#22302a";
          ctx!.fillRect(x + 286 + d * 14, y + 102, 10, 10);
        }
        const un = menu.unlocked[i];
        txt(ctx!, un ? "UNLOCK: " + p.unlock : "🔒 " + p.unlock, x + 240, y + 126, 7, un ? "#5c8a6e" : "#6e3f3f");
        if (p.cheat && un) {
          ctx!.save(); ctx!.globalAlpha = 0.5;
          txt(ctx!, "/" + p.cheat, x + CW - 14, y + 144, 7, p.col2, "right");
          ctx!.restore();
        }
        ctx!.save(); ctx!.globalAlpha = 0.45;
        txt(ctx!, "0" + (i + 1), x + 680, y + 44, 28, p.col, "center", 10);
        ctx!.restore();
        txt(ctx!, p.time, x + 680, y + 86, 8, "#8aa89a", "center");
        if (sel) {
          const bl = Math.floor(tG * 3) % 2 === 0;
          if (bl) {
            txt(ctx!, "▶", x - 26, y + 70, 16, p.col, "left", 8);
            txt(ctx!, "◀", x + CW + 10, y + 70, 16, p.col, "left", 8);
          }
          txt(ctx!, "ENTER PARA ENTRAR", x + CW / 2, y + 144, 7, p.col, "center", 4);
        }
        if (!un) {
          ctx!.fillStyle = "rgba(0,0,0,.55)"; ctx!.fillRect(x + 6, y + 6, CW - 12, CH - 12);
          txt(ctx!, "BLOQUEADO", x + CW / 2, y + 70, 14, "#6e3f3f", "center", 8);
        }
      }
      ctx!.restore();
      let fe = ctx!.createLinearGradient(0, VIEW_Y, 0, VIEW_Y + 26);
      fe.addColorStop(0, "rgba(7,11,13,.9)"); fe.addColorStop(1, "rgba(7,11,13,0)");
      ctx!.fillStyle = fe; ctx!.fillRect(60, VIEW_Y, 840, 26);
      fe = ctx!.createLinearGradient(0, VIEW_Y + VIEW_H - 26, 0, VIEW_Y + VIEW_H);
      fe.addColorStop(0, "rgba(7,11,13,0)"); fe.addColorStop(1, "rgba(7,11,13,.9)");
      ctx!.fillStyle = fe; ctx!.fillRect(60, VIEW_Y + VIEW_H - 26, 840, 26);
      ctx!.fillStyle = "#12201a"; ctx!.fillRect(SB_X, VIEW_Y, SB_W, VIEW_H);
      const th = thumbRect();
      ctx!.fillStyle = drag ? "#7dff6a" : "#3f6e5a"; ctx!.fillRect(th.x, th.y, th.w, th.h);
      ctx!.fillStyle = "#2a4a3a"; ctx!.fillRect(th.x + 2, th.y + th.h / 2 - 1, 4, 2);
      txt(
        ctx!,
        "↑/↓ · ENTER · SCROLL/ARRASTAR · CHEATS: IDCLIP IDBOO IDYARR IDMELT IDORBIT IDSIEGE IDCOIN",
        W / 2, 512, 7, "#5c8a6e", "center",
      );
      if (menu.load) {
        ctx!.fillStyle = "rgba(0,0,0,.82)"; ctx!.fillRect(0, 0, W, H);
        txt(ctx!, "CARREGANDO " + menu.load.name + "...", W / 2, H / 2 - 30, 14, menu.load.col, "center", 10);
        ctx!.strokeStyle = menu.load.col; ctx!.lineWidth = 2; ctx!.strokeRect(W / 2 - 160, H / 2 + 6, 320, 14);
        ctx!.fillStyle = menu.load.col; ctx!.fillRect(W / 2 - 158, H / 2 + 8, 316 * Math.min(1, menu.loadT / 1.4), 10);
        for (let d = 0; d < 3; d++) if (Math.floor(tG * 4) % 3 >= d) txt(ctx!, ".", W / 2 + 120 + d * 10, H / 2 - 30, 14, menu.load.col);
      }
      ctx!.save(); ctx!.globalAlpha = 0.12; ctx!.fillStyle = "#000";
      for (let scanY = 0; scanY < H; scanY += 3) ctx!.fillRect(0, scanY, W, 1);
      ctx!.restore();
      const v = ctx!.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.9);
      v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.5)");
      ctx!.fillStyle = v; ctx!.fillRect(0, 0, W, H);
      if (menu.idclipFlash > 0) {
        ctx!.globalAlpha = menu.idclipFlash * 0.5; ctx!.fillStyle = "#7dffe0";
        ctx!.fillRect(0, 0, W, H); ctx!.globalAlpha = 1;
      }
      if (menu.toastT > 0) {
        ctx!.save(); ctx!.globalAlpha = Math.min(1, menu.toastT);
        ctx!.fillStyle = "rgba(8,20,16,.9)"; ctx!.fillRect(W / 2 - 300, H - 52, 600, 26);
        ctx!.strokeStyle = "#5fd8c0"; ctx!.lineWidth = 1; ctx!.strokeRect(W / 2 - 300, H - 52, 600, 26);
        txt(ctx!, menu.toast, W / 2, H - 46, 8, "#cfe8d8", "center");
        ctx!.restore();
      }
      txt(ctx!, "v1.4 · IDCLIP", W - 12, H - 16, 7, "#3f6e5a", "right");
      raf = requestAnimationFrame(frame);
    }

    window.onPhaseSelect = handlePhaseSelect;
    window.addEventListener("keydown", onKeyDownCheat);
    window.addEventListener("keydown", onKeyDownKonami);
    cv.addEventListener("wheel", onWheel, { passive: false });
    cv.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    cv.addEventListener("mousemove", onMouseMove);
    cv.addEventListener("click", onClick);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      delete window.onPhaseSelect;
      window.removeEventListener("keydown", onKeyDownCheat);
      window.removeEventListener("keydown", onKeyDownKonami);
      cv.removeEventListener("wheel", onWheel);
      cv.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      cv.removeEventListener("mousemove", onMouseMove);
      cv.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <main
      style={{
        height: "100dvh",
        margin: 0,
        background: "#070b0d",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
      <div style={{ width: "min(96vw, 960px)" }}>
        <canvas
          ref={canvasRef}
          id="cv"
          width={960}
          height={544}
          style={{ width: "100%", height: "auto", display: "block", imageRendering: "pixelated", cursor: "pointer" }}
        />
        <div style={{ color: "#3f6e5a", fontSize: 9, textAlign: "center", marginTop: 10, fontFamily: "monospace", letterSpacing: 2 }}>
          ↑/↓ SELECIONAR · ENTER CONFIRMAR · SCROLL / ARRASTAR BARRA · IDCLIP + CHEATS POR FASE
        </div>
      </div>
    </main>
  );
}
