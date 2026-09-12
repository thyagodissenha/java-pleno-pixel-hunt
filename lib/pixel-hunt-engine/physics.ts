// Movimento, colisão, dano, IA de inimigos — a função `update()` de hoje,
// sem nenhuma chamada a `setState`. Porta `update()`, `shoot()`,
// `triggerActivePower()`, `clearNearbyEnemies()`, `collectPowerUp()`
// (`app/page.tsx:1064-1392` e trechos comuns de `1393-1892`), excluindo os
// branches específicos da fase secreta ("O Mainframe"): o telegraph/ataque
// do `secretBoss`, o `cobolSnake` e as `meetingZones` — essas ficam para os
// módulos de `phases/secret-mainframe/` (fora do escopo desta task).
//
// Ao contrário de callbacks, `stepWorld` retorna `FrameEvents` — a Phase
// ativa (fora deste módulo) decide o que fazer com eles (ex.: spawnar um
// novo boss, disparar a tela de escolha final). Ver design.md § Tech
// Decisions.

import { circleIntersectsRect, pointInRect } from "@/lib/obstacles";
import { resolveDashDirection, selectEnemiesToClear, type CharacterDefinition } from "@/lib/characters";
import type { AudioEngine } from "@/lib/pixel-hunt-engine/audio";
import { burst, clamp, distance, normalize } from "@/lib/pixel-hunt-engine/geometry";
import {
  FINAL_CHOICE_CLICK_RADIUS,
  FINAL_CHOICE_PICKUP_RADIUS,
  isFinalChoicePowerUp,
} from "@/lib/pixel-hunt-engine/phases/normal-run/final-choice";
import { emptyFrameEvents } from "@/lib/pixel-hunt-engine/types";
import type { Actor, EngineWorld, EnemyKind, FrameEvents, InputState, PowerUp, Shot } from "@/lib/pixel-hunt-engine/types";
import { shotLanesForWeaponLevel, weaponLevelForWave } from "@/lib/pixel-hunt-engine/weapon-progression";

const WORLD = { width: 960, height: 540 };
const BURST_STAMINA_MAX = 100;
const BURST_STAMINA_RECHARGE = 8;
const BURST_STAMINA_COST = 32;
const STAMINA_POWER_UP_GAIN = 5;

// Portado de app/page.tsx:798-800 — usado só para escalar o HP do chefe
// final quando ele avança de fase (via Actor.bossPhase, ver stepWorld). Não
// depende de "isFinalBoss()"/bossNames: só bosses spawnados com
// `bossPhase` definido (spawn.ts, T7) escalam; os demais morrem direto.
export function finalBossHp(phase: number, wave: number) {
  return 210 + phase * 48 + wave * 22;
}

export function scaledEnemyHp(baseHp: number, resets: number) {
  return Math.ceil(baseHp * (1 + resets * 0.25));
}

function announceEffect(world: EngineWorld, message: string) {
  world.run.effectMessage = message;
  world.run.effectBanner = 100;
}

/**
 * Multiplicador de score de morte de inimigo por fase — 2 na fase 4 do
 * Mainframe (spec.md SECBOSS-30..35), 1 em qualquer outro caso (nenhuma
 * regressão no `normal-run/` ou nas fases 1-3 da fase secreta). Type guard
 * estreito em `world.phaseState` (design.md § Risks & Concerns — única
 * exceção documentada ao "zero acoplamento" desta feature: uma LEITURA, não
 * escrita, do formato de `SecretMainframePhaseState`, com fallback seguro
 * `1` para qualquer outra Phase).
 */
export function secretPhaseScoreMultiplier(world: EngineWorld): number {
  const phaseState = world.phaseState;
  if (phaseState?.phase === "secret-mainframe" && phaseState.firewall.phaseIndex === 4) return 2;
  return 1;
}

function obstacleBlocksCircle(world: EngineWorld, x: number, y: number, radius: number) {
  return world.obstacles.some((obstacle) => circleIntersectsRect({ x, y, radius }, obstacle));
}

const ENEMY_DEATH_SCORE: Record<EnemyKind, number> = {
  secretBoss: 900,
  boss: 500,
  data: 80,
  vip: 95,
  legacy: 95,
  cron: 75,
  incident: 70,
  daemon: 65,
  qa: 60,
  user: 45,
  // NOVO (feature fase-secreta-datacenter, T1/SECBOSS-15): 30 base (60 na
  // fase 4, via multiplicador de score — T8), conforme spec.md.
  cobolSnake: 30,
};

