// Monta `SecretMainframePhase` — a fase secreta "O Mainframe" (`idclip`),
// implementando `EnginePhase` (`phase.ts`, T3). `enter` porta
// `startSecretRun()` (`app/page.tsx:1158-1208`); `update`/`draw` portam os
// branches `runOrigin === "secret"` de `update()`/`draw*()`
// (`app/page.tsx:1393-2477`) que `physics.ts` (T5) deliberadamente deixou de
// fora (movimento de daemon/cron/secretBoss, secretBossShots — ver o
// comentário no topo do loop de inimigos de `physics.ts`). O hazard antigo
// "cobol snake"/"meeting zones" (`cobol-snake.ts`) foi removido na T18: a
// Cobra COBOL é um `Actor` completo (T7) e as zonas de reunião foram
// substituídas pelas poças de vazamento de memória (`hazards/puddles.ts`,
// T4/T15). Delega a T11 (`datacenter.ts`), e reaproveita
// `physics.stepWorld`/`renderer.drawFrame`. Nenhum import de `react`.

import { DEFAULT_CHARACTER_ID, resolveCharacter, type CharacterDefinition } from "@/lib/characters";
import { applyPlayerDamage, stepWorld } from "@/lib/pixel-hunt-engine/physics";
import { drawFrame, type ViewState } from "@/lib/pixel-hunt-engine/renderer";
import { drawDatacenterFloor } from "@/lib/pixel-hunt-engine/renderer/world";
import type { EnginePhase, PhaseContext } from "@/lib/pixel-hunt-engine/phases/phase";
import {
  spawnDatacenterCracks,
  spawnDatacenterMoss,
  spawnDatacenterObstacles,
} from "@/lib/pixel-hunt-engine/phases/secret-mainframe/datacenter";
import { CONFIG, type SecretPhaseDominantMob } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/config";
import { advanceBreakFx, applyBarDamage, registerKill, tryBreakShield } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/firewall";
import { drawSecretPhaseHud, PHASE_NAMES } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/hud";
import { spawnBarriersForPhase } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/hazards/barriers";
import { applyPuddleSlow, clearMemorySurge, spawnPuddlesForPhase, triggerMemorySurge } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/hazards/puddles";
import { drawCobolSnakeBody, drawCronBody, drawMainframeBoss, drawPuddles } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/rendering";
import { bossKillTarget, resetWaveOne, scaledEnemyHp } from "@/lib/pixel-hunt-engine/phases/normal-run/wave-progression";
import { burst, clamp, distance, normalize } from "@/lib/pixel-hunt-engine/geometry";
import { emptyFrameEvents } from "@/lib/pixel-hunt-engine/types";
import type {
  Actor,
  EngineWorld,
  FirewallState,
  FrameEvents,
  InputState,
  SecretMainframePhaseState,
} from "@/lib/pixel-hunt-engine/types";

import type { AudioEngine } from "@/lib/pixel-hunt-engine/audio";

const WORLD = { width: 960, height: 540 };

function announceEffect(world: EngineWorld, message: string) {
  world.run.effectMessage = message;
  world.run.effectBanner = 100;
}

// NOVO (T13, SECBOSS-01): HP "sentinela" do `secretBoss` — grande o
// bastante para nunca chegar a 0 através do caminho genérico de dano de
// `physics.ts` (`resolveShotHitOnEnemy`/`resolveEnemyDeath`), tornando o
// core do boss "invulnerável" ao caminho de morte genérico em QUALQUER modo
// do firewall (SHIELD/BREAK_FX/DPS por igual). O dano real à barra ativa
// (`FirewallState.barHp`) é rastreado à parte — comparando o hp sentinela
// antes/depois de `stepWorld` (`syncBossHpSentinel`, `update()`'s cálculo
// de `bossDamageThisFrame`) — e só é aplicado à barra quando
// `state.firewall.mode === "DPS"` (fora disso, `applyBarDamage` é no-op,
// `firewall.ts`) — daí o core ficar de fato "protegido" durante
// SHIELD/BREAK_FX (spec.md SECBOSS-01), sem `physics.ts` precisar conhecer
// o conceito de firewall. A vitória real (barra 4 chega a 0) é tratada
// manualmente em `update()` (T17): o `onDeath` "clássico" do `secretBoss`
// (`spawnSecretEnemy`, abaixo) nunca mais dispara organicamente, porque o
// hp nunca chega a <= 0 sozinho — mantido como fallback defensivo inerte.
const BOSS_SENTINEL_HP = 1_000_000;

/**
 * Reseta o hp/maxHp do `secretBoss` para o valor sentinela ANTES de
 * `stepWorld` resolver colisões de tiro neste frame — garante que ele nunca
 * "morre" pelo caminho genérico de `physics.ts`, qualquer que seja o modo do
 * firewall. Devolve o próprio Actor (ou `undefined` se, por algum motivo,
 * ele não estiver mais em `world.enemies`) para `update()` medir o dano
 * sofrido neste frame comparando o hp antes/depois.
 */
function syncBossHpSentinel(world: EngineWorld): Actor | undefined {
  const boss = world.enemies.find((enemy) => enemy.kind === "secretBoss");
  if (!boss) return undefined;
  boss.hp = BOSS_SENTINEL_HP;
  boss.maxHp = BOSS_SENTINEL_HP;
  return boss;
}

// NOVO (T15): resolve o `SecretEnemyKind` a spawnar a partir do mob
// dominante da fase (`CONFIG.PHASES[n].dominantMob`, config.ts) — `"mixed"`
// (fase 4, spec.md SECBOSS-33: "todos os mobs SHALL poder aparecer") sorteia
// entre os 3 tipos completos (não inclui `secretBoss`, que nunca é
// respawnado por este caminho).
function pickPhaseMobKind(dominant: SecretPhaseDominantMob): SecretEnemyKind {
  if (dominant !== "mixed") return dominant;
  const options: SecretEnemyKind[] = ["daemon", "cron", "cobolSnake"];
  return options[Math.floor(Math.random() * options.length)];
}

