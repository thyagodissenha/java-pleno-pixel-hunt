// Progressão de onda do fluxo normal (ondas → chefe → escolha final → novo
// chamado). Porta `resetWaveOne`, `bossKillTarget`, `scaledEnemyHp`,
// `shotLanesForWeaponLevel`, `weaponLevelForWave` (`app/page.tsx:165-183`,
// `887-930`), adaptado para operar sobre `EngineWorld`/`RunCounters` em vez
// dos `let` locais do antigo `useEffect`. Nenhum import de `react`.
//
// `scaledEnemyHp` é canonicalizada em `physics.ts` e re-exportada aqui (fix1
// T3, ENGINE-21). `shotLanesForWeaponLevel`/`weaponLevelForWave` são
// canonicalizadas em `weapon-progression.ts` e re-exportadas aqui (fix2, T3,
// ENGINE-26).

import type { PhaseContext } from "@/lib/pixel-hunt-engine/phases/phase";
import { scaledEnemyHp } from "@/lib/pixel-hunt-engine/physics";
import { shotLanesForWeaponLevel, weaponLevelForWave } from "@/lib/pixel-hunt-engine/weapon-progression";
import type { EngineWorld } from "@/lib/pixel-hunt-engine/types";

const WORLD = { width: 960, height: 540 };
const BURST_STAMINA_MAX = 100;

// Nomes dos "chefes" por onda — usado só para saber quantos existem
// (`bossNames.length`) e rotular o Actor spawnado (`spawn.ts`, T7). O texto
// em si é conteúdo de UI/gameplay, não um tipo do motor.
export const bossNames = [
  "Gerente de Sprint",
  "Dono do Roadmap",
  "Arquiteto das Reuniões",
  "Diretor do Go-Live",
];

/** Porta `bossKillTarget()` (`app/page.tsx:165-167`). */
export function bossKillTarget(wave: number, resets = 0) {
  return 10 + wave * 4 + resets * 5;
}

/** Re-exportada de `physics.ts` — canonicalizada lá para evitar duplicação (ver design.md § Tech Decisions, ENGINE-21). */
export { scaledEnemyHp };

/** Re-exportadas de `weapon-progression.ts` — canonicalizadas lá para evitar duplicação e um ciclo de import com `physics.ts` (fix2, ENGINE-26). */
export { shotLanesForWeaponLevel, weaponLevelForWave };

/**
 * Reinicia `world` para o início da onda 1 — porta `resetWaveOne()`
 * (`app/page.tsx:887-930`), exceto pela parte de spawn (`spawnObstacles`/
 * `spawnEnemy`), que fica a cargo de `NormalRunPhase.enter` (T10) via
 * `spawn.ts` (T7) — `wave-progression.ts` não depende de `spawn.ts`.
 *
 * Não mexe em `world.run.frame`/`world.run.visualFrame`: no código atual
 * esses contadores vivem fora de `resetWaveOne` (persistem por toda a vida
 * do componente montado, não por run) — o `Orchestrator` (T14) os
 * inicializa uma vez ao criar o `EngineWorld`.
 */
export function resetWaveOne(world: EngineWorld, ctx: PhaseContext, keepScore = false) {
  const { player, run } = world;

  if (!keepScore) {
    run.score = 0;
    run.callLoops = 0;
  }
  run.wave = 1;
  run.spawnTimer = 0;
  run.dataTimer = 120;
  run.powerUpTimer = 7;
  run.shotTimer = 0;
  run.bossIndex = 0;
  run.bossKills = 0;
  run.bossSpawned = false;
  run.finalChoicePending = false;
  run.finalBossCorpse = null;
  run.burstStamina = BURST_STAMINA_MAX;
  run.weaponLevel = 1;
  run.damageFlash = 0;
  run.shake = 0;
  run.bossBanner = 0;
  run.effectMessage = "";
  run.effectBanner = 0;
  run.abilityCooldownRemaining = 0;
  run.lastMoveX = 0;
  run.lastMoveY = 0;

  player.maxHp = ctx.character.maxHp;
  player.speed = ctx.character.speed;
  player.size = ctx.character.size;
  player.x = WORLD.width / 2;
  player.y = WORLD.height / 2;
  player.hp = player.maxHp;
  player.invincible = 0;
  player.fury = 0;
  player.focus = 0;
  player.haste = 0;

  world.enemies.length = 0;
  world.shots.length = 0;
  world.particles.length = 0;
  world.powerUps.length = 0;
}