const ENEMY_TOUCH_DAMAGE: Record<EnemyKind, number> = {
  secretBoss: 20,
  boss: 18,
  data: 13,
  vip: 12,
  legacy: 12,
  cron: 15,
  incident: 15,
  daemon: 10,
  user: 8,
  qa: 8,
  // NOVO (feature fase-secreta-datacenter, T1/SECBOSS-14): 20 base (40 na
  // fase 4), conforme spec.md.
  cobolSnake: 20,
};

/** Dispara um tiro do jogador em direção ao inimigo vivo mais próximo (ou ao ponteiro, se não houver alvo). Porta `shoot()` (app/page.tsx:1367-1391). */
export function shoot(world: EngineWorld, input: InputState, audio: AudioEngine) {
  let target: Actor | undefined;
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0) continue;
    if (!target || distance(enemy, world.player) < distance(target, world.player)) target = enemy;
  }
  const aim = target
    ? normalize(target.x - world.player.x, target.y - world.player.y)
    : normalize(input.pointer.x - world.player.x, input.pointer.y - world.player.y);
  const lanes = shotLanesForWeaponLevel(world.run.weaponLevel);
  const shotSpeed = world.player.focus > 0 ? 500 : 430;
  for (const spread of lanes) {
    const angle = Math.atan2(aim.y, aim.x) + spread;
    world.shots.push({
      x: world.player.x + Math.cos(angle) * 20,
      y: world.player.y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * shotSpeed,
      vy: Math.sin(angle) * shotSpeed,
      ttl: 78,
    });
  }
  audio.playSound("shoot");
}

/**
 * Remove inimigos próximos do jogador (poder "dash" com `clearRadius`, e o
 * power-up "rollback"). Porta `clearNearbyEnemies()` (app/page.tsx:1064-1077).
 * De-hardcoded na Fatia 2 (T8, PHASEFLOW-01): `enemy.bossState === undefined`
 * substitui a checagem antiga de `kind` do chefe secreto — `bossState` já é,
 * hoje, um campo exclusivo dele (`phases/secret-mainframe/index.ts`'s
 * `spawnSecretEnemy`), então o resultado é idêntico sem `physics.ts` precisar
 * conhecer o `kind` literal.
 */
export function clearNearbyEnemies(world: EngineWorld, clearRadius: number) {
  const removed = selectEnemiesToClear(world.player, world.enemies, clearRadius).filter(
    (enemy) => enemy.bossState === undefined && enemy.hp > 0,
  );
  for (const enemy of removed) {
    const index = world.enemies.indexOf(enemy);
    if (index >= 0) world.enemies.splice(index, 1);
    world.run.score += enemy.kind === "data" ? 45 : 25;
    if (!world.run.bossSpawned && !world.run.finalChoicePending) world.run.bossKills += 1;
    burst(world, enemy.x, enemy.y, "#7dd3fc", 10);
  }
}

/** Ativa o poder especial do personagem ativo (dash/haste/shield). Porta `triggerActivePower()` (app/page.tsx:1256-1278). Chamado pelo orquestrador/Phase quando o jogador pressiona a tecla de poder — é um evento "keydown" (borda de subida), não um estado contínuo, por isso não faz parte de `InputState`/`stepWorld`. */
export function triggerActivePower(world: EngineWorld, character: CharacterDefinition) {
  const power = character.specialPower;
  if (!power) return;
  if (world.run.abilityCooldownRemaining > 0) return;

  if (power.kind === "dash") {
    const liveEnemies = world.enemies.filter((enemy) => enemy.hp > 0);
    const direction = resolveDashDirection(
      { x: world.run.lastMoveX, y: world.run.lastMoveY },
      world.player,
      liveEnemies,
    );
    world.player.x = clamp(world.player.x + direction.x * power.dashDistance, 28, WORLD.width - 28);
    world.player.y = clamp(world.player.y + direction.y * power.dashDistance, 36, WORLD.height - 28);
    if (power.clearRadius) clearNearbyEnemies(world, power.clearRadius);
  } else if (power.kind === "haste") {
    world.player.haste = Math.max(world.player.haste, power.durationSeconds);
  } else if (power.kind === "shield") {
    world.player.invincible = Math.max(world.player.invincible, power.durationSeconds);
  }
  world.run.abilityCooldownRemaining = power.cooldownSeconds;
  announceEffect(world, `${power.name.toUpperCase()}: ativado`);
}