// NOVO (T15, SECBOSS-17): substitui (não soma) as barreiras-firewall e as
// poças ativas pela composição da fase informada — chamado em `enter()`
// (fase 1) e a cada `BAR_DOWN` (fase seguinte). Filtra por
// `kind === "firewall"` para remover só as barreiras desta feature, sem
// tocar nos 14 obstáculos fixos do datacenter (`datacenter.ts`, nenhum dos
// quais usa esse `kind`, verificado lendo o arquivo diretamente).
//
// NOVO (quick fix pós-feature, feedback do usuário): as barreiras são
// sorteadas PRIMEIRO; as poças são sorteadas depois já sabendo onde as
// barreiras ficaram (`barriers`, abaixo) para nunca se sobrepor a elas —
// ambos os hazards agora têm posição aleatória por fase (antes eram slots
// fixos), cada um garantindo não se sobrepor a si mesmo internamente.
function refreshHazardsForPhase(world: EngineWorld, state: SecretRunState, phaseIndex: 1 | 2 | 3 | 4) {
  world.obstacles = world.obstacles.filter((obstacle) => obstacle.kind !== "firewall");
  spawnBarriersForPhase(world, phaseIndex);
  const barriers = world.obstacles.filter((obstacle) => obstacle.kind === "firewall");
  state.puddles = spawnPuddlesForPhase(phaseIndex, barriers);
}

// NOVO (T15): conta os mobs vivos "de verdade" para o teto de simultâneos
// por fase (`CONFIG.PHASES[n].mobCap`) — exclui só o `secretBoss`. Mobs
// stunados (`BREAK_FX`) continuam contando normalmente (edge case §16,
// SECBOSS-34 parte): esta contagem não sabe de stun, então já respeita essa
// regra de graça (um mob estunado continua em `world.enemies`, só congelado
// por `stepSecretEnemyAi`, T14).
function countLiveMobs(world: EngineWorld): number {
  return world.enemies.filter((enemy) => enemy.kind !== "secretBoss").length;
}

/**
 * Mantém a pressão de mobs da fase secreta: spawna o mob dominante da fase
 * (ou um aleatório entre os 3, na fase 4) quando `world.run.spawnTimer`
 * expira, respeitando `CONFIG.PHASES[n].mobCap` e a taxa de
 * `shieldSpawnRate`/`dpsSpawnRate` conforme o modo atual do firewall
 * (spec.md SECBOSS-14: taxa cai para ~35% em `DPS` — os valores de
 * `CONFIG.PHASES` já embutem essa razão). Reaproveita `run.spawnTimer`
 * (`physics.ts`'s `applyTimerDecay`, já decrementado por `stepWorld` — este
 * módulo só lê/reseta, sem duplicar o decremento).
 */
function maintainPhaseMobSpawns(world: EngineWorld, state: SecretRunState) {
  if (world.run.spawnTimer > 0) return;
  const tuning = CONFIG.PHASES[state.firewall.phaseIndex - 1];
  world.run.spawnTimer = state.firewall.mode === "DPS" ? tuning.dpsSpawnRate : tuning.shieldSpawnRate;
  if (countLiveMobs(world) >= tuning.mobCap) return;
  spawnSecretEnemy(world, pickPhaseMobKind(tuning.dominantMob));
}

// NOVO (T15, SECBOSS-30..33): decide quais padrões de ataque do boss disparam
// neste ciclo `tele → atk`, a partir do poder configurado para a fase atual
// (`CONFIG.PHASES[n].power`). Fases 1-3 têm um poder fixo (1 padrão sempre);
// a fase 4 (`"random"`) sorteia entre 0 e 2 padrões por ciclo (spec.md
// SECBOSS-33: "sortear 0–2 poderes por ciclo aleatoriamente" — 0 é um ciclo
// "vazio", sem disparo). Índices: 0 = burst radial, 1 = volley mirado,
// 2 = Memory Surge.
export function resolveBossPatternsForCycle(phaseIndex: 1 | 2 | 3 | 4): number[] {
  const power = CONFIG.PHASES[phaseIndex - 1].power;
  if (power === "burstRadial") return [0];
  if (power === "volley") return [1];
  if (power === "memorySurge") return [2];
  const count = Math.floor(Math.random() * 3); // 0, 1 ou 2 poderes
  const patterns: number[] = [];
  for (let i = 0; i < count; i += 1) patterns.push(Math.floor(Math.random() * 3));
  return patterns;
}

/**
 * Dispara o poder "Memory Surge" (fase 3+, spec.md SECBOSS-32): invoca até 2
 * mobs do tipo dominante da fase (respeitando `CONFIG.PHASES[n].mobCap`) e
 * expande o raio das poças por `CONFIG.MEMORY_SURGE_RADIUS_BONUS` durante
 * uma janela de 4s — reativar enquanto a janela já está ativa só reinicia o
 * timer, nunca soma raio (`triggerMemorySurge`, `hazards/puddles.ts`, é
 * idempotente por construção; edge case §16.3).
 */
export function triggerBossMemorySurge(world: EngineWorld, state: SecretRunState) {
  const tuning = CONFIG.PHASES[state.firewall.phaseIndex - 1];
  const capacity = Math.max(0, tuning.mobCap - countLiveMobs(world));
  const toSpawn = Math.min(2, capacity);
  for (let i = 0; i < toSpawn; i += 1) {
    spawnSecretEnemy(world, pickPhaseMobKind(tuning.dominantMob));
  }
  state.puddles = triggerMemorySurge(state.puddles);
  state.memorySurgeUntil = world.run.frame + 4 * 60; // janela de 4s (§9.2/§16.3 do documento)
  announceEffect(world, "MEMORY SURGE");
}

export type SecretEnemyKind = "daemon" | "cron" | "secretBoss" | "cobolSnake";

const SECRET_ENEMY_STATS: Record<SecretEnemyKind, { hp: number; speed: number; size: number }> = {
  daemon: { hp: 30, speed: 96, size: 22 },
  cron: { hp: 50, speed: 42, size: 24 },
  secretBoss: { hp: 520, speed: 0, size: 64 },
  // NOVO (feature fase-secreta-datacenter, T7/SECBOSS-13): Cobra COBOL como
  // Actor completo — HP/contato/score em `CONFIG.COBOL_SNAKE` (config.ts).
  // O dobro na fase 4 (hp 80, contato 40, score 60) é aplicado pela
  // integração completa do ciclo por fase (T13/T16, fora deste batch); aqui
  // só o valor base (fase normal) é usado, conforme o escopo de T7.
  cobolSnake: { hp: CONFIG.COBOL_SNAKE.hp, speed: 70, size: 22 },
};

