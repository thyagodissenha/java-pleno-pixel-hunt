// Único bloco de constantes editáveis do ciclo shield/firewall da fase
// secreta "O Datacenter Esquecido" (design.md § Components → config.ts,
// espelhando o §15 `CONFIG` do documento de design original). Valores
// iniciais são placeholder de tuning (spec.md, assumption A1) — os testes
// de aceite desta feature leem estas constantes em vez de literais, para
// que rebalancear depois não quebre a suíte. Nenhum import de `react`.

export type SecretPhaseDominantMob = "daemon" | "cron" | "cobolSnake" | "mixed";
export type SecretPhasePower = "burstRadial" | "volley" | "memorySurge" | "random";

export type SecretPhaseTuning = {
  readonly mobCap: number;
  readonly shieldSpawnRate: number;
  readonly dpsSpawnRate: number;
  readonly puddles: number;
  readonly barriers: number;
  readonly dominantMob: SecretPhaseDominantMob;
  readonly power: SecretPhasePower;
};

export type SecretPhaseConfig = {
  /** HP de cada barra nas fases 1-3 (design.md, spec.md SECBOSS-12). */
  readonly BAR_HP: number;
  /** HP da barra da fase 4 (o dobro de `BAR_HP`, spec.md SECBOSS-12). */
  readonly FINAL_BAR_HP: number;
  /** Pontos de firewall necessários para disparar `BREAK_FX` (spec.md SECBOSS-06). */
  readonly SHIELD_NEED: number;
  /** Pesos de firewall por tipo de kill durante `SHIELD` (spec.md SECBOSS-02..04). */
  readonly W_PTS: { readonly normal: number; readonly elite: number; readonly respawned: number };
  /** Duração (segundos) do stun/BREAK_FX após a quebra do firewall (spec.md SECBOSS-06, edge case §16.5). */
  readonly STUN_BREAK: number;
  /** Duração (segundos) da janela de slow-mo do `BREAK_FX`. */
  readonly SLOWMO_DURATION: number;
  /** Fator de escala do `delta` durante a janela de slow-mo (0 < escala < 1). */
  readonly SLOWMO_SCALE: number;
  /** Velocidade normal do jogador (fora de poças) — spec.md SECBOSS-18. */
  readonly PLAYER_SPEED_NORMAL: number;
  /** Velocidade do jogador dentro de uma poça de vazamento de memória — spec.md SECBOSS-18. */
  readonly PLAYER_SPEED_IN_PUDDLE: number;
  /** Raio base de cada poça (antes de qualquer Memory Surge). */
  readonly PUDDLE_BASE_RADIUS: number;
  /** Bônus de raio aplicado pelo poder "Memory Surge" (spec.md SECBOSS-21). */
  readonly MEMORY_SURGE_RADIUS_BONUS: number;
  /** Largura/altura (px) de cada barreira-firewall (design.md § Components → hazards/barriers.ts). */
  readonly BARRIER_WIDTH: number;
  readonly BARRIER_HEIGHT: number;
  /** Stats da Cobra COBOL, normal e ×2 na fase 4 (spec.md SECBOSS-13..15). */
  readonly COBOL_SNAKE: {
    readonly hp: number;
    readonly hpPhase4: number;
    readonly contactDamage: number;
    readonly contactDamagePhase4: number;
    readonly score: number;
    readonly scorePhase4: number;
  };
  /** Composição/tuning por fase (índice 0 = fase 1 .. índice 3 = fase 4). */
  readonly PHASES: readonly [SecretPhaseTuning, SecretPhaseTuning, SecretPhaseTuning, SecretPhaseTuning];
};

export const CONFIG: SecretPhaseConfig = {
  BAR_HP: 400,
  FINAL_BAR_HP: 800,
  SHIELD_NEED: 100,
  W_PTS: { normal: 1, elite: 3, respawned: 0.5 },
  STUN_BREAK: 1.5,
  SLOWMO_DURATION: 0.55,
  SLOWMO_SCALE: 0.3,
  PLAYER_SPEED_NORMAL: 170,
  PLAYER_SPEED_IN_PUDDLE: 70,
  PUDDLE_BASE_RADIUS: 40,
  MEMORY_SURGE_RADIUS_BONUS: 14,
  BARRIER_WIDTH: 84,
  BARRIER_HEIGHT: 18,
  COBOL_SNAKE: {
    hp: 40,
    hpPhase4: 80,
    contactDamage: 20,
    contactDamagePhase4: 40,
    score: 30,
    scorePhase4: 60,
  },
  PHASES: [
    { mobCap: 12, shieldSpawnRate: 1.2, dpsSpawnRate: 3.6, puddles: 2, barriers: 1, dominantMob: "daemon", power: "burstRadial" },
    { mobCap: 14, shieldSpawnRate: 1.1, dpsSpawnRate: 3.3, puddles: 4, barriers: 2, dominantMob: "cron", power: "volley" },
    { mobCap: 16, shieldSpawnRate: 1.0, dpsSpawnRate: 3.0, puddles: 6, barriers: 3, dominantMob: "cobolSnake", power: "memorySurge" },
    { mobCap: 18, shieldSpawnRate: 0.9, dpsSpawnRate: 2.7, puddles: 8, barriers: 4, dominantMob: "mixed", power: "random" },
  ],
};
