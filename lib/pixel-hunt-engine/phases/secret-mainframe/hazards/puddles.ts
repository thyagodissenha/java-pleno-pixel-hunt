// Poças de vazamento de memória — hazard da fase secreta "O Datacenter
// Esquecido" que lenta só o jogador (spec.md SECBOSS-17, 18, 21; design.md
// § Components → hazards/puddles.ts). Substitui `meetingZones`
// (spec.md/design.md assumption A7) — a wiring real dentro de `update()`
// (index.ts) fica para a T15, fora deste batch (T1-T7); este módulo é
// standalone e testado isoladamente, mesmo padrão de `datacenter.ts`.
// Nenhum import de `react`.
//
// NOVO (quick fix pós-feature, feedback do usuário): posições deixam de ser
// slots fixos e passam a ser sorteadas por fase — mesmo padrão de RNG puro
// (`Math.random()`, sem seed) e rejection sampling já usado por
// `hazards/barriers.ts` (que sofreu o mesmo ajuste). Garante que as poças
// nunca se sobrepõem entre si NEM com as barreiras já sorteadas para a
// mesma fase (`avoidObstacles`, passado por `index.ts`'s
// `refreshHazardsForPhase` — barreiras são sorteadas primeiro).

import { circleIntersectsRect } from "@/lib/obstacles";
import { CONFIG } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/config";
import { distance } from "@/lib/pixel-hunt-engine/geometry";
import type { EngineWorld, Obstacle, Puddle } from "@/lib/pixel-hunt-engine/types";

// Arena 960×540 — mesma constante duplicada localmente em cada módulo do
// motor (`index.ts`'s `WORLD`, `hazards/barriers.ts`, `physics.ts` etc.).
const ARENA_WIDTH = 960;
const ARENA_HEIGHT = 540;

// Raio usado só para o ESPAÇAMENTO do sorteio (não o raio real desenhado) —
// já conta o bônus do Memory Surge (`CONFIG.MEMORY_SURGE_RADIUS_BONUS`),
// para que duas poças nunca cheguem a se tocar nem quando o boss ativa o
// Memory Surge (fase 3+, spec.md SECBOSS-21) e ambas expandem ao mesmo tempo.
const SPACING_RADIUS = CONFIG.PUDDLE_BASE_RADIUS + CONFIG.MEMORY_SURGE_RADIUS_BONUS;

const PUDDLE_MARGIN = SPACING_RADIUS + 10;
const MAX_PLACEMENT_ATTEMPTS = 200;

// Fallback determinístico — só usado no caso extremo (não deveria acontecer
// nunca com até 8 poças numa arena de 960×540) de o sorteio esgotar as
// tentativas sem achar um ponto livre. Garante que a fase nunca fica com
// menos poças do que `CONFIG.PHASES[n].puddles` pede.
const FALLBACK_SLOTS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 220, y: 160 },
  { x: 740, y: 160 },
  { x: 220, y: 380 },
  { x: 740, y: 380 },
  { x: 480, y: 90 },
  { x: 480, y: 450 },
  { x: 120, y: 270 },
  { x: 840, y: 270 },
];

function randomPuddleCandidate(): { x: number; y: number } {
  return {
    x: PUDDLE_MARGIN + Math.random() * (ARENA_WIDTH - 2 * PUDDLE_MARGIN),
    y: PUDDLE_MARGIN + Math.random() * (ARENA_HEIGHT - 2 * PUDDLE_MARGIN),
  };
}

function overlapsPlacedPuddles(candidate: { x: number; y: number }, placed: ReadonlyArray<{ x: number; y: number }>): boolean {
  return placed.some((other) => distance(candidate, other) < SPACING_RADIUS * 2);
}

function overlapsObstacles(candidate: { x: number; y: number }, obstacles: ReadonlyArray<Obstacle>): boolean {
  return obstacles.some((obstacle) => circleIntersectsRect({ x: candidate.x, y: candidate.y, radius: SPACING_RADIUS }, obstacle));
}