/** Aplica o efeito de um power-up coletado. Porta `collectPowerUp()` (app/page.tsx:1079-1136). "promotion"/"call" são o desfecho da escolha final: `stepWorld` só sinaliza a intenção via `FrameEvents` — a Phase ativa (fora deste módulo) decide a transição de `gameState` e, para "call", o reset completo da wave (wave-progression.ts, T6). */
function collectPowerUp(world: EngineWorld, audio: AudioEngine, powerUp: PowerUp, events: FrameEvents) {
  // fix1, ENGINE-18: setado para QUALQUER PowerUpKind coletado (não só
  // "promotion"/"call") — único ponto de saída antes de qualquer `return`
  // abaixo, então cobre os 8 kinds sem repetir a atribuição em cada branch.
  events.powerUpCollected = true;

  if (powerUp.kind === "promotion") {
    world.run.finalChoicePending = false;
    world.run.bossSpawned = false;
    world.run.finalBossCorpse = null;
    world.powerUps.length = 0;
    events.promotionClaimed = true;
    audio.playSound("over");
    audio.stopMusic();
    return;
  }

  if (powerUp.kind === "call") {
    world.run.callLoops += 1;
    events.newCallRequested = true;
    audio.playSound("start");
    return;
  }

  world.run.score += 35;
  if (powerUp.kind === "coffee") {
    world.player.haste = 6;
    announceEffect(world, "CAFÉ: velocidade aumentada");
  } else if (powerUp.kind === "refactor") {
    world.player.fury = 6;
    announceEffect(world, "REFACTOR: tiros acelerados");
  } else if (powerUp.kind === "rollback") {
    clearNearbyEnemies(world, 190);
    announceEffect(world, "ROLLBACK: caos revertido");
  } else if (powerUp.kind === "hotfix") {
    world.player.hp = clamp(world.player.hp + 32, 0, world.player.maxHp);
    announceEffect(world, "HOTFIX: vida recuperada");
  } else if (powerUp.kind === "cafeZip") {
    // NOVO (feature fase-secreta-datacenter, T8/SECBOSS-27): drop da fase
    // secreta — liga `haste`+`fury` juntos (ambos já existentes: `haste>0`
    // dá speed×1.34, `fury>0` acelera o fire-rate), 8s cada. Zero mecânica
    // nova de player.
    world.player.haste = 8;
    world.player.fury = 8;
    announceEffect(world, "CAFE.ZIP: velocidade e tiro turbinados");
  } else if (powerUp.kind === "review") {
    world.player.focus = 7;
    world.player.invincible = Math.max(world.player.invincible, 2.4);
    announceEffect(world, "CODE REVIEW: escudo ativo");
  } else {
    if (world.run.burstStamina < BURST_STAMINA_MAX) {
      world.run.burstStamina = clamp(world.run.burstStamina + STAMINA_POWER_UP_GAIN, 0, BURST_STAMINA_MAX);
      announceEffect(world, "SPRINT: estamina +5%");
    } else {
      announceEffect(world, "SPRINT: estamina cheia");
    }
  }
  audio.playSound("save");
  burst(world, powerUp.x, powerUp.y, "#facc15", 18);
}

/**
 * Resolve um clique/toque direto num dos power-ups da escolha final (fix1,
 * fundação de ENGINE-16 — restaura o clique instantâneo do código
 * pré-refactor, ver `git show 06093ed:app/page.tsx:163`). Busca em
 * `world.powerUps` o primeiro power-up de escolha final (`isFinalChoicePowerUp`)
 * dentro de `FINAL_CHOICE_CLICK_RADIUS` do ponto `(x, y)`; se achar, remove
 * do array, aplica `collectPowerUp()` e devolve os `FrameEvents` resultantes.
 * Devolve `null` quando nenhum power-up de escolha final está no raio (a
 * Phase ativa decide o que fazer — não é um erro).
 */
export function resolveFinalChoiceClickPowerUp(
  world: EngineWorld,
  audio: AudioEngine,
  x: number,
  y: number,
): FrameEvents | null {
  for (let i = 0; i < world.powerUps.length; i += 1) {
    const powerUp = world.powerUps[i];
    if (!powerUp || !isFinalChoicePowerUp(powerUp.kind)) continue;
    if (distance(powerUp, { x, y }) >= FINAL_CHOICE_CLICK_RADIUS) continue;
    world.powerUps.splice(i, 1);
    const events = emptyFrameEvents();
    collectPowerUp(world, audio, powerUp, events);
    return events;
  }
  return null;
}

/**
 * Decai temporizadores/contadores de frame do `run` e os status temporários
 * do jogador (invencibilidade/fúria/foco/haste/cooldown/banners), e
 * recomputa `weaponLevel` a partir do wave atual. Fix1, T13 — extraído do
 * início de `stepWorld` (nenhum valor calculado muda).
 */
