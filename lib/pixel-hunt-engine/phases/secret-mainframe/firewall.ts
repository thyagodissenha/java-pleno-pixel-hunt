// Máquina de estados pura do ciclo SHIELD → BREAK_FX → DPS da fase secreta
// "O Datacenter Esquecido" (design.md § Components → firewall.ts). Sem
// efeitos colaterais de jogo (sem `burst`/`audio`/`announceEffect`) —
// devolve *o que aconteceu* (um novo `FirewallState`), quem chama
// (`index.ts`, T13) decide os efeitos visuais/sonoros. Nenhum `EngineWorld`
// é lido/mutado aqui — testável em isolamento total (Vitest puro). Nenhum
// import de `react`.
//
// `FirewallState`/`FirewallMode` vivem em `types.ts` (SPEC_DEVIATION
// documentada lá, T1) — reexportados aqui por conveniência de quem só
// importa deste módulo.

import { CONFIG } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/config";
import type { FirewallState } from "@/lib/pixel-hunt-engine/types";

export type { FirewallMode, FirewallState } from "@/lib/pixel-hunt-engine/types";

function barHpForPhase(phaseIndex: 1 | 2 | 3 | 4): number {
  return phaseIndex === 4 ? CONFIG.FINAL_BAR_HP : CONFIG.BAR_HP;
}

/** Estado inicial: fase 1, `SHIELD`, contador 0, barra cheia (spec.md SECBOSS-01). */
export function createFirewallState(): FirewallState {
  const barMaxHp = barHpForPhase(1);
  return {
    mode: "SHIELD",
    phaseIndex: 1,
    counter: 0,
    barHp: barMaxHp,
    barMaxHp,
    breakFxTimer: 0,
    won: false,
  };
}

/**
 * Soma `weight` ao contador de firewall SE `state.mode === "SHIELD"`
 * (spec.md SECBOSS-02..04); no-op (mesmo estado, por valor) fora de
 * `SHIELD` — kills durante `DPS`/`BREAK_FX` não pontuam (spec.md SECBOSS-05,
 * edge case §16.2 — cron respawnado durante `DPS` vale 0). Não muta `state`.
 */
export function registerKill(state: FirewallState, weight: number): FirewallState {
  if (state.mode !== "SHIELD") return state;
  return { ...state, counter: state.counter + weight };
}

/**
 * Transiciona `SHIELD → BREAK_FX` quando `counter >= CONFIG.SHIELD_NEED`
 * (spec.md SECBOSS-06); no-op caso contrário. O contador é sempre reiniciado
 * a 0 na transição — overkill (contador > SHIELD_NEED no mesmo evento) é
 * descartado, nunca herdado pela próxima barreira (spec.md SECBOSS-07).
 */
export function tryBreakShield(state: FirewallState): FirewallState {
  if (state.mode !== "SHIELD" || state.counter < CONFIG.SHIELD_NEED) return state;
  return { ...state, mode: "BREAK_FX", counter: 0, breakFxTimer: CONFIG.STUN_BREAK };
}

/**
 * Decrementa o timer do `BREAK_FX` em `elapsed` segundos; ao chegar a 0 (ou
 * menos), transiciona para `DPS` (spec.md SECBOSS-08). No-op fora de
 * `BREAK_FX`.
 */
export function advanceBreakFx(state: FirewallState, elapsed: number): FirewallState {
  if (state.mode !== "BREAK_FX") return state;
  const remaining = state.breakFxTimer - elapsed;
  if (remaining > 0) return { ...state, breakFxTimer: remaining };
  return { ...state, mode: "DPS", breakFxTimer: 0 };
}

/**
 * Aplica `damage` à barra ativa — só tem efeito em `DPS` (spec.md SECBOSS-01
 * implícito: o core só está exposto a dano durante `DPS`); no-op fora dele.
 * Quando a barra chega a 0:
 * - fase < 4: avança para a fase seguinte, reergue o firewall (`SHIELD`,
 *   contador 0, barra cheia do tamanho da nova fase) — spec.md SECBOSS-09.
 * - fase === 4: marca `won: true`, sem reerguer nada — spec.md SECBOSS-10.
 */
export function applyBarDamage(state: FirewallState, damage: number): FirewallState {
  if (state.mode !== "DPS") return state;
  const barHp = state.barHp - damage;
  if (barHp > 0) return { ...state, barHp };

  if (state.phaseIndex >= 4) {
    return { ...state, barHp: 0, won: true };
  }

  const nextPhase = (state.phaseIndex + 1) as 1 | 2 | 3 | 4;
  const nextBarMax = barHpForPhase(nextPhase);
  return {
    mode: "SHIELD",
    phaseIndex: nextPhase,
    counter: 0,
    barHp: nextBarMax,
    barMaxHp: nextBarMax,
    breakFxTimer: 0,
    won: false,
  };
}