/**
 * Porta o subconjunto de `spawnEnemy()` (`app/page.tsx:978-1040`) relativo a
 * `daemon`/`cron`/`secretBoss` — os únicos `EnemyKind` que `spawn.ts` (T7,
 * `normal-run/`) não sabe montar. `secretBoss` nasce centralizado
 * (`x = WORLD.width / 2, y = 150`), igual ao original; `daemon`/`cron`
 * nascem numa borda aleatória (mesmo padrão de `spawnEnemy`) — `enter()`
 * sobrescreve a posição dos dois primeiros daemons e do cron inicial em
 * seguida, igual a `startSecretRun()` original.
 *
 * Sobre o som de chefe: o original só toca `playSound("boss")` quando
 * `stateRef.current === "playing"` no momento do spawn — isso nunca é
 * verdade para o spawn único do `secretBoss` (sempre spawnado dentro de
 * `startSecretRun()`, antes do estado virar "playing") nem para as
 * reforços de `cron` (que nunca setam `bossBanner`/tocam esse som, só
 * `boss`/`secretBoss` o fazem). Por isso esta função nunca chama
 * `audio.playSound("boss")` — fielmente reproduz esse caminho, sempre
 * inatingível no código original.
 *
 * Fatia 2 (T9, PHASEFLOW-01/02): também atribui os hooks genéricos de
 * `Actor` (T7) que tornam `physics.ts`/`renderer/actors.ts` data-driven —
 * `customMovement: true` para os 3 kinds (`stepSecretEnemyAi`, abaixo, já
 * move os 3 por conta própria); `onDeath`/`render`/`deathBurstColor` só
 * para `cron`/`secretBoss`, cujo desenho migrou para `rendering.ts`
 * (`drawCronBody`/`drawMainframeBoss`) e cuja morte tem efeito especial
 * (`cron` "cai" com cooldown de revive; `secretBoss` dispara a vitória).
 * `daemon` não precisa de `onDeath`/`render` — morre normal (score + burst
 * genéricos de `physics.ts`) e é desenhado pelo branch hardcoded que
 * `renderer/actors.ts` mantém para ele (fora do escopo desta feature).
 */
// Exportada (T7) só para permitir teste unitário direto de spawn/IA sem
// esperar a integração completa via `phase.enter()`/`update()` (a Cobra
// COBOL só nasce organicamente pelo poder "Memory Surge" do boss a partir
// da T15, fora deste batch) — mesmo padrão já usado no projeto para fechar
// gaps de cobertura (`computeBossVolleyPlan`, ver STATE.md).
export function spawnSecretEnemy(world: EngineWorld, kind: SecretEnemyKind): Actor {
  const isSecretBoss = kind === "secretBoss";
  const isCron = kind === "cron";
  const edge = Math.floor(Math.random() * 4);
  const margin = 36;
  const x = isSecretBoss
    ? WORLD.width / 2
    : edge === 0 ? -margin : edge === 1 ? WORLD.width + margin : Math.random() * WORLD.width;
  const y = isSecretBoss
    ? 150
    : edge === 2 ? -margin : edge === 3 ? WORLD.height + margin : Math.random() * WORLD.height;
  const selected = SECRET_ENEMY_STATS[kind];
  // NOVO (T16, SECBOSS-35): HP dos mobs (não do `secretBoss`, cuja "HP"
  // funcional já é `FirewallState.barMaxHp` — `CONFIG.FINAL_BAR_HP` já é o
  // dobro de `CONFIG.BAR_HP`, satisfazendo "HP do boss ×2" de graça) dobra
  // na fase 4. Lê `world.phaseState` diretamente (mesmo type guard estreito
  // já usado por `physics.ts`'s `secretPhaseScoreMultiplier`, T8).
  const phaseIndex = world.phaseState?.phase === "secret-mainframe" ? world.phaseState.firewall.phaseIndex : 1;
  const phaseHpMultiplier = !isSecretBoss && phaseIndex === 4 ? 2 : 1;
  const hp = scaledEnemyHp(selected.hp, world.run.callLoops) * phaseHpMultiplier;
  const actor: Actor = {
    x,
    y,
    vx: 0,
    vy: 0,
    hp,
    maxHp: hp,
    speed: selected.speed,
    size: selected.size,
    kind,
    label: isSecretBoss ? "O Mainframe" : kind === "daemon" ? "Daemon" : kind === "cobolSnake" ? "Cobra COBOL" : "Cron Job",
    cooldown: kind === "daemon" ? 60 : 90,
    phase: Math.random() * Math.PI * 2,
    bossState: isSecretBoss ? "idle" : undefined,
    bossStateTimer: isSecretBoss ? 0 : undefined,
    bossAtkPattern: isSecretBoss ? [] : undefined,
    customMovement: true,
    // fix cycle 2 (SECBOSS-01): a barra de vida genérica de `drawActor`
    // (renderer/actors.ts) lê `hp`/`maxHp` — que `syncBossHpSentinel`
    // (acima) força a um valor "sentinela" fixo a cada frame, então a barra
    // genérica sempre aparecia ~100% cheia/verde, contradizendo o progresso
    // real mostrado pelo HUD dedicado (`drawSecretPhaseHud`). Suprimida só
    // para o `secretBoss` — nenhum outro `Actor` define este campo.
    hideHealthBar: isSecretBoss ? true : undefined,
  };
  if (isCron) {
    actor.render = drawCronBody;
    actor.onDeath = (deathWorld: EngineWorld) => {
      // NOVO (T13, SECBOSS-02,04): registra o peso de firewall — normal (1)
      // numa morte "fresca", reduzido (0.5) se este mesmo cron já tinha sido
      // revivido antes (`respawnedFromFallen`, setado por `stepSecretEnemyAi`
      // abaixo) — no-op fora de SHIELD (`registerKill`, `firewall.ts`).
      if (deathWorld.phaseState?.phase === "secret-mainframe") {
        const weight = actor.respawnedFromFallen ? CONFIG.W_PTS.respawned : CONFIG.W_PTS.normal;
        deathWorld.phaseState.firewall = registerKill(deathWorld.phaseState.firewall, weight);
      }
      // Não remove: fica "derrubado" e `stepSecretEnemyAi` o ressuscita
      // depois de alguns segundos (cooldown abaixo).
      actor.cooldown = 300;
      burst(deathWorld, actor.x, actor.y, "#d4ff5e", 14);
      return true;
    };
  } else if (isSecretBoss) {
    actor.render = drawMainframeBoss;
    actor.deathBurstColor = "#f9c74f";
    // SPEC_DEVIATION (T13): este `onDeath` era, no ciclo antigo (1 barra),
    // o único caminho de vitória — disparava sempre que `hp <= 0`. A partir
    // da T13, o `secretBoss` tem seu hp forçado a um valor "sentinela"
    // (`syncBossHpSentinel`, nunca chega a <= 0 organicamente) — o dano real
    // é rastreado à parte via `FirewallState.barHp`, e a vitória verdadeira
    // (barra 4 esgotada) é tratada manualmente em `update()` (T17). Este
    // `onDeath` fica como fallback defensivo inerte (nunca mais deve
    // disparar em uso normal).
    actor.onDeath = (deathWorld: EngineWorld, audio: AudioEngine, events: FrameEvents) => {
      deathWorld.player.fury = 5;
      deathWorld.player.hp = clamp(deathWorld.player.hp + 22, 0, deathWorld.player.maxHp);
      burst(deathWorld, actor.x, actor.y, "#ffd166", 28);
      burst(deathWorld, actor.x, actor.y, "#facc15", 24);
      events.gameWon = true;
      audio.playSound("won");
      audio.stopMusic();
    };
  } else if (kind === "cobolSnake") {
    actor.render = drawCobolSnakeBody;
    // NOVO (T13, SECBOSS-03): registra o peso de elite (3) no contador de
    // firewall quando morre em SHIELD (no-op em DPS/BREAK_FX). Precisa de
    // `onDeath` aqui (antes a morte caía 100% no caminho genérico) — por
    // isso replica o burst genérico que o branch `!enemy.onDeath` de
    // `resolveEnemyDeath` (physics.ts) faria, já que definir `onDeath`
    // pula aquele branch.
    actor.onDeath = (deathWorld: EngineWorld) => {
      if (deathWorld.phaseState?.phase === "secret-mainframe") {
        deathWorld.phaseState.firewall = registerKill(deathWorld.phaseState.firewall, CONFIG.W_PTS.elite);
      }
      burst(deathWorld, actor.x, actor.y, "#a7f3d0", 12);
      return false;
    };
  } else if (kind === "daemon") {
    // NOVO (T13, SECBOSS-02): registra o peso normal (1) no contador de
    // firewall quando morre em SHIELD — mesmo motivo/mesma réplica de burst
    // do branch `cobolSnake` acima.
    actor.onDeath = (deathWorld: EngineWorld) => {
      if (deathWorld.phaseState?.phase === "secret-mainframe") {
        deathWorld.phaseState.firewall = registerKill(deathWorld.phaseState.firewall, CONFIG.W_PTS.normal);
      }
      burst(deathWorld, actor.x, actor.y, "#a7f3d0", 12);
      return false;
    };
  }
  world.enemies.push(actor);
  if (isSecretBoss) world.run.bossBanner = 120;
  return actor;
}

