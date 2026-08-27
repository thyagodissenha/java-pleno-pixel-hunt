import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanScores, sanitizeScore, type HighScore } from "@/lib/high-scores";

const score = (overrides: Partial<HighScore>): HighScore => ({
  name: "DEV",
  score: 100,
  wave: 1,
  resets: 0,
  outcome: "over",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("sanitizeScore", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("normalizes whitespace, truncates names, and converts them to uppercase", () => {
    const result = sanitizeScore({ name: "  java   pleno developer  " });

    expect(result.name).toBe("JAVA PLENO DEV");
  });

  it("returns the specified fallback score for an invalid payload", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T12:00:00.000Z"));

    expect(sanitizeScore(null)).toEqual({
      name: "DEV ANON",
      score: 0,
      wave: 1,
      resets: 0,
      outcome: "over",
      createdAt: "2026-08-27T12:00:00.000Z",
    });
  });

  it("clamps score, wave, and resets to their upper limits", () => {
    const result = sanitizeScore({ score: 1_000_000, wave: 100, resets: 100 });

    expect(result.score).toBe(999_999);
    expect(result.wave).toBe(99);
    expect(result.resets).toBe(99);
  });

  it("clamps score, wave, and resets to their lower limits", () => {
    const result = sanitizeScore({ score: -1, wave: -1, resets: -1 });

    expect(result.score).toBe(0);
    expect(result.wave).toBe(1);
    expect(result.resets).toBe(0);
  });
});

describe("cleanScores", () => {
  it("sorts by descending score and wave, then ascending creation date", () => {
    const latest = score({ name: "LATEST", score: 200, wave: 3, createdAt: "2026-01-03T00:00:00.000Z" });
    const highestWave = score({ name: "WAVE", score: 200, wave: 4, createdAt: "2026-01-02T00:00:00.000Z" });
    const earliest = score({ name: "EARLIEST", score: 200, wave: 3, createdAt: "2026-01-01T00:00:00.000Z" });
    const lowestScore = score({ name: "LOWEST", score: 100, wave: 99 });

    expect(cleanScores([latest, lowestScore, earliest, highestWave])).toEqual([
      highestWave,
      earliest,
      latest,
      lowestScore,
    ]);
  });
});
