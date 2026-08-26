"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";

type Actor = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  speed: number;
  size: number;
  kind: "user" | "boss" | "data";
  label: string;
  cooldown?: number;
};

type Shot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  color: string;
};

type GameState = "menu" | "playing" | "paused" | "over" | "won";
type HighScore = {
  name: string;
  score: number;
  wave: number;
  outcome: "over" | "won";
  createdAt: string;
};

const WORLD = { width: 960, height: 540 };
const HIGH_SCORE_KEY = "java-pleno-pixel-hunt-high-scores";
const bossNames = [
  "Gerente de Sprint",
  "Dono do Roadmap",
  "Arquiteto das Reunioes",
  "Diretor do Go-Live",
];
const cloudLabels = ["Azure", "SQL", "Blob", "CI/CD", "Kafka", "BI"];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalize(x: number, y: number) {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function pixelRect(
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

function loadHighScores(): HighScore[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(HIGH_SCORE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as HighScore[];
    return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
  } catch {
    return [];
  }
}

function saveHighScores(scores: HighScore[]) {
  window.localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(scores.slice(0, 10)));
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keys = useRef(new Set<string>());
  const pointer = useRef({ active: false, x: WORLD.width / 2, y: WORLD.height / 2 });
  const stateRef = useRef<GameState>("menu");
  const startGameRef = useRef<() => void>(() => undefined);
  const [gameState, setGameState] = useState<GameState>("menu");
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [hp, setHp] = useState(100);
  const [boss, setBoss] = useState("Gerente de Sprint");
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [scoreSaved, setScoreSaved] = useState(true);
  const [lastOutcome, setLastOutcome] = useState<"over" | "won">("over");

  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    setHighScores(loadHighScores());
  }, []);

  function startNewGame() {
    setScoreSaved(true);
    setPlayerName("");
    startGameRef.current();
  }

  function submitScore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = playerName.trim().replace(/\s+/g, " ").slice(0, 14) || "DEV ANON";
    const nextScores = [
      {
        name: cleanName.toUpperCase(),
        score,
        wave,
        outcome: lastOutcome,
        createdAt: new Date().toISOString(),
      },
      ...highScores,
    ].sort((a, b) => b.score - a.score || b.wave - a.wave).slice(0, 10);

    saveHighScores(nextScores);
    setHighScores(nextScores);
    setScoreSaved(true);
  }

  function clearHighScores() {
    window.localStorage.removeItem(HIGH_SCORE_KEY);
    setHighScores([]);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (!ctx) return;

    let frame = 0;
    let raf = 0;
    let last = performance.now();
    let localScore = 0;
    let localWave = 1;
    let spawnTimer = 0;
    let dataTimer = 140;
    let shotTimer = 0;
    let bossIndex = 0;

    const player = {
      x: WORLD.width / 2,
      y: WORLD.height / 2,
      hp: 100,
      maxHp: 100,
      size: 24,
      speed: 210,
      invincible: 0,
      fury: 0,
    };

    const enemies: Actor[] = [];
    const shots: Shot[] = [];
    const particles: Particle[] = [];

    function syncHud() {
      setScore(localScore);
      setWave(localWave);
      setHp(Math.max(0, Math.round(player.hp)));
      setBoss(bossNames[bossIndex] ?? "Comite Executivo");
    }

    function burst(x: number, y: number, color: string, amount = 12) {
      for (let i = 0; i < amount; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 170;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          ttl: 24 + Math.random() * 24,
          color,
        });
      }
    }

    function spawnEnemy(kind: Actor["kind"]) {
      const edge = Math.floor(Math.random() * 4);
      const margin = 36;
      const x = edge === 0 ? -margin : edge === 1 ? WORLD.width + margin : Math.random() * WORLD.width;
      const y = edge === 2 ? -margin : edge === 3 ? WORLD.height + margin : Math.random() * WORLD.height;
      const isBoss = kind === "boss";
      const isData = kind === "data";
      enemies.push({
        x,
        y,
        vx: 0,
        vy: 0,
        hp: isBoss ? 140 + localWave * 35 : isData ? 18 : 28 + localWave * 2,
        maxHp: isBoss ? 140 + localWave * 35 : isData ? 18 : 28 + localWave * 2,
        speed: isBoss ? 54 + localWave * 2 : isData ? 92 : 72 + localWave * 4,
        size: isBoss ? 38 : isData ? 22 : 24,
        kind,
        label: isBoss ? bossNames[bossIndex] : isData ? cloudLabels[Math.floor(Math.random() * cloudLabels.length)] : "Usuario",
        cooldown: 90,
      });
    }

    function resetGame() {
      localScore = 0;
      localWave = 1;
      spawnTimer = 0;
      dataTimer = 120;
      shotTimer = 0;
      bossIndex = 0;
      player.x = WORLD.width / 2;
      player.y = WORLD.height / 2;
      player.hp = player.maxHp;
      player.invincible = 0;
      player.fury = 0;
      enemies.length = 0;
      shots.length = 0;
      particles.length = 0;
      for (let i = 0; i < 5; i += 1) spawnEnemy("user");
      spawnEnemy("boss");
      syncHud();
    }

    function start() {
      resetGame();
      setGameState("playing");
    }
    startGameRef.current = start;

    const onKeyDown = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "w", "a", "s", "d", "W", "A", "S", "D", "Enter", "Escape"].includes(event.key)) {
        event.preventDefault();
      }
      if (event.key === "Enter" && stateRef.current === "menu") start();
      if (event.key === "Escape" && stateRef.current === "playing") setGameState("paused");
      else if (event.key === "Escape" && stateRef.current === "paused") setGameState("playing");
      keys.current.add(event.key.toLowerCase());
    };
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    const onPointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      pointer.current.x = ((event.clientX - bounds.left) / bounds.width) * WORLD.width;
      pointer.current.y = ((event.clientY - bounds.top) / bounds.height) * WORLD.height;
    };
    const onPointerDown = (event: PointerEvent) => {
      pointer.current.active = true;
      onPointerMove(event);
      if (stateRef.current === "menu") start();
      if (stateRef.current === "paused") setGameState("playing");
    };
    const onPointerUp = () => {
      pointer.current.active = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);

    function shoot() {
      let target = enemies[0];
      for (const enemy of enemies) {
        if (!target || distance(enemy, player) < distance(target, player)) target = enemy;
      }
      const aim = target
        ? normalize(target.x - player.x, target.y - player.y)
        : normalize(pointer.current.x - player.x, pointer.current.y - player.y);
      shots.push({
        x: player.x + aim.x * 20,
        y: player.y + aim.y * 20,
        vx: aim.x * 430,
        vy: aim.y * 430,
        ttl: 78,
      });
    }

    function update(delta: number) {
      if (stateRef.current !== "playing") return;
      frame += 1;
      spawnTimer -= delta;
      dataTimer -= delta;
      shotTimer -= delta;
      player.invincible = Math.max(0, player.invincible - delta);
      player.fury = Math.max(0, player.fury - delta);

      let moveX = 0;
      let moveY = 0;
      if (keys.current.has("w") || keys.current.has("arrowup")) moveY -= 1;
      if (keys.current.has("s") || keys.current.has("arrowdown")) moveY += 1;
      if (keys.current.has("a") || keys.current.has("arrowleft")) moveX -= 1;
      if (keys.current.has("d") || keys.current.has("arrowright")) moveX += 1;
      if (pointer.current.active) {
        const drag = normalize(pointer.current.x - player.x, pointer.current.y - player.y);
        if (distance(pointer.current, player) > 18) {
          moveX += drag.x;
          moveY += drag.y;
        }
      }
      const move = normalize(moveX, moveY);
      if (moveX || moveY) {
        player.x = clamp(player.x + move.x * player.speed * delta, 28, WORLD.width - 28);
        player.y = clamp(player.y + move.y * player.speed * delta, 36, WORLD.height - 28);
      }

      if (shotTimer <= 0 || keys.current.has(" ")) {
        shoot();
        shotTimer = player.fury > 0 ? 0.11 : 0.24;
      }

      if (spawnTimer <= 0) {
        spawnTimer = Math.max(0.34, 1.25 - localWave * 0.06);
        spawnEnemy("user");
      }
      if (dataTimer <= 0) {
        dataTimer = Math.max(1.2, 3.7 - localWave * 0.16);
        spawnEnemy("data");
      }

      for (const enemy of enemies) {
        const toward = normalize(player.x - enemy.x, player.y - enemy.y);
        if (enemy.kind === "data") {
          enemy.vx = toward.x * enemy.speed * 1.5;
          enemy.vy = toward.y * enemy.speed * 1.5;
        } else {
          enemy.vx = toward.x * enemy.speed + Math.sin((frame + enemy.x) / 23) * 16;
          enemy.vy = toward.y * enemy.speed + Math.cos((frame + enemy.y) / 29) * 16;
        }
        enemy.x += enemy.vx * delta;
        enemy.y += enemy.vy * delta;
        if (enemy.kind === "boss") {
          enemy.cooldown = (enemy.cooldown ?? 0) - delta * 60;
          if (enemy.cooldown <= 0) {
            enemy.cooldown = 82 - localWave * 2;
            for (let i = 0; i < 3; i += 1) {
              const spread = (i - 1) * 0.34;
              const base = Math.atan2(player.y - enemy.y, player.x - enemy.x) + spread;
              enemies.push({
                x: enemy.x + Math.cos(base) * 30,
                y: enemy.y + Math.sin(base) * 30,
                vx: 0,
                vy: 0,
                hp: 16,
                maxHp: 16,
                speed: 110 + localWave * 3,
                size: 18,
                kind: "data",
                label: "Deploy",
              });
            }
          }
        }
      }

      for (const shot of shots) {
        shot.x += shot.vx * delta;
        shot.y += shot.vy * delta;
        shot.ttl -= delta * 60;
      }

      for (let i = enemies.length - 1; i >= 0; i -= 1) {
        const enemy = enemies[i];
        if (distance(enemy, player) < enemy.size * 0.55 + player.size * 0.55) {
          if (player.invincible <= 0) {
            player.hp -= enemy.kind === "boss" ? 18 : enemy.kind === "data" ? 13 : 8;
            player.invincible = 0.72;
            burst(player.x, player.y, "#ff5353", 10);
            if (enemy.kind !== "boss") enemies.splice(i, 1);
          }
        }
      }

      for (let s = shots.length - 1; s >= 0; s -= 1) {
        const shot = shots[s];
        if (shot.ttl <= 0 || shot.x < -20 || shot.x > WORLD.width + 20 || shot.y < -20 || shot.y > WORLD.height + 20) {
          shots.splice(s, 1);
          continue;
        }
        for (let e = enemies.length - 1; e >= 0; e -= 1) {
          const enemy = enemies[e];
          if (distance(shot, enemy) < enemy.size * 0.55 + 7) {
            enemy.hp -= player.fury > 0 ? 26 : 18;
            shots.splice(s, 1);
            burst(shot.x, shot.y, enemy.kind === "boss" ? "#f9c74f" : "#65d6ad", 4);
            if (enemy.hp <= 0) {
              localScore += enemy.kind === "boss" ? 500 : enemy.kind === "data" ? 80 : 45;
              if (enemy.kind === "boss") {
                player.fury = 5;
                player.hp = clamp(player.hp + 18, 0, player.maxHp);
                bossIndex += 1;
                localWave += 1;
                burst(enemy.x, enemy.y, "#ffd166", 28);
                if (bossIndex >= bossNames.length) {
                  syncHud();
                  setScore(localScore);
                  setWave(localWave);
                  setLastOutcome("won");
                  setScoreSaved(false);
                  setGameState("won");
                } else {
                  setTimeout(() => {
                    if (stateRef.current === "playing") spawnEnemy("boss");
                  }, 700);
                }
              } else {
                burst(enemy.x, enemy.y, enemy.kind === "data" ? "#7dd3fc" : "#a7f3d0", 12);
              }
              enemies.splice(e, 1);
              syncHud();
            }
            break;
          }
        }
      }

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i];
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.vx *= 0.96;
        particle.vy *= 0.96;
        particle.ttl -= delta * 60;
        if (particle.ttl <= 0) particles.splice(i, 1);
      }

      if (player.hp <= 0) {
        player.hp = 0;
        syncHud();
        setScore(localScore);
        setWave(localWave);
        setLastOutcome("over");
        setScoreSaved(false);
        setGameState("over");
      }
      if (frame % 18 === 0) syncHud();
    }

    function drawActor(actor: Actor) {
      const x = actor.x - actor.size / 2;
      const y = actor.y - actor.size / 2;
      if (actor.kind === "boss") {
        pixelRect(ctx, x, y + 8, actor.size, actor.size - 8, "#7f1d1d");
        pixelRect(ctx, x + 6, y, actor.size - 12, 10, "#f97316");
        pixelRect(ctx, x + 8, y + 17, 6, 6, "#fef3c7");
        pixelRect(ctx, x + actor.size - 14, y + 17, 6, 6, "#fef3c7");
        pixelRect(ctx, x + 9, y + actor.size - 8, actor.size - 18, 5, "#111827");
      } else if (actor.kind === "data") {
        pixelRect(ctx, x + 2, y + 5, actor.size - 4, actor.size - 7, "#2563eb");
        pixelRect(ctx, x + 5, y + 2, actor.size - 10, 6, "#93c5fd");
        pixelRect(ctx, x + 6, y + 11, actor.size - 12, 3, "#dbeafe");
        pixelRect(ctx, x + 6, y + 17, actor.size - 12, 3, "#dbeafe");
      } else {
        pixelRect(ctx, x + 6, y, actor.size - 12, 8, "#f9a8d4");
        pixelRect(ctx, x + 3, y + 8, actor.size - 6, actor.size - 8, "#ec4899");
        pixelRect(ctx, x + 7, y + 14, 4, 4, "#111827");
        pixelRect(ctx, x + actor.size - 11, y + 14, 4, 4, "#111827");
      }
      if (actor.kind !== "user") {
        ctx.fillStyle = "#f8fafc";
        ctx.font = "10px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.fillText(actor.label, actor.x, actor.y - actor.size / 2 - 8);
      }
      const bar = actor.size;
      pixelRect(ctx, actor.x - bar / 2, actor.y + actor.size / 2 + 5, bar, 4, "#111827");
      pixelRect(ctx, actor.x - bar / 2, actor.y + actor.size / 2 + 5, bar * (actor.hp / actor.maxHp), 4, "#84cc16");
    }

    function drawPlayer() {
      const blink = player.invincible > 0 && Math.floor(frame / 4) % 2 === 0;
      const x = player.x - player.size / 2;
      const y = player.y - player.size / 2;
      pixelRect(ctx, x + 6, y, 12, 7, blink ? "#fee2e2" : "#f5d0a9");
      pixelRect(ctx, x + 4, y + 7, 16, 13, player.fury > 0 ? "#f97316" : "#0ea5e9");
      pixelRect(ctx, x + 1, y + 10, 6, 5, "#78350f");
      pixelRect(ctx, x + 17, y + 10, 8, 5, "#78350f");
      pixelRect(ctx, x + 2, y + 20, 7, 5, "#111827");
      pixelRect(ctx, x + 15, y + 20, 7, 5, "#111827");
      pixelRect(ctx, x + 8, y + 9, 3, 3, "#111827");
      pixelRect(ctx, x + 14, y + 9, 3, 3, "#111827");
      pixelRect(ctx, x + 20, y + 6, 16, 7, "#facc15");
      pixelRect(ctx, x + 34, y + 8, 7, 3, "#fde68a");
      ctx.fillStyle = "#f8fafc";
      ctx.font = "10px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText("Java Pleno", player.x, player.y - 20);
    }

    function drawGrid() {
      ctx.fillStyle = "#101827";
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
      for (let x = 0; x < WORLD.width; x += 32) {
        for (let y = 0; y < WORLD.height; y += 32) {
          if ((x / 32 + y / 32) % 2 === 0) {
            ctx.fillStyle = "#132033";
            ctx.fillRect(x, y, 32, 32);
          }
        }
      }
      ctx.fillStyle = "#22304b";
      for (let x = 16; x < WORLD.width; x += 96) {
        for (let y = 18; y < WORLD.height; y += 96) {
          ctx.fillRect(x, y, 3, 3);
        }
      }
      pixelRect(ctx, 56, 56, 160, 30, "#1f2937");
      pixelRect(ctx, 64, 64, 144, 4, "#38bdf8");
      pixelRect(ctx, WORLD.width - 216, WORLD.height - 90, 160, 30, "#1f2937");
      pixelRect(ctx, WORLD.width - 208, WORLD.height - 82, 144, 4, "#fb7185");
    }

    function drawOverlay(title: string, text: string) {
      ctx.fillStyle = "rgba(8, 13, 24, 0.76)";
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 42px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText(title, WORLD.width / 2, WORLD.height / 2 - 32);
      ctx.font = "18px 'Courier New', monospace";
      ctx.fillStyle = "#bfdbfe";
      ctx.fillText(text, WORLD.width / 2, WORLD.height / 2 + 8);
      ctx.font = "14px 'Courier New', monospace";
      ctx.fillStyle = "#fde68a";
      ctx.fillText("Enter ou toque para jogar", WORLD.width / 2, WORLD.height / 2 + 44);
    }

    function draw() {
      drawGrid();
      for (const particle of particles) {
        pixelRect(ctx, particle.x, particle.y, 4, 4, particle.color);
      }
      for (const shot of shots) {
        pixelRect(ctx, shot.x - 5, shot.y - 3, 10, 6, "#facc15");
        pixelRect(ctx, shot.x + 3, shot.y - 1, 4, 2, "#fef9c3");
      }
      enemies.sort((a, b) => a.y - b.y).forEach(drawActor);
      drawPlayer();

      if (stateRef.current === "menu") {
        drawOverlay("JAVA PLENO: ESTOUROU A BUILD", "Sobreviva aos usuarios, dados e chefes da firma");
      } else if (stateRef.current === "paused") {
        drawOverlay("PAUSADO", "Respira. A daily espera.");
      } else if (stateRef.current === "over") {
        drawOverlay("PRODUCAO CAIU", `Pontuacao final: ${localScore}`);
      } else if (stateRef.current === "won") {
        drawOverlay("GO-LIVE DOMINADO", `Voce limpou a firma com ${localScore} pontos`);
      }
    }

    function tick(now: number) {
      const delta = Math.min(0.033, (now - last) / 1000);
      last = now;
      update(delta);
      draw();
      raf = requestAnimationFrame(tick);
    }

    resetGame();
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  const status = gameState === "playing" ? "Em combate" : gameState === "paused" ? "Pausado" : gameState === "won" ? "Vitoria" : gameState === "over" ? "Fim de jogo" : "Pronto";
  const finalScreen = gameState === "over" || gameState === "won";

  return (
    <main className="game-shell">
      <section className="topbar" aria-label="Painel do jogo">
        <div>
          <p>Java Pleno Pixel Hunt</p>
          <h1>{status}</h1>
        </div>
        <div className="hud">
          <span>HP {hp}</span>
          <span>Onda {wave}</span>
          <span>{score} pts</span>
        </div>
      </section>

      <section className="game-stage" aria-label="Arena do jogo">
        <canvas ref={canvasRef} width={WORLD.width} height={WORLD.height} aria-label="Arena pixel art" />
        {finalScreen && (
          <div className="score-overlay" role="dialog" aria-modal="true" aria-label="Ranking de maiores pontuacoes">
            <div className="score-panel">
              <p className="score-kicker">{gameState === "won" ? "Missao completa" : "Producao caiu"}</p>
              <h2>HIGH SCORES</h2>
              {!scoreSaved ? (
                <form className="score-form" onSubmit={submitScore}>
                  <label htmlFor="player-name">Digite seu nome</label>
                  <div>
                    <input
                      id="player-name"
                      maxLength={14}
                      value={playerName}
                      onChange={(event) => setPlayerName(event.target.value)}
                      placeholder="DEV ANON"
                      autoFocus
                    />
                    <button type="submit">Salvar</button>
                  </div>
                  <span>{score} pts · onda {wave}</span>
                </form>
              ) : (
                <button className="play-again" type="button" onClick={startNewGame}>
                  Jogar de novo
                </button>
              )}

              <ol className="score-list">
                {highScores.length ? (
                  highScores.map((entry, index) => (
                    <li key={`${entry.createdAt}-${entry.name}`}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{entry.name}</strong>
                      <em>{entry.score}</em>
                    </li>
                  ))
                ) : (
                  <li className="empty-score">
                    <strong>NENHUM SCORE AINDA</strong>
                    <em>{score}</em>
                  </li>
                )}
              </ol>
              <button className="clear-scores" type="button" onClick={clearHighScores}>
                Limpar ranking local
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="bottombar" aria-label="Controles e alvo">
        <div>
          <strong>Chefe atual</strong>
          <span>{boss}</span>
        </div>
        <div>
          <strong>Controles</strong>
          <span>WASD ou setas para mover, espaco para rajada, Esc pausa. Ao final, salve seu nome no HIGH SCORES.</span>
        </div>
      </section>
    </main>
  );
}