function applyTimerDecay(world: EngineWorld, delta: number) {
  const { player, run } = world;
  run.frame += 1;
  run.spawnTimer -= delta;
  run.dataTimer -= delta;
  run.powerUpTimer -= delta;
  run.shotTimer -= delta;
  player.invincible = Math.max(0, player.invincible - delta);
  player.fury = Math.max(0, player.fury - delta);
  player.focus = Math.max(0, player.focus - delta);
  player.haste = Math.max(0, player.haste - delta);
  run.abilityCooldownRemaining = Math.max(0, run.abilityCooldownRemaining - delta);
  run.damageFlash = Math.max(0, run.damageFlash - delta * 60);
  run.shake = Math.max(0, run.shake - delta * 60);
  run.bossBanner = Math.max(0, run.bossBanner - delta * 60);
  run.effectBanner = Math.max(0, run.effectBanner - delta * 60);
  run.weaponLevel = weaponLevelForWave(run.wave);
}

/**
 * Recarrega/consome a estamina do "burst" (tecla espaço) a partir do input
 * do frame; devolve se o burst está ativo neste frame (usado depois para
 * calcular a cadência de tiro). Fix1, T13 — extraído de `stepWorld`.
 */
function applyBurstStamina(world: EngineWorld, input: InputState, choosingFinalReward: boolean, delta: number) {
  const { run } = world;
  const wantsBurst = input.keys.has(" ");
  const burstActive = !choosingFinalReward && wantsBurst && run.burstStamina > 0;
  if (burstActive) {
    run.burstStamina = Math.max(0, run.burstStamina - BURST_STAMINA_COST * delta);
  } else {
    run.burstStamina = Math.min(BURST_STAMINA_MAX, run.burstStamina + BURST_STAMINA_RECHARGE * delta);
  }
  return burstActive;
}

/**
 * Move o jogador a partir de teclado/ponteiro, respeitando obstáculos.
 * Fix1, T13 — extraído de `stepWorld`.
 */
function movePlayer(world: EngineWorld, input: InputState, delta: number) {
  const { player, run } = world;
  let moveX = 0;
  let moveY = 0;
  if (input.keys.has("w") || input.keys.has("arrowup")) moveY -= 1;
  if (input.keys.has("s") || input.keys.has("arrowdown")) moveY += 1;
  if (input.keys.has("a") || input.keys.has("arrowleft")) moveX -= 1;
  if (input.keys.has("d") || input.keys.has("arrowright")) moveX += 1;
  if (input.pointer.active) {
    const drag = normalize(input.pointer.x - player.x, input.pointer.y - player.y);
    if (distance(input.pointer, player) > 18) {
      moveX += drag.x;
      moveY += drag.y;
    }
  }
  const move = normalize(moveX, moveY);
  run.lastMoveX = move.x;
  run.lastMoveY = move.y;
  if (moveX || moveY) {
    const currentSpeed = player.speed * (player.haste > 0 ? 1.34 : 1);
    const nextX = clamp(player.x + move.x * currentSpeed * delta, 28, WORLD.width - 28);
    const nextY = clamp(player.y + move.y * currentSpeed * delta, 36, WORLD.height - 28);
    const radius = player.size * 0.48;
    if (!obstacleBlocksCircle(world, nextX, player.y, radius)) player.x = nextX;
    if (!obstacleBlocksCircle(world, player.x, nextY, radius)) player.y = nextY;
  }
}

/**
 * Avança/expira as partículas de efeito visual. Fix1, T13 — unifica as 2
 * cópias idênticas que existiam antes em `stepWorld` (branch da escolha
 * final e fim da simulação normal) num único helper chamado nos 2 pontos.
 */
function updateParticles(world: EngineWorld, delta: number) {
  for (let i = world.particles.length - 1; i >= 0; i -= 1) {
    const particle = world.particles[i];
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vx *= 0.96;
    particle.vy *= 0.96;
    particle.ttl -= delta * 60;
    if (particle.ttl <= 0) world.particles.splice(i, 1);
  }
}

/**
 * Resolve a coleta de power-ups da escolha final (tela "choice") e avança as
 * partículas — o branch inteiro que `stepWorld` executa (com early return)
 * enquanto `run.finalChoicePending` está ativo. Fix1, T14 — extraído de
 * `stepWorld`.
 */
