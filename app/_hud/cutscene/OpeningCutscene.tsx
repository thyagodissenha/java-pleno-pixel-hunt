"use client";

import { useEffect, useRef, useState } from "react";
import { drawBossCharacter, pixelRect } from "@/lib/character-sprite";

// Módulo compartilhado por todas as instâncias na aba: a abertura só é
// contada uma vez por carregamento de página, mesmo trocando de tema (HUD
// clássico/neon) ou voltando ao menu depois de uma partida.
let cutsceneAlreadyPlayed = false;

type SceneCharacter = "dev" | "boss";

type Scene = {
  character: SceneCharacter;
  charX: number;
  charY: number;
  charScale: number;
  name: string;
  nameColor: string;
  dialog: string;
};

const SCENES: Scene[] = [
  {
    character: "dev",
    charX: 350,
    charY: 280,
    charScale: 2.6,
    name: "JAVA PLENO",
    nameColor: "#3dff7c",
    dialog: "Mais um dia normal no escritório... Hora de codar em paz.",
  },
  {
    character: "boss",
    charX: 740,
    charY: 430,
    charScale: 7,
    name: "GERENTE DE SPRINT",
    nameColor: "#ff3b3b",
    dialog: "PRECISO DESSA BUILD PRA ONTEM! O CLIENTE TÁ LIGANDO A CADA 5 MINUTOS!",
  },
  {
    character: "dev",
    charX: 380,
    charY: 250,
    charScale: 3,
    name: "JAVA PLENO",
    nameColor: "#3dff7c",
    dialog: "Chega. Hora de mostrar quem manda nesse código. BUILD INSTÁVEL? EU RESOLVO.",
  },
];

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 640;
const TYPING_SPEED = 0.035;
const FADE_SPEED = 2.2;

type FadeState = "in" | "visible" | "out";

type CutsceneState = {
  sceneIndex: number;
  fadeState: FadeState;
  fadeAlpha: number;
  dialogText: string;
  dialogIndex: number;
  typingTimer: number;
  finishedTyping: boolean;
  blinkTimer: number;
};

function freshState(sceneIndex: number): CutsceneState {
  return {
    sceneIndex,
    fadeState: "in",
    fadeAlpha: 0,
    dialogText: "",
    dialogIndex: 0,
    typingTimer: 0,
    finishedTyping: false,
    blinkTimer: 0,
  };
}

/**
 * Cutscene de abertura (dev vs. gerente de sprint) exibida uma vez antes do
 * menu inicial. Puramente canvas/imperativo, no mesmo estilo do poster
 * decorativo em PixelTitlePanels — o estado da cena vive num ref mutável e
 * é desenhado a cada frame, sem re-render do React a cada tecla digitada.
 */