/**
 * Sorteia os pontos de poça ativos para a fase (2/4/6/8, spec.md SECBOSS-17)
 * — todos com `radius === baseRadius` (sem Memory Surge ativo ainda). Nunca
 * se sobrepõem entre si nem com `avoidObstacles` (as barreiras já sorteadas
 * para a mesma fase — rejection sampling; cai no slot fixo de fallback só
 * se 200 tentativas esgotarem, o que não acontece na prática com este
 * tamanho de arena/contagem).
 */
export function spawnPuddlesForPhase(phaseIndex: 1 | 2 | 3 | 4, avoidObstacles: ReadonlyArray<Obstacle> = []): Puddle[] {
  const count = CONFIG.PHASES[phaseIndex - 1].puddles;
  const placed: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i += 1) {
    let point: { x: number; y: number } | undefined;
    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt += 1) {
      const candidate = randomPuddleCandidate();
      if (!overlapsPlacedPuddles(candidate, placed) && !overlapsObstacles(candidate, avoidObstacles)) {
        point = candidate;
        break;
      }
    }
    placed.push(point ?? FALLBACK_SLOTS[i] ?? FALLBACK_SLOTS[FALLBACK_SLOTS.length - 1]);
  }
  return placed.map((slot) => ({
    x: slot.x,
    y: slot.y,
    baseRadius: CONFIG.PUDDLE_BASE_RADIUS,
    radius: CONFIG.PUDDLE_BASE_RADIUS,
  }));
}

/**
 * Reduz a velocidade do jogador para `CONFIG.PLAYER_SPEED_IN_PUDDLE` quando
 * ele está dentro do raio de qualquer poça, ou a restaura para
 * `CONFIG.PLAYER_SPEED_NORMAL` caso contrário (spec.md SECBOSS-18: mobs
 * ignoram esse efeito — esta função só toca `world.player.speed`, nunca
 * `world.enemies`). Mesmo padrão de "ajuste temporário antes de
 * `stepWorld`" já usado pelas `meetingZones` atuais em `index.ts`.
 */
export function applyPuddleSlow(world: EngineWorld, puddles: Puddle[]): void {
  const inPuddle = puddles.some((puddle) => distance(world.player, puddle) < puddle.radius);
  world.player.speed = inPuddle ? CONFIG.PLAYER_SPEED_IN_PUDDLE : CONFIG.PLAYER_SPEED_NORMAL;
}

/**
 * Expande o raio de todas as poças para `baseRadius + CONFIG.MEMORY_SURGE_RADIUS_BONUS`
 * (spec.md SECBOSS-21). Idempotente por construção — chamar de novo enquanto
 * o efeito já está ativo produz o mesmo raio (nunca soma o bônus de novo);
 * reiniciar o TIMER da janela de 4s é responsabilidade de quem chama
 * (`index.ts`'s `memorySurgeUntil`, T15 — fora deste módulo, que é puro e
 * não conhece tempo).
 *
 * SPEC_DEVIATION: design.md descreve a assinatura como
 * `triggerMemorySurge(puddles, durationSeconds)`. Sem `durationSeconds`
 * aqui porque esta função só recalcula o raio (puro, sem noção de tempo);
 * a duração de 4s é um `CONFIG`/`memorySurgeUntil` gerenciado por quem
 * chama (`index.ts`, T15), não algo que este módulo precisasse receber
 * para produzir o efeito "sem empilhar" — que já é garantido pela
 * idempotência do cálculo abaixo.
 */
export function triggerMemorySurge(puddles: Puddle[]): Puddle[] {
  return puddles.map((puddle) => ({ ...puddle, radius: puddle.baseRadius + CONFIG.MEMORY_SURGE_RADIUS_BONUS }));
}

/** Reverte o raio de todas as poças ao valor base — chamado quando a janela do Memory Surge expira. */
export function clearMemorySurge(puddles: Puddle[]): Puddle[] {
  return puddles.map((puddle) => ({ ...puddle, radius: puddle.baseRadius }));
}