function resolveFinalChoicePickups(world: EngineWorld, audio: AudioEngine, events: FrameEvents, delta: number) {
  const { player } = world;
  for (let i = world.powerUps.length - 1; i >= 0; i -= 1) {
    const powerUp = world.powerUps[i];
    if (!powerUp) continue;
    powerUp.pulse += delta * 8;
    const pickupRadius = isFinalChoicePowerUp(powerUp.kind) ? FINAL_CHOICE_PICKUP_RADIUS : player.size * 0.55 + 18;
    if (distance(powerUp, player) < pickupRadius) {
      world.powerUps.splice(i, 1);
      collectPowerUp(world, audio, powerUp, events);
    }
  }
  updateParticles(world, delta);
}

/**
 * Dispara a rajada de tiros do chefe ("boss"), quando seu cooldown expira —
 * cobre tanto o chefe final escalável (`bossPhase` definido) quanto os
 * chefes de wave normais. Fix1, T14 — extraído de dentro do loop de
 * `updateEnemyMovement` para `kind === "boss"`.
 */
/**
 * Calcula o plano do próximo volley do chefe (pattern + tamanho da rajada) a
 * partir do cooldown atual. Retorna `null` quando o cooldown ainda não
 * zerou — nesse caso `updateBossVolley` não deve disparar neste frame.
 * Fix1 ciclo 2, T18 — extraído de `updateBossVolley`.
 */
export function computeBossVolleyPlan(
  enemy: Actor,
  run: EngineWorld["run"],
): { pattern: number; volleySize: number } | null {
  if ((enemy.cooldown ?? 0) > 0) return null;
  const isEscalating = enemy.bossPhase !== undefined;
  const bossPhase = enemy.bossPhase ?? 1;
  enemy.cooldown = isEscalating ? Math.max(42, 86 - bossPhase * 10) : Math.max(64, 104 - run.wave * 4);
  const pattern = isEscalating ? bossPhase : run.bossIndex % 4;
  const volleySize = isEscalating
    ? bossPhase === 1 ? 4 : bossPhase === 2 ? 9 : 7
    : pattern === 1 ? 8 : pattern === 3 ? 5 : run.wave >= 3 ? 3 : 2;
  return { pattern, volleySize };
}

/**
 * Spawna um projétil/minion do volley do chefe (índice `i` de `volleySize`).
 * Fix1 ciclo 2, T18 — extraído de `updateBossVolley`.
 */
function spawnBossVolleyShot(
  world: EngineWorld,
  enemy: Actor,
  player: EngineWorld["player"],
  pattern: number,
  volleySize: number,
  i: number,
) {
  const { run } = world;
  const aimed = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  const base = pattern === 1
    ? (Math.PI * 2 * i) / volleySize
    : pattern === 3
      ? aimed + (i - 2) * 0.24
      : aimed + (i - 1) * 0.34;
  const minionHp = scaledEnemyHp(pattern === 2 ? 24 : 16, run.callLoops);
  world.enemies.push({
    x: enemy.x + Math.cos(base) * 30,
    y: enemy.y + Math.sin(base) * 30,
    vx: 0,
    vy: 0,
    hp: minionHp,
    maxHp: minionHp,
    speed: pattern === 3 ? 126 : 96 + Math.min(run.wave, 5) * 4,
    size: pattern === 2 ? 22 : 18,
    kind: pattern === 2 ? "qa" : pattern === 3 ? "incident" : "data",
    label: pattern === 2 ? "QA" : pattern === 3 ? "P1" : "Deploy",
    phase: Math.random() * Math.PI * 2,
  });
}

function updateBossVolley(world: EngineWorld, enemy: Actor, delta: number) {
  const { player, run } = world;
  enemy.cooldown = (enemy.cooldown ?? 0) - delta * 60;
  const plan = computeBossVolleyPlan(enemy, run);
  if (plan) {
    const { pattern, volleySize } = plan;
    for (let i = 0; i < volleySize; i += 1) {
      spawnBossVolleyShot(world, enemy, player, pattern, volleySize, i);
    }
  }
}

/**
 * IA de movimento por `EnemyKind` (exceto Actors com `customMovement: true`
 * — hoje, `daemon`/`cron`/`secretBoss` da fase secreta, cuja IA fica com a
 * Phase que os spawna) + posição resultante; dispara a rajada do chefe via
 * `updateBossVolley`. Fix1, T14 — extraído de `stepWorld`; de-hardcoded na
 * Fatia 2 (T8, PHASEFLOW-01) para ler `Actor.customMovement` em vez de
 * checar `kind` diretamente.
 */
