// Monta `SecretMainframePhase` — a fase secreta "O Mainframe" (`idclip`),
// implementando `EnginePhase` (`phase.ts`, T3). `enter` porta
// `startSecretRun()` (`app/page.tsx:1158-1208`); `update`/`draw` portam os
// branches `runOrigin === "secret"` de `update()`/`draw*()`
// (`app/page.tsx:1393-2477`) que `physics.ts` (T5) deliberadamente deixou de
// fora (movimento de daemon/cron/secretBoss, secretBossShots, cobol snake,
// meeting zones — ver o comentário no topo do loop de inimigos de
// `physics.ts`). Delega a T11 (`datacenter.ts`) e T12 (`cobol-snake.ts`), e
// reaproveita `physics.stepWorld`/`renderer.drawFrame`. Nenhum import de
// `react`.

import { DEFAULT_CHARACTER_ID, resolveCharacter, type CharacterDefinition } from "@/lib/characters";
import { applyPlayerDamage, stepWorld } from "@/lib/pixel-hunt-engine/physics";
import { drawFrame, type ViewState } from "@/lib/pixel-hunt-engine/renderer";
import { drawDatacenterFloor, drawSecretRunOverlay } from "@/lib/pixel-hunt-engine/renderer/world";
import type { EnginePhase, PhaseContext } from "@/lib/pixel-hunt-engine/phases/phase";
import {
  spawnDatacenterCracks,
  spawnDatacenterMoss,
  spawnDatacenterObstacles,
} from "@/lib/pixel-hunt-engine/phases/secret-mainframe/datacenter";
import { createCobolSnake, stepCobolSnake } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/cobol-snake";
import { drawCronBody, drawMainframeBoss } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/rendering";
import { bossKillTarget, resetWaveOne, scaledEnemyHp } from "@/lib/pixel-hunt-engine/phases/normal-run/wave-progression";
import { burst, clamp, distance, normalize } from "@/lib/pixel-hunt-engine/geometry";
import { emptyFrameEvents } from "@/lib/pixel-hunt-engine/types";
import type {
  Actor,
  EngineWorld,
  FrameEvents,
  InputState,
  MeetingZone,
  SecretMainframePhaseState,
} from "@/lib/pixel-hunt-engine/types";
import type { AudioEngine } from "@/lib/pixel-hunt-engine/audio";

const WORLD = { width: 960, height: 540 };

function announceEffect(world: EngineWorld, message: string) {
  world.run.effectMessage = message;
  world.run.effectBanner = 100;
}

type SecretEnemyKind = "daemon" | "cron" | "secretBoss";

const SECRET_ENEMY_STATS: Record<SecretEnemyKind, { hp: number; speed: number; size: number }> = {
  daemon: { hp: 30, speed: 96, size: 22 },
  cron: { hp: 50, speed: 42, size: 24 },
  secretBoss: { hp: 520, speed: 0, size: 64 },
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
function spawnSecretEnemy(world: EngineWorld, kind: SecretEnemyKind): Actor {
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
  const hp = scaledEnemyHp(selected.hp, world.run.callLoops);
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
    label: isSecretBoss ? "O Mainframe" : kind === "daemon" ? "Daemon" : "Cron Job",
    cooldown: kind === "daemon" ? 60 : 90,
    phase: Math.random() * Math.PI * 2,
    bossState: isSecretBoss ? "idle" : undefined,
    bossStateTimer: isSecretBoss ? 0 : undefined,
    bossAtkPattern: isSecretBoss ? -1 : undefined,
    customMovement: true,
  };
  if (isCron) {
    actor.render = drawCronBody;
    actor.onDeath = (deathWorld: EngineWorld) => {
      // Não remove: fica "derrubado" e `stepSecretEnemyAi` o ressuscita
      // depois de alguns segundos (cooldown abaixo).
      actor.cooldown = 300;
      burst(deathWorld, actor.x, actor.y, "#d4ff5e", 14);
      return true;
    };
  } else if (isSecretBoss) {
    actor.render = drawMainframeBoss;
    actor.deathBurstColor = "#f9c74f";
    actor.onDeath = (deathWorld: EngineWorld, audio: AudioEngine, events: FrameEvents) => {
      deathWorld.player.fury = 5;
      deathWorld.player.hp = clamp(deathWorld.player.hp + 22, 0, deathWorld.player.maxHp);
      burst(deathWorld, actor.x, actor.y, "#ffd166", 28);
      burst(deathWorld, actor.x, actor.y, "#facc15", 24);
      events.gameWon = true;
      audio.playSound("won");
      audio.stopMusic();
    };
  }
  world.enemies.push(actor);
  if (isSecretBoss) world.run.bossBanner = 120;
  return actor;
}

