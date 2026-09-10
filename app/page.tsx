"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  createDebugKeyHandler,
  DEBUG_ACTION_EVENT,
  isDebugAction,
  isDebugAllowed,
} from "@/lib/debug";
import { getAdsenseBannerSlotId, getPublicAdsenseClientId } from "@/lib/adsense";
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
import { drawCharacterBody } from "@/lib/character-sprite";
import type { GameState, HudProps, MenuPanel } from "@/app/_hud/hud-props";
import { ClassicHud } from "@/app/_hud/classic/ClassicHud";
import { NeonHud } from "@/app/_hud/neon/NeonHud";
import { isOpeningCutscenePlaying } from "@/app/_hud/cutscene/OpeningCutscene";
import { CHARACTERS, DEFAULT_CHARACTER_ID, resolveCharacter } from "@/lib/characters";
import { createEngine, type Engine } from "@/lib/pixel-hunt-engine/orchestrator";
import { normalRunGraph } from "@/lib/pixel-hunt-engine/phases/normal-run/graph";
import { secretMainframeGraph } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/graph";
import type { EngineSnapshot } from "@/lib/pixel-hunt-engine/types";

const adsenseClientId = getPublicAdsenseClientId();
const adsenseBannerSlotId = getAdsenseBannerSlotId();

const WORLD = { width: 960, height: 540 };
const SOUND_KEY = "java-pleno-pixel-hunt-sound";
const BURST_STAMINA_MAX = 100;