export function OpeningCutscene() {
  const [dismissed, setDismissed] = useState(cutsceneAlreadyPlayed);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneStateRef = useRef<CutsceneState>(freshState(0));

  useEffect(() => {
    if (dismissed) return;
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let rafId = 0;
    let cancelled = false;
    let lastTime = 0;

    function finish() {
      cutsceneAlreadyPlayed = true;
      setDismissed(true);
    }

    function skip() {
      const state = sceneStateRef.current;
      if (!state.finishedTyping) {
        const scene = SCENES[state.sceneIndex];
        state.dialogText = scene.dialog;
        state.dialogIndex = scene.dialog.length;
        state.finishedTyping = true;
        return;
      }
      if (state.fadeState === "visible") {
        state.fadeState = "out";
        state.fadeAlpha = 0;
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        skip();
      }
    }

    cv.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", onKeyDown);

    // Retrato do "Java Pleno" na cutscene: óculos, moletom com logo Java,
    // caneca fumegante e teclado piscando — mais detalhado que o sprite
    // pequeno usado em jogo (drawCharacterBody), só para esta introdução.
    function drawJavaPlenoIntro(x: number, y: number, t: number, scale: number) {
      if (!ctx) return;
      const s = scale;
      const breath = Math.sin(t * 3) * s;

      pixelRect(ctx, x + 18 * s, y + 0, 24 * s, 4 * s, "#6b4423");
      pixelRect(ctx, x + 14 * s, y + 4 * s, 32 * s, 4 * s, "#6b4423");
      pixelRect(ctx, x + 12 * s, y + 8 * s, 36 * s, 4 * s, "#6b4423");
      pixelRect(ctx, x + 10 * s, y + 12 * s, 6 * s, 8 * s, "#6b4423");
      pixelRect(ctx, x + 44 * s, y + 12 * s, 6 * s, 8 * s, "#6b4423");
      pixelRect(ctx, x + 16 * s, y + 12 * s, 8 * s, 4 * s, "#6b4423");
      pixelRect(ctx, x + 36 * s, y + 12 * s, 8 * s, 4 * s, "#6b4423");
      pixelRect(ctx, x + 20 * s, y + 2 * s, 8 * s, 2 * s, "#8b5a33");
      pixelRect(ctx, x + 16 * s, y + 6 * s, 6 * s, 2 * s, "#8b5a33");

      pixelRect(ctx, x + 14 * s, y + 16 * s, 32 * s, 20 * s, "#f5d0a9");
      pixelRect(ctx, x + 10 * s, y + 20 * s, 4 * s, 8 * s, "#e8b98a");
      pixelRect(ctx, x + 46 * s, y + 20 * s, 4 * s, 8 * s, "#e8b98a");

      pixelRect(ctx, x + 12 * s, y + 20 * s, 14 * s, 10 * s, "#1a1a1a");
      pixelRect(ctx, x + 34 * s, y + 20 * s, 14 * s, 10 * s, "#1a1a1a");
      pixelRect(ctx, x + 26 * s, y + 23 * s, 8 * s, 3 * s, "#1a1a1a");
      pixelRect(ctx, x + 8 * s, y + 23 * s, 4 * s, 3 * s, "#1a1a1a");
      pixelRect(ctx, x + 48 * s, y + 23 * s, 4 * s, 3 * s, "#1a1a1a");
      pixelRect(ctx, x + 14 * s, y + 22 * s, 10 * s, 7 * s, "#93c5fd");
      pixelRect(ctx, x + 36 * s, y + 22 * s, 10 * s, 7 * s, "#93c5fd");
      pixelRect(ctx, x + 16 * s, y + 23 * s, 3 * s, 2 * s, "#dbeafe");
      pixelRect(ctx, x + 38 * s, y + 23 * s, 3 * s, 2 * s, "#dbeafe");
      pixelRect(ctx, x + 18 * s, y + 24 * s, 3 * s, 3 * s, "#1a1a1a");
      pixelRect(ctx, x + 40 * s, y + 24 * s, 3 * s, 3 * s, "#1a1a1a");

      pixelRect(ctx, x + 28 * s, y + 30 * s, 4 * s, 3 * s, "#d4a574");
      pixelRect(ctx, x + 22 * s, y + 34 * s, 16 * s, 2 * s, "#8b4513");
      pixelRect(ctx, x + 24 * s, y + 36 * s, 12 * s, 2 * s, "#8b4513");

      pixelRect(ctx, x + 24 * s, y + 36 * s, 12 * s, 6 * s, "#e8b98a");

      pixelRect(ctx, x + 8 * s, y + 42 * s, 44 * s, 32 * s, "#1e3a5f");
      pixelRect(ctx, x + 10 * s, y + 44 * s, 40 * s, 4 * s, "#152a47");
      pixelRect(ctx, x + 6 * s, y + 14 * s, 8 * s, 20 * s, "#1e3a5f");
      pixelRect(ctx, x + 46 * s, y + 14 * s, 8 * s, 20 * s, "#1e3a5f");
      pixelRect(ctx, x + 26 * s, y + 42 * s, 2 * s, 8 * s, "#93c5fd");
      pixelRect(ctx, x + 32 * s, y + 42 * s, 2 * s, 8 * s, "#93c5fd");
      pixelRect(ctx, x + 16 * s, y + 62 * s, 28 * s, 10 * s, "#152a47");
      pixelRect(ctx, x + 18 * s, y + 64 * s, 24 * s, 6 * s, "#0f1f3a");

      const logoX = x + 22 * s;
      const logoY = y + 48 * s;
      pixelRect(ctx, logoX, logoY, 12 * s, 10 * s, "#fff");
      pixelRect(ctx, logoX + 2 * s, logoY + 2 * s, 8 * s, 6 * s, "#f0f0f0");
      pixelRect(ctx, logoX + 12 * s, logoY + 3 * s, 3 * s, 5 * s, "#fff");
      pixelRect(ctx, logoX + 3 * s, logoY - 4 * s, 2 * s, 3 * s, "#fff");
      pixelRect(ctx, logoX + 6 * s, logoY - 6 * s, 2 * s, 4 * s, "#fff");
      pixelRect(ctx, logoX + 9 * s, logoY - 4 * s, 2 * s, 3 * s, "#fff");
      pixelRect(ctx, logoX + 2 * s, logoY + 4 * s, 8 * s, 2 * s, "#e76f00");

      pixelRect(ctx, x, y + 44 * s, 10 * s, 20 * s, "#1e3a5f");
      pixelRect(ctx, x, y + 62 * s, 10 * s, 8 * s, "#f5d0a9");
      const mugX = x - 4 * s;
      const mugY = y + 58 * s;
      pixelRect(ctx, mugX, mugY, 14 * s, 16 * s, "#fff");
      pixelRect(ctx, mugX + 2 * s, mugY + 2 * s, 10 * s, 12 * s, "#f0f0f0");
      pixelRect(ctx, mugX + 14 * s, mugY + 4 * s, 4 * s, 8 * s, "#fff");
      pixelRect(ctx, mugX + 15 * s, mugY + 5 * s, 2 * s, 6 * s, "#f5e6a3");
      pixelRect(ctx, mugX + 3 * s, mugY + 5 * s, 8 * s, 6 * s, "#e76f00");
      pixelRect(ctx, mugX + 4 * s, mugY + 6 * s, 6 * s, 4 * s, "#fff");
      const steam1 = Math.sin(t * 4) * 2 * s;
      const steam2 = Math.sin(t * 4 + 1.5) * 2 * s;
      pixelRect(ctx, mugX + 3 * s, mugY - 4 * s + steam1, 3 * s, 3 * s, "rgba(255,255,255,0.7)");
      pixelRect(ctx, mugX + 8 * s, mugY - 6 * s + steam2, 3 * s, 3 * s, "rgba(255,255,255,0.7)");

      pixelRect(ctx, x + 50 * s, y + 44 * s, 12 * s, 16 * s, "#1e3a5f");
      pixelRect(ctx, x + 52 * s, y + 58 * s, 10 * s, 8 * s, "#f5d0a9");
      const kbX = x + 58 * s;
      const kbY = y + 54 * s;
      pixelRect(ctx, kbX, kbY, 30 * s, 14 * s, "#4a5568");
      pixelRect(ctx, kbX + 2 * s, kbY + 2 * s, 26 * s, 10 * s, "#2d3748");
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 7; col++) {
          pixelRect(ctx, kbX + 3 * s + col * 3.5 * s, kbY + 3 * s + row * 3 * s, 2.5 * s, 2 * s, "#1a202c");
        }
      }
      const flicker = Math.sin(t * 15) * 2 * s;
      const flicker2 = Math.cos(t * 18) * 1.5 * s;
      pixelRect(ctx, kbX + 30 * s + flicker, kbY + 2 * s, 10 * s, 8 * s, "#ff8c3d");
      pixelRect(ctx, kbX + 34 * s + flicker, kbY + 4 * s, 8 * s, 6 * s, "#ff6b1a");
      pixelRect(ctx, kbX + 32 * s + flicker2, kbY + 3 * s, 6 * s, 6 * s, "#ffe94d");
      pixelRect(ctx, kbX + 34 * s + flicker2, kbY + 4 * s, 4 * s, 4 * s, "#fff7a0");
      pixelRect(ctx, kbX + 35 * s + flicker, kbY + 5 * s, 2 * s, 2 * s, "#fff");
      if (Math.random() > 0.7) {
        pixelRect(ctx, kbX + 38 * s + Math.random() * 6 * s, kbY + Math.random() * 8 * s, 2 * s, 2 * s, "#ffe94d");
      }

      pixelRect(ctx, x + 10 * s, y + 74 * s + breath, 18 * s, 20 * s, "#2c4a7c");
      pixelRect(ctx, x + 32 * s, y + 74 * s + breath, 18 * s, 20 * s, "#2c4a7c");
      pixelRect(ctx, x + 12 * s, y + 76 * s + breath, 14 * s, 2 * s, "#1e3a5f");
      pixelRect(ctx, x + 34 * s, y + 76 * s + breath, 14 * s, 2 * s, "#1e3a5f");
      pixelRect(ctx, x + 8 * s, y + 94 * s + breath, 20 * s, 8 * s, "#1a1a1a");
      pixelRect(ctx, x + 32 * s, y + 94 * s + breath, 20 * s, 8 * s, "#1a1a1a");
      pixelRect(ctx, x + 8 * s, y + 100 * s + breath, 20 * s, 2 * s, "#4a5568");
      pixelRect(ctx, x + 32 * s, y + 100 * s + breath, 20 * s, 2 * s, "#4a5568");
    }

    function drawServerRoom(t: number) {
      if (!ctx || !cv) return;
      ctx.fillStyle = "#0f1f3a";
      ctx.fillRect(0, 0, cv.width, cv.height);
      const rackW = 60;
      const rackH = 160;
      const racks = [70, 190, cv.width - 250, cv.width - 130];
      racks.forEach((rx, i) => {
        const ry = cv.height - rackH - 60;
        ctx.fillStyle = "#1a3a6a";
        ctx.fillRect(rx, ry, rackW, rackH);
        ctx.strokeStyle = "#0f2a5a";
        ctx.lineWidth = 2;
        ctx.strokeRect(rx, ry, rackW, rackH);
        for (let row = 0; row < 7; row++) {
          for (let col = 0; col < 4; col++) {
            const blink = Math.sin(t * 3 + i + row * 0.5 + col * 0.3) > 0;
            ctx.fillStyle = blink ? "#3dff7c" : "#1a5a3a";
            ctx.fillRect(rx + 8 + col * 12, ry + 10 + row * 20, 8, 6);
          }
        }
      });
    }

    function drawMeetingRoom(t: number) {
      if (!ctx || !cv) return;
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      for (let x = 0; x < cv.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, cv.height);
        ctx.stroke();
      }
      for (let y = 0; y < cv.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(cv.width, y);
        ctx.stroke();
      }
      ctx.fillStyle = "#1a3a6a";
      ctx.fillRect(0, 0, cv.width, 40);
      const blink = Math.sin(t * 6) > 0;
      ctx.fillStyle = blink ? "#ff3b3b" : "#8b1515";
      ctx.fillRect(20, 12, 16, 16);
      ctx.save();
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#fff";
      ctx.fillText("MEETING CALL", 50, 14);
      ctx.restore();
    }

    function drawDialogBox(scene: Scene, state: CutsceneState) {
      if (!ctx || !cv) return;
      const balloonX = 40;
      const balloonY = cv.height - 170;
      const balloonW = cv.width - 80;
      const balloonH = 130;

      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(balloonX + 4, balloonY + 4, balloonW, balloonH);
      ctx.fillStyle = "#0a0a1a";
      ctx.fillRect(balloonX, balloonY, balloonW, balloonH);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.strokeRect(balloonX, balloonY, balloonW, balloonH);

      const nameBoxW = 260;
      const nameBoxH = 26;
      const nameBoxX = balloonX + 16;
      const nameBoxY = balloonY - 16;
      ctx.fillStyle = scene.nameColor;
      ctx.fillRect(nameBoxX, nameBoxY, nameBoxW, nameBoxH);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(nameBoxX, nameBoxY, nameBoxW, nameBoxH);
      ctx.save();
      ctx.font = '11px "Press Start 2P", monospace';
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#000";
      ctx.fillText(scene.name, nameBoxX + 10, nameBoxY + 6);
      ctx.restore();

      const dialogX = balloonX + 18;
      const dialogMaxW = balloonW - 36;
      const dialogLineH = 20;
      ctx.save();
      ctx.font = '12px "Press Start 2P", monospace';
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#fff";
      const words = state.dialogText.split(" ");
      let line = "";
      let lineY = balloonY + 18;
      for (const word of words) {
        const testLine = `${line}${word} `;
        if (ctx.measureText(testLine).width > dialogMaxW && line !== "") {
          ctx.fillText(line.trim(), dialogX, lineY);
          line = `${word} `;
          lineY += dialogLineH;
        } else {
          line = testLine;
        }
      }
      if (line.trim() !== "") ctx.fillText(line.trim(), dialogX, lineY);
      ctx.restore();

      if (state.finishedTyping && state.fadeState === "visible" && Math.sin(state.blinkTimer * 6) > 0) {
        ctx.save();
        ctx.font = '9px "Press Start 2P", monospace';
        ctx.textAlign = "right";
        ctx.fillStyle = "#ffe94d";
        ctx.fillText("ESPAÇO/CLIQUE ▶", balloonX + balloonW - 16, balloonY + balloonH - 22);
        ctx.restore();
      }

      ctx.save();
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillText(`${state.sceneIndex + 1} / ${SCENES.length}`, cv.width / 2, balloonY + balloonH + 12);
      ctx.restore();
    }

    function drawScene(t: number) {
      if (!ctx || !cv) return;
      const state = sceneStateRef.current;
      const scene = SCENES[state.sceneIndex];

      if (scene.character === "boss") drawMeetingRoom(t);
      else drawServerRoom(t);

      if (scene.character === "dev") {
        drawJavaPlenoIntro(scene.charX, scene.charY, t, scene.charScale);
      } else {
        drawBossCharacter(ctx, scene.charX, scene.charY, scene.charScale, t);
      }

      drawDialogBox(scene, state);

      if (state.fadeState !== "visible") {
        ctx.fillStyle = `rgba(5, 8, 15, ${state.fadeAlpha})`;
        ctx.fillRect(0, 0, cv.width, cv.height);
      }
    }

    function update(dt: number) {
      const state = sceneStateRef.current;
      if (state.fadeState === "in") {
        state.fadeAlpha = Math.min(1, state.fadeAlpha + FADE_SPEED * dt);
        if (state.fadeAlpha >= 1) {
          state.fadeState = "visible";
          state.fadeAlpha = 0;
        }
      } else if (state.fadeState === "out") {
        state.fadeAlpha = Math.min(1, state.fadeAlpha + FADE_SPEED * dt);
        if (state.fadeAlpha >= 1) {
          if (state.sceneIndex < SCENES.length - 1) {
            sceneStateRef.current = freshState(state.sceneIndex + 1);
          } else {
            finish();
            return;
          }
        }
      }

      const current = sceneStateRef.current;
      if (current.fadeState === "visible" && !current.finishedTyping) {
        current.typingTimer += dt;
        const scene = SCENES[current.sceneIndex];
        while (current.typingTimer >= TYPING_SPEED && current.dialogIndex < scene.dialog.length) {
          current.dialogText += scene.dialog[current.dialogIndex];
          current.dialogIndex += 1;
          current.typingTimer -= TYPING_SPEED;
        }
        if (current.dialogIndex >= scene.dialog.length) current.finishedTyping = true;
      }
      current.blinkTimer += dt;
    }

    function loop(ms: number) {
      if (cancelled || !cv || !cv.isConnected) return;
      const t = ms / 1000;
      const dt = lastTime === 0 ? 0 : Math.min(0.05, Math.max(0.001, t - lastTime));
      lastTime = t;
      update(dt);
      if (!cancelled) drawScene(t);
      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      cv.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dismissed]);

  if (dismissed) return null;

  return (
    <div
      className="cutscene-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Abertura da história — pressione espaço, Enter ou clique para avançar"
    >
      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="cutscene-canvas" aria-hidden="true" />
    </div>
  );
}
