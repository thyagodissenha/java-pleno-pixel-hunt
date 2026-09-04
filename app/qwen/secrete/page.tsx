"use client";

import { useEffect, useRef } from "react";
import "./secrete.css";

const W = 960;
const H = 544;

type Particle = { x: number; y: number; vx: number; vy: number; life: number; col: string; s: number };
type PlayerShot = { x: number; y: number; vx: number; vy: number };
type EnemyShot = { x: number; y: number; vx: number; vy: number };
type MeetingZone = { x: number; y: number; base: number; r: number; ph: number };
type LegacySystem = {
  active: boolean;
  cd: number;
  t: number;
  dir: number;
  y0: number;
  x: number;
  y: number;
  hist: Array<{ x: number; y: number }>;
};

type Incident = { type: "incident"; x: number; y: number; hp: number; alive: boolean; dash: number; vx: number; vy: number; anim: number };
type Reviewer = { type: "qa"; x: number; y: number; hp: number; alive: boolean; rt: number; anim: number };
type Mob = Incident | Reviewer;

type Player = {
  x: number;
  y: number;
  hp: number;
  dir: number;
  iframe: number;
  cd: number;
  bob: number;
  moving: boolean;
  aimx: number;
  aimy: number;
};

type BossState = "idle" | "tele" | "atk";
type Boss = { x: number; y: number; hp: number; max: number; state: BossState; st: number; atk: number; alive: boolean; shake: number };

type GameState = "play" | "win" | "dead";

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function pixelRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawCharacterBody(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  options: { bodyColor: string; faceColor?: string; runOffset?: number },
) {
  const { bodyColor, faceColor = "#f5d0a9", runOffset = 0 } = options;
  pixelRect(g, x + 6, y, 12, 7, faceColor);
  pixelRect(g, x + 5, y - 3, 14, 4, "#78350f");
  pixelRect(g, x + 4, y + 7, 16, 13, bodyColor);
  pixelRect(g, x + 1, y + 10, 6, 5, "#78350f");
  pixelRect(g, x + 17, y + 10, 8, 5, "#78350f");
  pixelRect(g, x + 2, y + 20 + runOffset, 7, 5, "#111827");
  pixelRect(g, x + 15, y + 21 - runOffset, 7, 5, "#111827");
  pixelRect(g, x + 8, y + 9, 3, 3, "#111827");
  pixelRect(g, x + 14, y + 9, 3, 3, "#111827");
  pixelRect(g, x + 7, y + 15, 10, 3, "#fef3c7");
}

function txt(
  g: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  col: string,
  align: CanvasTextAlign = "left",
  weight: "normal" | "bold" = "normal",
) {
  g.save();
  g.font = `${weight === "bold" ? "bold " : ""}${size}px "Courier New", monospace`;
  g.textAlign = align;
  g.textBaseline = "top";
  g.fillStyle = col;
  g.fillText(s, x, y);
  g.restore();
}

function bar(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, p: number, col: string) {
  pixelRect(g, x, y, w, h, "#111827");
  g.strokeStyle = "#334155";
  g.lineWidth = 2;
  g.strokeRect(x, y, w, h);
  if (p > 0) pixelRect(g, x + 2, y + 2, (w - 4) * clamp01(p), h - 4, col);
}

const PLAYER_BODY_COLOR = "#0ea5e9";
const BOSS_NAME = "Comitê Executivo";

function drawObstacle(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  kind: "desk" | "board",
  label: string,
) {
  const palette = {
    desk: { base: "#78350f", edge: "#451a03", accent: "#f59e0b", text: "#fef3c7" },
    board: { base: "#164e63", edge: "#083344", accent: "#facc15", text: "#ecfeff" },
  }[kind];
  pixelRect(g, x + 6, y + height - 2, width - 4, 8, "rgba(0,0,0,0.28)");
  pixelRect(g, x, y, width, height, palette.edge);
  pixelRect(g, x + 4, y + 4, width - 8, height - 8, palette.base);
  pixelRect(g, x + 8, y + 8, width - 16, 4, palette.accent);
  if (kind === "board") {
    const notes = ["#facc15", "#38bdf8", "#fb7185", "#22c55e"];
    for (let i = 0; i < 4; i += 1) pixelRect(g, x + 12 + i * 14, y + 19 + (i % 2) * 10, 9, 8, notes[i]);
  } else {
    pixelRect(g, x + 10, y + height - 12, 12, 8, "#451a03");
    pixelRect(g, x + width - 22, y + height - 12, 12, 8, "#451a03");
    pixelRect(g, x + width / 2 - 12, y + 16, 24, 8, "#fef3c7");
  }
  g.fillStyle = palette.text;
  g.font = "9px 'Courier New', monospace";
  g.textAlign = "center";
  g.fillText(label, x + width / 2, y - 5);
}

