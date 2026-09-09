// Progresso e regras do chefe do fluxo normal. Porta `countBossProgress`,
// `isFinalBoss`, `finalBossHp` (`app/page.tsx:784-800`). Nenhum import de
// `react`.
//
// `stepWorld` (`physics.ts`, T5) já incrementa `world.run.bossKills` no
// momento em que um inimigo comum morre (`if (!run.bossSpawned &&
// !run.finalChoicePending) run.bossKills += 1`) — o `countBossProgress`
// original também fazia esse incremento (`app/page.tsx:786`), mas aqui ele
// só checa o limiar e dispara o spawn do chefe, para não contar duas vezes
// a mesma morte.

import type { AudioEngine } from "@/lib/pixel-hunt-engine/audio";
import { finalBossHp } from "@/lib/pixel-hunt-engine/physics";
import { bossKillTarget, bossNames } from "@/lib/pixel-hunt-engine/phases/normal-run/wave-progression";
// Reuso de T7 (spawn.ts) — por ordem de execução da Fase 3 (T6 → T7 → T8),
// `spawn.ts` já existe quando esta task roda; é quem sabe montar o Actor do
// chefe (stats, label, bossPhase). Ver design.md § Components →
// normal-run/ ("countBossProgress... dispara spawn do chefe").
import { spawnEnemy } from "@/lib/pixel-hunt-engine/phases/normal-run/spawn";
import type { EngineWorld } from "@/lib/pixel-hunt-engine/types";

/** Porta `isFinalBoss()` (`app/page.tsx:794-796`). */
export function isFinalBoss(bossIndex: number) {
  return bossIndex === bossNames.length - 1;
}

/** Re-exportada de `physics.ts` — canonicalizada lá para evitar duplicação (ver design.md § Tech Decisions, ENGINE-21). */
export { finalBossHp };

/**
 * Porta `countBossProgress()` (`app/page.tsx:784-792`) — checa se
 * `bossKills` cruzou `bossKillTarget(wave, resets)` e, se sim, libera o
 * chefe (marca `bossSpawned`, anuncia o evento e spawna o Actor via
 * `spawn.ts`). Retorna `true` quando o chefe foi liberado nesta chamada.
 */
export function countBossProgress(world: EngineWorld, audio: AudioEngine): boolean {
  if (world.run.bossSpawned || world.run.finalChoicePending) return false;
  if (world.run.bossKills < bossKillTarget(world.run.wave, world.run.callLoops)) return false;

  world.run.bossSpawned = true;
  world.run.effectMessage = "CHEFE LIBERADO: entra na call";
  world.run.effectBanner = 100;
  spawnEnemy(world, "boss", audio);
  return true;
}
