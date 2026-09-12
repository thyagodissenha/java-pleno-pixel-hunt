// Spawn de inimigos, power-ups e obstáculos do fluxo normal. Porta
// `spawnEnemy`, `spawnPowerUp`, `spawnObstacles`, `obstacleTemplates`,
// `obstacleBlocksCircle` (`app/page.tsx:802-861`, `978-1057`), operando
// sobre `EngineWorld`. Nenhum import de `react`.

import { circleIntersectsRect, obstacleCount } from "@/lib/obstacles";
import type { AudioEngine } from "@/lib/pixel-hunt-engine/audio";
import { finalBossHp, scaledEnemyHp } from "@/lib/pixel-hunt-engine/physics";
import { bossNames } from "@/lib/pixel-hunt-engine/phases/normal-run/wave-progression";
import type { Actor, EngineWorld, EnemyKind, Obstacle, PowerUpKind } from "@/lib/pixel-hunt-engine/types";

const WORLD = { width: 960, height: 540 };
const OBSTACLE_MARGIN = 48;
// Mesma contagem de biomas que `bossNames`/`renderer.ts` (`BIOME_COUNT`) —
// só usada aqui para escolher o tema visual dos obstáculos por onda.
const BIOME_COUNT = 5;

const cloudLabels = ["Azure", "SQL", "Blob", "CI/CD", "Kafka", "BI"];

// Subconjunto de `EnemyKind` que este módulo sabe spawnar — os inimigos da
// fase secreta ("O Mainframe": `secretBoss`/`daemon`/`cron`) ficam com
// `phases/secret-mainframe/` (fora do escopo de `normal-run`).
export type NormalEnemyKind = Exclude<EnemyKind, "secretBoss" | "daemon" | "cron" | "cobolSnake">;

const enemyLabels: Record<Exclude<NormalEnemyKind, "boss" | "data">, string> = {
  user: "Usuário",
  qa: "QA nervoso",
  vip: "Usuário VIP",
  incident: "Incidente P1",
  legacy: "Legado",
};

// Duplicado intencional (mesma fórmula que `physics.ts`/`wave-progression.ts`
// mantêm em privado) — evita que `spawn.ts` (T7) dependa de `boss.ts` (T8),
// já que é `boss.ts` quem depende de `spawn.ts` (chama `spawnEnemy("boss")`
// ao cruzar o limiar de `bossKillTarget`), não o contrário.
function isFinalBossIndex(bossIndex: number) {
  return bossIndex === bossNames.length - 1;
}

/** Porta `obstacleBlocksCircle()` (`app/page.tsx:830-832`). */
export function obstacleBlocksCircle(world: EngineWorld, x: number, y: number, radius: number) {
  return world.obstacles.some((obstacle) => circleIntersectsRect({ x, y, radius }, obstacle));
}

/** Porta `obstacleTemplates()` (`app/page.tsx:802-828`). */
export function obstacleTemplates(world: EngineWorld): Array<Omit<Obstacle, "x" | "y">> {
  const theme = Math.min(world.run.bossIndex, BIOME_COUNT - 1);
  const templates: Array<Array<Omit<Obstacle, "x" | "y">>> = [
    [
      { kind: "desk", label: "Mesa", width: 92, height: 34 },
      { kind: "board", label: "Kanban", width: 74, height: 44 },
      { kind: "server", label: "Impressora", width: 48, height: 62 },
    ],
    [
      { kind: "server", label: "Rack", width: 58, height: 76 },
      { kind: "firewall", label: "Firewall", width: 82, height: 42 },
      { kind: "desk", label: "Cabo", width: 118, height: 24 },
    ],
    [
      { kind: "firewall", label: "Bucket", width: 76, height: 48 },
      { kind: "server", label: "Pipeline", width: 104, height: 30 },
      { kind: "board", label: "Cloud", width: 64, height: 58 },
    ],
    [
      { kind: "board", label: "Post-its", width: 86, height: 50 },
      { kind: "desk", label: "Mesa call", width: 118, height: 36 },
      { kind: "server", label: "Telão", width: 92, height: 56 },
    ],
    [
      { kind: "board", label: "Pauta", width: 80, height: 46 },
      { kind: "chair", label: "Cadeira de couro", width: 40, height: 44 },
      { kind: "rack", label: "Servidor de backup", width: 58, height: 70 },
    ],
  ];

  return templates[theme] ?? templates[0];
}

