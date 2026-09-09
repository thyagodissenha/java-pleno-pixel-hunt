// Cenário fixo do "datacenter esquecido" da fase secreta ("O Mainframe").
// Porta `spawnDatacenterObstacles` (`app/page.tsx:866-885`) e a geração de
// `datacenterMoss`/`datacenterCracks` hoje dentro de `startSecretRun`
// (`app/page.tsx:1182-1197`). Nenhum import de `react`.

import type { EngineWorld, Obstacle } from "@/lib/pixel-hunt-engine/types";

const WORLD = { width: 960, height: 540 };

export type DatacenterMoss = { x: number; y: number; r: number };
export type DatacenterCrack = Array<{ x: number; y: number }>;

/**
 * Layout fixo do "datacenter esquecido" — mesmas posições da maquete
 * original (racks, CRTs, cadeiras, samambaias e cogumelos), em vez do
 * posicionamento aleatório das ondas normais. Porta `spawnDatacenterObstacles()`
 * (`app/page.tsx:866-885`): 14 obstáculos fixos, mesmos `kind`/`x`/`y`/
 * `width`/`height`.
 */
export function spawnDatacenterObstacles(world: EngineWorld) {
  world.obstacles.length = 0;
  const props: Obstacle[] = [
    { kind: "rack", x: 36, y: 118, width: 32, height: 48, label: "Rack" },
    { kind: "rack", x: 120, y: 68, width: 32, height: 48, label: "Rack" },
    { kind: "rack", x: 812, y: 62, width: 32, height: 48, label: "Rack" },
    { kind: "rack", x: 872, y: 206, width: 32, height: 48, label: "Rack" },
    { kind: "crt", x: 676, y: 68, width: 36, height: 30, label: "CRT" },
    { kind: "crt", x: 56, y: 394, width: 36, height: 30, label: "CRT" },
    { kind: "chair", x: 628, y: 418, width: 24, height: 30, label: "Cadeira" },
    { kind: "chair", x: 752, y: 402, width: 24, height: 30, label: "Cadeira" },
    { kind: "fern", x: 16, y: 484, width: 36, height: 24, label: "Samambaia" },
    { kind: "fern", x: 300, y: 50, width: 36, height: 24, label: "Samambaia" },
    { kind: "fern", x: 600, y: 50, width: 36, height: 24, label: "Samambaia" },
    { kind: "fern", x: 906, y: 484, width: 36, height: 24, label: "Samambaia" },
    { kind: "shroom", x: 300, y: 138, width: 16, height: 14, label: "Cogumelo" },
    { kind: "shroom", x: 866, y: 174, width: 16, height: 14, label: "Cogumelo" },
  ];
  for (const prop of props) world.obstacles.push(prop);
}

/**
 * Gera 12 manchas de musgo em posições aleatórias — porta o trecho de
 * `startSecretRun()` (`app/page.tsx:1182-1185`).
 */
export function spawnDatacenterMoss(): DatacenterMoss[] {
  const moss: DatacenterMoss[] = [];
  for (let i = 0; i < 12; i += 1) {
    moss.push({ x: Math.random() * WORLD.width, y: Math.random() * WORLD.height, r: 14 + Math.random() * 26 });
  }
  return moss;
}

/**
 * Gera 9 rachaduras (cada uma uma polilinha de 6 pontos) — porta o trecho de
 * `startSecretRun()` (`app/page.tsx:1186-1197`).
 */
export function spawnDatacenterCracks(): DatacenterCrack[] {
  const cracks: DatacenterCrack[] = [];
  for (let i = 0; i < 9; i += 1) {
    let cx = Math.random() * WORLD.width;
    let cy = 60 + Math.random() * (WORLD.height - 80);
    const crack: DatacenterCrack = [{ x: cx, y: cy }];
    for (let s = 0; s < 5; s += 1) {
      cx += (Math.random() - 0.5) * 90;
      cy += (Math.random() - 0.3) * 50;
      crack.push({ x: cx, y: cy });
    }
    cracks.push(crack);
  }
  return cracks;
}