/**
 * Dropa os 2 pickups funcionais (cura "hotfix" + buff "cafeZip") na posição
 * `(x, y)` — tipicamente a posição do boss quando `BREAK_FX` dispara
 * (spec.md SECBOSS-26). `ttl: Infinity` (nunca expiram) e reaproveitam a
 * coleta por contato já existente em `physics.ts`'s `updatePowerUps`, que
 * não checa `world.obstacles` — ou seja, já ignoram barreiras de graça
 * (spec.md SECBOSS-28, design.md § Tech Decisions). Toda quebra de firewall,
 * em qualquer fase (incluindo a 4), dropa os dois sem exceção (spec.md
 * SECBOSS-29).
 *
 * Exportada (T9) para teste unitário direto, mesmo padrão de
 * `spawnSecretEnemy`/`stepSecretEnemyAi` (T7) — o disparo automático na
 * transição `SHIELD → BREAK_FX` do ciclo real do firewall é T13, fora deste
 * batch.
 */
export function dropFirewallBreakRewards(world: EngineWorld, x: number, y: number): void {
  world.powerUps.push(
    { x, y, kind: "hotfix", ttl: Infinity, pulse: 0 },
    { x, y, kind: "cafeZip", ttl: Infinity, pulse: 0 },
  );
}

type SecretRunState = SecretMainframePhaseState;

// Placeholder (T1) até `firewall.ts` (T3) existir: só garante que
// `SecretMainframePhaseState.firewall` nasce num formato válido (fase 1,
// `SHIELD`, contador 0, barra cheia). A integração real do ciclo (ler/gravar
// isto a cada frame) é T13 — fora deste batch (T1-T7).
function createPlaceholderFirewallState(): FirewallState {
  return { mode: "SHIELD", phaseIndex: 1, counter: 0, barHp: CONFIG.BAR_HP, barMaxHp: CONFIG.BAR_HP, breakFxTimer: 0, won: false };
}

function readState(world: EngineWorld): SecretRunState {
  if (world.phaseState?.phase === "secret-mainframe") return world.phaseState;
  // Defensivo: `enter()` sempre popula `world.phaseState` antes de
  // `update`/`draw`/`isComplete` serem chamados pelo orquestrador — este
  // ramo espelha o fallback de `NormalRunPhase.readState` (T10) para nunca
  // lançar caso algo chame esses métodos fora de ordem.
  const fresh: SecretRunState = {
    phase: "secret-mainframe",
    localGameState: "playing",
    secretBossShots: [],
    datacenterMoss: [],
    datacenterCracks: [],
    firewall: createPlaceholderFirewallState(),
    puddles: [],
    memorySurgeUntil: 0,
    slowMoUntil: 0,
    stunUntil: 0,
  };
  world.phaseState = fresh;
  return fresh;
}

