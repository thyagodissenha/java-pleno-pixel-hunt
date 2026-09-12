// Tipos compartilhados do motor de jogo (lib/pixel-hunt-engine).
//
// Movidos 1:1 (mesma forma) de `app/page.tsx:44-126`, mais os tipos novos
// definidos em `_docs/specs/features/motor-de-jogo-modular/design.md`
// (seção "Data Models"). Nenhum import de `react` neste arquivo — o motor
// não conhece React.

import type { CharacterDefinition } from "@/lib/characters";
import type { GameState } from "@/app/_hud/hud-props";
import type { EnginePhase } from "@/lib/pixel-hunt-engine/phases/phase";
import type { AudioEngine } from "@/lib/pixel-hunt-engine/audio";

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
  | "cron"
  // NOVO (feature fase-secreta-datacenter, T1/SECBOSS-13..16): Cobra COBOL
  // como `Actor` completo (HP/contato/score), substituindo o hazard sem HP
  // que `cobol-snake.ts` representava.
  | "cobolSnake";

export type ObstacleKind = "desk" | "server" | "firewall" | "board" | "rack" | "crt" | "chair" | "fern" | "shroom";

export type PowerUpKind =
  | "coffee"
  | "refactor"
  | "rollback"
  | "hotfix"
  | "review"
  | "stamina"
  | "promotion"
  | "call"
  // NOVO (feature fase-secreta-datacenter, T1/T8, SECBOSS-27): drop de
  // "cafe.zip" da fase secreta — liga `haste`+`fury` (ambos já existentes).
  | "cafeZip";

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
  // NOVO (feature fase-secreta-datacenter, T15): passou de `number` (índice
  // único, ciclando 0→1→2→0) para `number[]` — a fase 4 (`CONFIG.PHASES[3]`,
  // `power: "random"`) sorteia entre 0 e 2 padrões por ciclo de ataque do
  // `secretBoss` (spec.md SECBOSS-33), então um único índice não basta mais.
  bossAtkPattern?: number[];
  // Hooks genéricos opcionais (design.md § Components → types.ts's Actor,
  // Fatia 2) — tornam `physics.ts`/`renderer/actors.ts` data-driven em vez
  // de checar `Actor.kind` diretamente. Setados pela Phase que spawna o
  // Actor (ex.: `phases/secret-mainframe/`); Actors que não os definem
  // mantêm o comportamento genérico de hoje.
  //
  // Chamado pelo death-handling genérico de `stepWorld` (physics.ts), ANTES
  // de remover o Actor de `world.enemies`. Retornar `true` impede a
  // remoção (ex.: `cron` "cai" mas fica com cooldown de revive).
  onDeath?: (world: EngineWorld, audio: AudioEngine, events: FrameEvents) => boolean | void;
  // Quando presente, `drawActor` (renderer/actors.ts) chama isso em vez do
  // corpo de desenho genérico.
  render?: (ctx: CanvasRenderingContext2D, actor: Actor, visualFrame: number) => void;
  // Quando `true`, o switch de IA genérico de `physics.ts` pula este Actor
  // inteiramente — a Phase ativa já o move por conta própria.
  customMovement?: boolean;
  // Cor do burst de partícula ao ser atingido por um tiro (physics.ts's
  // `resolveShotHitOnEnemy`) — mesmo padrão dos outros hooks: só usada por
  // Actors "especiais" que não são o `kind === "boss"` do `normal-run`
  // (esse permanece com cor própria hardcoded). Sem este campo, o Actor usa
  // a cor genérica de hoje.
  deathBurstColor?: string;
  // NOVO (feature fase-secreta-datacenter, T13/SECBOSS-04): marca um `cron`
  // que já "caiu" e foi revivido pelo cooldown de respawn
  // (`stepSecretEnemyAi`, `phases/secret-mainframe/index.ts`) — usado só
  // para decidir o peso de firewall (`CONFIG.W_PTS.respawned`, 0.5) na
  // PRÓXIMA morte desse mesmo Actor, distinguindo-a de uma morte "normal"
  // (peso 1). Sem efeito para qualquer outro `EnemyKind`.
  respawnedFromFallen?: boolean;
  // NOVO (fix cycle 2, SECBOSS-01/22-24): quando `true`, `drawActor`
  // (renderer/actors.ts) suprime a barra de vida genérica deste Actor —
  // aditivo, `undefined`/`false` preserva o comportamento de hoje para
  // qualquer outro `Actor`. Usado só pelo `secretBoss`
  // (`phases/secret-mainframe/index.ts`'s `spawnSecretEnemy`), cujo
  // `hp`/`maxHp` são forçados a um valor "sentinela" a cada frame
  // (`syncBossHpSentinel`) — sem isto, a barra genérica sempre aparecia
  // ~100% cheia/verde, contradizendo o progresso real mostrado pelo HUD
  // dedicado (`drawSecretPhaseHud`, hud.ts).
  hideHealthBar?: boolean;
  // NOVO (quick fix pós-feature, feedback do usuário): quando `true`,
  // `drawMainframeBoss` (rendering.ts) desenha um anel de escudo ao redor
  // do boss. Setado a cada frame pelo `update()` de `secret-mainframe`
  // conforme `state.firewall.mode === "SHIELD"` — aditivo, sem efeito para
  // qualquer outro `Actor` que não o define.
  shieldVisible?: boolean;
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
  // NOVO (feature fase-secreta-datacenter, T1/T5/T12): hook opcional de
  // desenho, espelhando `Actor.render?` — quando presente, o loop de
  // obstáculos de `renderer/world.ts` (T10) chama isto em vez do desenho
  // genérico atual. Usado pelas barreiras-firewall da fase secreta
  // (`drawFirewallBarrier`, `rendering.ts`).
  render?: (ctx: CanvasRenderingContext2D, obstacle: Obstacle, visualFrame: number) => void;
};

