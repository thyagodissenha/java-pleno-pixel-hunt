import type { FormEvent, RefObject } from "react";
import type { HighScore } from "@/lib/score-sync";
import type { ThemeId } from "@/lib/theme/theme-cookie";

// app/page.tsx can't export extra names (AD-008 — it's a route file), so
// GameState/MenuPanel live here and app/page.tsx imports them from here.
export type GameState = "menu" | "playing" | "paused" | "over" | "won" | "promotion" | "choice";
export type MenuPanel = "home" | "scores" | "help" | "skins";

export interface HudProps {
  // leitura
  status: string;
  hp: number;
  score: number;
  wave: number;
  resetCount: number;
  boss: string;
  biome: string;
  upgrade: string;
  bossProgress: string;
  burstStaminaPct: number;
  abilityCooldownPct: number;
  muted: boolean;
  volume: number;
  gameState: GameState;
  menuPanel: MenuPanel;
  menuIndex: number;
  highScores: HighScore[];
  selectedCharacterId: string;
  settingsOpen: boolean;
  theme: ThemeId;
  supportOpen: boolean;
  debugOpen: boolean;
  playerName: string;
  scoreSaved: boolean;
  scoreMessage: string;
  promotionCountdown: number;
  // neon-only (canvas header/footer parity — wired to the engine in T6)
  bossKillsCount: number;
  bossKillTargetCount: number;
  bossEncountered: boolean;
  bossIncident: boolean;
  enemyCount: number;
  damageFlash: number;
  // debug
  debugBossHealth: { hp: number; maxHp: number } | null;
  debugPowerUpCount: number;
  debugAbilityCooldown: number;
  debugPlayerPosition: { x: number; y: number };
  debugPlayerEffects: { haste: number; invincible: number };
  // ação
  setMuted: (value: boolean | ((current: boolean) => boolean)) => void;
  setVolume: (value: number) => void;
  setMenuIndex: (index: number) => void;
  activateMenuOption: (index: number) => void;
  setMenuPanel: (panel: MenuPanel) => void;
  setSelectedCharacterId: (id: string) => void;
  openSettingsPanel: () => void;
  closeSettingsPanel: () => void;
  setTheme: (theme: ThemeId) => void;
  setSupportOpen: (open: boolean) => void;
  setDebugOpen: (open: boolean) => void;
  setPlayerName: (name: string) => void;
  submitScore: (event: FormEvent<HTMLFormElement>) => void;
  startNewGame: () => void;
  resumeGame: () => void;
  returnToTitle: () => void;
  // refs
  canvasRef: RefObject<HTMLCanvasElement | null>;
  adBannerRef: RefObject<HTMLModElement | null>;
  characterPortraitRefs: RefObject<Array<HTMLCanvasElement | null>>;
  debugFirstActionRef: RefObject<HTMLButtonElement | null>;
}