/**
 * Move e faz agir os inimigos que `physics.stepWorld` (T5) deliberadamente
 * não move (`daemon`/`cron`/`secretBoss` — ver o comentário no loop de
 * inimigos de `physics.ts`): investidas do daemon, perseguição/ressurreição
 * do cron "derrubado", e a máquina de estados do secretBoss
 * (idle → tele → atk, disparando `secretBossShots` reais ou invocando um
 * reforço de cron). Porta `app/page.tsx:1536-1644` (o daemon/cron/secretBoss
 * dessa fatia do loop de inimigos original).
 *
 * Chamado ANTES de `stepWorld` (que aplica `enemy.x += vx * delta`
 * genericamente para todo `Actor`, inclusive estes) — uma diferença sutil e
 * documentada em relação ao original: o original roda essa IA DEPOIS do
 * movimento do jogador (ambos dentro do mesmo `update()` monolítico), então
 * mira na posição do jogador já atualizada neste frame; aqui, por
 * `physics.ts` ser uma função só (sem um ponto de extensão entre "mover
 * jogador" e "mover inimigos"), a IA mira na posição do frame anterior. A
 * 30-60 FPS isso é uma diferença de mira sub-pixel, não uma mudança de dano/
 * score/HP observável.
 */
export function stepSecretEnemyAi(world: EngineWorld, phaseState: SecretRunState, delta: number) {
  // NOVO (T14, SECBOSS-06 parte do BREAK_FX): enquanto `stunUntil` estiver
  // no futuro, todos os mobs congelam posição/ataque — EXCETO o
  // temporizador de respawn do cron "derrubado" (`hp <= 0`), que continua
  // contando normalmente (edge case §16.5). `world.run.frame` é o mesmo
  // contador "frame-based" já usado por `bossBanner`/`cooldown` no resto do
  // arquivo (ver `stunUntil`/`slowMoUntil` setados em `update()`, T13).
  const stunned = phaseState.stunUntil > world.run.frame;
  for (const enemy of world.enemies) {
    if (stunned) {
      if (enemy.kind === "cron" && enemy.hp <= 0) {
        enemy.cooldown = (enemy.cooldown ?? 0) - delta * 60;
        if (enemy.cooldown <= 0) {
          enemy.hp = enemy.maxHp;
          enemy.respawnedFromFallen = true;
          burst(world, enemy.x, enemy.y, "#7dff6a", 14);
        }
      }
      enemy.vx = 0;
      enemy.vy = 0;
      continue;
    }
    const toward = normalize(world.player.x - enemy.x, world.player.y - enemy.y);
    if (enemy.kind === "daemon") {
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
      if (enemy.hp <= 0) {
        enemy.vx = 0;
        enemy.vy = 0;
        enemy.cooldown = (enemy.cooldown ?? 0) - delta * 60;
        if (enemy.cooldown <= 0) {
          enemy.hp = enemy.maxHp;
          // NOVO (T13, SECBOSS-04): marca este cron como "já revivido" —
          // a PRÓXIMA morte dele conta peso reduzido (0.5) no firewall
          // (`spawnSecretEnemy`'s `onDeath`, acima), em vez do peso normal.
          enemy.respawnedFromFallen = true;
          burst(world, enemy.x, enemy.y, "#7dff6a", 14);
        }
      } else {
        enemy.vx = toward.x * enemy.speed;
        enemy.vy = toward.y * enemy.speed;
      }
    } else if (enemy.kind === "cobolSnake") {
      // NOVO (T7, SECBOSS-13): slither senoidal perseguindo o jogador — a
      // mesma direção "toward" do perseguidor comum, somada a uma
      // oscilação perpendicular (S-curve), em vez do sweep horizontal
      // determinístico do hazard antigo (`cobol-snake.ts`, aposentado na
      // T18). `drawCobolSnakeBody` (T6) desenha o rastro segmentado a
      // partir da posição resultante.
      const perpendicular = { x: -toward.y, y: toward.x };
      const wiggle = Math.sin(world.run.frame / 9 + (enemy.phase ?? 0)) * 50;
      enemy.vx = toward.x * enemy.speed + perpendicular.x * wiggle;
      enemy.vy = toward.y * enemy.speed + perpendicular.y * wiggle;
    } else if (enemy.kind === "secretBoss") {
      enemy.vx = 0;
      enemy.vy = 0;
      enemy.bossStateTimer = (enemy.bossStateTimer ?? 0) + delta;
      const bossFightState = enemy.bossState ?? "idle";
      // SPEC_DEVIATION (T14): antes lia `enemy.hp < enemy.maxHp * 0.35` —
      // desde a T13, `enemy.hp`/`maxHp` do secretBoss são forçados a um
      // valor "sentinela" (`syncBossHpSentinel`, sempre com razão 1), então
      // essa leitura nunca mais refletiria dano real. Substituída pela
      // razão real da barra ativa (`FirewallState.barHp`/`barMaxHp`,
      // relevante só durante `DPS` — fora dele o core está protegido e
      // segue no ritmo normal).
      const barRatio = phaseState.firewall.mode === "DPS"
        ? phaseState.firewall.barHp / phaseState.firewall.barMaxHp
        : 1;
      const slow = barRatio < 0.35 ? 0.6 : 1;
      // NOVO (T16, SECBOSS-35): telegraphs (janelas idle/tele/atk do boss)
      // duram +15% na fase 4 — multiplica os 3 limiares de transição de
      // estado uniformemente.
      const telegraphMultiplier = phaseState.firewall.phaseIndex === 4 ? 1.15 : 1;
      if (bossFightState === "idle" && enemy.bossStateTimer > 2.2 * slow * telegraphMultiplier) {
        enemy.bossState = "tele";
        enemy.bossStateTimer = 0;
        // NOVO (T15, SECBOSS-30..33): o(s) padrão(ões) deste ciclo são
        // sorteados/fixados AQUI (na telegrafia), não mais um índice que
        // cicla 0→1→2→0 — cada fase tem seu próprio poder configurado
        // (`CONFIG.PHASES[n].power`), com a fase 4 sorteando 0-2 por ciclo.
        enemy.bossAtkPattern = resolveBossPatternsForCycle(phaseState.firewall.phaseIndex);
      } else if (bossFightState === "tele" && enemy.bossStateTimer > 0.9 * telegraphMultiplier) {
        enemy.bossState = "atk";
        enemy.bossStateTimer = 0;
        const patterns = enemy.bossAtkPattern ?? [];
        for (const pattern of patterns) {
          if (pattern === 0) {
            for (let i = 0; i < 14; i += 1) {
              const a = (i / 14) * Math.PI * 2;
              phaseState.secretBossShots.push({ x: enemy.x, y: enemy.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120 });
            }
          } else if (pattern === 1) {
            const aimed = Math.atan2(world.player.y - enemy.y, world.player.x - enemy.x);
            for (let k = -1; k <= 1; k += 1) {
              const a = aimed + k * 0.22;
              phaseState.secretBossShots.push({ x: enemy.x, y: enemy.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170 });
            }
          } else {
            // NOVO (T15, SECBOSS-32): "Memory Surge" — substitui o antigo
            // reforço fixo de 1 cron (agora coberto pela composição de mobs
            // por fase, `maintainPhaseMobSpawns`) por invocar até 2 mobs do
            // tipo dominante da fase + expandir as poças.
            triggerBossMemorySurge(world, phaseState);
          }
        }
        burst(world, enemy.x, enemy.y + 20, "#7dff6a", 16);
      } else if (bossFightState === "atk" && enemy.bossStateTimer > 0.5 * telegraphMultiplier) {
        enemy.bossState = "idle";
        enemy.bossStateTimer = 0;
      }
    }
  }
}