const OBSTACLES: Array<{ x: number; y: number; width: number; height: number; kind: "desk" | "board"; label: string }> = [
  { x: 90, y: 120, width: 86, height: 50, kind: "board", label: "Post-its" },
  { x: 780, y: 120, width: 86, height: 50, kind: "board", label: "Post-its" },
  { x: 96, y: 380, width: 118, height: 36, kind: "desk", label: "Mesa call" },
  { x: 746, y: 380, width: 118, height: 36, kind: "desk", label: "Mesa call" },
];

export default function SecretePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    const maybeCtx = cv?.getContext("2d");
    if (!cv || !maybeCtx) return;
    const ctx = maybeCtx;

    const keys: Record<string, boolean> = {};

    const st = document.createElement("canvas");
    st.width = W;
    st.height = H;
    const sg = st.getContext("2d");
    if (sg) {
      sg.fillStyle = "#211414";
      sg.fillRect(0, 0, W, H);
      sg.fillStyle = "#321b1b";
      for (let x = 0; x < W; x += 32) {
        for (let y = 0; y < H; y += 32) {
          if ((x / 32 + y / 32) % 2 === 0) sg.fillRect(x, y, 32, 32);
        }
      }
      sg.fillStyle = "#4a2a2a";
      for (let x = 16; x < W; x += 96) {
        for (let y = 18; y < H; y += 96) sg.fillRect(x, y, 3, 3);
      }
      for (const o of OBSTACLES) drawObstacle(sg, o.x, o.y, o.width, o.height, o.kind, o.label);
    }

    let player: Player;
    let boss: Boss;
    let mobs: Mob[];
    let shots: PlayerShot[];
    let eshots: EnemyShot[];
    let parts: Particle[];
    let zones: MeetingZone[];
    let legacy: LegacySystem;
    let state: GameState;
    let tG = 0;
    let lastMs = 0;
    let raf = 0;
    let cancelled = false;

    const spawnIncident = (x: number, y: number): Incident => ({ type: "incident", x, y, hp: 30, alive: true, dash: 1, vx: 0, vy: 0, anim: Math.random() * 7 });
    const spawnReviewer = (x: number, y: number): Reviewer => ({ type: "qa", x, y, hp: 50, alive: true, rt: 0, anim: Math.random() * 7 });

    function init() {
      player = { x: W / 2, y: H - 90, hp: 100, dir: 1, iframe: 0, cd: 0, bob: 0, moving: false, aimx: 0, aimy: -1 };
      boss = { x: W / 2, y: 150, hp: 400, max: 400, state: "idle", st: 0, atk: -1, alive: true, shake: 0 };
      mobs = [spawnIncident(200, 220), spawnIncident(760, 220), spawnReviewer(W / 2, 270)];
      shots = [];
      eshots = [];
      parts = [];
      zones = [{ x: 300, y: 330, base: 26, r: 26, ph: 0 }, { x: 660, y: 420, base: 30, r: 30, ph: 2 }];
      legacy = { active: false, cd: 8, t: 0, dir: 1, y0: 300, x: 0, y: 0, hist: [] };
      state = "play";
    }

    function burst(x: number, y: number, col: string, n: number) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 7;
        const v = 40 + Math.random() * 120;
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.4, col, s: 2 + Math.random() * 3 });
      }
    }

    function hurt(n: number) {
      const p = player;
      if (p.iframe > 0 || state !== "play") return;
      p.iframe = 0.9;
      p.hp -= n;
      burst(p.x, p.y, "#ef4444", 10);
      if (p.hp <= 0) {
        p.hp = 0;
        state = "dead";
      }
    }

    function updPlayer(dt: number) {
      const p = player;
      p.iframe = Math.max(0, p.iframe - dt);
      p.cd = Math.max(0, p.cd - dt);
      const ax = (keys["d"] || keys["arrowright"] ? 1 : 0) - (keys["a"] || keys["arrowleft"] ? 1 : 0);
      const ay = (keys["s"] || keys["arrowdown"] ? 1 : 0) - (keys["w"] || keys["arrowup"] ? 1 : 0);
      const slow = zones.some((zone) => Math.hypot(p.x - zone.x, p.y - zone.y) < zone.r);
      const sp = slow ? 70 : 170;
      if (ax || ay) {
        const d = Math.hypot(ax, ay);
        p.x += (ax / d) * sp * dt;
        p.y += (ay / d) * sp * dt;
        p.aimx = ax / d;
        p.aimy = ay / d;
        if (ax) p.dir = ax > 0 ? 1 : -1;
        p.moving = true;
        p.bob += dt;
      } else {
        p.moving = false;
      }
      p.x = Math.max(30, Math.min(W - 30, p.x));
      p.y = Math.max(70, Math.min(H - 24, p.y));
      if (keys[" "] && p.cd <= 0) {
        p.cd = 0.25;
        shots.push({ x: p.x + p.aimx * 12, y: p.y + p.aimy * 12, vx: p.aimx * 330, vy: p.aimy * 330 });
      }
    }

    function updBoss(dt: number) {
      const b = boss;
      if (!b.alive) return;
      b.st += dt;
      b.shake = Math.max(0, b.shake - dt * 3);
      const mult = b.hp < b.max * 0.35 ? 0.6 : 1;
      if (b.state === "idle" && b.st > 2.2 * mult) {
        b.state = "tele";
        b.st = 0;
        b.atk = (b.atk + 1) % 3;
      } else if (b.state === "tele" && b.st > 0.9) {
        b.state = "atk";
        b.st = 0;
        if (b.atk === 0) {
          for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2;
            eshots.push({ x: b.x, y: b.y + 20, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120 });
          }
        } else if (b.atk === 1) {
          for (let k = -1; k <= 1; k++) {
            const a = Math.atan2(player.y - b.y, player.x - b.x) + k * 0.22;
            eshots.push({ x: b.x, y: b.y + 20, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170 });
          }
        } else {
          if (mobs.filter((m) => m.type === "qa" && m.alive).length < 2) {
            mobs.push(spawnReviewer(b.x + (Math.random() * 160 - 80), b.y + 70));
          }
          burst(b.x, b.y + 40, "#84cc16", 16);
        }
      } else if (b.state === "atk" && b.st > 0.5) {
        b.state = "idle";
        b.st = 0;
      }
      if (Math.hypot(player.x - b.x, player.y - (b.y + 16)) < 46) hurt(20);
    }

    function updMob(m: Mob, dt: number) {
      if (!m.alive) {
        if (m.type === "qa") {
          m.rt -= dt;
          if (m.rt <= 0) {
            m.alive = true;
            m.hp = 50;
            burst(m.x, m.y, "#84cc16", 14);
          }
        }
        return;
      }
      m.anim += dt;
      const dx = player.x - m.x;
      const dy = player.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      if (m.type === "incident") {
        m.dash -= dt;
        if (m.dash <= 0) {
          m.dash = 1.6 + Math.random() * 1.4;
          m.vx = (dx / d) * 230;
          m.vy = (dy / d) * 230;
        }
        const f = Math.exp(-3 * dt);
        m.vx *= f;
        m.vy *= f;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
      } else {
        m.x += (dx / d) * 42 * dt;
        m.y += (dy / d) * 42 * dt;
      }
      if (d < 20) hurt(m.type === "qa" ? 15 : 10);
    }

    function updLegacy(dt: number) {
      const c = legacy;
      if (c.active) {
        c.t += dt;
        c.x = c.dir > 0 ? -80 + c.t * 150 : W + 80 - c.t * 150;
        c.y = c.y0 + Math.sin(c.t * 3) * 46;
        c.hist.unshift({ x: c.x, y: c.y });
        if (c.hist.length > 42) c.hist.pop();
        if (Math.hypot(player.x - c.x, player.y - c.y) < 18) hurt(20);
        if (c.x < -120 || c.x > W + 120) {
          c.active = false;
          c.cd = 12 + Math.random() * 8;
        }
      } else {
        c.cd -= dt;
        if (c.hist.length) {
          c.hist.pop();
          c.hist.pop();
        }
        if (c.cd <= 0) {
          c.active = true;
          c.t = 0;
          c.dir = Math.random() < 0.5 ? 1 : -1;
          c.y0 = 140 + Math.random() * 320;
        }
      }
    }

    function updShots(dt: number) {
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        let dead = s.x < 0 || s.x > W || s.y < 0 || s.y > H;
        if (!dead) {
          for (const m of mobs) {
            if (!m.alive) continue;
            if (Math.hypot(s.x - m.x, s.y - m.y) < 16) {
              m.hp -= 10;
              burst(s.x, s.y, "#84cc16", 6);
              dead = true;
              if (m.hp <= 0) {
                m.alive = false;
                if (m.type === "qa") m.rt = 5;
                burst(m.x, m.y, "#facc15", 14);
              }
              break;
            }
          }
        }
        if (!dead && boss.alive && Math.hypot(s.x - boss.x, s.y - (boss.y + 16)) < 36) {
          boss.hp -= 10;
          boss.shake = 1;
          burst(s.x, s.y, "#facc15", 6);
          dead = true;
          if (boss.hp <= 0) {
            boss.alive = false;
            state = "win";
            burst(boss.x, boss.y + 10, "#facc15", 40);
            burst(boss.x, boss.y + 10, "#ef4444", 40);
          }
        }
        if (dead) shots.splice(i, 1);
      }
      for (let i = eshots.length - 1; i >= 0; i--) {
        const s = eshots[i];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (Math.hypot(s.x - player.x, s.y - player.y) < 12) {
          hurt(10);
          eshots.splice(i, 1);
          continue;
        }
        if (s.x < 0 || s.x > W || s.y < 0 || s.y > H) eshots.splice(i, 1);
      }
      zones.forEach((zone) => (zone.r = zone.base + Math.sin(tG * 1.5 + zone.ph) * 6));
    }

    function updParts(dt: number) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.95;
        p.vy *= 0.95;
        if (p.life <= 0) parts.splice(i, 1);
      }
    }

    function drawBoss(g: CanvasRenderingContext2D, t: number) {
      const b = boss;
      const size = 72;
      const shakeOffset = b.shake > 0 ? (Math.random() - 0.5) * 4 * b.shake : 0;
      const wobble = Math.sin(t * 3) * 2;
      const x = Math.round(b.x - size / 2 + shakeOffset);
      const y = Math.round(b.y - size / 2 + wobble);
      pixelRect(g, b.x - size * 0.42, b.y + size * 0.36, size * 0.84, 6, "rgba(0,0,0,0.34)");
      pixelRect(g, x - 4, y + 12, size + 8, size - 8, "#450a0a");
      pixelRect(g, x, y + 8, size, size - 8, "#7f1d1d");
      pixelRect(g, x + 6, y, size - 12, 10, "#f97316");
      const eyeColor = !b.alive ? "#57534e" : b.state === "tele" ? (Math.sin(t * 20) > 0 ? "#facc15" : "#fef3c7") : b.state === "atk" ? "#ffffff" : "#facc15";
      pixelRect(g, x + 2, y + 4, 7, 7, eyeColor);
      pixelRect(g, x + size - 9, y + 4, 7, 7, eyeColor);
      pixelRect(g, x + 8, y + 17, 6, 6, "#fef3c7");
      pixelRect(g, x + size - 14, y + 17, 6, 6, "#fef3c7");
      pixelRect(g, x + 9, y + size - 8, size - 18, 5, "#111827");

      if (b.alive && b.state === "tele") {
        g.save();
        g.globalAlpha = 0.55;
        g.strokeStyle = "#facc15";
        g.setLineDash([6, 6]);
        g.lineWidth = 2;
        g.beginPath();
        g.arc(b.x, b.y + 16, 30 + b.st * 30, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }

      txt(g, BOSS_NAME, b.x, y - size / 2 - 4, 10, "#f8fafc", "center");
      const barW = size + 20;
      pixelRect(g, b.x - barW / 2, b.y + size / 2 + 5, barW, 4, "#111827");
      pixelRect(g, b.x - barW / 2, b.y + size / 2 + 5, barW * clamp01(b.hp / b.max), 4, "#84cc16");
    }

    function drawMob(g: CanvasRenderingContext2D, m: Mob, t: number) {
      void t;
      if (!m.alive) {
        if (m.type === "qa") {
          g.save();
          g.globalAlpha = 0.35;
          g.strokeStyle = "#84cc16";
          g.lineWidth = 2;
          g.beginPath();
          g.arc(m.x, m.y, 10 * (1 - m.rt / 5), 0, Math.PI * 2);
          g.stroke();
          g.restore();
        }
        return;
      }
      const size = m.type === "incident" ? 22 : 24;
      const wobble = Math.sin(m.anim * 8) * 2;
      const x = m.x - size / 2;
      const y = m.y - size / 2 + wobble;
      pixelRect(g, m.x - size * 0.42, m.y + size * 0.36, size * 0.84, 4, "rgba(0,0,0,0.3)");
      if (m.type === "incident") {
        pixelRect(g, x + 5, y + 2, size - 10, size - 4, "#ef4444");
        pixelRect(g, x + 2, y + 8, size - 4, 5, "#facc15");
        pixelRect(g, x + 8, y + 15, size - 16, 4, "#111827");
      } else {
        pixelRect(g, x + 4, y, size - 8, 8, "#fde047");
        pixelRect(g, x + 2, y + 8, size - 4, size - 8, "#ca8a04");
        pixelRect(g, x + 6, y + 13, 4, 4, "#111827");
        pixelRect(g, x + size - 10, y + 13, 4, 4, "#111827");
        pixelRect(g, x + 4, y + size - 5, size - 8, 3, "#ef4444");
      }
      txt(g, m.type === "incident" ? "Incidente P1" : "QA Nervoso", m.x, m.y - size / 2 - 14, 8, "#f8fafc", "center");
      pixelRect(g, m.x - size / 2, m.y + size / 2 + 4, size, 3, "#111827");
      pixelRect(g, m.x - size / 2, m.y + size / 2 + 4, size * clamp01(m.hp / (m.type === "incident" ? 30 : 50)), 3, "#84cc16");
    }

    function drawPlayer(g: CanvasRenderingContext2D) {
      const p = player;
      const blink = p.iframe > 0 && Math.floor(tG * 20) % 2 === 0;
      const run = p.moving ? Math.round(Math.sin(p.bob * 10)) : 0;
      const x = p.x - 12;
      const y = p.y - 13;
      g.save();
      if (blink) g.globalAlpha = 0.4;
      pixelRect(g, x - 2, y + 23, 28, 5, "rgba(0,0,0,0.35)");
      if (p.dir < 0) {
        g.translate(p.x, 0);
        g.scale(-1, 1);
        g.translate(-p.x, 0);
      }
      drawCharacterBody(g, x, y, { bodyColor: PLAYER_BODY_COLOR, faceColor: blink ? "#fee2e2" : "#f5d0a9", runOffset: run });
      g.restore();
      pixelRect(g, x + 20, y + 6, 16, 7, "#facc15");
      pixelRect(g, x + 34, y + 8, 7, 3, "#fde68a");
      if (p.cd > 0.19) pixelRect(g, x + 40, y + 7, 10, 5, "#f97316");
      txt(g, "Dev Pleno", p.x, p.y - 30, 9, "#f8fafc", "center");
    }

    function drawLegacy(g: CanvasRenderingContext2D) {
      const c = legacy;
      for (let i = c.hist.length - 1; i >= 0; i -= 3) {
        const q = c.hist[i];
        const s = 10 - (i / c.hist.length) * 6;
        pixelRect(g, q.x - s / 2, q.y - s / 2, s, s, i % 6 < 3 ? "#57534e" : "#44403c");
        if (i % 9 < 3) pixelRect(g, q.x - 1, q.y - 1, 2, 2, "#22c55e");
      }
      if (c.active) {
        pixelRect(g, c.x - 8, c.y - 8, 16, 16, "#57534e");
        pixelRect(g, c.x - 5, c.y - 5, 10, 10, "#a8a29e");
        pixelRect(g, c.x + (c.dir > 0 ? 2 : -6), c.y - 3, 4, 3, "#22c55e");
        txt(g, "Sistema Legado", c.x, c.y - 20, 8, "#f8fafc", "center");
      }
    }

    function frame(ms: number) {
      if (cancelled) return;
      const t = ms / 1000;
      const dt = Math.min(0.05, Math.max(0.001, t - lastMs));
      lastMs = t;
      tG += dt;

      if (state === "play") {
        updPlayer(dt);
        updBoss(dt);
        mobs.forEach((m) => updMob(m, dt));
        updLegacy(dt);
        updShots(dt);
      }
      updParts(dt);

      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(st, 0, 0);

      for (const zone of zones) {
        pixelRect(ctx, zone.x - zone.r, zone.y - zone.r * 0.6, zone.r * 2, zone.r * 1.2, "rgba(22,78,99,0.22)");
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(zone.x, zone.y, zone.r, zone.r * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
        txt(ctx, "REUNIÃO", zone.x, zone.y - zone.r * 0.6 - 14, 8, "#facc15", "center");
      }

      drawLegacy(ctx);
      mobs.forEach((m) => drawMob(ctx, m, tG));
      drawPlayer(ctx);
      drawBoss(ctx, tG);

      for (const s of shots) {
        pixelRect(ctx, s.x - 5, s.y - 3, 10, 6, "#facc15");
        pixelRect(ctx, s.x + 3, s.y - 1, 4, 2, "#fef9c3");
      }
      for (const s of eshots) {
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const p of parts) {
        ctx.globalAlpha = Math.max(0, p.life);
        pixelRect(ctx, p.x, p.y, p.s, p.s, p.col);
      }
      ctx.globalAlpha = 1;

      if (state === "play" && boss.state === "atk" && boss.st < 0.06) {
        ctx.fillStyle = "rgba(239,68,68,0.18)";
        ctx.fillRect(0, 0, W, H);
      }

      bar(ctx, 16, 12, 180, 14, player.hp / 100, "#ef4444");
      txt(ctx, "HP " + Math.max(0, Math.round(player.hp)), 22, 15, 9, "#f8fafc", "left", "bold");
      txt(ctx, BOSS_NAME.toUpperCase(), W / 2, 8, 12, "#facc15", "center", "bold");
      bar(ctx, W / 2 - 180, 26, 360, 12, boss.hp / boss.max, "#84cc16");

      if (state !== "play") {
        ctx.fillStyle = "rgba(5,10,22,0.82)";
        ctx.fillRect(0, H / 2 - 60, W, 120);
        txt(
          ctx,
          state === "win" ? "GO-LIVE DOMINADO" : "PRODUÇÃO CAIU",
          W / 2,
          H / 2 - 26,
          22,
          state === "win" ? "#facc15" : "#ef4444",
          "center",
          "bold",
        );
        txt(ctx, "Pressione R para reiniciar", W / 2, H / 2 + 16, 12, "#bfdbfe", "center");
      }

      raf = requestAnimationFrame(frame);
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
      keys[k] = true;
      if (k === "r") init();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    init();
    raf = requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  return (
    <div className="secrete-page">
      <div className="secrete-wrap">
        <canvas ref={canvasRef} width={W} height={H} />
        <div className="secrete-cap">SALA DE GUERRA · WASD MOVER · ESPAÇO ATIRAR · R REINICIAR</div>
      </div>
    </div>
  );
}
