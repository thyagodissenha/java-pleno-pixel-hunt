import { describe, expect, it } from "vitest";
import { MAX_OBSTACLES, circleIntersectsRect, obstacleCount, pointInRect, rectsOverlap } from "@/lib/obstacles";

describe("obstacleCount", () => {
  it("grows linearly with resets below the cap", () => {
    expect(obstacleCount(0)).toBe(1);
    expect(obstacleCount(1)).toBe(2);
    expect(obstacleCount(2)).toBe(3);
    expect(obstacleCount(3)).toBe(4);
  });

  it("is capped at MAX_OBSTACLES once resets reach the threshold", () => {
    expect(obstacleCount(4)).toBe(MAX_OBSTACLES);
    expect(obstacleCount(5)).toBe(MAX_OBSTACLES);
    expect(obstacleCount(100)).toBe(MAX_OBSTACLES);
  });

  it("never exceeds MAX_OBSTACLES for any resets value at or above the cap", () => {
    for (const resets of [4, 5, 10, 1000]) {
      expect(obstacleCount(resets)).toBeLessThanOrEqual(MAX_OBSTACLES);
    }
  });

  it("preserves current behavior for negative resets (no clamp applied, known limitation)", () => {
    // Documented as-is per spec Edge Cases: not a bug fix target for this phase.
    expect(obstacleCount(-1)).toBe(0);
    expect(obstacleCount(-5)).toBe(-4);
  });
});

describe("circleIntersectsRect", () => {
  const rect = { x: 100, y: 100, width: 50, height: 50 };

  it("returns true when the circle overlaps the rectangle", () => {
    expect(circleIntersectsRect({ x: 125, y: 125, radius: 10 }, rect)).toBe(true);
  });

  it("returns true when the circle overlaps a corner of the rectangle", () => {
    // Corner at (100,100); place circle center diagonally outside but within radius reach.
    expect(circleIntersectsRect({ x: 95, y: 95, radius: 10 }, rect)).toBe(true);
  });

  it("returns false when the circle is exactly tangent to the rectangle edge", () => {
    // Distance from circle center to closest point equals radius exactly -> strict `<` means false.
    expect(circleIntersectsRect({ x: 100 - 10, y: 125, radius: 10 }, rect)).toBe(false);
  });

  it("returns true when the circle is just inside the tangent boundary", () => {
    expect(circleIntersectsRect({ x: 100 - 9.999, y: 125, radius: 10 }, rect)).toBe(true);
  });

  it("returns false when there is no overlap", () => {
    expect(circleIntersectsRect({ x: 0, y: 0, radius: 5 }, rect)).toBe(false);
  });
});

describe("rectsOverlap", () => {
  const rect = { x: 100, y: 100, width: 50, height: 50 };

  it("returns true when two rectangles clearly overlap", () => {
    expect(rectsOverlap(rect, { x: 125, y: 125, width: 50, height: 50 })).toBe(true);
  });

  it("returns false when two rectangles are clearly separated", () => {
    expect(rectsOverlap(rect, { x: 300, y: 300, width: 50, height: 50 })).toBe(false);
  });

  it("returns false when two rectangles only touch at the border (strict inequality, no overlap)", () => {
    // rect's right edge (150) meets the other rect's left edge (150) exactly.
    expect(rectsOverlap(rect, { x: 150, y: 100, width: 50, height: 50 })).toBe(false);
  });

  it("returns true when rectangles overlap by a fraction of a pixel past the border", () => {
    expect(rectsOverlap(rect, { x: 149.999, y: 100, width: 50, height: 50 })).toBe(true);
  });
});

describe("pointInRect", () => {
  const rect = { x: 100, y: 100, width: 50, height: 50 };

  it("returns true for a point inside the rectangle", () => {
    expect(pointInRect({ x: 125, y: 125 }, rect)).toBe(true);
  });

  it("returns true for a point exactly on the rectangle border", () => {
    expect(pointInRect({ x: 100, y: 100 }, rect)).toBe(true);
    expect(pointInRect({ x: 150, y: 150 }, rect)).toBe(true);
  });

  it("returns false for a point outside the rectangle", () => {
    expect(pointInRect({ x: 99, y: 125 }, rect)).toBe(false);
    expect(pointInRect({ x: 125, y: 151 }, rect)).toBe(false);
  });
});