/** Porta o bloco de movimento/colisão de `secretBossShots` (`app/page.tsx:1647-1666`). */
function stepSecretBossShots(world: EngineWorld, phaseState: SecretRunState, ctx: PhaseContext, events: FrameEvents, delta: number) {
  for (let i = phaseState.secretBossShots.length - 1; i >= 0; i -= 1) {
    const shot = phaseState.secretBossShots[i];
    shot.x += shot.vx * delta;
    shot.y += shot.vy * delta;
    if (distance(shot, world.player) < world.player.size * 0.5 + 6) {
      phaseState.secretBossShots.splice(i, 1);
      // NOVO (T16, SECBOSS-35): dano do tiro do boss dobra na fase 4.
      const shotDamage = phaseState.firewall.phaseIndex === 4 ? 20 : 10;
      applyPlayerDamage(world, ctx.audio, events, shotDamage, 12);
      continue;
    }
    if (shot.x < -20 || shot.x > WORLD.width + 20 || shot.y < -20 || shot.y > WORLD.height + 20) {
      phaseState.secretBossShots.splice(i, 1);
    }
  }
}

export function createSecretMainframePhase(): EnginePhase {
  // Mesmo padrão de `NormalRunPhase` (T10): guardado à parte de
  // `world.phaseState` só para `draw()` montar o `ViewState`.
  let character: CharacterDefinition = resolveCharacter(DEFAULT_CHARACTER_ID);

  return {
    id: "secret-mainframe",

    enter(world: EngineWorld, ctx: PhaseContext) {
      character = ctx.character;
      resetWaveOne(world, ctx, false);
      // A maquete original começa com o jogador perto da borda de baixo e o
      // chefe/elenco perto do topo — `resetWaveOne` usa o centro do mundo
      // (fluxo normal), sobrescrito aqui (`app/page.tsx:1163-1164`).
      world.player.y = WORLD.height - 90;
      spawnDatacenterObstacles(world);

      const daemonA = spawnSecretEnemy(world, "daemon");
      daemonA.x = 200;
      daemonA.y = 220;
      const daemonB = spawnSecretEnemy(world, "daemon");
      daemonB.x = 760;
      daemonB.y = 220;
      const cron = spawnSecretEnemy(world, "cron");
      cron.x = WORLD.width / 2;
      cron.y = 280;

      world.run.bossKills = bossKillTarget(world.run.wave, world.run.callLoops);
      world.run.bossSpawned = true;
      spawnSecretEnemy(world, "secretBoss");

      world.phaseState = {
        phase: "secret-mainframe",
        localGameState: "playing",
        secretBossShots: [],
        datacenterMoss: spawnDatacenterMoss(),
        datacenterCracks: spawnDatacenterCracks(),
        firewall: createPlaceholderFirewallState(),
        puddles: [],
        memorySurgeUntil: 0,
        slowMoUntil: 0,
        stunUntil: 0,
      } satisfies SecretRunState;

      // NOVO (T15, SECBOSS-17): ativa as poças/barreiras da fase 1
      // (2 poças, 1 barreira — `CONFIG.PHASES[0]`) já na entrada da fase.
      refreshHazardsForPhase(world, world.phaseState as SecretRunState, 1);
    },

    update(world: EngineWorld, ctx: PhaseContext, input: InputState, delta: number): FrameEvents {
      const state = readState(world);
      if (state.localGameState === "over" || state.localGameState === "won") {
        return emptyFrameEvents();
      }

      // NOVO (T14, SECBOSS-06 parte do BREAK_FX): enquanto `slowMoUntil`
      // estiver no futuro, o `delta` efetivo passado para a simulação
      // (IA/física/tiros do boss) é escalado por `CONFIG.SLOWMO_SCALE` — só
      // dentro desta Phase (`physics.ts`/`stepWorld` continuam recebendo um
      // `number` puro, sem saber de onde veio, design.md § Tech Decisions).
      // O `delta` "real" (não escalado) segue usado pelos decaimentos de
      // timer que precisam continuar em ritmo normal (`advanceBreakFx`,
      // abaixo).
      const slowMoActive = state.slowMoUntil > world.run.frame;
      const effectiveDelta = slowMoActive ? delta * CONFIG.SLOWMO_SCALE : delta;

      // NOVO (T15, SECBOSS-21, edge case §16.3): reverte o raio das poças ao
      // valor base quando a janela do Memory Surge expira.
      if (state.memorySurgeUntil > 0 && world.run.frame >= state.memorySurgeUntil) {
        state.puddles = clearMemorySurge(state.puddles);
        state.memorySurgeUntil = 0;
      }

      stepSecretEnemyAi(world, state, effectiveDelta);

      // NOVO (T13, SECBOSS-01): força o hp do secretBoss ao valor sentinela
      // ANTES de `stepWorld` resolver colisões de tiro neste frame — o core
      // fica de fato invulnerável ao caminho genérico de morte de
      // `physics.ts` em qualquer modo do firewall; o dano real à barra
      // ativa é medido comparando o hp antes/depois (abaixo).
      const boss = syncBossHpSentinel(world);

      // NOVO (T15, SECBOSS-18): poças de vazamento de memória — autoritativas
      // sobre a velocidade final do jogador neste frame. Substituem por
      // completo o antigo ajuste de velocidade das "zonas de reunião"
      // (`app/page.tsx:1436-1437`, hazard `cobol-snake.ts`), removido na
      // T18 (spec.md A7).
      const originalSpeed = world.player.speed;
      applyPuddleSlow(world, state.puddles);
      // NOVO (T16, SECBOSS-35): dano de TOQUE (mob colidindo com o jogador)
      // é resolvido inteiramente dentro de `stepWorld` (physics.ts, fora do
      // escopo desta feature) — sem um hook para dobrá-lo ali, medimos o
      // hp do jogador antes/depois (mesma técnica de `syncBossHpSentinel`)
      // e reaplicamos a MESMA quantia de dano quando a fase é 4, dobrando o
      // total de forma equivalente a "ENEMY_TOUCH_DAMAGE × 2" sem tocar
      // `physics.ts`.
      const playerHpBeforeStep = world.player.hp;
      // fix cycle 2 (SECBOSS-14/16/35): também precisamos saber, ANTES de
      // `stepWorld`, quantos pickups "hotfix" (cura +32, `physics.ts`'s
      // `collectPowerUp`) estão em campo — a técnica de "delta líquido de
      // hp" abaixo só funciona isolada quando NENHUMA cura é coletada no
      // mesmo frame do toque (o code-review apontou exatamente esse caso:
      // `updatePowerUps` roda ANTES de `resolveEnemyPlayerCollisions` dentro
      // de `stepWorld`, então um hotfix coletado no mesmo frame soma ao hp
      // antes do toque subtrair, mascarando/zerando o delta líquido e
      // fazendo a guarda `> 0` abaixo falhar silenciosamente).
      const hotfixesBeforeStep = world.powerUps.filter((powerUp) => powerUp.kind === "hotfix").length;
      const events = stepWorld(world, input, effectiveDelta, ctx.audio);
      world.player.speed = originalSpeed;

      if (state.firewall.phaseIndex === 4 && events.playerHit) {
        // fix cycle 2: reconstrói o dano de toque real "descontando" a cura
        // que o mesmo frame possa ter aplicado, em vez de inferir só pelo
        // delta líquido (hp depois − hp antes) — que fica positivo/zerado
        // quando um hotfix (+32, capado em `maxHp`) é coletado no mesmo
        // frame em que o jogador é tocado, escondendo o dano real e fazendo
        // o dobro nunca disparar.
        const HOTFIX_HEAL_AMOUNT = 32; // physics.ts's collectPowerUp, branch "hotfix" (mesmo valor, design.md § Code Reuse Analysis)
        const hotfixesAfterStep = world.powerUps.filter((powerUp) => powerUp.kind === "hotfix").length;
        const hotfixesCollectedThisFrame = Math.max(0, hotfixesBeforeStep - hotfixesAfterStep);
        const healAppliedThisFrame = hotfixesCollectedThisFrame > 0
          ? Math.max(0, Math.min(hotfixesCollectedThisFrame * HOTFIX_HEAL_AMOUNT, world.player.maxHp - playerHpBeforeStep))
          : 0;
        const netHpDeltaThisFrame = world.player.hp - playerHpBeforeStep;
        const touchDamageThisFrame = healAppliedThisFrame - netHpDeltaThisFrame;
        if (touchDamageThisFrame > 0) {
          world.player.hp = Math.max(0, world.player.hp - touchDamageThisFrame);
          if (world.player.hp <= 0 && !events.gameOver) {
            events.gameOver = true;
            ctx.audio.playSound("over");
            ctx.audio.stopMusic();
          }
        }
      }

      stepSecretBossShots(world, state, ctx, events, effectiveDelta);

      // NOVO (T15, SECBOSS-14): mantém a pressão de mobs da fase atual
      // (mob dominante, taxa SHIELD/DPS, teto — `CONFIG.PHASES[n]`).
      maintainPhaseMobSpawns(world, state);

      // NOVO (T13/T17, SECBOSS-11, edge case §16.1): a morte do jogador tem
      // prioridade sobre QUALQUER transição de firewall no mesmo frame —
      // nem o dano real à barra (`applyBarDamage`), nem `tryBreakShield`/
      // `advanceBreakFx`, nem a finalização de vitória avançam quando
      // `events.gameOver` já foi sinalizado por `stepWorld` (ou pelo dobro
      // de dano de toque da fase 4, acima) neste frame — a outra transição
      // é simplesmente ignorada (SECBOSS-11 é explícito: "fim de barra"
      // também conta, não só a quebra do firewall).
      if (!events.gameOver) {
        // NOVO (T13, SECBOSS-09): dano real à barra ativa do firewall — só
        // tem efeito quando `mode === "DPS"` (`applyBarDamage`, `firewall.ts`
        // é no-op fora dele, o que já garante SECBOSS-01: nenhum tiro reduz
        // a barra durante SHIELD/BREAK_FX).
        if (boss) {
          const phaseIndexBeforeDamage = state.firewall.phaseIndex;
          const bossDamageThisFrame = BOSS_SENTINEL_HP - boss.hp;
          if (bossDamageThisFrame > 0) {
            state.firewall = applyBarDamage(state.firewall, bossDamageThisFrame);
          }
          // NOVO (T15, SECBOSS-09/17): `BAR_DOWN` avançou de fase — reativa
          // poças/barreiras com a composição da NOVA fase (2/4/6/8 poças,
          // 1/2/3/4 barreiras).
          if (state.firewall.phaseIndex !== phaseIndexBeforeDamage) {
            refreshHazardsForPhase(world, state, state.firewall.phaseIndex);
            // NOVO (fix cycle 1, SECBOSS-25): banner central de transição de
            // fase — o de quebra ("FIREWALL DOWN!") já disparava abaixo, mas
            // a transição BAR_DOWN nunca anunciava a nova fase.
            const newPhaseName = PHASE_NAMES[state.firewall.phaseIndex - 1] ?? PHASE_NAMES[0];
            announceEffect(world, `FASE ${state.firewall.phaseIndex} — ${newPhaseName}`);
          }
        }

        // NOVO (T13, SECBOSS-06/07): dispara BREAK_FX quando o contador
        // atinge `CONFIG.SHIELD_NEED` — banner, shake e os 2 drops
        // funcionais (T9) disparam juntos nesta transição; as janelas de
        // stun/slow-mo são só marcadas aqui (`stunUntil`/`slowMoUntil`) —
        // consumidas de fato pela T14.
        const wasShield = state.firewall.mode === "SHIELD";
        state.firewall = tryBreakShield(state.firewall);
        if (wasShield && state.firewall.mode === "BREAK_FX") {
          announceEffect(world, "FIREWALL DOWN!");
          world.run.shake = 14;
          if (boss) {
            dropFirewallBreakRewards(world, boss.x, boss.y);
            // NOVO (quick fix pós-feature, feedback do usuário): explosão do
            // escudo no exato frame em que o firewall quebra — mesma cor
            // teal do HUD (`#2dd4bf`, hud.ts's "FIREWALL x/100"), reaproveita
            // o sistema de partículas genérico já usado pelos outros bursts
            // desta Phase (ex.: burst de vitória, abaixo).
            burst(world, boss.x, boss.y, "#2dd4bf", 20);
          }
          state.stunUntil = world.run.frame + CONFIG.STUN_BREAK * 60;
          state.slowMoUntil = world.run.frame + CONFIG.SLOWMO_DURATION * 60;
        }

        if (state.firewall.mode === "BREAK_FX") {
          state.firewall = advanceBreakFx(state.firewall, delta);
        }

        // NOVO (T17, SECBOSS-10): vitória real — a barra 4 se esgotou em
        // `DPS` (`applyBarDamage` marca `won: true`, mode/phaseIndex ficam
        // como estavam). Finaliza manualmente o que o antigo `onDeath` do
        // `secretBoss` fazia (cura/fúria residual, bursts, remoção),
        // já que o hp dele nunca chega a <= 0 organicamente desde a T13.
        if (state.firewall.won && boss) {
          world.player.fury = 5;
          world.player.hp = clamp(world.player.hp + 22, 0, world.player.maxHp);
          burst(world, boss.x, boss.y, "#ffd166", 28);
          burst(world, boss.x, boss.y, "#facc15", 24);
          const bossIndex = world.enemies.indexOf(boss);
          if (bossIndex >= 0) world.enemies.splice(bossIndex, 1);
          world.run.score += 5000;
          events.gameWon = true;
          ctx.audio.playSound("won");
          ctx.audio.stopMusic();
        }
      }

      // NOVO (quick fix pós-feature, feedback do usuário): sincroniza o
      // escudo visual do boss com o modo do firewall JÁ APÓS as transições
      // acima (não antes) — se fosse setado antes de `tryBreakShield`, o
      // frame exato da quebra ainda leria `mode === "SHIELD"` e o escudo
      // ficaria visível por 1 frame a mais do que deveria. Visível em
      // SHIELD; some no mesmo frame em que vira BREAK_FX (a explosão de
      // partículas, acima, cobre a transição); reaparece sozinho quando a
      // próxima fase reergue o firewall em SHIELD (BAR_DOWN).
      if (boss) boss.shieldVisible = state.firewall.mode === "SHIELD";

      if (events.gameOver) state.localGameState = "over";
      if (events.gameWon) state.localGameState = "won";
      if (state.localGameState !== "over" && state.localGameState !== "won") {
        state.localGameState = "playing";
      }

      return events;
    },

    draw(ctx: CanvasRenderingContext2D, world: EngineWorld) {
      const state = readState(world);
      // Fatia 2 (T11, PHASEFLOW-03): `renderer/` não conhece mais o
      // datacenter/zonas de reunião/cobol snake/tiros do chefe secreto —
      // esta Phase fornece os 3 ganchos genéricos de `ViewState` para
      // desenhar seus próprios extras nos mesmos pontos onde
      // `view.runOrigin === "secret"` fazia isso antes.
      const view: ViewState = {
        character,
        gameState: state.localGameState,
        menuPanel: "home",
        drawFloor: (floorCtx) => drawDatacenterFloor(floorCtx, state),
        // fix cycle 2 (SECBOSS-17/18/21): as poças de vazamento de memória
        // nunca tinham representação visual — `applyPuddleSlow` já lentava o
        // jogador de fato, mas nada era desenhado em tela (bug apontado pelo
        // code-review). `drawGroundOverlay` é chamado logo após os
        // obstáculos do datacenter (`renderer/index.ts`), mesmo ponto onde o
        // hazard antigo desenhava suas zonas.
        drawGroundOverlay: (groundCtx) => drawPuddles(groundCtx, state.puddles),
        // fix cycle 2 (SECBOSS-22/23/24): faltava o gancho `drawHudOverlay`
        // no `ViewState` — o HUD dedicado (`drawSecretPhaseHud`, hud.ts) já
        // estava implementado, mas nunca era chamado por `drawFrame`
        // (`renderer/index.ts`), então nunca renderizava (bug apontado pelo
        // code-review). Assinatura de `drawHudOverlay?` é `(ctx) => void`;
        // este wrapper fecha sobre `state` para casar com
        // `drawSecretPhaseHud(ctx, state)`.
        drawHudOverlay: (hudCtx) => drawSecretPhaseHud(hudCtx, state),
        drawExtraShots: (shotsCtx) => {
          for (const shot of state.secretBossShots) {
            shotsCtx.save();
            shotsCtx.shadowColor = "#ff5a4d";
            shotsCtx.shadowBlur = 6;
            shotsCtx.fillStyle = "#ff5a4d";
            shotsCtx.beginPath();
            shotsCtx.arc(shot.x, shot.y, 4, 0, Math.PI * 2);
            shotsCtx.fill();
            shotsCtx.restore();
          }
        },
      };
      drawFrame(ctx, world, view);
    },

    isComplete(world: EngineWorld): boolean {
      const state = readState(world);
      return state.localGameState === "over" || state.localGameState === "won";
    },

    // A fase secreta não expõe ações de debug (F1/F2/F3 sempre operam sobre
    // `NormalRunPhase` — `onDebugAction` original força `runOriginRef.current
    // = "debug"` e chama `start()` quando necessário, nunca `startSecretRun()`).
    // `handleDebugAction` é opcional em `EnginePhase` — omitido de propósito.

    // Fatia 2 (T12, PHASEFLOW-02): réplica exata do ramo `isSecret` que
    // `orchestrator.ts`'s `buildSnapshot()` calculava antes desta task —
    // textos estáticos, sem depender de `world`.
    hudLabels() {
      return { boss: "O Mainframe", biome: "Datacenter Esquecido", bossProgress: "Chefe secreto" };
    },
  };
}
