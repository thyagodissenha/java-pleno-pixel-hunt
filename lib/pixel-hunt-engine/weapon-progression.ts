// Regras puras de progressão de arma — módulo-kernel sem dependência de
// `physics.ts` nem de nenhuma Phase (mesmo padrão de `geometry.ts`). Fix2,
// T3 (ENGINE-26): fonte única de `shotLanesForWeaponLevel`/
// `weaponLevelForWave`, antes duplicadas em `physics.ts` e
// `phases/normal-run/wave-progression.ts`. Extraídas para um arquivo
// próprio (em vez de uma das duas cópias existentes importar da outra) para
// não criar um ciclo: `wave-progression.ts` já importa `scaledEnemyHp` de
// `physics.ts`.

/** Porta `shotLanesForWeaponLevel()` (`app/page.tsx:173-177`). */
export function shotLanesForWeaponLevel(weaponLevel: number) {
  if (weaponLevel >= 3) return [-0.16, 0, 0.16];
  if (weaponLevel === 2) return [-0.1, 0.1];
  return [0];
}

/** Porta `weaponLevelForWave()` (`app/page.tsx:179-183`). */
export function weaponLevelForWave(wave: number) {
  if (wave >= 4) return 3;
  if (wave >= 2) return 2;
  return 1;
}
