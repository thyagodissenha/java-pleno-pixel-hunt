"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Actor = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  speed: number;
  size: number;
  kind: EnemyKind;
  label: string;
  cooldown?: number;
  phase?: number;
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
type MenuPanel = "home" | "scores" | "help";
type EnemyKind = "user" | "boss" | "data" | "qa" | "vip" | "incident" | "legacy";
type PowerUpKind = "coffee" | "refactor" | "rollback" | "hotfix" | "review";
type SoundName = "shoot" | "hit" | "hurt" | "boss" | "over" | "save" | "start" | "won";
type Tone = [number, number, OscillatorType];
type HighScore = {
  name: string;
  score: number;
  wave: number;
  outcome: "over" | "won";
  createdAt: string;
};

type PowerUp = {
  x: number;
  y: number;
  kind: PowerUpKind;
  ttl: number;
  pulse: number;
};

const WORLD = { width: 960, height: 540 };
const HIGH_SCORE_KEY = "java-pleno-pixel-hunt-high-scores";
const SOUND_KEY = "java-pleno-pixel-hunt-sound";
const bossNames = [
  "Gerente de Sprint",
  "Dono do Roadmap",
  "Arquiteto das Reunioes",
  "Diretor do Go-Live",
];
const cloudLabels = ["Azure", "SQL", "Blob", "CI/CD", "Kafka", "BI"];
const enemyLabels: Record<Exclude<EnemyKind, "boss" | "data">, string> = {
  user: "Usuario",
  qa: "QA nervoso",
  vip: "Usuario VIP",
  incident: "Incidente P1",
  legacy: "Legado",
};
const powerUpLabels: Record<PowerUpKind, string> = {
  coffee: "Cafe",
  refactor: "Refactor",
  rollback: "Rollback",
  hotfix: "Hotfix",
  review: "Code Review",
};
const biomeNames = ["Escritorio", "Producao", "Cloud", "War Room"];

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

function loadSoundSettings() {
  if (typeof window === "undefined") return { muted: false, volume: 0.35 };
  try {
    const stored = window.localStorage.getItem(SOUND_KEY);
    if (!stored) return { muted: false, volume: 0.35 };
    const parsed = JSON.parse(stored) as { muted?: boolean; volume?: number };
    return {
      muted: Boolean(parsed.muted),
      volume: clamp(Number(parsed.volume) || 0.35, 0, 1),
    };
  } catch {
    return { muted: false, volume: 0.35 };
  }
}