// Perigos da fase secreta ("O Mainframe") que não se encaixam no vocabulário
// normal de Actor/Obstacle do motor: projéteis reais do chefe (não são
// minions perseguidores).
export type SecretBossShot = { x: number; y: number; vx: number; vy: number };

// --- Fase secreta "O Datacenter Esquecido" (design.md § Data Models) ---
//
// SPEC_DEVIATION (T1): o design.md descreve `FirewallState`/`FirewallMode`
// como tipos "privados" de `firewall.ts` (não exportados daqui) e `Puddle`
// como privado de `hazards/puddles.ts`. Isso não é possível respeitando a
// ordem de tasks do tasks.md (T1 precisa do formato final de
// `SecretMainframePhaseState` — que embute os dois — ANTES de `firewall.ts`
// (T3) e `hazards/puddles.ts` (T4) existirem). Resolução: os tipos vivem
// aqui (mesmo padrão já usado no arquivo para `SecretBossShot`, e antes
// para `MeetingZone`/`CobolSnake`), e `firewall.ts`/`hazards/puddles.ts`
// importam-nos daqui em vez de redefini-los. Comportamento idêntico ao
// design; só a localização do `type` muda.
export type FirewallMode = "SHIELD" | "BREAK_FX" | "DPS";

export type FirewallState = {
  mode: FirewallMode;
  phaseIndex: 1 | 2 | 3 | 4;
  counter: number;
  barHp: number;
  barMaxHp: number;
  breakFxTimer: number;
  won: boolean;
};

export type Puddle = { x: number; y: number; baseRadius: number; radius: number };

// PHASEFLOW-08/09 (design.md § Tech Decisions): união fechada de 2 valores
// de propósito — gateia submissão de score (`!== "debug"`) — é uma
// pergunta genuinamente binária, não uma enumeração de grafos por nome.
// "secret" (rótulo antigo do fluxo da fase secreta) some daqui: qualquer
// grafo iniciado via `Engine.start(graph)` normalmente é `"play"`,
// independente de qual grafo seja; só ações de debug produzem `"debug"`. O
// rótulo de apresentação "secret" vs "normal" (usado hoje por
// `renderer/`'s `ViewState.runOrigin`, um campo DIFERENTE, só de desenho)
// não depende deste tipo.
export type RunOrigin = "play" | "debug";

// --- Grafo genérico de fases (design.md § Components → types.ts) --------

/** Identificador de nó dentro de um `PhaseGraph` — tipo aberto (não mais uma
 * union fechada enumerando fases conhecidas), permitindo que qualquer
 * feature futura declare seus próprios nós sem editar este arquivo. */
export type PhaseId = string;

export type PhaseGraph = {
  /** Nó por onde `Engine.start(graph)` sempre começa. */
  readonly entry: PhaseId;
  /** Fábrica de cada nó — chamada uma vez quando o nó se torna ativo. */
  readonly nodes: Readonly<Record<PhaseId, () => EnginePhase>>;
  /**
   * Para cada nó, decide o próximo nó (ou `null` para permanecer). Chamada
   * pelo orquestrador logo após `activePhase.update()`, com o `world`
   * (já mutado por `update()`) e os `FrameEvents` que `update()` retornou.
   * Só nós com transições de saída precisam de uma entrada aqui — um nó
   * terminal (ex.: `secret-mainframe`) simplesmente não tem entrada, e o
   * orquestrador trata ausência de entrada como "nunca transiciona".
   */
  readonly transitions: Readonly<Record<PhaseId, (world: EngineWorld, events: FrameEvents) => PhaseId | null>>;
};

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
export type SecretMainframePhaseState = {
  phase: "secret-mainframe";
  localGameState: "playing" | "over" | "won";
  secretBossShots: SecretBossShot[];
  datacenterMoss: Array<{ x: number; y: number; r: number }>;
  datacenterCracks: Array<Array<{ x: number; y: number }>>;
  // NOVO (feature fase-secreta-datacenter, T1) — substitui
  // `meetingZones`/`cobolSnake` (spec.md assumptions A7/A8, confirmadas em
  // design.md). Integração completa do ciclo (T13+) fica fora deste batch;
  // até lá, `index.ts` popula estes campos com um estado inicial válido
  // (fase 1, `SHIELD`) sem ainda reagir a eles frame a frame.
  firewall: FirewallState;
  puddles: Puddle[];
  memorySurgeUntil: number;
  slowMoUntil: number;
  stunUntil: number;
};

// Fatia 3 (T13, PHASEFLOW-10): `createWavePhase(waveNumber)` produz nós
// `wave-1`..`wave-N` (`EnginePhase.id`, um por número de onda) que
// compartilham o MESMO membro do union — o `waveNumber` em si não afeta o
// formato do estado local (só "playing"/"over"/"won", igual ao que
// `NormalRunPhase` monolítica guardava para o fluxo de ondas), então usar um
// discriminante fixo (`"wave"`, não `` `wave-${waveNumber}` ``) evita
// enumerar um membro por onda sem perder precisão nenhuma.
export type WavePhaseState = {
  phase: "wave";
  localGameState: "playing" | "over" | "won";
};

// Fatia 3 (T14, PHASEFLOW-10/12): estado local de `createFinalChoicePhase()`.
export type FinalChoicePhaseState = {
  phase: "final-choice";
  localGameState: "choice" | "promotion" | "over" | "won";
};

export type PhaseState = SecretMainframePhaseState | WavePhaseState | FinalChoicePhaseState;

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
