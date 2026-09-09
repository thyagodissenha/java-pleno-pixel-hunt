// Tipos compartilhados do motor de jogo (lib/pixel-hunt-engine).
//
// Movidos 1:1 (mesma forma) de `app/page.tsx:44-126`, mais os tipos novos
// definidos em `_docs/specs/features/motor-de-jogo-modular/design.md`
// (seção "Data Models"). Nenhum import de `react` neste arquivo — o motor
// não conhece React.

import type { CharacterDefinition } from "@/lib/characters";
import type { GameState } from "@/app/_hud/hud-props";

export type EnemyKind =
  | "user"
  | "boss"
  | "data"
  | "qa"
  | "vip"
  | "incident"
  | "legacy"
  | "secretBoss"
  | "daemon"
  | "cron";

export type ObstacleKind = "desk" | "server" | "firewall" | "board" | "rack" | "crt" | "chair" | "fern" | "shroom";

export type PowerUpKind =
  | "coffee"
  | "refactor"
  | "rollback"
  | "hotfix"
  | "review"
  | "stamina"
  | "promotion"
  | "call";

export type SoundName = "shoot" | "hit" | "hurt" | "boss" | "over" | "save" | "start" | "won";

export type Tone = [frequency: number, duration: number, type: OscillatorType];

export type Actor = {
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

export type Shot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  color: string;
};

export type PowerUp = {
  x: number;
  y: number;
  kind: PowerUpKind;
  ttl: number;
  pulse: number;
};

export type Obstacle = {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: ObstacleKind;
  label: string;
};

// Perigos da fase secreta ("O Mainframe") que não se encaixam no vocabulário
// normal de Actor/Obstacle do motor: projéteis reais do chefe (não são
// minions perseguidores), o "cobol snake" que atravessa a arena e as zonas
// de "reunião" que reduzem a velocidade do jogador.
export type SecretBossShot = { x: number; y: number; vx: number; vy: number };

export type MeetingZone = { x: number; y: number; base: number; r: number; ph: number };

export type CobolSnake = {
  active: boolean;
  cd: number;
  t: number;
  dir: number;
  y0: number;
  x: number;
  y: number;
  hist: Array<{ x: number; y: number }>;
};

export type RunOrigin = "normal" | "debug" | "secret";

// --- Novos tipos do motor (design.md § Data Models) ---------------------

export type Player = {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  size: number;
  speed: number;
  invincible: number;
  fury: number;
  focus: number;
  haste: number;
};

export type RunCounters = {
  score: number;
  wave: number;
  callLoops: number;
  bossIndex: number;
  bossKills: number;
  bossSpawned: boolean;
  finalChoicePending: boolean;
  weaponLevel: number;
  burstStamina: number;
  abilityCooldownRemaining: number;
  damageFlash: number;
  shake: number;
  bossBanner: number;
  effectMessage: string;
  effectBanner: number;
  finalBossCorpse: { x: number; y: number } | null;
  frame: number;
  visualFrame: number;
  spawnTimer: number;
  dataTimer: number;
  powerUpTimer: number;
  shotTimer: number;
  lastMoveX: number;
  lastMoveY: number;
};

// Estado local de cada Phase, guardado em `EngineWorld.phaseState`.
// Discriminado pelo campo `phase` (mesmo literal de `EnginePhase.id`,
// `phases/phase.ts`) — fix2, T4 (ENGINE-28): antes `unknown`, com cada
// Phase (e `renderer.ts`/`orchestrator.ts`) fazendo cast + duck-typing
// (checagem de campo em runtime) para ler o próprio formato.
export type NormalRunPhaseState = {
  phase: "normal-run";
  localGameState: "playing" | "choice" | "over" | "won" | "promotion";
};

export type SecretMainframePhaseState = {
  phase: "secret-mainframe";
  localGameState: "playing" | "over" | "won";
  secretBossShots: SecretBossShot[];
  meetingZones: MeetingZone[];
  cobolSnake: CobolSnake;
  datacenterMoss: Array<{ x: number; y: number; r: number }>;
  datacenterCracks: Array<Array<{ x: number; y: number }>>;
};

export type PhaseState = NormalRunPhaseState | SecretMainframePhaseState;

export type EngineWorld = {
  player: Player;
  enemies: Actor[];
  shots: Shot[];
  particles: Particle[];
  powerUps: PowerUp[];
  obstacles: Obstacle[];
  run: RunCounters;
  // Estado local da Phase ativa, tipado como união discriminada por `phase`
  // (`PhaseState`, acima) — cada Phase só lê/popula seu próprio membro do
  // union.
  phaseState: PhaseState | null;
};

export type InputState = {
  keys: ReadonlySet<string>;
  pointer: { active: boolean; x: number; y: number };
};

export type DebugAction =
  | "toggle_menu"
  | "reset"
  | "spawn_boss"
  | "add_powerup"
  | "max_stamina"
  | "win_game";

export type FrameEvents = {
  playerHit: boolean;
  bossDefeated: boolean;
  gameOver: boolean;
  gameWon: boolean;
  // Eventos adicionais inventariados durante T5 (physics.ts) a partir dos
  // pontos de setGameState/announceEffect/playSound hoje disparados dentro
  // de update() — ver lib/pixel-hunt-engine/physics.ts.
  bossPhaseAdvanced: boolean;
  promotionClaimed: boolean;
  newCallRequested: boolean;
  // Setado por `collectPowerUp()` (physics.ts) para QUALQUER `PowerUpKind`
  // coletado — não só "promotion"/"call" (fix1, fundação de ENGINE-18: o
  // Orchestrator usa este campo, entre outros, para computar
  // `EngineSnapshot.hudSyncRequested`).
  powerUpCollected: boolean;
};

/** Fábrica única de `FrameEvents` vazio (todos os campos `false`) — fix2, ENGINE-27, dedupe de 3 cópias antes espalhadas em `physics.ts`/`normal-run/index.ts`/`secret-mainframe/index.ts`. */
export function emptyFrameEvents(): FrameEvents {
  return {
    playerHit: false,
    bossDefeated: false,
    gameOver: false,
    gameWon: false,
    bossPhaseAdvanced: false,
    promotionClaimed: false,
    newCallRequested: false,
    powerUpCollected: false,
  };
}

export type EngineSnapshot = {
  gameState: GameState;
  score: number;
  wave: number;
  resetCount: number;
  hp: number;
  boss: string;
  biome: string;
  upgrade: string;
  bossProgress: string;
  burstStaminaPct: number;
  abilityCooldownPct: number;
  bossKillsCount: number;
  bossKillTargetCount: number;
  bossEncountered: boolean;
  bossIncident: boolean;
  enemyCount: number;
  damageFlash: number;
  // Sinaliza que o HUD precisa sincronizar no MESMO frame (fix1, ENGINE-17/
  // ENGINE-18: throttle de sincronização de HUD) — true quando algum evento
  // discreto (`FrameEvents`) ocorreu neste `tick()`, ou quando o snapshot
  // veio de uma ação discreta fora de `tick()` (`start`/`startSecretRun`/
  // `handleDebugAction`/`activateSpecialPower`/`resolveFinalChoiceClick`).
  // Computado pelo `Orchestrator` (orchestrator.ts, T10) — ainda não
  // calculado nesta task (T9 só define o tipo).
  hudSyncRequested: boolean;
  debug: {
    bossHealth: { hp: number; maxHp: number } | null;
    powerUpCount: number;
    abilityCooldown: number;
    playerPosition: { x: number; y: number };
    playerEffects: { haste: number; invincible: number };
  };
};

export type { CharacterDefinition, GameState };