export default function Home() {
  const [initialSound] = useState(() => loadSoundSettings());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keys = useRef(new Set<string>());
  const pointer = useRef({ active: false, x: WORLD.width / 2, y: WORLD.height / 2 });
  const stateRef = useRef<GameState>("menu");
  const menuPanelRef = useRef<MenuPanel>("home");
  const menuIndexRef = useRef(0);
  const startGameRef = useRef<() => void>(() => undefined);
  const audioRef = useRef<AudioContext | null>(null);
  const musicTimerRef = useRef<number | null>(null);
  const musicStepRef = useRef(0);
  const mutedRef = useRef(initialSound.muted);
  const volumeRef = useRef(initialSound.volume);
  const lastSoundRef = useRef<Record<SoundName, number>>({
    shoot: 0,
    hit: 0,
    hurt: 0,
    boss: 0,
    over: 0,
    save: 0,
    start: 0,
    won: 0,
  });
  const [gameState, setGameState] = useState<GameState>("menu");
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [hp, setHp] = useState(100);
  const [boss, setBoss] = useState("Gerente de Sprint");
  const [highScores, setHighScores] = useState<HighScore[]>(() => loadHighScores());
  const [playerName, setPlayerName] = useState("");
  const [scoreSaved, setScoreSaved] = useState(true);
  const [scoreMessage, setScoreMessage] = useState("Ranking global carregando...");
  const [lastOutcome, setLastOutcome] = useState<"over" | "won">("over");
  const [menuPanel, setMenuPanel] = useState<MenuPanel>("home");
  const [menuIndex, setMenuIndex] = useState(0);
  const [muted, setMuted] = useState(initialSound.muted);
  const [volume, setVolume] = useState(initialSound.volume);
  const [biome, setBiome] = useState(biomeNames[0]);
  const [upgrade, setUpgrade] = useState("JDK 8");

  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    menuPanelRef.current = menuPanel;
  }, [menuPanel]);

  useEffect(() => {
    menuIndexRef.current = menuIndex;
  }, [menuIndex]);

  const getAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    const audio = audioRef.current ?? new AudioContextClass();
    audioRef.current = audio;
    if (audio.state === "suspended") void audio.resume();
    return audio;
  }, []);

  const playTone = useCallback(([frequency, duration, type]: Tone, volumeScale = 0.16, delay = 0) => {
    if (mutedRef.current || volumeRef.current <= 0) return;
    const audio = getAudioContext();
    if (!audio) return;
    const gain = audio.createGain();
    gain.connect(audio.destination);
    const start = audio.currentTime + delay;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volumeRef.current * volumeScale, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    const oscillator = audio.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.connect(gain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }, [getAudioContext]);

  const playSound = useCallback((sound: SoundName) => {
    if (mutedRef.current || volumeRef.current <= 0) return;
    const now = performance.now();
    const minGap = sound === "shoot" ? 70 : sound === "hit" ? 45 : 120;
    if (now - lastSoundRef.current[sound] < minGap) return;
    lastSoundRef.current[sound] = now;

    const notes: Record<SoundName, Tone[]> = {
      shoot: [[720, 0.055, "square"], [480, 0.05, "square"]],
      hit: [[210, 0.08, "sawtooth"]],
      hurt: [[140, 0.18, "sawtooth"], [90, 0.16, "square"]],
      boss: [[196, 0.16, "square"], [147, 0.18, "square"], [110, 0.22, "square"]],
      over: [[110, 0.18, "sawtooth"], [82, 0.28, "sawtooth"]],
      save: [[523, 0.08, "square"], [659, 0.08, "square"], [784, 0.12, "square"]],
      start: [[330, 0.07, "square"], [494, 0.09, "square"], [660, 0.12, "square"]],
      won: [[523, 0.1, "square"], [659, 0.1, "square"], [784, 0.1, "square"], [1047, 0.16, "square"]],
    };

    let offset = 0;
    for (const note of notes[sound]) {
      playTone(note, 0.16, offset);
      const [, duration] = note;
      offset += duration * 0.72;
    }
  }, [playTone]);

  const stopMusic = useCallback(() => {
    if (musicTimerRef.current !== null) {
      window.clearInterval(musicTimerRef.current);
      musicTimerRef.current = null;
    }
  }, []);

  const startMusic = useCallback(() => {
    if (musicTimerRef.current !== null || mutedRef.current || volumeRef.current <= 0) return;
    const bass = [110, 110, 147, 110, 165, 147, 196, 147];
    const lead = [440, 494, 523, 494, 659, 587, 523, 494, 392, 440, 494, 523, 587, 659, 784, 659];
    musicTimerRef.current = window.setInterval(() => {
      if (stateRef.current !== "playing" || mutedRef.current || volumeRef.current <= 0) {
        stopMusic();
        return;
      }
      const step = musicStepRef.current;
      playTone([bass[step % bass.length], 0.105, "square"], 0.032);
      if (step % 2 === 0) playTone([lead[step % lead.length], 0.08, "triangle"], 0.026, 0.035);
      musicStepRef.current += 1;
    }, 170);
  }, [playTone, stopMusic]);

  useEffect(() => {
    refreshHighScores();
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
    volumeRef.current = volume;
    window.localStorage.setItem(SOUND_KEY, JSON.stringify({ muted, volume }));
    if (muted || volume <= 0) stopMusic();
    else if (stateRef.current === "playing") startMusic();
  }, [muted, startMusic, stopMusic, volume]);

  useEffect(() => {
    if (gameState === "playing") startMusic();
    else stopMusic();
  }, [gameState, startMusic, stopMusic]);

  function refreshHighScores() {
    setScoreMessage("Ranking global carregando...");
    return fetch("/api/scores", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: unknown) => {
        const data = payload as { scores?: HighScore[] };
        const scores = data.scores ?? [];
        setHighScores(scores);
        saveHighScores(scores);
        setScoreMessage("Ranking global");
      })
      .catch(() => {
        setScoreMessage("Ranking local offline");
      });
  }

  function startNewGame() {
    setScoreSaved(true);
    setPlayerName("");
    setMenuPanel("home");
    playSound("start");
    startGameRef.current();
  }

  const activateMenuOption = useCallback((index: number) => {
    setMenuIndex(index);
    if (index === 0) startNewGame();
    else if (index === 1) {
      setMenuPanel("scores");
      refreshHighScores();
    } else {
      setMenuPanel("help");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitScore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = playerName.trim().replace(/\s+/g, " ").slice(0, 14) || "DEV ANON";
    const entry = {
      name: cleanName.toUpperCase(),
      score,
      wave,
      outcome: lastOutcome,
      createdAt: new Date().toISOString(),
    };

    setScoreMessage("Salvando score...");
    try {
      const response = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      if (!response.ok) throw new Error("Score API failed");
      const payload = (await response.json()) as { scores: HighScore[] };
      setHighScores(payload.scores);
      saveHighScores(payload.scores);
      setScoreMessage("Ranking global atualizado");
      playSound("save");
      setScoreSaved(true);
    } catch {
      const nextScores = [entry, ...highScores]
        .sort((a, b) => b.score - a.score || b.wave - a.wave)
        .slice(0, 10);
      saveHighScores(nextScores);
      setHighScores(nextScores);
      setScoreMessage("Ranking local salvo. Global indisponivel.");
      playSound("save");
      setScoreSaved(true);
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (!ctx) return;

    let frame = 0;
    let visualFrame = 0;
    let raf = 0;
    let last = performance.now();
    let localScore = 0;
    let localWave = 1;
    let spawnTimer = 0;
    let dataTimer = 140;
    let powerUpTimer = 9;
    let shotTimer = 0;
    let bossIndex = 0;
    let weaponLevel = 1;
    let damageFlash = 0;
    let shake = 0;
    let bossBanner = 0;
    let effectMessage = "";
    let effectBanner = 0;

    const player = {
      x: WORLD.width / 2,
      y: WORLD.height / 2,
      hp: 100,
      maxHp: 100,
      size: 24,
      speed: 210,
      invincible: 0,
      fury: 0,
      focus: 0,
      haste: 0,
    };

    const enemies: Actor[] = [];
    const shots: Shot[] = [];
    const particles: Particle[] = [];
    const powerUps: PowerUp[] = [];

    function syncHud() {
      setScore(localScore);
      setWave(localWave);
      setHp(Math.max(0, Math.round(player.hp)));
      setBoss(bossNames[bossIndex] ?? "Comite Executivo");
      setBiome(biomeNames[Math.min(bossIndex, biomeNames.length - 1)] ?? "War Room");
      setUpgrade(weaponLevel >= 3 ? "JDK 21" : weaponLevel === 2 ? "JDK 17" : "JDK 8");
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

    function spawnEnemy(kind: EnemyKind) {
      const edge = Math.floor(Math.random() * 4);
      const margin = 36;
      const x = edge === 0 ? -margin : edge === 1 ? WORLD.width + margin : Math.random() * WORLD.width;
      const y = edge === 2 ? -margin : edge === 3 ? WORLD.height + margin : Math.random() * WORLD.height;
      const isBoss = kind === "boss";
      const isData = kind === "data";
      const wavePressure = Math.min(localWave - 1, 5);
      const stats: Record<EnemyKind, { hp: number; speed: number; size: number }> = {
        user: { hp: 28 + wavePressure * 2, speed: 68 + wavePressure * 5, size: 24 },
        qa: { hp: 22 + wavePressure * 2, speed: 96 + wavePressure * 7, size: 22 },
        vip: { hp: 58 + wavePressure * 5, speed: 54 + wavePressure * 3, size: 30 },
        incident: { hp: 20 + wavePressure * 3, speed: 122 + wavePressure * 8, size: 20 },
        legacy: { hp: 88 + wavePressure * 8, speed: 36 + wavePressure * 2, size: 34 },
        data: { hp: 16 + wavePressure, speed: 86 + wavePressure * 5, size: 22 },
        boss: { hp: 160 + localWave * 28, speed: 52 + wavePressure * 2, size: 38 },
      };
      const selected = stats[kind];
      enemies.push({
        x,
        y,
        vx: 0,
        vy: 0,
        hp: selected.hp,
        maxHp: selected.hp,
        speed: selected.speed,
        size: selected.size,
        kind,
        label: isBoss
          ? bossNames[bossIndex]
          : isData
            ? cloudLabels[Math.floor(Math.random() * cloudLabels.length)]
            : enemyLabels[kind],
        cooldown: isBoss ? 118 : 90,
        phase: Math.random() * Math.PI * 2,
      });
      if (isBoss) {
        bossBanner = 120;
        if (stateRef.current === "playing") playSound("boss");
      }
    }

    function spawnPowerUp() {
      const kinds: PowerUpKind[] = ["coffee", "refactor", "rollback", "hotfix", "review"];
      powerUps.push({
        x: 70 + Math.random() * (WORLD.width - 140),
        y: 70 + Math.random() * (WORLD.height - 140),
        kind: kinds[Math.floor(Math.random() * kinds.length)],
        ttl: 780,
        pulse: Math.random() * Math.PI * 2,
      });
    }

    function announceEffect(message: string) {
      effectMessage = message;
      effectBanner = 100;
    }

    function collectPowerUp(powerUp: PowerUp) {
      localScore += 35;
      if (powerUp.kind === "coffee") {
        player.haste = 6;
        announceEffect("CAFE: velocidade aumentada");
      } else if (powerUp.kind === "refactor") {
        player.fury = 6;
        announceEffect("REFACTOR: tiros acelerados");
      } else if (powerUp.kind === "rollback") {
        const removed = enemies.filter((enemy) => enemy.kind !== "boss" && distance(enemy, player) < 190);
        for (const enemy of removed) {
          const index = enemies.indexOf(enemy);
          if (index >= 0) enemies.splice(index, 1);
          localScore += enemy.kind === "data" ? 45 : 25;
          burst(enemy.x, enemy.y, "#7dd3fc", 10);
        }
        announceEffect("ROLLBACK: caos revertido");
      } else if (powerUp.kind === "hotfix") {
        player.hp = clamp(player.hp + 32, 0, player.maxHp);
        announceEffect("HOTFIX: vida recuperada");
      } else {
        player.focus = 7;
        player.invincible = Math.max(player.invincible, 2.4);
        announceEffect("CODE REVIEW: escudo ativo");
      }
      playSound("save");
      burst(powerUp.x, powerUp.y, "#facc15", 18);
      syncHud();
    }

    function resetGame() {
      localScore = 0;
      localWave = 1;
      spawnTimer = 0;
      dataTimer = 120;
      powerUpTimer = 7;
      shotTimer = 0;
      bossIndex = 0;
      weaponLevel = 1;
      damageFlash = 0;
      shake = 0;
      bossBanner = 120;
      effectMessage = "";
      effectBanner = 0;
      player.x = WORLD.width / 2;
      player.y = WORLD.height / 2;
      player.hp = player.maxHp;
      player.invincible = 0;
      player.fury = 0;
      player.focus = 0;
      player.haste = 0;
      enemies.length = 0;
      shots.length = 0;
      particles.length = 0;
      powerUps.length = 0;
      for (let i = 0; i < 5; i += 1) spawnEnemy("user");
      spawnEnemy("boss");
      syncHud();
    }

    function start() {
      resetGame();
      stateRef.current = "playing";
      setGameState("playing");
      startMusic();
    }
    startGameRef.current = start;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isTyping) return;

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "w", "a", "s", "d", "W", "A", "S", "D", "Enter", "Escape"].includes(event.key)) {
        event.preventDefault();
      }
      if (stateRef.current === "menu" && menuPanelRef.current === "home") {
        if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
          menuIndexRef.current = (menuIndexRef.current + 2) % 3;
          setMenuIndex(menuIndexRef.current);
          playSound("hit");
        } else if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
          menuIndexRef.current = (menuIndexRef.current + 1) % 3;
          setMenuIndex(menuIndexRef.current);
          playSound("hit");
        } else if (event.key === "Enter" || event.key === " ") {
          activateMenuOption(menuIndexRef.current);
        }
      } else if (event.key === "Enter" && stateRef.current === "menu") {
        activateMenuOption(0);
      } else if (event.key === "Escape" && stateRef.current === "menu" && menuPanelRef.current !== "home") {
        setMenuPanel("home");
      }
      if (event.key === "Escape" && stateRef.current === "playing") {
        stateRef.current = "paused";
        stopMusic();
        setGameState("paused");
      } else if (event.key === "Escape" && stateRef.current === "paused") {
        stateRef.current = "playing";
        setGameState("playing");
        startMusic();
      }
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
      if (stateRef.current === "paused") {
        stateRef.current = "playing";
        setGameState("playing");
        startMusic();
      }
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
      const lanes = weaponLevel >= 3 ? [-0.16, 0, 0.16] : weaponLevel === 2 ? [-0.1, 0.1] : [0];
      const shotSpeed = player.focus > 0 ? 500 : 430;
      for (const spread of lanes) {
        const angle = Math.atan2(aim.y, aim.x) + spread;
        shots.push({
          x: player.x + Math.cos(angle) * 20,
          y: player.y + Math.sin(angle) * 20,
          vx: Math.cos(angle) * shotSpeed,
          vy: Math.sin(angle) * shotSpeed,
          ttl: 78,
        });
      }
    }

    function update(delta: number) {
      if (stateRef.current !== "playing") return;
      frame += 1;
      spawnTimer -= delta;
      dataTimer -= delta;
      powerUpTimer -= delta;
      shotTimer -= delta;
      player.invincible = Math.max(0, player.invincible - delta);
      player.fury = Math.max(0, player.fury - delta);
      player.focus = Math.max(0, player.focus - delta);
      player.haste = Math.max(0, player.haste - delta);
      damageFlash = Math.max(0, damageFlash - delta * 60);
      shake = Math.max(0, shake - delta * 60);
      bossBanner = Math.max(0, bossBanner - delta * 60);
      effectBanner = Math.max(0, effectBanner - delta * 60);
      weaponLevel = localWave >= 4 ? 3 : localWave >= 2 ? 2 : 1;

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
        const currentSpeed = player.speed * (player.haste > 0 ? 1.34 : 1);
        player.x = clamp(player.x + move.x * currentSpeed * delta, 28, WORLD.width - 28);
        player.y = clamp(player.y + move.y * currentSpeed * delta, 36, WORLD.height - 28);
      }

      if (shotTimer <= 0 || keys.current.has(" ")) {
        shoot();
        playSound("shoot");
        shotTimer = player.fury > 0 ? 0.11 : weaponLevel >= 3 ? 0.2 : 0.24;
      }

      const usersAlive = enemies.filter((enemy) => enemy.kind === "user").length;
      const dataAlive = enemies.filter((enemy) => enemy.kind === "data").length;
      const specialAlive = enemies.filter((enemy) => ["qa", "vip", "incident", "legacy"].includes(enemy.kind)).length;
      const maxUsers = 7 + localWave * 2;
      const maxData = 3 + Math.ceil(localWave * 0.8);
      const maxSpecial = Math.min(2 + Math.floor(localWave / 2), 5);

      if (spawnTimer <= 0 && usersAlive < maxUsers) {
        spawnTimer = Math.max(0.58, 1.45 - localWave * 0.08);
        const specialPool: EnemyKind[] = [
          ...(localWave >= 2 ? ["qa" as const] : []),
          ...(localWave >= 3 ? ["vip" as const] : []),
          ...(localWave >= 4 ? ["incident" as const] : []),
          ...(localWave >= 5 ? ["legacy" as const] : []),
        ];
        if (specialPool.length && specialAlive < maxSpecial && Math.random() < 0.34) {
          spawnEnemy(specialPool[Math.floor(Math.random() * specialPool.length)]);
        } else {
          spawnEnemy("user");
        }
      }
      if (dataTimer <= 0 && dataAlive < maxData) {
        dataTimer = Math.max(1.55, 4.1 - localWave * 0.18);
        spawnEnemy("data");
      }
      if (powerUpTimer <= 0 && powerUps.length < 2) {
        powerUpTimer = 11 + Math.random() * 8;
        spawnPowerUp();
      }

      for (const enemy of enemies) {
        const toward = normalize(player.x - enemy.x, player.y - enemy.y);
        if (enemy.kind === "data") {
          enemy.vx = toward.x * enemy.speed * 1.5;
          enemy.vy = toward.y * enemy.speed * 1.5;
        } else if (enemy.kind === "qa") {
          const strafe = Math.sin(frame / 10 + (enemy.phase ?? 0)) * 85;
          enemy.vx = toward.x * enemy.speed - toward.y * strafe;
          enemy.vy = toward.y * enemy.speed + toward.x * strafe;
        } else if (enemy.kind === "vip") {
          enemy.vx = toward.x * enemy.speed * 0.84;
          enemy.vy = toward.y * enemy.speed * 0.84;
        } else if (enemy.kind === "incident") {
          const pulse = Math.sin(frame / 14 + (enemy.phase ?? 0)) > 0.25 ? 1.55 : 0.72;
          enemy.vx = toward.x * enemy.speed * pulse;
          enemy.vy = toward.y * enemy.speed * pulse;
        } else if (enemy.kind === "legacy") {
          enemy.vx = toward.x * enemy.speed + Math.sin(frame / 42 + (enemy.phase ?? 0)) * 8;
          enemy.vy = toward.y * enemy.speed + Math.cos(frame / 48 + (enemy.phase ?? 0)) * 8;
        } else {
          enemy.vx = toward.x * enemy.speed + Math.sin((frame + enemy.x) / 23) * 16;
          enemy.vy = toward.y * enemy.speed + Math.cos((frame + enemy.y) / 29) * 16;
        }
        enemy.x += enemy.vx * delta;
        enemy.y += enemy.vy * delta;
        if (enemy.kind === "boss") {
          enemy.cooldown = (enemy.cooldown ?? 0) - delta * 60;
          if (enemy.cooldown <= 0) {
            enemy.cooldown = Math.max(64, 104 - localWave * 4);
            const pattern = bossIndex % 4;
            const volleySize = pattern === 1 ? 8 : pattern === 3 ? 5 : localWave >= 3 ? 3 : 2;
            for (let i = 0; i < volleySize; i += 1) {
              const aimed = Math.atan2(player.y - enemy.y, player.x - enemy.x);
              const base = pattern === 1
                ? (Math.PI * 2 * i) / volleySize
                : pattern === 3
                  ? aimed + (i - 2) * 0.24
                  : aimed + (i - 1) * 0.34;
              enemies.push({
                x: enemy.x + Math.cos(base) * 30,
                y: enemy.y + Math.sin(base) * 30,
                vx: 0,
                vy: 0,
                hp: pattern === 2 ? 24 : 16,
                maxHp: pattern === 2 ? 24 : 16,
                speed: pattern === 3 ? 126 : 96 + Math.min(localWave, 5) * 4,
                size: pattern === 2 ? 22 : 18,
                kind: pattern === 2 ? "qa" : pattern === 3 ? "incident" : "data",
                label: pattern === 2 ? "QA" : pattern === 3 ? "P1" : "Deploy",
                phase: Math.random() * Math.PI * 2,
              });
            }
          }
        }
      }

      for (let i = powerUps.length - 1; i >= 0; i -= 1) {
        const powerUp = powerUps[i];
        powerUp.ttl -= delta * 60;
        powerUp.pulse += delta * 8;
        if (distance(powerUp, player) < player.size * 0.55 + 16) {
          collectPowerUp(powerUp);
          powerUps.splice(i, 1);
        } else if (powerUp.ttl <= 0) {
          powerUps.splice(i, 1);
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
            const damage = enemy.kind === "boss"
              ? 18
              : enemy.kind === "data"
                ? 13
                : enemy.kind === "vip" || enemy.kind === "legacy"
                  ? 12
                  : enemy.kind === "incident"
                    ? 15
                    : 8;
            player.hp -= damage;
            player.invincible = 0.92;
            damageFlash = 16;
            shake = 14;
            playSound("hurt");
            burst(player.x, player.y, "#ff5353", 16);
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
            const damage = player.fury > 0 ? 26 : player.focus > 0 ? 23 : 18;
            enemy.hp -= damage;
            shots.splice(s, 1);
            playSound("hit");
            burst(shot.x, shot.y, enemy.kind === "boss" ? "#f9c74f" : "#65d6ad", 4);
            if (enemy.hp <= 0) {
              localScore += enemy.kind === "boss"
                ? 500
                : enemy.kind === "data"
                  ? 80
                  : enemy.kind === "vip" || enemy.kind === "legacy"
                    ? 95
                    : enemy.kind === "incident"
                      ? 70
                      : enemy.kind === "qa"
                        ? 60
                        : 45;
              if (enemy.kind === "boss") {
                player.fury = 5;
                player.hp = clamp(player.hp + 22, 0, player.maxHp);
                bossIndex += 1;
                localWave += 1;
                burst(enemy.x, enemy.y, "#ffd166", 28);
                if (bossIndex >= bossNames.length) {
                  syncHud();
                  setScore(localScore);
                  setWave(localWave);
                  setLastOutcome("won");
                  setScoreSaved(false);
                  playSound("won");
                  stopMusic();
                  stateRef.current = "won";
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
        playSound("over");
        stopMusic();
        stateRef.current = "over";
        setGameState("over");
      }
      if (frame % 18 === 0) syncHud();
    }

    function drawActor(actor: Actor) {
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
      } else {
        pixelRect(ctx, x + 6, y, actor.size - 12, 8, "#f9a8d4");
        pixelRect(ctx, x + 3, y + 8, actor.size - 6, actor.size - 8, "#ec4899");
        pixelRect(ctx, x + 7, y + 14, 4, 4, "#111827");
        pixelRect(ctx, x + actor.size - 11, y + 14, 4, 4, "#111827");
      }
      if (actor.kind !== "user") {
        pixelRect(ctx, actor.x - actor.label.length * 3.1, actor.y - actor.size / 2 - 19, actor.label.length * 6.2, 14, "rgba(2, 6, 23, 0.72)");
        ctx.fillStyle = "#f8fafc";
        ctx.font = "10px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.fillText(actor.label, actor.x, actor.y - actor.size / 2 - 8);
      }
      const bar = actor.size;
      pixelRect(ctx, actor.x - bar / 2, actor.y + actor.size / 2 + 5, bar, 4, "#111827");
      pixelRect(ctx, actor.x - bar / 2, actor.y + actor.size / 2 + 5, bar * (actor.hp / actor.maxHp), 4, "#84cc16");
    }

    function drawPowerUp(powerUp: PowerUp) {
      const bob = Math.sin(powerUp.pulse) * 3;
      const x = powerUp.x - 13;
      const y = powerUp.y - 13 + bob;
      const ring = 20 + Math.sin(powerUp.pulse) * 4;
      const color: Record<PowerUpKind, string> = {
        coffee: "#a16207",
        refactor: "#14b8a6",
        rollback: "#38bdf8",
        hotfix: "#ef4444",
        review: "#a855f7",
      };
      ctx.strokeStyle = color[powerUp.kind];
      ctx.lineWidth = 2;
      ctx.strokeRect(Math.round(powerUp.x - ring / 2), Math.round(powerUp.y - ring / 2 + bob), Math.round(ring), Math.round(ring));
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
      } else {
        pixelRect(ctx, x + 7, y + 8, 12, 4, "#faf5ff");
        pixelRect(ctx, x + 7, y + 14, 8, 4, "#faf5ff");
      }
      ctx.fillStyle = "#f8fafc";
      ctx.font = "10px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText(powerUpLabels[powerUp.kind], powerUp.x, y - 7);
    }

    function drawPlayer() {
      const blink = player.invincible > 0 && Math.floor(frame / 4) % 2 === 0;
      const run = Math.floor(visualFrame / 8) % 2;
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
      pixelRect(ctx, x + 6, y, 12, 7, blink ? "#fee2e2" : "#f5d0a9");
      pixelRect(ctx, x + 5, y - 3, 14, 4, "#78350f");
      pixelRect(ctx, x + 4, y + 7, 16, 13, player.fury > 0 ? "#f97316" : "#0ea5e9");
      pixelRect(ctx, x + 1, y + 10, 6, 5, "#78350f");
      pixelRect(ctx, x + 17, y + 10, 8, 5, "#78350f");
      pixelRect(ctx, x + 2, y + 20 + run, 7, 5, "#111827");
      pixelRect(ctx, x + 15, y + 21 - run, 7, 5, "#111827");
      pixelRect(ctx, x + 8, y + 9, 3, 3, "#111827");
      pixelRect(ctx, x + 14, y + 9, 3, 3, "#111827");
      pixelRect(ctx, x + 7, y + 15, 10, 3, "#fef3c7");
      pixelRect(ctx, x + 20, y + 6, 16, 7, "#facc15");
      pixelRect(ctx, x + 34, y + 8, 7, 3, "#fde68a");
      if (shotTimer < 0.06) pixelRect(ctx, x + 40, y + 7, 10, 5, "#f97316");
      ctx.fillStyle = "#f8fafc";
      ctx.font = "10px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText("Java Pleno", player.x, player.y - 20);
    }

    function drawGrid() {
      const theme = Math.min(bossIndex, biomeNames.length - 1);
      const floor = ["#101827", "#1b1620", "#071a2f", "#211414"][theme] ?? "#101827";
      const tile = ["#132033", "#261b2c", "#0d2745", "#321b1b"][theme] ?? "#132033";
      const accent = ["#38bdf8", "#fb7185", "#60a5fa", "#facc15"][theme] ?? "#38bdf8";
      ctx.fillStyle = floor;
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
      for (let x = 0; x < WORLD.width; x += 32) {
        for (let y = 0; y < WORLD.height; y += 32) {
          if ((x / 32 + y / 32) % 2 === 0) {
            ctx.fillStyle = tile;
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
      pixelRect(ctx, 64, 64, 144, 4, accent);
      pixelRect(ctx, WORLD.width - 216, WORLD.height - 90, 160, 30, "#1f2937");
      pixelRect(ctx, WORLD.width - 208, WORLD.height - 82, 144, 4, "#fb7185");
      ctx.fillStyle = "#f8fafc";
      ctx.font = "12px 'Courier New', monospace";
      ctx.textAlign = "left";
      ctx.fillText(biomeNames[theme], 62, 48);
    }

    function drawDim() {
      ctx.fillStyle = "rgba(8, 13, 24, 0.76)";
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    }

    function drawOverlay(title: string, text: string) {
      drawDim();
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

    function drawVictoryOverlay() {
      ctx.fillStyle = "rgba(5, 10, 22, 0.82)";
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
      for (let i = 0; i < 46; i += 1) {
        const x = (i * 73 + visualFrame * (1 + (i % 4))) % WORLD.width;
        const y = (i * 41 + visualFrame * (2 + (i % 3))) % WORLD.height;
        const colors = ["#facc15", "#38bdf8", "#fb7185", "#22c55e", "#a855f7"];
        pixelRect(ctx, x, y, 6, 10, colors[i % colors.length]);
      }
      const cx = WORLD.width / 2;
      pixelRect(ctx, cx - 50, 126, 100, 76, "#facc15");
      pixelRect(ctx, cx - 34, 110, 68, 24, "#fde68a");
      pixelRect(ctx, cx - 70, 138, 22, 42, "#ca8a04");
      pixelRect(ctx, cx + 48, 138, 22, 42, "#ca8a04");
      pixelRect(ctx, cx - 14, 202, 28, 34, "#ca8a04");
      pixelRect(ctx, cx - 42, 236, 84, 16, "#92400e");
      ctx.fillStyle = "#facc15";
      ctx.font = "bold 44px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText("GO-LIVE DOMINADO", cx, 306);
      ctx.fillStyle = "#bfdbfe";
      ctx.font = "18px 'Courier New', monospace";
      ctx.fillText(`Voce limpou a firma com ${localScore} pontos`, cx, 342);
      ctx.fillStyle = "#fde68a";
      ctx.font = "14px 'Courier New', monospace";
      ctx.fillText("Salve seu nome no HIGH SCORES", cx, 378);
    }

    function draw() {
      const shakeX = shake > 0 ? (Math.random() - 0.5) * shake : 0;
      const shakeY = shake > 0 ? (Math.random() - 0.5) * shake : 0;
      ctx.save();
      ctx.translate(shakeX, shakeY);
      drawGrid();
      for (const particle of particles) {
        const size = Math.max(2, Math.min(8, particle.ttl / 6));
        pixelRect(ctx, particle.x, particle.y, size, size, particle.color);
      }
      for (const shot of shots) {
        pixelRect(ctx, shot.x - shot.vx * 0.018 - 4, shot.y - shot.vy * 0.018 - 2, 8, 4, "#fde68a");
        pixelRect(ctx, shot.x - 5, shot.y - 3, 10, 6, "#facc15");
        pixelRect(ctx, shot.x + 3, shot.y - 1, 4, 2, "#fef9c3");
      }
      powerUps.forEach(drawPowerUp);
      enemies.sort((a, b) => a.y - b.y).forEach(drawActor);
      drawPlayer();
      ctx.restore();

      if (damageFlash > 0) {
        ctx.fillStyle = `rgba(239, 68, 68, ${Math.min(0.32, damageFlash / 55)})`;
        ctx.fillRect(0, 0, WORLD.width, WORLD.height);
      }

      if (bossBanner > 0 && stateRef.current === "playing") {
        ctx.fillStyle = "rgba(2, 6, 23, 0.76)";
        ctx.fillRect(0, 26, WORLD.width, 58);
        ctx.fillStyle = "#facc15";
        ctx.font = "bold 28px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.fillText("CHEFE ENTROU NA CALL", WORLD.width / 2, 64);
      }

      if (effectBanner > 0 && stateRef.current === "playing") {
        ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
        ctx.fillRect(WORLD.width / 2 - 230, WORLD.height - 72, 460, 34);
        ctx.fillStyle = "#7dd3fc";
        ctx.font = "bold 17px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.fillText(effectMessage, WORLD.width / 2, WORLD.height - 50);
      }

      if (stateRef.current === "menu" && menuPanelRef.current !== "home") {
        drawDim();
      } else if (stateRef.current === "paused") {
        drawOverlay("PAUSADO", "Respira. A daily espera.");
      } else if (stateRef.current === "over") {
        drawOverlay("PRODUCAO CAIU", `Pontuacao final: ${localScore}`);
      } else if (stateRef.current === "won") {
        drawVictoryOverlay();
      }
    }

    function tick(now: number) {
      const delta = Math.min(0.033, (now - last) / 1000);
      last = now;
      visualFrame += 1;
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
      stopMusic();
    };
  }, [activateMenuOption, playSound, startMusic, stopMusic]);

  const status = gameState === "playing" ? "Em combate" : gameState === "paused" ? "Pausado" : gameState === "won" ? "Vitoria" : gameState === "over" ? "Fim de jogo" : "Pronto";
  const finalScreen = gameState === "over" || gameState === "won";
  const menuScreen = gameState === "menu";

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
          <div className="sound-controls" aria-label="Controles de som">
            <button
              type="button"
              aria-pressed={muted}
              aria-label={muted ? "Ativar som" : "Mutar som"}
              onClick={() => setMuted((current) => !current)}
            >
              {muted ? "Som off" : "Som on"}
            </button>
            <label>
              <span>Volume</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(event) => {
                  const nextVolume = Number(event.target.value);
                  setVolume(nextVolume);
                  setMuted(nextVolume <= 0);
                }}
              />
            </label>
          </div>
        </div>
      </section>

      <section className="game-stage" aria-label="Arena do jogo">
        <div className="canvas-frame">
        <canvas ref={canvasRef} width={WORLD.width} height={WORLD.height} aria-label="Arena pixel art" />
        {menuScreen && (
          <div className={`menu-overlay ${menuPanel === "home" ? "menu-overlay-full" : ""}`} role="dialog" aria-label="Menu inicial">
            <div className={`menu-panel ${menuPanel === "home" ? "title-menu-panel" : ""}`}>
              <p className="menu-kicker">Build instavel detectada</p>

              {menuPanel === "home" && (
                <>
                  <div className="retro-title-screen" aria-label="Tela inicial pixel art do Java Pleno Pixel Hunt">
                    <div className="retro-scene hero-scene" aria-hidden="true">
                      <div className="pixel-dev">
                        <span className="hair" />
                        <span className="head" />
                        <span className="body" />
                        <span className="arm mug" />
                        <span className="arm keyboard" />
                        <span className="leg left" />
                        <span className="leg right" />
                      </div>
                      <span className="java-mug">JAVA</span>
                      <span className="code-shot" />
                    </div>

                    <div className="retro-scene call-scene" aria-hidden="true">
                      <span className="window-title">MEETING CALL</span>
                      <span className="boss-face" />
                      <span className="speech">PRA ONTEM!</span>
                    </div>

                    <div className="retro-logo" aria-label="Java Pleno Pixel Hunt">
                      <span>Java</span>
                      <span>Pleno</span>
                      <span>Pixel Hunt</span>
                    </div>

                    <div className="retro-scene users-scene" aria-hidden="true">
                      <span className="speech">USUARIOS!</span>
                      <span className="user u1" />
                      <span className="user u2" />
                      <span className="user u3" />
                    </div>

                    <div className="retro-scene cloud-scene" aria-hidden="true">
                      <span className="cloud" />
                      <span className="cube c1" />
                      <span className="cube c2" />
                      <span className="binary">101<br />010</span>
                    </div>

                    <div className="retro-scene deploy-scene" aria-hidden="true">
                      <span className="terminal">$ deploy --prod<br />tests...<br />success!</span>
                      <span className="rocket">DEPLOY</span>
                    </div>

                    <div className="retro-scene incident-scene" aria-hidden="true">
                      <span className="incident-title">PROD INCIDENT</span>
                      <span className="explosion" />
                      <span className="alert-sign">!</span>
                    </div>

                    <div className="title-menu-actions" role="menu" aria-label="Opcoes do jogo (use as setas e Enter)">
                      <button
                        type="button"
                        role="menuitem"
                        aria-current={menuIndex === 0}
                        className={menuIndex === 0 ? "active" : undefined}
                        onMouseEnter={() => setMenuIndex(0)}
                        onClick={() => activateMenuOption(0)}
                      >
                        {menuIndex === 0 ? "▶ " : ""}Jogar
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        aria-current={menuIndex === 1}
                        className={menuIndex === 1 ? "active" : undefined}
                        onMouseEnter={() => setMenuIndex(1)}
                        onClick={() => activateMenuOption(1)}
                      >
                        {menuIndex === 1 ? "▶ " : ""}High Scores
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        aria-current={menuIndex === 2}
                        className={menuIndex === 2 ? "active" : undefined}
                        onMouseEnter={() => setMenuIndex(2)}
                        onClick={() => activateMenuOption(2)}
                      >
                        {menuIndex === 2 ? "▶ " : ""}Como Jogar
                      </button>
                    </div>
                  </div>
                  <p className="menu-copy">
                    Sobreviva aos usuarios, derrote os chefes e tente entrar no ranking global antes que alguem peca um deploy em sexta-feira.
                  </p>
                </>
              )}

              {menuPanel === "scores" && (
                <>
                  <h2>High Scores</h2>
                  <p className="score-mode">{scoreMessage}</p>
                  <ol className="score-list menu-score-list">
                    {highScores.length ? (
                      highScores.map((entry, index) => (
                        <li key={`${entry.createdAt}-${entry.name}`}>
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <strong>{entry.name}</strong>
                          <em>{entry.score}<small>Onda {entry.wave}</small></em>
                        </li>
                      ))
                    ) : (
                      <li className="empty-score">
                        <strong>NENHUM SCORE AINDA</strong>
                        <em>0</em>
                      </li>
                    )}
                  </ol>
                  <div className="menu-actions two">
                    <button type="button" onClick={startNewGame}>Jogar</button>
                    <button type="button" onClick={() => setMenuPanel("home")}>Voltar</button>
                  </div>
                </>
              )}

              {menuPanel === "help" && (
                <>
                  <h2>Como jogar</h2>
                  <ul className="help-list">
                    <li><strong>Mover</strong><span>WASD, setas ou arraste no celular.</span></li>
                    <li><strong>Atirar</strong><span>Automatico no inimigo mais proximo.</span></li>
                    <li><strong>Rajada</strong><span>Espaco acelera os tiros.</span></li>
                    <li><strong>Power-ups</strong><span>Cafe, Refactor, Rollback, Hotfix e Code Review ajudam na partida.</span></li>
                    <li><strong>Objetivo</strong><span>Sobreviva, derrube chefes e salve seu score.</span></li>
                  </ul>
                  <div className="menu-actions two">
                    <button type="button" onClick={startNewGame}>Jogar</button>
                    <button type="button" onClick={() => setMenuPanel("home")}>Voltar</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {finalScreen && (
          <div className="score-overlay" role="dialog" aria-modal="true" aria-label="Ranking de maiores pontuacoes">
            <div className="score-panel">
              <p className="score-kicker">{gameState === "won" ? "Missao completa" : "Producao caiu"}</p>
              <h2>HIGH SCORES</h2>
              <p className="score-mode">{scoreMessage}</p>
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
                      <em>{entry.score}<small>Onda {entry.wave}</small></em>
                    </li>
                  ))
                ) : (
                  <li className="empty-score">
                    <strong>NENHUM SCORE AINDA</strong>
                    <em>{score}</em>
                  </li>
                )}
              </ol>
            </div>
          </div>
        )}
        </div>
      </section>

      <section className="bottombar" aria-label="Controles e alvo">
        <div>
          <strong>Chefe atual</strong>
          <span>{boss} · {biome}</span>
        </div>
        <div>
          <strong>Arma e controles</strong>
          <span>{upgrade} · WASD ou setas para mover, espaco para rajada, Esc pausa. Colete power-ups e salve seu nome no HIGH SCORES.</span>
        </div>
      </section>
    </main>
  );
}
