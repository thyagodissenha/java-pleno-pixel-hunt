// Helpers geométricos puros e compartilhados entre `physics.ts`, `renderer.ts`
// e os módulos de `phases/` (normal-run, secret-mainframe). Extraído para
// deduplicar 4 definições idênticas que existiam localmente em cada um
// desses arquivos (ver design.md § Tech Decisions, ENGINE-20). Nenhum import
// de `react`.

import type { EngineWorld } from "@/lib/pixel-hunt-engine/types";

/** Restringe `value` ao intervalo [min, max]. */
export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/** Distância euclidiana entre dois pontos. */
export function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Normaliza o vetor `(x, y)`; retorna `{ x: 0, y: 0 }` normalizado como `{x, y}` com length 1 quando o vetor é zero (fallback `|| 1`). */
export function normalize(x: number, y: number) {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

/** Gera `amount` partículas espalhadas a partir de `(x, y)` em `world.particles`. */
export function burst(world: EngineWorld, x: number, y: number, color: string, amount = 12) {
  for (let i = 0; i < amount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 170;
    world.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      ttl: 24 + Math.random() * 24,
      color,
    });
  }
}
