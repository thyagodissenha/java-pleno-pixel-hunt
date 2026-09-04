"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  createDebugKeyHandler,
  DEBUG_ACTION_EVENT,
  isDebugAction,
  isDebugAllowed,
} from "@/lib/debug";
import { getAdsenseBannerSlotId, getPublicAdsenseClientId } from "@/lib/adsense";
import { circleIntersectsRect, obstacleCount, pointInRect } from "@/lib/obstacles";
import {
  type HighScore,
  type PendingScoreEntry,
  enqueuePendingScore,
  isPersistedScoreResponse,
  loadHighScores,
  loadPendingScores,
  mergeHighScores,
  postPendingScore,
  removePendingScore,
  saveHighScores,
  updatePendingScoreAttempt,
  waitForNextScorePost,
} from "@/lib/score-sync";
import { appendCheatBuffer, matchCheatCode } from "@/lib/cheat-codes";
import { useThemePreference } from "@/lib/theme/use-theme-preference";
import { drawCharacterBody, pixelRect } from "@/lib/character-sprite";
import type { GameState, HudProps, MenuPanel } from "@/app/_hud/hud-props";
import { ClassicHud } from "@/app/_hud/classic/ClassicHud";
import { NeonHud } from "@/app/_hud/neon/NeonHud";
import { isOpeningCutscenePlaying } from "@/app/_hud/cutscene/OpeningCutscene";
import {
  CHARACTERS,
  DEFAULT_CHARACTER_ID,
  resolveCharacter,
  resolveDashDirection,
  selectEnemiesToClear,
} from "@/lib/characters";

const adsenseClientId = getPublicAdsenseClientId();
const adsenseBannerSlotId = getAdsenseBannerSlotId();

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
  bossPhase?: number;
  bossState?: "idle" | "tele" | "atk";
  bossStateTimer?: number;
  bossAtkPattern?: number;
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

// Perigos da fase secreta ("O Mainframe") que não se encaixam no vocabulário
// normal de Actor/Obstacle do motor: projéteis reais do chefe (não são
// minions perseguidores), o "cobol snake" que atravessa a arena e as zonas
// de "reunião" que reduzem a velocidade do jogador.
type SecretBossShot = { x: number; y: number; vx: number; vy: number };
type MeetingZone = { x: number; y: number; base: number; r: number; ph: number };
type CobolSnake = {
  active: boolean;
  cd: number;
  t: number;
  dir: number;
  y0: number;
  x: number;
  y: number;
  hist: Array<{ x: number; y: number }>;
};

type RunOrigin = "normal" | "debug" | "secret";
type EnemyKind = "user" | "boss" | "data" | "qa" | "vip" | "incident" | "legacy" | "secretBoss" | "daemon" | "cron";
type ObstacleKind = "desk" | "server" | "firewall" | "board" | "rack" | "crt" | "chair" | "fern" | "shroom";
type PowerUpKind =
  | "coffee"
  | "refactor"
  | "rollback"
  | "hotfix"
  | "review"
  | "stamina"
  | "promotion"
  | "call";
type SoundName = "shoot" | "hit" | "hurt" | "boss" | "over" | "save" | "start" | "won";
type Tone = [number, number, OscillatorType];
type PowerUp = {
  x: number;
  y: number;
  kind: PowerUpKind;
  ttl: number;
  pulse: number;
};

type Obstacle = {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: ObstacleKind;
  label: string;
};

const WORLD = { width: 960, height: 540 };
const SOUND_KEY = "java-pleno-pixel-hunt-sound";
const bossNames = [
  "Gerente de Sprint",
  "Dono do Roadmap",
  "Arquiteto das Reuniões",
  "Diretor do Go-Live",
];
const cloudLabels = ["Azure", "SQL", "Blob", "CI/CD", "Kafka", "BI"];
const enemyLabels: Record<Exclude<EnemyKind, "boss" | "data" | "secretBoss" | "daemon" | "cron">, string> = {
  user: "Usuário",
  qa: "QA nervoso",
  vip: "Usuário VIP",
  incident: "Incidente P1",
  legacy: "Legado",
};
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
const biomeNames = ["Escritório", "Produção", "Cloud", "War Room"];
const BURST_STAMINA_MAX = 100;
const BURST_STAMINA_RECHARGE = 8;
const BURST_STAMINA_COST = 32;
const STAMINA_POWER_UP_GAIN = 5;
const OBSTACLE_MARGIN = 48;
const FINAL_CHOICE_OFFSET_X = 104;
const FINAL_CHOICE_OFFSET_Y = 76;
const FINAL_CHOICE_PICKUP_RADIUS = 68;
const FINAL_CHOICE_CLICK_RADIUS = 52;

function bossKillTarget(wave: number, resets = 0) {
  return 10 + wave * 4 + resets * 5;
}

function scaledEnemyHp(baseHp: number, resets: number) {
  return Math.ceil(baseHp * (1 + resets * 0.25));
}

function shotLanesForWeaponLevel(weaponLevel: number) {
  if (weaponLevel >= 3) return [-0.16, 0, 0.16];
  if (weaponLevel === 2) return [-0.1, 0.1];
  return [0];
}

