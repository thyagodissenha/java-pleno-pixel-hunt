export const MAX_OBSTACLES = 5;

export function obstacleCount(resets: number) {
  return Math.min(MAX_OBSTACLES, 1 + resets);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function circleIntersectsRect(
  circle: { x: number; y: number; radius: number },
  rect: { x: number; y: number; width: number; height: number },
) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.height);
  return Math.hypot(circle.x - closestX, circle.y - closestY) < circle.radius;
}

export function pointInRect(point: { x: number; y: number }, rect: { x: number; y: number; width: number; height: number }) {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}
