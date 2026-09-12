// Barreiras-firewall — hazard da fase secreta "O Datacenter Esquecido" que
// bloqueia o jogador e seus tiros, mas deixa mobs/eshots/drops atravessarem
// livremente (spec.md SECBOSS-17, 19, 20; design.md § Components →
// hazards/barriers.ts). Reaproveita `Obstacle`/`ObstacleKind: "firewall"`
// já existente — a colisão "bloqueia jogador+tiro, mobs atravessam" já
// existe de graça em `physics.ts` (`obstacleBlocksCircle`/`pointInRect`, só
// chamadas para o jogador; inimigos se movem sem checar `obstacles`),
// verificado lendo `physics.ts` diretamente (design.md assumption A6).
// Nenhum import de `react`.
//
// NOVO (quick fix pós-feature, feedback do usuário): posições deixam de ser
// slots fixos e passam a ser sorteadas por fase — `Math.random()` puro,
// mesmo padrão já usado no resto da fase secreta (ex.: `pickPhaseMobKind`,
// o sorteio de 0-2 poderes da fase 4) e no motor em geral (não há RNG
// seedado em `lib/pixel-hunt-engine/`). Rejection sampling (mesmo padrão de
// `normal-run/spawn.ts`'s `spawnObstacles`) garante que as barreiras nunca
// se sobrepõem entre si.

import { rectsOverlap } from "@/lib/obstacles";
import { CONFIG } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/config";
import { drawFirewallBarrier } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/rendering";
import type { EngineWorld, Obstacle } from "@/lib/pixel-hunt-engine/types";

// Arena 960×540 — mesma constante duplicada localmente em cada módulo do
// motor (`index.ts`'s `WORLD`, `datacenter.ts`, `physics.ts` etc.).
const ARENA_WIDTH = 960;

// Faixa horizontal (em `y`) que nenhuma barreira jamais ocupa, qualquer que
// seja a fase — o sorteio abaixo fica sempre confinado ACIMA desta linha
// (`BARRIER_ZONE_Y_MAX`), então a garantia de rota de fuga (spec.md
// SECBOSS-20, edge case §16.6) vale por construção, não por checagem
// pós-hoc: a faixa perto da borda de baixo (onde o jogador nasce,
// `index.ts`'s `enter()`) nunca é candidata a receber uma barreira.
const ESCAPE_CORRIDOR_Y_MIN = 420;

const BARRIER_MARGIN_X = 60;
const BARRIER_ZONE_Y_MIN = 60;
const BARRIER_ZONE_Y_MAX = ESCAPE_CORRIDOR_Y_MIN - CONFIG.BARRIER_HEIGHT / 2 - 10;

// Espaçamento mínimo extra entre barreiras, além de simplesmente não se
// tocarem — evita que duas barreiras fiquem coladas, visualmente confuso.
const BARRIER_PADDING = 12;

const MAX_PLACEMENT_ATTEMPTS = 200;

// Fallback determinístico — só usado no caso extremo (não deveria acontecer
// nunca com até 4 barreiras numa arena de 960×540) de o sorteio esgotar as
// tentativas sem achar um slot livre. Garante que a fase nunca fica com
// menos barreiras do que `CONFIG.PHASES[n].barriers` pede.
const FALLBACK_SLOTS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 260, y: 180 },
  { x: 700, y: 180 },
  { x: 260, y: 340 },
  { x: 700, y: 340 },
];

function makeBarrierAt(centerX: number, centerY: number): Obstacle {
  return {
    kind: "firewall",
    x: centerX - CONFIG.BARRIER_WIDTH / 2,
    y: centerY - CONFIG.BARRIER_HEIGHT / 2,
    width: CONFIG.BARRIER_WIDTH,
    height: CONFIG.BARRIER_HEIGHT,
    label: "Firewall",
    render: drawFirewallBarrier,
  };
}

function randomBarrierCandidate(): Obstacle {
  const centerX = BARRIER_MARGIN_X + Math.random() * (ARENA_WIDTH - 2 * BARRIER_MARGIN_X);
  const centerY = BARRIER_ZONE_Y_MIN + Math.random() * (BARRIER_ZONE_Y_MAX - BARRIER_ZONE_Y_MIN);
  return makeBarrierAt(centerX, centerY);
}

function overlapsAnyWithPadding(candidate: Obstacle, placed: readonly Obstacle[]): boolean {
  const padded = {
    x: candidate.x - BARRIER_PADDING,
    y: candidate.y - BARRIER_PADDING,
    width: candidate.width + BARRIER_PADDING * 2,
    height: candidate.height + BARRIER_PADDING * 2,
  };
  return placed.some((other) => rectsOverlap(padded, other));
}

/**
 * Sorteia e empurra `Obstacle`s (`kind: "firewall"`, `CONFIG.BARRIER_WIDTH` ×
 * `CONFIG.BARRIER_HEIGHT`) para `world.obstacles`, na quantidade da fase
 * (1/2/3/4, spec.md SECBOSS-17) — nunca se sobrepondo entre si (rejection
 * sampling; cai no slot fixo de fallback só se 200 tentativas esgotarem, o
 * que não acontece na prática com este tamanho de arena/contagem). Não
 * limpa `world.obstacles` antes (mesmo padrão aditivo de
 * `spawnDatacenterObstacles`, que já preenche a arena — barreiras somam-se
 * aos props existentes).
 */
export function spawnBarriersForPhase(world: EngineWorld, phaseIndex: 1 | 2 | 3 | 4): void {
  const count = CONFIG.PHASES[phaseIndex - 1].barriers;
  const placed: Obstacle[] = [];
  for (let i = 0; i < count; i += 1) {
    let candidate: Obstacle | undefined;
    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt += 1) {
      const next = randomBarrierCandidate();
      if (!overlapsAnyWithPadding(next, placed)) {
        candidate = next;
        break;
      }
    }
    if (!candidate) {
      const slot = FALLBACK_SLOTS[i] ?? FALLBACK_SLOTS[FALLBACK_SLOTS.length - 1];
      candidate = makeBarrierAt(slot.x, slot.y);
    }
    placed.push(candidate);
  }
  world.obstacles.push(...placed);
}

export { ESCAPE_CORRIDOR_Y_MIN };