type SecretRunState = SecretMainframePhaseState;

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
    meetingZones: [],
    cobolSnake: createCobolSnake(),
    datacenterMoss: [],
    datacenterCracks: [],
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
function stepSecretEnemyAi(world: EngineWorld, phaseState: SecretRunState, delta: number) {
  for (const enemy of world.enemies) {
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
          burst(world, enemy.x, enemy.y, "#7dff6a", 14);
        }
      } else {
        enemy.vx = toward.x * enemy.speed;
        enemy.vy = toward.y * enemy.speed;
      }
    } else if (enemy.kind === "secretBoss") {
      enemy.vx = 0;
      enemy.vy = 0;
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
            phaseState.secretBossShots.push({ x: enemy.x, y: enemy.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120 });
          }
        } else if (pattern === 1) {
          const aimed = Math.atan2(world.player.y - enemy.y, world.player.x - enemy.x);
          for (let k = -1; k <= 1; k += 1) {
            const a = aimed + k * 0.22;
            phaseState.secretBossShots.push({ x: enemy.x, y: enemy.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170 });
          }
        } else {
          if (world.enemies.filter((other) => other.kind === "cron" && other.hp > 0).length < 2) {
            spawnSecretEnemy(world, "cron");
            announceEffect(world, "O MAINFRAME REINICIA UM CRON JOB");
          }
          burst(world, enemy.x, enemy.y + 20, "#7dff6a", 16);
        }
      } else if (bossFightState === "atk" && enemy.bossStateTimer > 0.5) {
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
      applyPlayerDamage(world, ctx.audio, events, 10, 12);
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

      const meetingZones: MeetingZone[] = [
        { x: 300, y: 330, base: 26, r: 26, ph: 0 },
        { x: 660, y: 420, base: 30, r: 30, ph: 2 },
      ];

      world.run.bossKills = bossKillTarget(world.run.wave, world.run.callLoops);
      world.run.bossSpawned = true;
      spawnSecretEnemy(world, "secretBoss");

      world.phaseState = {
        phase: "secret-mainframe",
        localGameState: "playing",
        secretBossShots: [],
        meetingZones,
        cobolSnake: createCobolSnake(),
        datacenterMoss: spawnDatacenterMoss(),
        datacenterCracks: spawnDatacenterCracks(),
      } satisfies SecretRunState;
    },

    update(world: EngineWorld, ctx: PhaseContext, input: InputState, delta: number): FrameEvents {
      const state = readState(world);
      if (state.localGameState === "over" || state.localGameState === "won") {
        return emptyFrameEvents();
      }

      stepSecretEnemyAi(world, state, delta);

      // Reduz a velocidade do jogador em 45% dentro de uma "zona de
      // reunião" (`app/page.tsx:1436-1437`) — `stepWorld` (T5) não conhece
      // `meetingZones` (é específico do fluxo secreto), então este ajuste
      // acontece por fora, temporariamente, só para a chamada de baixo.
      const inMeetingZone = state.meetingZones.some((zone) => distance(world.player, zone) < zone.r);
      const originalSpeed = world.player.speed;
      if (inMeetingZone) world.player.speed *= 0.55;
      const events = stepWorld(world, input, delta, ctx.audio);
      world.player.speed = originalSpeed;

      stepSecretBossShots(world, state, ctx, events, delta);
      stepCobolSnake(world, state.cobolSnake, ctx.audio, delta);
      state.meetingZones.forEach((zone) => {
        zone.r = zone.base + Math.sin(world.run.frame / 40 + zone.ph) * 6;
      });

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
        drawGroundOverlay: (overlayCtx) => drawSecretRunOverlay(overlayCtx, state),
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