/** Porta `spawnObstacles()` (`app/page.tsx:834-861`). */
export function spawnObstacles(world: EngineWorld) {
  world.obstacles.length = 0;
  const templates = obstacleTemplates(world);
  const amount = obstacleCount(world.run.callLoops);
  let attempts = 0;

  while (world.obstacles.length < amount && attempts < 140) {
    attempts += 1;
    const template = templates[Math.floor(Math.random() * templates.length)];
    const x = OBSTACLE_MARGIN + Math.random() * (WORLD.width - template.width - OBSTACLE_MARGIN * 2);
    const y = OBSTACLE_MARGIN + Math.random() * (WORLD.height - template.height - OBSTACLE_MARGIN * 2);
    const obstacle = { ...template, x, y };
    const center = { x: x + template.width / 2, y: y + template.height / 2 };
    const overlapsPlayer = circleIntersectsRect({ x: world.player.x, y: world.player.y, radius: 86 }, obstacle);
    const overlapsStart = circleIntersectsRect({ x: WORLD.width / 2, y: WORLD.height / 2, radius: 96 }, obstacle);
    const overlapsExisting = world.obstacles.some((existing) => (
      x < existing.x + existing.width + 26 &&
      x + template.width + 26 > existing.x &&
      y < existing.y + existing.height + 26 &&
      y + template.height + 26 > existing.y
    ));
    const tooCloseToEdges = center.x < 120 || center.x > WORLD.width - 120 || center.y < 100 || center.y > WORLD.height - 86;

    if (!overlapsPlayer && !overlapsStart && !overlapsExisting && !tooCloseToEdges) {
      world.obstacles.push(obstacle);
    }
  }
}

/** Porta `spawnEnemy()` (`app/page.tsx:978-1040`) para os `EnemyKind` do fluxo normal (não-secretos). */
export function spawnEnemy(world: EngineWorld, kind: NormalEnemyKind, audio: AudioEngine): Actor {
  const edge = Math.floor(Math.random() * 4);
  const margin = 36;
  const x = edge === 0 ? -margin : edge === 1 ? WORLD.width + margin : Math.random() * WORLD.width;
  const y = edge === 2 ? -margin : edge === 3 ? WORLD.height + margin : Math.random() * WORLD.height;
  const isBoss = kind === "boss";
  const isData = kind === "data";
  const finalBoss = isBoss && isFinalBossIndex(world.run.bossIndex);
  const wavePressure = Math.min(world.run.wave - 1, 5);
  const stats: Record<NormalEnemyKind, { hp: number; speed: number; size: number }> = {
    user: { hp: 28 + wavePressure * 2, speed: 68 + wavePressure * 5, size: 24 },
    qa: { hp: 22 + wavePressure * 2, speed: 96 + wavePressure * 7, size: 22 },
    vip: { hp: 58 + wavePressure * 5, speed: 54 + wavePressure * 3, size: 30 },
    incident: { hp: 20 + wavePressure * 3, speed: 122 + wavePressure * 8, size: 20 },
    legacy: { hp: 88 + wavePressure * 8, speed: 36 + wavePressure * 2, size: 34 },
    data: { hp: 16 + wavePressure, speed: 86 + wavePressure * 5, size: 22 },
    boss: finalBoss
      ? { hp: finalBossHp(1, world.run.wave), speed: 44 + wavePressure, size: 62 }
      : { hp: 160 + world.run.wave * 28, speed: 52 + wavePressure * 2, size: 38 },
  };
  const selected = stats[kind];
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
    label: isBoss
      ? finalBoss ? "Diretoria" : bossNames[world.run.bossIndex]
      : isData
        ? cloudLabels[Math.floor(Math.random() * cloudLabels.length)]
        : enemyLabels[kind],
    cooldown: isBoss ? 118 : 90,
    phase: Math.random() * Math.PI * 2,
    bossPhase: finalBoss ? 1 : undefined,
  };
  world.enemies.push(actor);
  if (isBoss) {
    world.run.bossBanner = 120;
    audio.playSound("boss");
  }
  return actor;
}

/** Porta `spawnPowerUp()` (`app/page.tsx:1042-1057`). */
export function spawnPowerUp(world: EngineWorld) {
  const kinds: PowerUpKind[] = ["coffee", "refactor", "rollback", "hotfix", "review", "stamina"];
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const powerUp = {
      x: 70 + Math.random() * (WORLD.width - 140),
      y: 70 + Math.random() * (WORLD.height - 140),
      kind: kinds[Math.floor(Math.random() * kinds.length)],
      ttl: 780,
      pulse: Math.random() * Math.PI * 2,
    };
    if (!obstacleBlocksCircle(world, powerUp.x, powerUp.y, 26)) {
      world.powerUps.push(powerUp);
      return;
    }
  }
}
