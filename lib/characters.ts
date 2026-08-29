export type Vector2 = { x: number; y: number };

export type CharacterSpecialPower = {
  id: string;
  name: string;
  description: string;
  cooldownSeconds: number;
  dashDistance: number;
};

export type CharacterDefinition = {
  id: string;
  name: string;
  maxHp: number;
  speed: number;
  size: number;
  specialPower: CharacterSpecialPower | null;
};

export const CHARACTERS: readonly CharacterDefinition[] = [
  {
    id: "dev-pleno",
    name: "Dev Pleno",
    maxHp: 100,
    speed: 210,
    size: 24,
    specialPower: {
      id: "refactor-dash",
      name: "Refactor Dash",
      description: "Teleporte curto na direção do movimento.",
      cooldownSeconds: 6,
      dashDistance: 140,
    },
  },
];

export const DEFAULT_CHARACTER_ID = CHARACTERS[0].id;

export function resolveCharacter(
  id: string | undefined,
  registry: readonly CharacterDefinition[] = CHARACTERS,
): CharacterDefinition {
  return registry.find((character) => character.id === id) ?? registry[0];
}

function distance(a: Vector2, b: Vector2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalize(x: number, y: number): Vector2 {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

export function resolveDashDirection(
  moveDirection: Vector2,
  player: Vector2,
  enemies: readonly Vector2[],
): Vector2 {
  if (moveDirection.x !== 0 || moveDirection.y !== 0) {
    return normalize(moveDirection.x, moveDirection.y);
  }

  let nearest: Vector2 | undefined;
  let nearestDistance = Infinity;
  for (const enemy of enemies) {
    const d = distance(enemy, player);
    if (d < nearestDistance) {
      nearestDistance = d;
      nearest = enemy;
    }
  }

  if (nearest && Number.isFinite(nearestDistance) && nearestDistance > 0) {
    return normalize(nearest.x - player.x, nearest.y - player.y);
  }

  return { x: 0, y: -1 };
}