function updateEnemyMovement(world: EngineWorld, delta: number) {
  const { player, run } = world;
  for (const enemy of world.enemies) {
    const toward = normalize(player.x - enemy.x, player.y - enemy.y);
    if (enemy.kind === "data") {
      enemy.vx = toward.x * enemy.speed * 1.5;
      enemy.vy = toward.y * enemy.speed * 1.5;
    } else if (enemy.kind === "qa") {
      const strafe = Math.sin(run.frame / 10 + (enemy.phase ?? 0)) * 85;
      enemy.vx = toward.x * enemy.speed - toward.y * strafe;
      enemy.vy = toward.y * enemy.speed + toward.x * strafe;
    } else if (enemy.kind === "vip") {
      enemy.vx = toward.x * enemy.speed * 0.84;
      enemy.vy = toward.y * enemy.speed * 0.84;
    } else if (enemy.kind === "incident") {
      const pulse = Math.sin(run.frame / 14 + (enemy.phase ?? 0)) > 0.25 ? 1.55 : 0.72;
      enemy.vx = toward.x * enemy.speed * pulse;
      enemy.vy = toward.y * enemy.speed * pulse;
    } else if (enemy.kind === "legacy") {
      enemy.vx = toward.x * enemy.speed + Math.sin(run.frame / 42 + (enemy.phase ?? 0)) * 8;
      enemy.vy = toward.y * enemy.speed + Math.cos(run.frame / 48 + (enemy.phase ?? 0)) * 8;
    } else if (enemy.kind === "boss") {
      enemy.vx = toward.x * enemy.speed;
      enemy.vy = toward.y * enemy.speed;
    } else if (enemy.customMovement) {
      // IA específica de quem spawnou este Actor (ex.: fase secreta "O
      // Mainframe", phases/secret-mainframe/). stepWorld não move esses
      // inimigos; a Phase ativa assume o movimento antes/depois de chamar
      // stepWorld.
    } else {
      enemy.vx = toward.x * enemy.speed + Math.sin((run.frame + enemy.x) / 23) * 16;
      enemy.vy = toward.y * enemy.speed + Math.cos((run.frame + enemy.y) / 29) * 16;
    }
    enemy.x += enemy.vx * delta;
    enemy.y += enemy.vy * delta;

    if (enemy.kind === "boss") {
      updateBossVolley(world, enemy, delta);
    }
  }
}

/**
 * Coleta/expira os power-ups em campo (fora da escolha final, ver
 * `resolveFinalChoicePickups`). Fix1, T15 — extraído de `stepWorld`.
 */
function updatePowerUps(world: EngineWorld, audio: AudioEngine, events: FrameEvents, delta: number) {
  const { player } = world;
  for (let i = world.powerUps.length - 1; i >= 0; i -= 1) {
    const powerUp = world.powerUps[i];
    powerUp.ttl -= delta * 60;
    powerUp.pulse += delta * 8;
    if (distance(powerUp, player) < player.size * 0.55 + 16) {
      collectPowerUp(world, audio, powerUp, events);
      world.powerUps.splice(i, 1);
    } else if (powerUp.ttl <= 0) {
      world.powerUps.splice(i, 1);
    }
  }
}

/**
 * Avança os tiros em voo e os apaga ao colidirem com um obstáculo. Fix1,
 * T15 — extraído de `stepWorld`.
 */
function updateShots(world: EngineWorld, delta: number) {
  for (const shot of world.shots) {
    shot.x += shot.vx * delta;
    shot.y += shot.vy * delta;
    shot.ttl -= delta * 60;
    if (world.obstacles.some((obstacle) => pointInRect(shot, obstacle))) {
      shot.ttl = 0;
      burst(world, shot.x, shot.y, "#94a3b8", 3);
    }
  }
}

/**
 * Aplica a regra "jogador leva dano" (invencibilidade, flash, shake, evento,
 * som, partículas) — única implementação compartilhada entre o dano de
 * toque (`resolveEnemyPlayerCollisions`, abaixo) e o dano de tiro do chefe
 * secreto (`stepSecretBossShots`, `phases/secret-mainframe/index.ts`).
 * Fix2, T2 (ENGINE-24/ENGINE-25) — antes duplicada nos 2 arquivos, com uma
 * divergência real: a cópia da fase secreta nunca setava
 * `events.playerHit`. A guarda `player.invincible <= 0` fica aqui dentro,
 * então chamar 2x no mesmo frame não duplica o efeito.
 */
export function applyPlayerDamage(world: EngineWorld, audio: AudioEngine, events: FrameEvents, damage: number, burstCount: number) {
  const { player, run } = world;
  if (player.invincible > 0) return;
  player.hp -= damage;
  player.invincible = 0.92;
  run.damageFlash = 16;
  run.shake = 14;
  events.playerHit = true;
  audio.playSound("hurt");
  burst(world, player.x, player.y, "#ff5353", burstCount);
}