function weaponLevelForWave(wave: number) {
  if (wave >= 4) return 3;
  if (wave >= 2) return 2;
  return 1;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isFinalChoicePowerUp(kind: PowerUpKind) {
  return kind === "promotion" || kind === "call";
}

function normalize(x: number, y: number) {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const adBannerRef = useRef<HTMLModElement | null>(null);
  const adBannerPushedRef = useRef(false);
  const keys = useRef(new Set<string>());
  const pointer = useRef({ active: false, x: WORLD.width / 2, y: WORLD.height / 2 });
  const stateRef = useRef<GameState>("menu");
  const runOriginRef = useRef<RunOrigin>("normal");
  const menuPanelRef = useRef<MenuPanel>("home");
  const selectedCharacterIdRef = useRef(DEFAULT_CHARACTER_ID);
  const characterPortraitRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const menuIndexRef = useRef(0);
  const startGameRef = useRef<() => void>(() => undefined);
  const startSecretRunRef = useRef<() => void>(() => undefined);
  const audioRef = useRef<AudioContext | null>(null);
  const musicTimerRef = useRef<number | null>(null);
  const debugFirstActionRef = useRef<HTMLButtonElement | null>(null);
  const cheatBufferRef = useRef("");
  const drainPromiseRef = useRef<Promise<void> | null>(null);
  const musicStepRef = useRef(0);
  const soundHydratedRef = useRef(false);
  const mutedRef = useRef(false);
  const volumeRef = useRef(0.35);
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
  const [resetCount, setResetCount] = useState(0);
  const [hp, setHp] = useState(100);
  const [boss, setBoss] = useState("Gerente de Sprint");
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [scoreSaved, setScoreSaved] = useState(true);
  const [scoreMessage, setScoreMessage] = useState("Ranking global carregando...");
  const [lastOutcome, setLastOutcome] = useState<"over" | "won">("over");
  const [menuPanel, setMenuPanel] = useState<MenuPanel>("home");
  const [selectedCharacterId, setSelectedCharacterId] = useState(DEFAULT_CHARACTER_ID);
  const [menuIndex, setMenuIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.35);
  const [supportOpen, setSupportOpen] = useState(false);
  const [biome, setBiome] = useState(biomeNames[0]);
  const [upgrade, setUpgrade] = useState("JDK 8");
  const [bossProgress, setBossProgress] = useState("0/14 mobs");
  const [debugBossHealth, setDebugBossHealth] = useState<{ hp: number; maxHp: number } | null>(null);
  const [debugPowerUpCount, setDebugPowerUpCount] = useState(0);
  const [debugAbilityCooldown, setDebugAbilityCooldown] = useState(0);
  const [debugPlayerPosition, setDebugPlayerPosition] = useState({ x: 0, y: 0 });
  const [debugPlayerEffects, setDebugPlayerEffects] = useState({ haste: 0, invincible: 0 });
  const [burstStaminaPct, setBurstStaminaPct] = useState(BURST_STAMINA_MAX);
  const [abilityCooldownPct, setAbilityCooldownPct] = useState(100);
  const [promotionCountdown, setPromotionCountdown] = useState(3);
  const [debugOpen, setDebugOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bossKillsCount, setBossKillsCount] = useState(0);
  const [bossKillTargetCount, setBossKillTargetCount] = useState(bossKillTarget(1, 0));
  const [bossEncountered, setBossEncountered] = useState(false);
  const [bossIncident, setBossIncident] = useState(false);
  const [enemyCount, setEnemyCount] = useState(0);
  const [damageFlash, setDamageFlash] = useState(0);
  const { theme, setTheme } = useThemePreference();

  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    menuPanelRef.current = menuPanel;
  }, [menuPanel]);

  useEffect(() => {
    selectedCharacterIdRef.current = selectedCharacterId;
  }, [selectedCharacterId]);

  useEffect(() => {
    if (menuPanel !== "skins") return;
    CHARACTERS.forEach((character, index) => {
      const canvas = characterPortraitRefs.current[index];
      const ctx = canvas?.getContext("2d") as CanvasRenderingContext2D | null;
      if (!ctx) return;
      drawCharacterBody(ctx, 8, 6, { bodyColor: character.bodyColor });
    });
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
    void refreshHighScores();
    void drainPendingScores();
    const retryPendingScores = () => {
      void refreshHighScores();
      void drainPendingScores();
    };
    window.addEventListener("online", retryPendingScores);
    return () => window.removeEventListener("online", retryPendingScores);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const savedSound = loadSoundSettings();
      soundHydratedRef.current = true;
      mutedRef.current = savedSound.muted;
      volumeRef.current = savedSound.volume;
      setMuted(savedSound.muted);
      setVolume(savedSound.volume);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
    volumeRef.current = volume;
    if (!soundHydratedRef.current) return;
    window.localStorage.setItem(SOUND_KEY, JSON.stringify({ muted, volume }));
    if (muted || volume <= 0) stopMusic();
    else if (stateRef.current === "playing") startMusic();
  }, [muted, startMusic, stopMusic, volume]);

  useEffect(() => {
    if (gameState === "playing") startMusic();
    else stopMusic();
  }, [gameState, startMusic, stopMusic]);

  useEffect(() => {
    const handler = createDebugKeyHandler();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (gameState !== "menu" || menuPanel !== "home") cheatBufferRef.current = "";
  }, [gameState, menuPanel]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (stateRef.current !== "menu" || menuPanelRef.current !== "home") return;
      cheatBufferRef.current = appendCheatBuffer(cheatBufferRef.current, event.key);
      const matched = matchCheatCode(cheatBufferRef.current);
      if (!matched) return;
      cheatBufferRef.current = "";
      if (matched === "idclip") {
        setScoreSaved(true);
        setPlayerName("");
        setSupportOpen(false);
        playSound("start");
        startSecretRunRef.current();
      } else {
        setMenuPanel("skins");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [playSound]);

  useEffect(() => {
    if (debugOpen) debugFirstActionRef.current?.focus();
  }, [debugOpen]);

  async function refreshHighScores() {
    setScoreMessage("Ranking global carregando...");

    try {
      const response = await fetch("/api/scores", { cache: "no-store" });
      if (!response.ok) throw new Error("Score API failed");
      const payload = (await response.json()) as { scores?: HighScore[] };
      const globalScores = payload.scores ?? [];
      const scores = loadPendingScores().length > 0
        ? mergeHighScores(globalScores, loadHighScores())
        : globalScores;
      setHighScores(scores);
      saveHighScores(scores);
      setScoreMessage("Ranking global");
    } catch {
      const localScores = loadHighScores();
      setHighScores(localScores);
      setScoreMessage("Ranking local offline");
    }
  }

  function drainPendingScores() {
    if (drainPromiseRef.current) return drainPromiseRef.current;

    const drain = async () => {
      let previousPostStartedAt: number | null = null;

      while (true) {
        const pendingScore = loadPendingScores()[0];
        if (!pendingScore) return;

        await waitForNextScorePost(previousPostStartedAt);

        previousPostStartedAt = Date.now();
        try {
          const payload = await postPendingScore(pendingScore);
          if (!isPersistedScoreResponse(payload)) {
            throw new Error("Score sync not persisted");
          }
          removePendingScore(pendingScore.submissionId);
          if (payload.scores) {
            setHighScores(payload.scores);
            saveHighScores(payload.scores);
          }
          setScoreMessage(payload.storage === "local"
            ? "Ranking local aguardando sincronização"
            : "Ranking global atualizado");
        } catch {
          updatePendingScoreAttempt(pendingScore.submissionId, new Date().toISOString());
          setScoreMessage("Ranking local aguardando sincronização");
          return;
        }
      }
    };

    drainPromiseRef.current = drain().finally(() => {
      drainPromiseRef.current = null;
    });
    return drainPromiseRef.current;
  }

  function startNewGame() {
    setScoreSaved(true);
    setPlayerName("");
    setMenuPanel("home");
    setSupportOpen(false);
    playSound("start");
    startGameRef.current();
  }


  function returnToTitle() {
    setScoreSaved(true);
    setPlayerName("");
    setMenuPanel("home");
    setSupportOpen(false);
    setScore(0);
    setWave(1);
    setResetCount(0);
    setHp(100);
    setBoss("Gerente de Sprint");
    setBiome(biomeNames[0]);
    setUpgrade("JDK 8");
    setBossProgress("0/14 mobs");
    setBurstStaminaPct(BURST_STAMINA_MAX);
    stateRef.current = "menu";
    setGameState("menu");
    stopMusic();
  }

  const resumeGame = useCallback(() => {
    stateRef.current = "playing";
    setGameState("playing");
    startMusic();
  }, [startMusic]);

  function openSupportPanel() {
    if (stateRef.current === "playing") {
      stateRef.current = "paused";
      setGameState("paused");
      stopMusic();
    }
    setSupportOpen(true);
  }

  function openSettingsPanel() {
    if (stateRef.current === "playing") {
      stateRef.current = "paused";
      setGameState("paused");
      stopMusic();
    }
    setSettingsOpen(true);
  }

  function closeSettingsPanel() {
    setSettingsOpen(false);
  }

  useEffect(() => {
    if (gameState !== "promotion") return;
    const interval = window.setInterval(() => {
      setPromotionCountdown((current) => Math.max(0, current - 1));
    }, 1000);
    const timeout = window.setTimeout(() => {
      setScoreSaved(false);
      stateRef.current = "over";
      setGameState("over");
    }, 3200);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [gameState]);

  const activateMenuOption = useCallback((index: number) => {
    setMenuIndex(index);
    if (index === 0) startNewGame();
    else if (index === 1) {
      setMenuPanel("scores");
      refreshHighScores();
    } else if (index === 2) openSettingsPanel();
    else if (index === 3) setMenuPanel("help");
    else if (index === 4) openSupportPanel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitScore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (runOriginRef.current === "debug") {
      setScoreMessage("Score de debug não enviado.");
      setScoreSaved(true);
      return;
    }

    const cleanName = playerName.trim().replace(/\s+/g, " ").slice(0, 14) || "DEV ANON";
    const entry = {
      name: cleanName.toUpperCase(),
      score,
      wave,
      resets: resetCount,
      outcome: lastOutcome,
      createdAt: new Date().toISOString(),
    };
    const pendingEntry: PendingScoreEntry = {
      version: 1,
      submissionId: crypto.randomUUID(),
      score: entry,
      enqueuedAt: new Date().toISOString(),
      attempts: 0,
      lastAttemptAt: null,
    };

    setScoreMessage("Salvando score...");
    try {
      const response = await fetch("/api/scores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": pendingEntry.submissionId,
        },
        body: JSON.stringify(entry),
      });
      if (!response.ok) throw new Error("Score API failed");
      const payload = (await response.json()) as {
        scores: HighScore[];
        storage?: "blob" | "local";
        idempotent?: boolean;
      };
      if (!isPersistedScoreResponse(payload)) {
        throw new Error("Score not persisted");
      }
      setHighScores(payload.scores);
      saveHighScores(payload.scores);
      setScoreMessage(payload.storage === "local" ? "Ranking local aguardando sincronização" : "Ranking global atualizado");
      playSound("save");
      setScoreSaved(true);
    } catch {
      const nextScores = [entry, ...highScores]
        .sort((a, b) => b.score - a.score || b.wave - a.wave || (b.resets ?? 0) - (a.resets ?? 0))
        .slice(0, 10);
      enqueuePendingScore(pendingEntry);
      saveHighScores(nextScores);
      setHighScores(nextScores);
      setScoreMessage("Ranking local salvo. Global indisponível.");
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
    let bossKills = 0;
    let bossSpawned = false;
    let finalChoicePending = false;
    let finalBossCorpse: { x: number; y: number } | null = null;
    let callLoops = 0;
    let burstStamina = BURST_STAMINA_MAX;
    let weaponLevel = 1;
    let damageFlash = 0;
    let shake = 0;
    let bossBanner = 0;
    let effectMessage = "";
    let effectBanner = 0;
    let abilityCooldownRemaining = 0;
    let lastMoveX = 0;
    let lastMoveY = 0;
    let activeCharacter = resolveCharacter(selectedCharacterIdRef.current);

    const player = {
      x: WORLD.width / 2,
      y: WORLD.height / 2,
      hp: activeCharacter.maxHp,
      maxHp: activeCharacter.maxHp,
      size: activeCharacter.size,
      speed: activeCharacter.speed,
      invincible: 0,
      fury: 0,
      focus: 0,
      haste: 0,
    };

    const enemies: Actor[] = [];
    const shots: Shot[] = [];
    const particles: Particle[] = [];
    const powerUps: PowerUp[] = [];
    const obstacles: Obstacle[] = [];
    const secretBossShots: SecretBossShot[] = [];
    const meetingZones: MeetingZone[] = [];
    const cobolSnake: CobolSnake = { active: false, cd: 8, t: 0, dir: 1, y0: 300, x: 0, y: 0, hist: [] };
    const datacenterMoss: Array<{ x: number; y: number; r: number }> = [];
    const datacenterCracks: Array<Array<{ x: number; y: number }>> = [];
    const datacenterPuddles = [
      { x: 560, y: 200, rx: 60, ry: 20 },
      { x: 520, y: 390, rx: 52, ry: 18 },
      { x: 330, y: 440, rx: 44, ry: 16 },
    ];

    function syncHud() {
      setScore(localScore);
      setWave(localWave);
      setResetCount(callLoops);
      setHp(Math.max(0, Math.round(player.hp)));
      setBoss(runOriginRef.current === "secret" ? "O Mainframe" : finalChoicePending ? "Diretoria caída" : bossNames[bossIndex] ?? "Comitê Executivo");
      setBiome(runOriginRef.current === "secret" ? "Datacenter Esquecido" : biomeNames[Math.min(bossIndex, biomeNames.length - 1)] ?? "War Room");
      setUpgrade(weaponLevel >= 3 ? "JDK 21" : weaponLevel === 2 ? "JDK 17" : "JDK 8");
      setBurstStaminaPct(Math.round(burstStamina));
      const power = activeCharacter.specialPower;
      setAbilityCooldownPct(
        power
          ? Math.round(
              ((power.cooldownSeconds - Math.min(abilityCooldownRemaining, power.cooldownSeconds)) /
                power.cooldownSeconds) *
                100,
            )
          : 100,
      );
      setBossProgress(
        runOriginRef.current === "secret"
          ? "Chefe secreto"
          : finalChoicePending
          ? "Escolha final"
          : bossSpawned
          ? "Chefe em combate"
          : `${Math.min(bossKills, bossKillTarget(localWave, callLoops))}/${bossKillTarget(localWave, callLoops)} mobs`,
      );
      if (isDebugAllowed()) {
        setDebugAbilityCooldown(Math.max(0, abilityCooldownRemaining));
        setDebugPlayerPosition({ x: Math.round(player.x), y: Math.round(player.y) });
        setDebugPlayerEffects({
          haste: Math.max(0, player.haste),
          invincible: Math.max(0, player.invincible),
        });
      }
      setBossKillsCount(Math.min(bossKills, bossKillTarget(localWave, callLoops)));
      setBossKillTargetCount(bossKillTarget(localWave, callLoops));
      setBossEncountered(bossSpawned);
      setBossIncident(bossBanner > 0);
      setEnemyCount(enemies.length);
      setDamageFlash(damageFlash);
    }

    function countBossProgress() {
      if (bossSpawned || finalChoicePending) return;
      bossKills += 1;
      if (bossKills >= bossKillTarget(localWave, callLoops)) {
        bossSpawned = true;
        announceEffect("CHEFE LIBERADO: entra na call");
        spawnEnemy("boss");
      }
    }

    function isFinalBoss() {
      return bossIndex === bossNames.length - 1;
    }

    function finalBossHp(phase: number) {
      return 210 + phase * 48 + localWave * 22;
    }

    function obstacleTemplates(): Array<Omit<Obstacle, "x" | "y">> {
      const theme = Math.min(bossIndex, biomeNames.length - 1);
      const templates: Array<Array<Omit<Obstacle, "x" | "y">>> = [
        [
          { kind: "desk", label: "Mesa", width: 92, height: 34 },
          { kind: "board", label: "Kanban", width: 74, height: 44 },
          { kind: "server", label: "Impressora", width: 48, height: 62 },
        ],
        [
          { kind: "server", label: "Rack", width: 58, height: 76 },
          { kind: "firewall", label: "Firewall", width: 82, height: 42 },
          { kind: "desk", label: "Cabo", width: 118, height: 24 },
        ],
        [
          { kind: "firewall", label: "Bucket", width: 76, height: 48 },
          { kind: "server", label: "Pipeline", width: 104, height: 30 },
          { kind: "board", label: "Cloud", width: 64, height: 58 },
        ],
        [
          { kind: "board", label: "Post-its", width: 86, height: 50 },
          { kind: "desk", label: "Mesa call", width: 118, height: 36 },
          { kind: "server", label: "Telão", width: 92, height: 56 },
        ],
      ];

      return templates[theme] ?? templates[0];
    }

    function obstacleBlocksCircle(x: number, y: number, radius: number) {
      return obstacles.some((obstacle) => circleIntersectsRect({ x, y, radius }, obstacle));
    }

    function spawnObstacles() {
      obstacles.length = 0;
      const templates = obstacleTemplates();
      const amount = obstacleCount(callLoops);
      let attempts = 0;

      while (obstacles.length < amount && attempts < 140) {
        attempts += 1;
        const template = templates[Math.floor(Math.random() * templates.length)];
        const x = OBSTACLE_MARGIN + Math.random() * (WORLD.width - template.width - OBSTACLE_MARGIN * 2);
        const y = OBSTACLE_MARGIN + Math.random() * (WORLD.height - template.height - OBSTACLE_MARGIN * 2);
        const obstacle = { ...template, x, y };
        const center = { x: x + template.width / 2, y: y + template.height / 2 };
        const overlapsPlayer = circleIntersectsRect({ x: player.x, y: player.y, radius: 86 }, obstacle);
        const overlapsStart = circleIntersectsRect({ x: WORLD.width / 2, y: WORLD.height / 2, radius: 96 }, obstacle);
        const overlapsExisting = obstacles.some((existing) => (
          x < existing.x + existing.width + 26 &&
          x + template.width + 26 > existing.x &&
          y < existing.y + existing.height + 26 &&
          y + template.height + 26 > existing.y
        ));
        const tooCloseToEdges = center.x < 120 || center.x > WORLD.width - 120 || center.y < 100 || center.y > WORLD.height - 86;

        if (!overlapsPlayer && !overlapsStart && !overlapsExisting && !tooCloseToEdges) {
          obstacles.push(obstacle);
        }
      }
    }

    // Layout fixo do "datacenter esquecido" da fase secreta — mesmas
    // posições da maquete original (racks, CRTs, cadeiras, samambaias e
    // cogumelos), em vez do posicionamento aleatório das ondas normais.
    function spawnDatacenterObstacles() {
      obstacles.length = 0;
      const props: Array<{ kind: ObstacleKind; x: number; y: number; width: number; height: number; label: string }> = [
        { kind: "rack", x: 36, y: 118, width: 32, height: 48, label: "Rack" },
        { kind: "rack", x: 120, y: 68, width: 32, height: 48, label: "Rack" },
        { kind: "rack", x: 812, y: 62, width: 32, height: 48, label: "Rack" },
        { kind: "rack", x: 872, y: 206, width: 32, height: 48, label: "Rack" },
        { kind: "crt", x: 676, y: 68, width: 36, height: 30, label: "CRT" },
        { kind: "crt", x: 56, y: 394, width: 36, height: 30, label: "CRT" },
        { kind: "chair", x: 628, y: 418, width: 24, height: 30, label: "Cadeira" },
        { kind: "chair", x: 752, y: 402, width: 24, height: 30, label: "Cadeira" },
        { kind: "fern", x: 16, y: 484, width: 36, height: 24, label: "Samambaia" },
        { kind: "fern", x: 300, y: 50, width: 36, height: 24, label: "Samambaia" },
        { kind: "fern", x: 600, y: 50, width: 36, height: 24, label: "Samambaia" },
        { kind: "fern", x: 906, y: 484, width: 36, height: 24, label: "Samambaia" },
        { kind: "shroom", x: 300, y: 138, width: 16, height: 14, label: "Cogumelo" },
        { kind: "shroom", x: 866, y: 174, width: 16, height: 14, label: "Cogumelo" },
      ];
      for (const prop of props) obstacles.push(prop);
    }

    function resetWaveOne(keepScore = false) {
      if (!keepScore) {
        localScore = 0;
        callLoops = 0;
      }
      localWave = 1;
      spawnTimer = 0;
      dataTimer = 120;
      powerUpTimer = 7;
      shotTimer = 0;
      bossIndex = 0;
      bossKills = 0;
      bossSpawned = false;
      finalChoicePending = false;
      finalBossCorpse = null;
      burstStamina = BURST_STAMINA_MAX;
      weaponLevel = 1;
      damageFlash = 0;
      shake = 0;
      bossBanner = 0;
      effectMessage = "";
      effectBanner = 0;
      abilityCooldownRemaining = 0;
      lastMoveX = 0;
      lastMoveY = 0;
      activeCharacter = resolveCharacter(selectedCharacterIdRef.current);
      player.maxHp = activeCharacter.maxHp;
      player.speed = activeCharacter.speed;
      player.size = activeCharacter.size;
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
      spawnObstacles();
      for (let i = 0; i < 5; i += 1) spawnEnemy("user");
      syncHud();
    }

    function spawnFinalChoices(x: number, y: number) {
      finalChoicePending = true;
      bossSpawned = true;
      finalBossCorpse = { x, y };
      bossBanner = 0;
      shake = 0;
      enemies.length = 0;
      shots.length = 0;
      powerUps.length = 0;
      obstacles.length = 0;
      const choiceCenterX = clamp(player.x, FINAL_CHOICE_OFFSET_X + 40, WORLD.width - FINAL_CHOICE_OFFSET_X - 40);
      const choiceY = clamp(player.y - FINAL_CHOICE_OFFSET_Y, 120, WORLD.height - 110);
      const choices: Array<{ kind: PowerUpKind; x: number; y: number }> = [
        { kind: "promotion", x: choiceCenterX - FINAL_CHOICE_OFFSET_X, y: choiceY },
        { kind: "call", x: choiceCenterX + FINAL_CHOICE_OFFSET_X, y: choiceY },
      ];
      for (const choice of choices) {
        powerUps.push({
          x: choice.x,
          y: choice.y,
          kind: choice.kind,
          ttl: 99999,
          pulse: Math.random() * Math.PI * 2,
        });
      }
      announceEffect("ESCOLHA O SEU DESTINO CORPORATIVO");
      stateRef.current = "choice";
      setGameState("choice");
      syncHud();
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
      let x = edge === 0 ? -margin : edge === 1 ? WORLD.width + margin : Math.random() * WORLD.width;
      let y = edge === 2 ? -margin : edge === 3 ? WORLD.height + margin : Math.random() * WORLD.height;
      const isBoss = kind === "boss";
      const isSecretBoss = kind === "secretBoss";
      const isData = kind === "data";
      const finalBoss = isBoss && isFinalBoss();
      const wavePressure = Math.min(localWave - 1, 5);
      const stats: Record<EnemyKind, { hp: number; speed: number; size: number }> = {
        user: { hp: 28 + wavePressure * 2, speed: 68 + wavePressure * 5, size: 24 },
        qa: { hp: 22 + wavePressure * 2, speed: 96 + wavePressure * 7, size: 22 },
        vip: { hp: 58 + wavePressure * 5, speed: 54 + wavePressure * 3, size: 30 },
        incident: { hp: 20 + wavePressure * 3, speed: 122 + wavePressure * 8, size: 20 },
        legacy: { hp: 88 + wavePressure * 8, speed: 36 + wavePressure * 2, size: 34 },
        data: { hp: 16 + wavePressure, speed: 86 + wavePressure * 5, size: 22 },
        boss: finalBoss
          ? { hp: finalBossHp(1), speed: 44 + wavePressure, size: 62 }
          : { hp: 160 + localWave * 28, speed: 52 + wavePressure * 2, size: 38 },
        secretBoss: { hp: 520, speed: 0, size: 64 },
        daemon: { hp: 30, speed: 96, size: 22 },
        cron: { hp: 50, speed: 42, size: 24 },
      };
      if (isSecretBoss) {
        x = WORLD.width / 2;
        y = 150;
      }
      const selected = stats[kind];
      const hp = scaledEnemyHp(selected.hp, callLoops);
      enemies.push({
        x,
        y,
        vx: 0,
        vy: 0,
        hp,
        maxHp: hp,
        speed: selected.speed,
        size: selected.size,
        kind,
        label: isSecretBoss
          ? "O Mainframe"
          : kind === "daemon"
            ? "Daemon"
            : kind === "cron"
              ? "Cron Job"
              : isBoss
                ? finalBoss ? "Diretoria" : bossNames[bossIndex]
                : isData
                  ? cloudLabels[Math.floor(Math.random() * cloudLabels.length)]
                  : enemyLabels[kind],
        cooldown: isBoss ? 118 : kind === "daemon" ? 60 : 90,
        phase: Math.random() * Math.PI * 2,
        bossPhase: finalBoss ? 1 : undefined,
        bossState: isSecretBoss ? "idle" : undefined,
        bossStateTimer: isSecretBoss ? 0 : undefined,
        bossAtkPattern: isSecretBoss ? -1 : undefined,
      });
      if (isBoss || isSecretBoss) {
        bossBanner = 120;
        if (stateRef.current === "playing") playSound("boss");
      }
    }

    function spawnPowerUp() {
      const kinds: PowerUpKind[] = ["coffee", "refactor", "rollback", "hotfix", "review", "stamina"];
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const powerUp = {
          x: 70 + Math.random() * (WORLD.width - 140),
          y: 70 + Math.random() * (WORLD.height - 140),
          kind: kinds[Math.floor(Math.random() * kinds.length)],
          ttl: 780,
          pulse: Math.random() * Math.PI * 2,
        };
        if (!obstacleBlocksCircle(powerUp.x, powerUp.y, 26)) {
          powerUps.push(powerUp);
          return;
        }
      }
    }

    function announceEffect(message: string) {
      effectMessage = message;
      effectBanner = 100;
    }

    function clearNearbyEnemies(clearRadius: number) {
      // "boss" já é protegido pela lib; "secretBoss" e um "cron" derrubado
      // (hp <= 0, esperando ressuscitar) também não podem ser limpos assim.
      const removed = selectEnemiesToClear(player, enemies, clearRadius).filter(
        (enemy) => enemy.kind !== "secretBoss" && enemy.hp > 0,
      );
      for (const enemy of removed) {
        const index = enemies.indexOf(enemy);
        if (index >= 0) enemies.splice(index, 1);
        localScore += enemy.kind === "data" ? 45 : 25;
        countBossProgress();
        burst(enemy.x, enemy.y, "#7dd3fc", 10);
      }
    }

    function collectPowerUp(powerUp: PowerUp) {
      if (powerUp.kind === "promotion") {
        finalChoicePending = false;
        bossSpawned = false;
        finalBossCorpse = null;
        powerUps.length = 0;
        setScore(localScore);
        setWave(localWave);
        setLastOutcome("over");
        setScoreSaved(true);
        setPromotionCountdown(3);
        playSound("over");
        stopMusic();
        stateRef.current = "promotion";
        setGameState("promotion");
        return;
      }

      if (powerUp.kind === "call") {
        callLoops += 1;
        playSound("start");
        resetWaveOne(true);
        announceEffect("NOVO CHAMADO: pontuação mantida");
        stateRef.current = "playing";
        setGameState("playing");
        startMusic();
        return;
      }

      localScore += 35;
      if (powerUp.kind === "coffee") {
        player.haste = 6;
        announceEffect("CAFÉ: velocidade aumentada");
      } else if (powerUp.kind === "refactor") {
        player.fury = 6;
        announceEffect("REFACTOR: tiros acelerados");
      } else if (powerUp.kind === "rollback") {
        clearNearbyEnemies(190);
        announceEffect("ROLLBACK: caos revertido");
      } else if (powerUp.kind === "hotfix") {
        player.hp = clamp(player.hp + 32, 0, player.maxHp);
        announceEffect("HOTFIX: vida recuperada");
      } else if (powerUp.kind === "review") {
        player.focus = 7;
        player.invincible = Math.max(player.invincible, 2.4);
        announceEffect("CODE REVIEW: escudo ativo");
      } else {
        if (burstStamina < BURST_STAMINA_MAX) {
          burstStamina = clamp(burstStamina + STAMINA_POWER_UP_GAIN, 0, BURST_STAMINA_MAX);
          announceEffect("SPRINT: estamina +5%");
        } else {
          announceEffect("SPRINT: estamina cheia");
        }
      }
      playSound("save");
      burst(powerUp.x, powerUp.y, "#facc15", 18);
      syncHud();
    }

    function resetGame() {
      resetWaveOne(false);
    }

    function start() {
      resetGame();
      setDebugBossHealth(null);
      setDebugPowerUpCount(0);
      runOriginRef.current = "normal";
      stateRef.current = "playing";
      setGameState("playing");
      startMusic();
    }
    startGameRef.current = start;

    // Fase secreta ("idclip" no menu inicial): reaproveita o motor real —
    // mesmo player/física/colisão/inimigos/tiros/partículas/telas de fim de
    // jogo — mas com o cenário, o elenco (daemon/cron/cobol snake/reuniões)
    // e o chefe ("O Mainframe") fiéis à maquete original da fase secreta,
    // em vez da progressão normal de ondas do jogo.
    function startSecretRun() {
      resetWaveOne(false);
      // A maquete original começa com o jogador perto da borda de baixo e o
      // chefe/elenco perto do topo — o reset padrão do motor usa o centro do
      // mundo, o que colocaria o jogador em cima do cron logo de cara.
      player.x = WORLD.width / 2;
      player.y = WORLD.height - 90;
      spawnDatacenterObstacles();
      enemies.length = 0;
      spawnEnemy("daemon");
      enemies[enemies.length - 1].x = 200;
      enemies[enemies.length - 1].y = 220;
      spawnEnemy("daemon");
      enemies[enemies.length - 1].x = 760;
      enemies[enemies.length - 1].y = 220;
      spawnEnemy("cron");
      enemies[enemies.length - 1].x = WORLD.width / 2;
      enemies[enemies.length - 1].y = 280;
      secretBossShots.length = 0;
      meetingZones.length = 0;
      meetingZones.push({ x: 300, y: 330, base: 26, r: 26, ph: 0 }, { x: 660, y: 420, base: 30, r: 30, ph: 2 });
      cobolSnake.active = false;
      cobolSnake.cd = 8;
      cobolSnake.hist = [];
      datacenterMoss.length = 0;
      for (let i = 0; i < 12; i += 1) {
        datacenterMoss.push({ x: Math.random() * WORLD.width, y: Math.random() * WORLD.height, r: 14 + Math.random() * 26 });
      }
      datacenterCracks.length = 0;
      for (let i = 0; i < 9; i += 1) {
        let cx = Math.random() * WORLD.width;
        let cy = 60 + Math.random() * (WORLD.height - 80);
        const crack = [{ x: cx, y: cy }];
        for (let s = 0; s < 5; s += 1) {
          cx += (Math.random() - 0.5) * 90;
          cy += (Math.random() - 0.3) * 50;
          crack.push({ x: cx, y: cy });
        }
        datacenterCracks.push(crack);
      }
      bossKills = bossKillTarget(localWave, callLoops);
      bossSpawned = true;
      spawnEnemy("secretBoss");
      setDebugBossHealth(null);
      setDebugPowerUpCount(0);
      runOriginRef.current = "secret";
      stateRef.current = "playing";
      setGameState("playing");
      startMusic();
      syncHud();
    }
    startSecretRunRef.current = startSecretRun;

    const onDebugAction = (event: Event) => {
      const action = (event as CustomEvent<unknown>).detail;
      if (!isDebugAllowed() || !isDebugAction(action)) return;

      if (action === "toggle_menu") {
        setDebugOpen((current) => !current);
        return;
      }

      setDebugOpen(false);
      const startsRun = action === "reset"
        || ((action === "spawn_boss" || action === "add_powerup") && stateRef.current !== "playing");
      if (startsRun) {
        start();
      }
      runOriginRef.current = "debug";

      if (action === "spawn_boss") {
        if (!bossSpawned) {
          bossKills = bossKillTarget(localWave, callLoops);
          bossSpawned = true;
          spawnEnemy("boss");
          const bossEntity = enemies.find((enemy) => enemy.kind === "boss");
          setDebugBossHealth(bossEntity ? { hp: bossEntity.hp, maxHp: bossEntity.maxHp } : null);
          syncHud();
        }
      } else if (action === "add_powerup") {
        spawnPowerUp();
        setDebugPowerUpCount(powerUps.length);
        announceEffect("DEBUG: power-up liberado");
      } else if (action === "max_stamina") {
        burstStamina = BURST_STAMINA_MAX;
        syncHud();
      } else if (action === "win_game") {
        setScore(localScore);
        setWave(localWave);
        setLastOutcome("won");
        setScoreSaved(false);
        playSound("won");
        stopMusic();
        stateRef.current = "won";
        setGameState("won");
      }
    };

    function triggerActivePower() {
      if (stateRef.current !== "playing") return;
      const power = activeCharacter.specialPower;
      if (!power) return;
      if (abilityCooldownRemaining > 0) return;

      if (power.kind === "dash") {
        // Ignora um "cron" derrubado (hp <= 0, esperando ressuscitar) — ele
        // continua no array de enemies, mas não é um alvo válido.
        const liveEnemies = enemies.filter((enemy) => enemy.hp > 0);
        const direction = resolveDashDirection({ x: lastMoveX, y: lastMoveY }, player, liveEnemies);
        player.x = clamp(player.x + direction.x * power.dashDistance, 28, WORLD.width - 28);
        player.y = clamp(player.y + direction.y * power.dashDistance, 36, WORLD.height - 28);
        if (power.clearRadius) clearNearbyEnemies(power.clearRadius);
      } else if (power.kind === "haste") {
        player.haste = Math.max(player.haste, power.durationSeconds);
      } else if (power.kind === "shield") {
        player.invincible = Math.max(player.invincible, power.durationSeconds);
      }
      abilityCooldownRemaining = power.cooldownSeconds;
      announceEffect(`${power.name.toUpperCase()}: ativado`);
      syncHud();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isTyping) return;

      if (event.key.toLowerCase() === "q" && !event.repeat) {
        triggerActivePower();
      }

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "w", "a", "s", "d", "W", "A", "S", "D", "Enter", "Escape"].includes(event.key)) {
        event.preventDefault();
      }
      if (stateRef.current === "menu" && menuPanelRef.current === "home" && !isOpeningCutscenePlaying()) {
        if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
          menuIndexRef.current = (menuIndexRef.current + 4) % 5;
          setMenuIndex(menuIndexRef.current);
          playSound("hit");
        } else if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
          menuIndexRef.current = (menuIndexRef.current + 1) % 5;
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
        resumeGame();
      }
      keys.current.add(event.key.toLowerCase());
    };
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    const onPointerMove = (event: PointerEvent) => {
      event.preventDefault();
      const bounds = canvas.getBoundingClientRect();
      pointer.current.x = ((event.clientX - bounds.left) / bounds.width) * WORLD.width;
      pointer.current.y = ((event.clientY - bounds.top) / bounds.height) * WORLD.height;
    };
    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      canvas.setPointerCapture?.(event.pointerId);
      pointer.current.active = true;
      onPointerMove(event);
      if (stateRef.current === "choice" || finalChoicePending) {
        for (let i = powerUps.length - 1; i >= 0; i -= 1) {
          const powerUp = powerUps[i];
          if (!powerUp) continue;
          if (isFinalChoicePowerUp(powerUp.kind) && distance(powerUp, pointer.current) < FINAL_CHOICE_CLICK_RADIUS) {
            powerUps.splice(i, 1);
            collectPowerUp(powerUp);
            return;
          }
        }
      }
      if (stateRef.current === "menu") start();
      if (stateRef.current === "paused") {
        stateRef.current = "playing";
        setGameState("playing");
        startMusic();
      }
    };
    const onPointerUp = (event: PointerEvent) => {
      if (canvas.hasPointerCapture?.(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      pointer.current.active = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener(DEBUG_ACTION_EVENT, onDebugAction);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    function shoot() {
      // Um "cron" derrubado fica no array de enemies (esperando ressuscitar)
      // em vez de ser removido — sem esse filtro, a mira automática podia
      // travar nele e os tiros pareciam ir "para o vazio".
      let target: Actor | undefined;
      for (const enemy of enemies) {
        if (enemy.hp <= 0) continue;
        if (!target || distance(enemy, player) < distance(target, player)) target = enemy;
      }
      const aim = target
        ? normalize(target.x - player.x, target.y - player.y)
        : normalize(pointer.current.x - player.x, pointer.current.y - player.y);
      const lanes = shotLanesForWeaponLevel(weaponLevel);
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
      const choosingFinalReward = stateRef.current === "choice" || finalChoicePending;
      if (stateRef.current !== "playing" && !choosingFinalReward) return;
      frame += 1;
      spawnTimer -= delta;
      dataTimer -= delta;
      powerUpTimer -= delta;
      shotTimer -= delta;
      player.invincible = Math.max(0, player.invincible - delta);
      player.fury = Math.max(0, player.fury - delta);
      player.focus = Math.max(0, player.focus - delta);
      player.haste = Math.max(0, player.haste - delta);
      abilityCooldownRemaining = Math.max(0, abilityCooldownRemaining - delta);
      damageFlash = Math.max(0, damageFlash - delta * 60);
      shake = Math.max(0, shake - delta * 60);
      bossBanner = Math.max(0, bossBanner - delta * 60);
      effectBanner = Math.max(0, effectBanner - delta * 60);
      weaponLevel = weaponLevelForWave(localWave);
      const wantsBurst = keys.current.has(" ");
      const burstActive = !choosingFinalReward && wantsBurst && burstStamina > 0;
      if (burstActive) {
        burstStamina = Math.max(0, burstStamina - BURST_STAMINA_COST * delta);
      } else {
        burstStamina = Math.min(BURST_STAMINA_MAX, burstStamina + BURST_STAMINA_RECHARGE * delta);
      }

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
      lastMoveX = move.x;
      lastMoveY = move.y;
      if (moveX || moveY) {
        const inMeetingZone = meetingZones.some((zone) => distance(player, zone) < zone.r);
        const currentSpeed = player.speed * (player.haste > 0 ? 1.34 : 1) * (inMeetingZone ? 0.55 : 1);
        const nextX = clamp(player.x + move.x * currentSpeed * delta, 28, WORLD.width - 28);
        const nextY = clamp(player.y + move.y * currentSpeed * delta, 36, WORLD.height - 28);
        const radius = player.size * 0.48;
        if (!obstacleBlocksCircle(nextX, player.y, radius)) player.x = nextX;
        if (!obstacleBlocksCircle(player.x, nextY, radius)) player.y = nextY;
      }

      if (choosingFinalReward) {
        for (let i = powerUps.length - 1; i >= 0; i -= 1) {
          const powerUp = powerUps[i];
          if (!powerUp) continue;
          powerUp.pulse += delta * 8;
          const pickupRadius = isFinalChoicePowerUp(powerUp.kind)
            ? FINAL_CHOICE_PICKUP_RADIUS
            : player.size * 0.55 + 18;
          if (distance(powerUp, player) < pickupRadius) {
            powerUps.splice(i, 1);
            collectPowerUp(powerUp);
            if (stateRef.current !== "choice" && !finalChoicePending) return;
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
        if (frame % 18 === 0) syncHud();
        return;
      }

      if (shotTimer <= 0) {
        shoot();
        playSound("shoot");
        shotTimer = player.fury > 0 || burstActive ? 0.11 : weaponLevel >= 3 ? 0.2 : 0.24;
      }

      // A fase secreta ("O Mainframe") tem elenco fixo — daemons/cron/snake/
      // zonas — e não deve ficar poluída pelos usuários/dados/power-ups da
      // progressão normal de ondas.
      const isSecretRun = runOriginRef.current === "secret";
      const usersAlive = enemies.filter((enemy) => enemy.kind === "user").length;
      const dataAlive = enemies.filter((enemy) => enemy.kind === "data").length;
      const specialAlive = enemies.filter((enemy) => ["qa", "vip", "incident", "legacy"].includes(enemy.kind)).length;
      const maxUsers = 7 + localWave * 2;
      const maxData = 3 + Math.ceil(localWave * 0.8);
      const maxSpecial = Math.min(2 + Math.floor(localWave / 2), 5);

      if (!isSecretRun && !finalChoicePending && spawnTimer <= 0 && usersAlive < maxUsers) {
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
      if (!isSecretRun && !finalChoicePending && dataTimer <= 0 && dataAlive < maxData) {
        dataTimer = Math.max(1.55, 4.1 - localWave * 0.18);
        spawnEnemy("data");
      }
      if (!isSecretRun && !finalChoicePending && powerUpTimer <= 0 && powerUps.length < 2) {
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
        } else if (enemy.kind === "secretBoss") {
          // O Mainframe fica parado no lugar (como na maquete original) — só
          // treme no impacto, quem se move é o jogador e os projéteis dele.
          enemy.vx = 0;
          enemy.vy = 0;
        } else if (enemy.kind === "daemon") {
          // Investidas curtas e rápidas, com atrito desacelerando entre elas —
          // igual ao "daemon" da maquete original.
          enemy.cooldown = (enemy.cooldown ?? 0) - delta * 60;
          if (enemy.cooldown <= 0) {
            enemy.cooldown = 96 + Math.random() * 84;
            enemy.vx = toward.x * enemy.speed * 2.4;
            enemy.vy = toward.y * enemy.speed * 2.4;
          } else {
            const decay = Math.exp(-3 * delta);
            enemy.vx *= decay;
            enemy.vy *= decay;
          }
        } else if (enemy.kind === "cron") {
          // Perseguição direta e constante enquanto vivo; ao ser abatido ele
          // não é removido — fica "derrubado" (hp 0) e ressurge sozinho depois
          // de alguns segundos, igual à maquete original.
          if (enemy.hp <= 0) {
            enemy.vx = 0;
            enemy.vy = 0;
            enemy.cooldown = (enemy.cooldown ?? 0) - delta * 60;
            if (enemy.cooldown <= 0) {
              enemy.hp = enemy.maxHp;
              burst(enemy.x, enemy.y, "#7dff6a", 14);
            }
          } else {
            enemy.vx = toward.x * enemy.speed;
            enemy.vy = toward.y * enemy.speed;
          }
        } else {
          enemy.vx = toward.x * enemy.speed + Math.sin((frame + enemy.x) / 23) * 16;
          enemy.vy = toward.y * enemy.speed + Math.cos((frame + enemy.y) / 29) * 16;
        }
        enemy.x += enemy.vx * delta;
        enemy.y += enemy.vy * delta;
        if (enemy.kind === "boss") {
          enemy.cooldown = (enemy.cooldown ?? 0) - delta * 60;
          if (enemy.cooldown <= 0) {
            const finalBoss = isFinalBoss();
            const bossPhase = enemy.bossPhase ?? 1;
            enemy.cooldown = finalBoss
              ? Math.max(42, 86 - bossPhase * 10)
              : Math.max(64, 104 - localWave * 4);
            const pattern = finalBoss ? bossPhase : bossIndex % 4;
            const volleySize = finalBoss
              ? bossPhase === 1 ? 4 : bossPhase === 2 ? 9 : 7
              : pattern === 1 ? 8 : pattern === 3 ? 5 : localWave >= 3 ? 3 : 2;
            for (let i = 0; i < volleySize; i += 1) {
              const aimed = Math.atan2(player.y - enemy.y, player.x - enemy.x);
              const base = pattern === 1
                ? (Math.PI * 2 * i) / volleySize
                : pattern === 3
                  ? aimed + (i - 2) * 0.24
                  : aimed + (i - 1) * 0.34;
              const minionHp = scaledEnemyHp(pattern === 2 ? 24 : 16, callLoops);
              enemies.push({
                x: enemy.x + Math.cos(base) * 30,
                y: enemy.y + Math.sin(base) * 30,
                vx: 0,
                vy: 0,
                hp: minionHp,
                maxHp: minionHp,
                speed: pattern === 3 ? 126 : 96 + Math.min(localWave, 5) * 4,
                size: pattern === 2 ? 22 : 18,
                kind: pattern === 2 ? "qa" : pattern === 3 ? "incident" : "data",
                label: pattern === 2 ? "QA" : pattern === 3 ? "P1" : "Deploy",
                phase: Math.random() * Math.PI * 2,
              });
            }
          }
        }
        if (enemy.kind === "secretBoss") {
          // Estados idle → tele (telegraph) → atk, igual à maquete: 3
          // padrões (rajada radial, tiro mirado, chamar reforço) disparando
          // projéteis reais (secretBossShots), não minions perseguidores.
          enemy.bossStateTimer = (enemy.bossStateTimer ?? 0) + delta;
          const bossFightState = enemy.bossState ?? "idle";
          const slow = enemy.hp < enemy.maxHp * 0.35 ? 0.6 : 1;
          if (bossFightState === "idle" && enemy.bossStateTimer > 2.2 * slow) {
            enemy.bossState = "tele";
            enemy.bossStateTimer = 0;
            enemy.bossAtkPattern = ((enemy.bossAtkPattern ?? -1) + 1) % 3;
          } else if (bossFightState === "tele" && enemy.bossStateTimer > 0.9) {
            enemy.bossState = "atk";
            enemy.bossStateTimer = 0;
            const pattern = enemy.bossAtkPattern ?? 0;
            if (pattern === 0) {
              for (let i = 0; i < 14; i += 1) {
                const a = (i / 14) * Math.PI * 2;
                secretBossShots.push({ x: enemy.x, y: enemy.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120 });
              }
            } else if (pattern === 1) {
              const aimed = Math.atan2(player.y - enemy.y, player.x - enemy.x);
              for (let k = -1; k <= 1; k += 1) {
                const a = aimed + k * 0.22;
                secretBossShots.push({ x: enemy.x, y: enemy.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170 });
              }
            } else {
              if (enemies.filter((other) => other.kind === "cron" && other.hp > 0).length < 2) {
                spawnEnemy("cron");
                announceEffect("O MAINFRAME REINICIA UM CRON JOB");
              }
              burst(enemy.x, enemy.y + 20, "#7dff6a", 16);
            }
          } else if (bossFightState === "atk" && enemy.bossStateTimer > 0.5) {
            enemy.bossState = "idle";
            enemy.bossStateTimer = 0;
          }
        }
      }

      for (let i = secretBossShots.length - 1; i >= 0; i -= 1) {
        const shot = secretBossShots[i];
        shot.x += shot.vx * delta;
        shot.y += shot.vy * delta;
        if (distance(shot, player) < player.size * 0.5 + 6) {
          secretBossShots.splice(i, 1);
          if (player.invincible <= 0) {
            player.hp -= 10;
            player.invincible = 0.92;
            damageFlash = 16;
            shake = 14;
            playSound("hurt");
            burst(player.x, player.y, "#ff5353", 12);
          }
          continue;
        }
        if (shot.x < -20 || shot.x > WORLD.width + 20 || shot.y < -20 || shot.y > WORLD.height + 20) {
          secretBossShots.splice(i, 1);
        }
      }

      if (cobolSnake.active) {
        cobolSnake.t += delta;
        cobolSnake.x = cobolSnake.dir > 0 ? -80 + cobolSnake.t * 150 : WORLD.width + 80 - cobolSnake.t * 150;
        cobolSnake.y = cobolSnake.y0 + Math.sin(cobolSnake.t * 3) * 46;
        cobolSnake.hist.unshift({ x: cobolSnake.x, y: cobolSnake.y });
        if (cobolSnake.hist.length > 42) cobolSnake.hist.pop();
        if (distance(cobolSnake, player) < 18 && player.invincible <= 0) {
          player.hp -= 20;
          player.invincible = 0.92;
          damageFlash = 16;
          shake = 14;
          playSound("hurt");
          burst(player.x, player.y, "#ff5353", 12);
        }
        if (cobolSnake.x < -120 || cobolSnake.x > WORLD.width + 120) {
          cobolSnake.active = false;
          cobolSnake.cd = 12 + Math.random() * 8;
        }
      } else if (runOriginRef.current === "secret") {
        cobolSnake.cd -= delta;
        if (cobolSnake.hist.length) {
          cobolSnake.hist.pop();
          cobolSnake.hist.pop();
        }
        if (cobolSnake.cd <= 0) {
          cobolSnake.active = true;
          cobolSnake.t = 0;
          cobolSnake.dir = Math.random() < 0.5 ? 1 : -1;
          cobolSnake.y0 = 140 + Math.random() * (WORLD.height - 280);
        }
      }

      meetingZones.forEach((zone) => {
        zone.r = zone.base + Math.sin(frame / 40 + zone.ph) * 6;
      });

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
        if (obstacles.some((obstacle) => pointInRect(shot, obstacle))) {
          shot.ttl = 0;
          burst(shot.x, shot.y, "#94a3b8", 3);
        }
      }

      for (let i = enemies.length - 1; i >= 0; i -= 1) {
        const enemy = enemies[i];
        if (enemy.hp > 0 && distance(enemy, player) < enemy.size * 0.55 + player.size * 0.55) {
          if (player.invincible <= 0) {
            const damage = enemy.kind === "secretBoss"
              ? 20
              : enemy.kind === "boss"
                ? 18
                : enemy.kind === "data"
                  ? 13
                  : enemy.kind === "vip" || enemy.kind === "legacy"
                    ? 12
                    : enemy.kind === "cron"
                      ? 15
                      : enemy.kind === "incident"
                        ? 15
                        : enemy.kind === "daemon"
                          ? 10
                          : 8;
            player.hp -= damage;
            player.invincible = 0.92;
            damageFlash = 16;
            shake = 14;
            playSound("hurt");
            burst(player.x, player.y, "#ff5353", 16);
            if (enemy.kind !== "boss" && enemy.kind !== "secretBoss" && enemy.kind !== "cron") enemies.splice(i, 1);
          }
        }
      }

      for (let s = shots.length - 1; s >= 0; s -= 1) {
        const shot = shots[s];
        if (!shot) {
          shots.splice(s, 1);
          continue;
        }
        if (shot.ttl <= 0 || shot.x < -20 || shot.x > WORLD.width + 20 || shot.y < -20 || shot.y > WORLD.height + 20) {
          shots.splice(s, 1);
          continue;
        }
        for (let e = enemies.length - 1; e >= 0; e -= 1) {
          const enemy = enemies[e];
          if (!enemy || enemy.hp <= 0) continue;
          if (distance(shot, enemy) < enemy.size * 0.55 + 7) {
            const damage = player.fury > 0 ? 26 : player.focus > 0 ? 23 : 18;
            enemy.hp -= damage;
            shots.splice(s, 1);
            playSound("hit");
            burst(shot.x, shot.y, enemy.kind === "boss" || enemy.kind === "secretBoss" ? "#f9c74f" : "#65d6ad", 4);
            if (enemy.hp <= 0) {
              localScore += enemy.kind === "secretBoss"
                ? 900
                : enemy.kind === "boss"
                ? 500
                : enemy.kind === "data"
                  ? 80
                  : enemy.kind === "vip" || enemy.kind === "legacy"
                    ? 95
                    : enemy.kind === "cron"
                      ? 75
                      : enemy.kind === "incident"
                        ? 70
                        : enemy.kind === "daemon"
                          ? 65
                          : enemy.kind === "qa"
                            ? 60
                            : 45;
              if (enemy.kind === "cron") {
                // Não remove: fica "derrubado" e o próprio loop de movimento
                // (mais acima) o ressuscita depois de alguns segundos.
                enemy.cooldown = 300;
                burst(enemy.x, enemy.y, "#d4ff5e", 14);
                syncHud();
                break;
              }
              if (enemy.kind === "secretBoss") {
                player.fury = 5;
                player.hp = clamp(player.hp + 22, 0, player.maxHp);
                burst(enemy.x, enemy.y, "#ffd166", 28);
                burst(enemy.x, enemy.y, "#facc15", 24);
                syncHud();
                setScore(localScore);
                setWave(localWave);
                setLastOutcome("won");
                setScoreSaved(false);
                playSound("won");
                stopMusic();
                stateRef.current = "won";
                setGameState("won");
              } else if (enemy.kind === "boss") {
                const finalBoss = isFinalBoss();
                const currentBossPhase = enemy.bossPhase ?? 1;
                player.fury = 5;
                player.hp = clamp(player.hp + 22, 0, player.maxHp);
                if (finalBoss && currentBossPhase < 3) {
                  enemy.bossPhase = currentBossPhase + 1;
                  enemy.maxHp = scaledEnemyHp(finalBossHp(enemy.bossPhase), callLoops);
                  enemy.hp = enemy.maxHp;
                  enemy.size = 62 + enemy.bossPhase * 6;
                  enemy.speed += 7;
                  enemy.cooldown = 64;
                  bossBanner = 130;
                  announceEffect(`DIRETORIA FASE ${enemy.bossPhase}: benefício removido`);
                  burst(enemy.x, enemy.y, "#f97316", 30);
                  syncHud();
                  break;
                }
                bossIndex += 1;
                localWave += 1;
                bossKills = 0;
                bossSpawned = false;
                spawnObstacles();
                burst(enemy.x, enemy.y, "#ffd166", 28);
                if (finalBoss) {
                  spawnFinalChoices(enemy.x, enemy.y);
                } else if (bossIndex >= bossNames.length) {
                    syncHud();
                    setScore(localScore);
                    setWave(localWave);
                    setLastOutcome("won");
                    setScoreSaved(false);
                    playSound("won");
                    stopMusic();
                    stateRef.current = "won";
                    setGameState("won");
                }
              } else {
                countBossProgress();
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

    // "O Mainframe": máquina imóvel com grade de LEDs e núcleo que telegrafa
    // o ataque (verde parado, amarelo/vermelho piscando ao mirar, branco no
    // disparo) — porte fiel à maquete original da fase secreta.
    function drawMainframeBoss(actor: Actor) {
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
        drawMainframeBoss(actor);
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

    function drawObstacle(obstacle: Obstacle) {
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

    function drawPowerUp(powerUp: PowerUp) {
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

    function drawFinalChoiceScene() {
      if (!finalBossCorpse) return;
      const x = finalBossCorpse.x - 50;
      const y = finalBossCorpse.y - 24;
      pixelRect(ctx, finalBossCorpse.x - 70, finalBossCorpse.y + 42, 140, 8, "rgba(0, 0, 0, 0.4)");
      pixelRect(ctx, x, y + 16, 98, 58, "#450a0a");
      pixelRect(ctx, x + 6, y + 22, 86, 46, "#7f1d1d");
      pixelRect(ctx, x + 16, y + 8, 64, 16, "#f97316");
      pixelRect(ctx, x + 14, y + 34, 12, 8, "#fef3c7");
      pixelRect(ctx, x + 72, y + 34, 12, 8, "#fef3c7");
      pixelRect(ctx, x + 30, y + 54, 38, 5, "#111827");
      pixelRect(ctx, x - 18, y + 58, 120, 8, "#020617");
      ctx.fillStyle = "#facc15";
      ctx.font = "bold 18px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText("DIRETORIA CAIU", WORLD.width / 2, 72);
      ctx.fillStyle = "#bfdbfe";
      ctx.font = "14px 'Courier New', monospace";
      ctx.fillText("Escolha a sua próxima mentira corporativa", WORLD.width / 2, 96);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "12px 'Courier New', monospace";
      ctx.fillText("Encoste no powerup ou toque nele para confirmar", WORLD.width / 2, 120);
      ctx.fillStyle = "#fde68a";
      ctx.fillText("Promoção encerra · Chamado reinicia mantendo pontos", WORLD.width / 2, 140);
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
      drawCharacterBody(ctx, x, y, {
        bodyColor: player.fury > 0 ? "#f97316" : activeCharacter.bodyColor,
        faceColor: blink ? "#fee2e2" : "#f5d0a9",
        runOffset: run,
      });
      pixelRect(ctx, x + 20, y + 6, 16, 7, "#facc15");
      pixelRect(ctx, x + 34, y + 8, 7, 3, "#fde68a");
      if (stateRef.current !== "choice" && shotTimer < 0.06) pixelRect(ctx, x + 40, y + 7, 10, 5, "#f97316");
      ctx.fillStyle = "#f8fafc";
      ctx.font = "10px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText(activeCharacter.name, player.x, player.y - 20);
      if (callLoops > 0) {
        ctx.fillStyle = "#facc15";
        ctx.font = "bold 14px 'Courier New', monospace";
        ctx.fillText(`+${callLoops}`, player.x, player.y - 36);
      }
    }

    function drawDatacenterFloor() {
      for (let x = 0; x < WORLD.width; x += 32) {
        for (let y = 0; y < WORLD.height; y += 32) {
          const h = ((x / 32) * 7 + (y / 32) * 13) % 5;
          ctx.fillStyle = h < 2 ? "#5c6a72" : h < 4 ? "#52606a" : "#4d5a63";
          ctx.fillRect(x, y, 32, 32);
          ctx.strokeStyle = "#39444c";
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, 30, 30);
        }
      }
      ctx.strokeStyle = "#2b3438";
      ctx.lineWidth = 2;
      for (const crack of datacenterCracks) {
        ctx.beginPath();
        ctx.moveTo(crack[0].x, crack[0].y);
        for (const point of crack) ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
      for (const moss of datacenterMoss) {
        ctx.fillStyle = "#3f8a3a";
        ctx.beginPath();
        ctx.ellipse(moss.x, moss.y, moss.r, moss.r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        pixelRect(ctx, moss.x - moss.r * 0.4, moss.y - 3, 4, 3, "#6abf5e");
      }
      for (const puddle of datacenterPuddles) {
        ctx.fillStyle = "#5aa8c0";
        ctx.beginPath();
        ctx.ellipse(puddle.x, puddle.y, puddle.rx, puddle.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#9fd8e8";
        ctx.beginPath();
        ctx.ellipse(puddle.x, puddle.y - 2, puddle.rx * 0.85, puddle.ry * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawGrid() {
      if (runOriginRef.current === "secret") {
        drawDatacenterFloor();
        return;
      }
      const theme = Math.min(bossIndex, biomeNames.length - 1);
      const floor = ["#101827", "#1b1620", "#071a2f", "#211414"][theme] ?? "#101827";
      const tile = ["#132033", "#261b2c", "#0d2745", "#321b1b"][theme] ?? "#132033";
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
      ctx.fillText(`Você limpou a firma com ${localScore} pontos`, cx, 342);
      ctx.fillStyle = "#fde68a";
      ctx.font = "14px 'Courier New', monospace";
      ctx.fillText("Salve seu nome no HIGH SCORES", cx, 378);
    }

    function draw() {
      const choosingFinalReward = stateRef.current === "choice" || finalChoicePending;
      const shakeX = shake > 0 ? (Math.random() - 0.5) * shake : 0;
      const shakeY = shake > 0 ? (Math.random() - 0.5) * shake : 0;
      ctx.save();
      ctx.translate(shakeX, shakeY);
      drawGrid();
      if (choosingFinalReward) drawFinalChoiceScene();
      if (!choosingFinalReward) obstacles.forEach(drawObstacle);
      if (runOriginRef.current === "secret" && !choosingFinalReward) {
        for (const zone of meetingZones) {
          pixelRect(ctx, zone.x - zone.r, zone.y - zone.r * 0.6, zone.r * 2, zone.r * 1.2, "rgba(22,78,99,0.22)");
          ctx.strokeStyle = "#7dff6a";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(zone.x, zone.y, zone.r, zone.r * 0.6, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "#f8fafc";
          ctx.font = "9px 'Courier New', monospace";
          ctx.textAlign = "center";
          ctx.fillText("REUNIÃO", zone.x, zone.y - zone.r * 0.6 - 12);
        }
        for (let i = cobolSnake.hist.length - 1; i >= 0; i -= 3) {
          const point = cobolSnake.hist[i];
          const r = 10 - (i / cobolSnake.hist.length) * 7;
          ctx.fillStyle = i % 6 < 3 ? "#3f8a3a" : "#2e6e2e";
          ctx.beginPath();
          ctx.arc(point.x, point.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        if (cobolSnake.active) {
          ctx.fillStyle = "#2e6e2e";
          ctx.beginPath();
          ctx.arc(cobolSnake.x, cobolSnake.y, 11, 0, Math.PI * 2);
          ctx.fill();
          pixelRect(ctx, cobolSnake.x + (cobolSnake.dir > 0 ? 3 : -6), cobolSnake.y - 4, 3, 3, "#ffd94d");
          ctx.strokeStyle = "#ff5a4d";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cobolSnake.x + cobolSnake.dir * 11, cobolSnake.y);
          ctx.lineTo(cobolSnake.x + cobolSnake.dir * 17, cobolSnake.y);
          ctx.stroke();
          ctx.fillStyle = "#f8fafc";
          ctx.font = "9px 'Courier New', monospace";
          ctx.textAlign = "center";
          ctx.fillText("COBOL SNAKE", cobolSnake.x, cobolSnake.y - 20);
        }
      }
      for (const particle of particles) {
        const size = Math.max(2, Math.min(8, particle.ttl / 6));
        pixelRect(ctx, particle.x, particle.y, size, size, particle.color);
      }
      if (!choosingFinalReward) {
        for (const shot of shots) {
          pixelRect(ctx, shot.x - shot.vx * 0.018 - 4, shot.y - shot.vy * 0.018 - 2, 8, 4, "#fde68a");
          pixelRect(ctx, shot.x - 5, shot.y - 3, 10, 6, "#facc15");
          pixelRect(ctx, shot.x + 3, shot.y - 1, 4, 2, "#fef9c3");
        }
        for (const shot of secretBossShots) {
          ctx.save();
          ctx.shadowColor = "#ff5a4d";
          ctx.shadowBlur = 6;
          ctx.fillStyle = "#ff5a4d";
          ctx.beginPath();
          ctx.arc(shot.x, shot.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      powerUps.forEach(drawPowerUp);
      if (!choosingFinalReward) enemies.sort((a, b) => a.y - b.y).forEach(drawActor);
      drawPlayer();
      ctx.restore();

      if (damageFlash > 0) {
        ctx.fillStyle = `rgba(239, 68, 68, ${Math.min(0.32, damageFlash / 55)})`;
        ctx.fillRect(0, 0, WORLD.width, WORLD.height);
      }

      if (bossBanner > 0 && stateRef.current === "playing" && !finalChoicePending) {
        ctx.fillStyle = "rgba(2, 6, 23, 0.76)";
        ctx.fillRect(0, 26, WORLD.width, 58);
        ctx.fillStyle = "#facc15";
        ctx.font = "bold 28px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.fillText("CHEFE ENTROU NA CALL", WORLD.width / 2, 64);
      }

      if (effectBanner > 0 && (stateRef.current === "playing" || stateRef.current === "choice")) {
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
        drawOverlay("PRODUÇÃO CAIU", `Pontuação final: ${localScore}`);
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
      window.removeEventListener(DEBUG_ACTION_EVENT, onDebugAction);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      stopMusic();
    };
    // `theme` is a dependency on purpose: ClassicHud and NeonHud each own a
    // separate <canvas ref={canvasRef}>, so switching themes (including the
    // classico->neon swap useThemePreference does right after mount, once
    // it reads the saved cookie) unmounts one canvas and mounts the other
    // under the same ref. Without re-running this effect, it stays bound
    // (via the `canvas` closure above) to whichever canvas existed when it
    // first ran, and the arena reads as permanently black once that one is
    // detached. Safe to reset on: theme can only be changed from the title
    // screen (see ClassicHud/NeonHud, no "Configurações" entry point exists
    // during "playing"/"paused"), so there's never a run in progress to
    // lose.
  }, [activateMenuOption, playSound, resumeGame, startMusic, stopMusic, theme]);

  const status = gameState === "playing" ? "Em combate" : gameState === "choice" ? "Escolha final" : gameState === "paused" ? "Pausado" : gameState === "promotion" ? "Promoção?" : gameState === "won" ? "Vitória" : gameState === "over" ? "Fim de jogo" : "Pronto";
  const showAdBanner = gameState === "playing" && Boolean(adsenseClientId && adsenseBannerSlotId);

  useEffect(() => {
    if (!showAdBanner) {
      adBannerPushedRef.current = false;
      return;
    }
    if (adBannerPushedRef.current || !adBannerRef.current) return;
    try {
      const adsbygoogle = (window as Window & { adsbygoogle?: unknown[] }).adsbygoogle ?? [];
      adsbygoogle.push({});
      (window as Window & { adsbygoogle?: unknown[] }).adsbygoogle = adsbygoogle;
      adBannerPushedRef.current = true;
    } catch {
      // Script do AdSense ainda não carregou ou foi bloqueado; sem problema, tentamos de novo no próximo mount.
    }
  }, [showAdBanner]);

  const hudProps: HudProps = {
    status,
    hp,
    score,
    wave,
    resetCount,
    boss,
    biome,
    upgrade,
    bossProgress,
    burstStaminaPct,
    abilityCooldownPct,
    muted,
    volume,
    gameState,
    menuPanel,
    menuIndex,
    highScores,
    selectedCharacterId,
    settingsOpen,
    theme,
    supportOpen,
    debugOpen,
    playerName,
    scoreSaved,
    scoreMessage,
    promotionCountdown,
    bossKillsCount,
    bossKillTargetCount,
    bossEncountered,
    bossIncident,
    enemyCount,
    damageFlash,
    debugBossHealth,
    debugPowerUpCount,
    debugAbilityCooldown,
    debugPlayerPosition,
    debugPlayerEffects,
    setMuted,
    setVolume,
    setMenuIndex,
    activateMenuOption,
    setMenuPanel,
    setSelectedCharacterId,
    openSettingsPanel,
    closeSettingsPanel,
    setTheme,
    setSupportOpen,
    setDebugOpen,
    setPlayerName,
    submitScore,
    startNewGame,
    resumeGame,
    returnToTitle,
    canvasRef,
    adBannerRef,
    characterPortraitRefs,
    debugFirstActionRef,
  };

  return theme === "neon" ? <NeonHud {...hudProps} /> : <ClassicHud {...hudProps} />;
}