function loadSoundSettings() {
  if (typeof window === "undefined") return { muted: false, volume: 0.35 };
  try {
    const stored = window.localStorage.getItem(SOUND_KEY);
    if (!stored) return { muted: false, volume: 0.35 };
    const parsed = JSON.parse(stored) as { muted?: boolean; volume?: number };
    return {
      muted: Boolean(parsed.muted),
      volume: Math.max(0, Math.min(1, Number(parsed.volume) || 0.35)),
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
  const engineRef = useRef<Engine | null>(null);
  const gameStateRef = useRef<GameState>("menu");
  const promotionExpiredRef = useRef(false);
  const menuPanelRef = useRef<MenuPanel>("home");
  const selectedCharacterIdRef = useRef(DEFAULT_CHARACTER_ID);
  const characterPortraitRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const menuIndexRef = useRef(0);
  const debugFirstActionRef = useRef<HTMLButtonElement | null>(null);
  const cheatBufferRef = useRef("");
  const drainPromiseRef = useRef<Promise<void> | null>(null);
  const soundHydratedRef = useRef(false);
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
  const [biome, setBiome] = useState("Escritório");
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
  const [bossKillTargetCount, setBossKillTargetCount] = useState(14);
  const [bossEncountered, setBossEncountered] = useState(false);
  const [bossIncident, setBossIncident] = useState(false);
  const [enemyCount, setEnemyCount] = useState(0);
  const [damageFlash, setDamageFlash] = useState(0);
  const { theme, setTheme } = useThemePreference();

  // Aplica um `EngineSnapshot` (de `engine.tick()`, `handleDebugAction()`,
  // `activateSpecialPower()`, `start(graph)`) aos `useState` que hoje o HUD
  // lê — o único ponto de contato motor→React (ver design.md § Architecture
  // Overview). Definido no nível do componente (não dentro do efeito do
  // game loop) para que os outros pontos que chamam ações síncronas do
  // motor (cheat `idclip`, `startNewGame`, clique no menu) também consigam
  // refletir o resultado no MESMO evento, sem esperar o próximo
  // `requestAnimationFrame` — igual ao original, onde
  // `start()`/`startSecretRun()`/`triggerActivePower()` chamavam
  // `syncHud()` diretamente no fim de si mesmas (T5/T6: unificados em
  // `Engine.start(graph: PhaseGraph)`, ver orchestrator.ts).
  const applyGameState = useCallback((snapshot: EngineSnapshot) => {
    if (snapshot.gameState === "playing") promotionExpiredRef.current = false;
    const displayed = snapshot.gameState === "promotion" && promotionExpiredRef.current ? "over" : snapshot.gameState;
    gameStateRef.current = displayed;
    setGameState(displayed);
  }, []);

  const applyHudFields = useCallback((snapshot: EngineSnapshot) => {
    setScore(snapshot.score);
    setWave(snapshot.wave);
    setResetCount(snapshot.resetCount);
    setHp(snapshot.hp);
    setBoss(snapshot.boss);
    setBiome(snapshot.biome);
    setUpgrade(snapshot.upgrade);
    setBossProgress(snapshot.bossProgress);
    setBurstStaminaPct(snapshot.burstStaminaPct);
    setAbilityCooldownPct(snapshot.abilityCooldownPct);
    setBossKillsCount(snapshot.bossKillsCount);
    setBossKillTargetCount(snapshot.bossKillTargetCount);
    setBossEncountered(snapshot.bossEncountered);
    setBossIncident(snapshot.bossIncident);
    setEnemyCount(snapshot.enemyCount);
    setDamageFlash(snapshot.damageFlash);
    setDebugBossHealth(snapshot.debug.bossHealth);
    setDebugPowerUpCount(snapshot.debug.powerUpCount);
    if (isDebugAllowed()) {
      setDebugAbilityCooldown(snapshot.debug.abilityCooldown);
      setDebugPlayerPosition(snapshot.debug.playerPosition);
      setDebugPlayerEffects(snapshot.debug.playerEffects);
    }
  }, []);

  const applySnapshot = useCallback((snapshot: EngineSnapshot) => {
    applyGameState(snapshot);
    applyHudFields(snapshot);
  }, [applyGameState, applyHudFields]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    menuPanelRef.current = menuPanel;
  }, [menuPanel]);

  useEffect(() => {
    selectedCharacterIdRef.current = selectedCharacterId;
    engineRef.current?.setCharacter(selectedCharacterId);
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
      setMuted(savedSound.muted);
      setVolume(savedSound.volume);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    engineRef.current?.setAudioPrefs({ muted, volume });
    if (!soundHydratedRef.current) return;
    window.localStorage.setItem(SOUND_KEY, JSON.stringify({ muted, volume }));
    if (muted || volume <= 0) engineRef.current?.stopMusic();
    else if (gameStateRef.current === "playing") engineRef.current?.startMusic();
  }, [muted, volume]);

  useEffect(() => {
    if (gameState === "playing") engineRef.current?.startMusic();
    else engineRef.current?.stopMusic();
  }, [gameState]);

  // Detecta a transição de `gameState` para os estados que antes recebiam
  // `setLastOutcome`/`setScoreSaved`/`setPromotionCountdown` diretamente em
  // cada ponto do motor original (hp <= 0, chefe final derrotado, chefe
  // secreto derrotado, "Testar Tela de Vitória" do debug, escolha de
  // "promoção"): guarda o resultado da run para o formulário de envio de
  // score. Feito durante a renderização (não num `useEffect`) seguindo o
  // padrão recomendado pelo React para "ajustar estado quando outro estado
  // muda" — chamar `setState` de forma síncrona dentro de um efeito
  // dispara uma cascata de re-renders extra e é sinalizado pelo lint
  // (`react-hooks/set-state-in-effect`).
  const previousGameStateRef = useRef<GameState>("menu");
  if (previousGameStateRef.current !== gameState) {
    previousGameStateRef.current = gameState;
    if (gameState === "over" || gameState === "won") {
      setLastOutcome(gameState);
      setScoreSaved(false);
    } else if (gameState === "promotion") {
      setLastOutcome("over");
      setScoreSaved(true);
      setPromotionCountdown(3);
    }
  }

  const createDebugKeyHandlerRef = useRef(createDebugKeyHandler);
  useEffect(() => {
    const handler = createDebugKeyHandlerRef.current();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (gameState !== "menu" || menuPanel !== "home") cheatBufferRef.current = "";
  }, [gameState, menuPanel]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (gameStateRef.current !== "menu" || menuPanelRef.current !== "home") return;
      cheatBufferRef.current = appendCheatBuffer(cheatBufferRef.current, event.key);
      const matched = matchCheatCode(cheatBufferRef.current);
      if (!matched) return;
      cheatBufferRef.current = "";
      if (matched === "idclip") {
        setScoreSaved(true);
        setPlayerName("");
        setSupportOpen(false);
        promotionExpiredRef.current = false;
        engineRef.current?.playSound("start");
        const snapshot = engineRef.current?.start(secretMainframeGraph);
        if (snapshot) applySnapshot(snapshot);
      } else {
        setMenuPanel("skins");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [applySnapshot]);

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
    promotionExpiredRef.current = false;
    engineRef.current?.playSound("start");
    const snapshot = engineRef.current?.start(normalRunGraph);
    if (snapshot) applySnapshot(snapshot);
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
    setBiome("Escritório");
    setUpgrade("JDK 8");
    setBossProgress("0/14 mobs");
    setBurstStaminaPct(BURST_STAMINA_MAX);
    gameStateRef.current = "menu";
    setGameState("menu");
    engineRef.current?.returnToMenu();
  }

  const resumeGame = useCallback(() => {
    engineRef.current?.resume();
    gameStateRef.current = "playing";
    setGameState("playing");
  }, []);

  function openSupportPanel() {
    if (gameStateRef.current === "playing") {
      engineRef.current?.pause();
      gameStateRef.current = "paused";
      setGameState("paused");
    }
    setSupportOpen(true);
  }

  function openSettingsPanel() {
    if (gameStateRef.current === "playing") {
      engineRef.current?.pause();
      gameStateRef.current = "paused";
      setGameState("paused");
    }
    setSettingsOpen(true);
  }

  function closeSettingsPanel() {
    setSettingsOpen(false);
  }

  useEffect(() => {
    if (gameState !== "promotion") return;
    // `setLastOutcome`/`setScoreSaved`/`setPromotionCountdown` na entrada de
    // "promotion" já são feitos durante a renderização, no bloco acima que
    // observa `previousGameStateRef` — este efeito só cuida dos timers
    // (efeito colateral genuíno, não substituível por ajuste em render).
    const interval = window.setInterval(() => {
      setPromotionCountdown((current) => Math.max(0, current - 1));
    }, 1000);
    const timeout = window.setTimeout(() => {
      setScoreSaved(false);
      promotionExpiredRef.current = true;
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
    if (engineRef.current?.getRunOrigin() === "debug") {
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
      engineRef.current?.playSound("save");
      setScoreSaved(true);
    } catch {
      const nextScores = [entry, ...highScores]
        .sort((a, b) => b.score - a.score || b.wave - a.wave || (b.resets ?? 0) - (a.resets ?? 0))
        .slice(0, 10);
      enqueuePendingScore(pendingEntry);
      saveHighScores(nextScores);
      setHighScores(nextScores);
      setScoreMessage("Ranking local salvo. Global indisponível.");
      engineRef.current?.playSound("save");
      setScoreSaved(true);
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (!ctx) return;

    const engine = createEngine({
      character: resolveCharacter(selectedCharacterIdRef.current),
      canvasWidth: WORLD.width,
      canvasHeight: WORLD.height,
    });
    engineRef.current = engine;
    engine.setAudioPrefs({ muted, volume });

    const onDebugAction = (event: Event) => {
      const action = (event as CustomEvent<unknown>).detail;
      if (!isDebugAllowed() || !isDebugAction(action)) return;

      if (action === "toggle_menu") {
        setDebugOpen((current) => !current);
        return;
      }

      setDebugOpen(false);
      applySnapshot(engine.handleDebugAction(action));
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isTyping) return;

      if (event.key.toLowerCase() === "q" && !event.repeat) {
        const powerSnapshot = engine.activateSpecialPower();
        if (powerSnapshot) applySnapshot(powerSnapshot);
      }

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "w", "a", "s", "d", "W", "A", "S", "D", "Enter", "Escape"].includes(event.key)) {
        event.preventDefault();
      }
      if (gameStateRef.current === "menu" && menuPanelRef.current === "home" && !isOpeningCutscenePlaying()) {
        if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
          menuIndexRef.current = (menuIndexRef.current + 4) % 5;
          setMenuIndex(menuIndexRef.current);
          engine.playSound("hit");
        } else if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
          menuIndexRef.current = (menuIndexRef.current + 1) % 5;
          setMenuIndex(menuIndexRef.current);
          engine.playSound("hit");
        } else if (event.key === "Enter" || event.key === " ") {
          activateMenuOption(menuIndexRef.current);
        }
      } else if (event.key === "Enter" && gameStateRef.current === "menu") {
        activateMenuOption(0);
      } else if (event.key === "Escape" && gameStateRef.current === "menu" && menuPanelRef.current !== "home") {
        setMenuPanel("home");
      }
      if (event.key === "Escape" && gameStateRef.current === "playing") {
        engine.pause();
        gameStateRef.current = "paused";
        setGameState("paused");
      } else if (event.key === "Escape" && gameStateRef.current === "paused") {
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
      // Clique/toque direto num dos dois power-ups da "escolha final"
      // resolve instantaneamente, no mesmo evento (fix1, ENGINE-16 —
      // restaura o comportamento pré-migração do motor).
      if (gameStateRef.current === "choice") {
        const snap = engine.resolveFinalChoiceClick(pointer.current.x, pointer.current.y);
        if (snap) {
          applySnapshot(snap);
          return;
        }
      }
      if (gameStateRef.current === "menu") {
        engine.playSound("start");
        applySnapshot(engine.start(normalRunGraph));
      }
      if (gameStateRef.current === "paused") {
        resumeGame();
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

    let raf = 0;
    // Throttle de sincronização de HUD (fix1, ENGINE-17) — mesma cadência
    // do código pré-refactor (`frame % 18 === 0`, `git show
    // 06093ed:app/page.tsx:1468,1886`): fora de um evento discreto
    // (`hudSyncRequested`, T9/T10), o HUD só sincroniza a cada 18 frames de
    // `requestAnimationFrame`, não em todo frame. Qualquer evento discreto
    // (dano, power-up coletado, chefe derrotado etc.) ainda sincroniza no
    // MESMO frame, independente do contador. Chamadas de `applySnapshot`
    // fora deste loop (start/pause/debug/clique na escolha final/etc.)
    // continuam imediatas, sem throttle.
    let hudFrame = 0;
    function tick(now: number) {
      const snapshot = engine.tick(now, { keys: keys.current, pointer: pointer.current }, ctx);
      hudFrame += 1;
      if (snapshot.hudSyncRequested || hudFrame % 18 === 0) {
        applySnapshot(snapshot);
      }
      raf = requestAnimationFrame(tick);
    }
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
      engine.stopMusic();
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
    // lose — the engine (and its world) is recreated along with the canvas
    // binding, matching the pre-migration behavior where the entire effect
    // (including the game world's local state) reran on theme change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activateMenuOption, applySnapshot, resumeGame, theme]);

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