/**
 * Aplica dano de toque quando um inimigo vivo colide com o jogador
 * desprotegido, e remove o inimigo quando ele não é um "tanque" — `boss`
 * (literal, chefe do `normal-run`) ou qualquer Actor com `onDeath` definido
 * (hoje, `secretBoss`/`cron` da fase secreta, atribuído por quem os
 * spawna) sobrevivem ao toque. Fix1, T15 — extraído de `stepWorld`;
 * de-hardcoded na Fatia 2 (T8, PHASEFLOW-01).
 */
function resolveEnemyPlayerCollisions(world: EngineWorld, audio: AudioEngine, events: FrameEvents) {
  const { player } = world;
  for (let i = world.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = world.enemies[i];
    if (enemy.hp > 0 && distance(enemy, player) < enemy.size * 0.55 + player.size * 0.55) {
      if (player.invincible <= 0) {
        applyPlayerDamage(world, audio, events, ENEMY_TOUCH_DAMAGE[enemy.kind], 16);
        if (enemy.kind !== "boss" && !enemy.onDeath) world.enemies.splice(i, 1);
      }
    }
  }
}

/**
 * Resolve a morte de um inimigo já com `hp <= 0` (score, efeitos por kind,
 * escalonamento de fase do chefe final, remoção do array de inimigos).
 * Fix1, T15 — extraída de dentro de `resolveShotEnemyCollisions` para manter
 * sua complexidade cognitiva sob controle (segunda extração interna,
 * documentada na task T15/T14).
 *
 * De-hardcoded na Fatia 2 (T8, PHASEFLOW-01): `Actor.onDeath?`, quando
 * presente, roda ANTES de qualquer branch de `kind` — hoje, quem o
 * spawnou (`phases/secret-mainframe/`) o usa para o efeito de `cron`
 * ("cai" mas fica com cooldown de revive, sem ser removido — `onDeath`
 * retorna `true`) e de `secretBoss` (cura/fúria/`events.gameWon`/áudio de
 * vitória, seguido de remoção normal). `kind === "boss"` (chefe do
 * `normal-run`) permanece hardcoded aqui — fora do escopo desta feature.
 */
function resolveEnemyDeath(world: EngineWorld, audio: AudioEngine, events: FrameEvents, enemy: Actor, enemyIndex: number) {
  const { player, run } = world;
  run.score += ENEMY_DEATH_SCORE[enemy.kind] * secretPhaseScoreMultiplier(world);
  const preventRemoval = enemy.onDeath?.(world, audio, events);
  if (preventRemoval) return;
  if (enemy.kind === "boss") {
    const currentBossPhase = enemy.bossPhase ?? 1;
    player.fury = 5;
    player.hp = clamp(player.hp + 22, 0, player.maxHp);
    if (enemy.bossPhase !== undefined && currentBossPhase < 3) {
      enemy.bossPhase = currentBossPhase + 1;
      enemy.maxHp = scaledEnemyHp(finalBossHp(enemy.bossPhase, run.wave), run.callLoops);
      enemy.hp = enemy.maxHp;
      enemy.size = 62 + enemy.bossPhase * 6;
      enemy.speed += 7;
      enemy.cooldown = 64;
      run.bossBanner = 130;
      events.bossPhaseAdvanced = true;
      announceEffect(world, `DIRETORIA FASE ${enemy.bossPhase}: benefício removido`);
      burst(world, enemy.x, enemy.y, "#f97316", 30);
      return;
    }
    burst(world, enemy.x, enemy.y, "#ffd166", 28);
    events.bossDefeated = true;
  } else if (!enemy.onDeath) {
    if (!run.bossSpawned && !run.finalChoicePending) run.bossKills += 1;
    burst(world, enemy.x, enemy.y, enemy.kind === "data" ? "#7dd3fc" : "#a7f3d0", 12);
  }
  world.enemies.splice(enemyIndex, 1);
}

/**
 * Resolve colisões de tiro contra inimigo: dano, remoção do tiro e, quando o
 * inimigo morre, delega a `resolveEnemyDeath`. Fix1, T15 — extraído de
 * `stepWorld`; a resolução de morte foi extraída à parte (ver
 * `resolveEnemyDeath`) para manter a complexidade cognitiva desta função sob
 * controle.
 */
/**
 * Checa se um tiro deve ser removido do mundo antes de testar colisão:
 * slot vazio, TTL esgotado ou fora dos limites do mundo. Fix1 ciclo 2, T19
 * — extraído de `resolveShotEnemyCollisions`.
 */
function shouldCullShot(shot: Shot | undefined): boolean {
  if (!shot) return true;
  return shot.ttl <= 0 || shot.x < -20 || shot.x > WORLD.width + 20 || shot.y < -20 || shot.y > WORLD.height + 20;
}

/**
 * Testa colisão de um tiro contra os inimigos vivos do mundo: aplica dano,
 * remove o tiro e, quando o inimigo morre, delega a `resolveEnemyDeath`.
 * Retorna `true` se acertou algum inimigo. Fix1 ciclo 2, T19 — extraído de
 * `resolveShotEnemyCollisions`.
 */
function resolveShotHitOnEnemy(
  world: EngineWorld,
  audio: AudioEngine,
  events: FrameEvents,
  shot: Shot,
  shotIndex: number,
): boolean {
  const { player } = world;
  for (let e = world.enemies.length - 1; e >= 0; e -= 1) {
    const enemy = world.enemies[e];
    if (!enemy || enemy.hp <= 0) continue;
    if (distance(shot, enemy) < enemy.size * 0.55 + 7) {
      const damage = player.fury > 0 ? 26 : player.focus > 0 ? 23 : 18;
      enemy.hp -= damage;
      world.shots.splice(shotIndex, 1);
      audio.playSound("hit");
      // `kind === "boss"` (chefe do `normal-run`) permanece hardcoded aqui —
      // fora do escopo desta feature. `Actor.deathBurstColor?` (opcional,
      // atribuído por quem spawna o Actor) cobre o mesmo efeito visual para
      // outros Actors "especiais" sem `physics.ts` precisar conhecer seu
      // `kind` (hoje, só `secretBoss`, atribuído por `phases/secret-mainframe/`).
      const hitSparkColor = enemy.kind === "boss" ? "#f9c74f" : (enemy.deathBurstColor ?? "#65d6ad");
      burst(world, shot.x, shot.y, hitSparkColor, 4);
      if (enemy.hp <= 0) {
        resolveEnemyDeath(world, audio, events, enemy, e);
      }
      return true;
    }
  }
  return false;
}

function resolveShotEnemyCollisions(world: EngineWorld, audio: AudioEngine, events: FrameEvents) {
  for (let s = world.shots.length - 1; s >= 0; s -= 1) {
    const shot = world.shots[s];
    if (shouldCullShot(shot)) {
      world.shots.splice(s, 1);
      continue;
    }
    resolveShotHitOnEnemy(world, audio, events, shot as Shot, s);
  }
}

/**
 * Marca `gameOver`/toca o som de derrota quando o jogador chega a 0 de HP.
 * Fix1, T15 — extraído de `stepWorld`.
 */
function resolveGameOver(world: EngineWorld, audio: AudioEngine, events: FrameEvents) {
  const { player } = world;
  if (player.hp <= 0) {
    player.hp = 0;
    events.gameOver = true;
    audio.playSound("over");
    audio.stopMusic();
  }
}

/**
 * Avança a simulação em `delta` segundos: movimento do jogador, IA/movimento
 * de inimigos (exceto a IA específica de `daemon`/`cron`/`secretBoss`, que
 * fica com `phases/secret-mainframe/`), colisões, dano, coleta de power-up e
 * tiros. Não chama `setState` nem importa `react`; roda sem lançar erro num
 * ambiente Vitest puro (sem `window`/`HTMLCanvasElement`).
 */
export function stepWorld(world: EngineWorld, input: InputState, delta: number, audio: AudioEngine): FrameEvents {
  const events = emptyFrameEvents();
  const { player, run } = world;
  const choosingFinalReward = run.finalChoicePending;

  applyTimerDecay(world, delta);
  const burstActive = applyBurstStamina(world, input, choosingFinalReward, delta);
  movePlayer(world, input, delta);

  if (choosingFinalReward) {
    resolveFinalChoicePickups(world, audio, events, delta);
    return events;
  }

  if (run.shotTimer <= 0) {
    shoot(world, input, audio);
    run.shotTimer = player.fury > 0 || burstActive ? 0.11 : run.weaponLevel >= 3 ? 0.2 : 0.24;
  }

  updateEnemyMovement(world, delta);
  updatePowerUps(world, audio, events, delta);
  updateShots(world, delta);
  resolveEnemyPlayerCollisions(world, audio, events);
  resolveShotEnemyCollisions(world, audio, events);
  updateParticles(world, delta);
  resolveGameOver(world, audio, events);

  return events;
}

