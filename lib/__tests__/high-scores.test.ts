import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanScores,
  decodeRankingDocument,
  publicHighScores,
  readHighScores,
  sanitizeScore,
  type HighScore,
} from "@/lib/high-scores";

const blobGet = vi.hoisted(() => vi.fn());
const blobPut = vi.hoisted(() => vi.fn());

vi.mock("@vercel/blob", () => ({
  get: blobGet,
  put: blobPut,
}));

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

describe("ranking document codec", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    blobGet.mockReset();
    blobPut.mockReset();
  });

  it("keeps legacy arrays compatible with sanitized and sorted public scores", () => {
    const latest = score({ name: "LATEST", score: 200, wave: 3, createdAt: "2026-01-03T00:00:00.000Z" });
    const highestWave = score({ name: "WAVE", score: 200, wave: 4, createdAt: "2026-01-02T00:00:00.000Z" });
    const malformed = { name: "  legacy   name  ", score: "50", wave: "2", outcome: "won", createdAt: "2026-01-04T00:00:00.000Z" };

    const document = decodeRankingDocument([latest, malformed, highestWave], Date.parse("2026-08-28T12:00:00.000Z"));

    expect(document.version).toBe(2);
    expect(document.processedSubmissions).toEqual([]);
    expect(publicHighScores(document)).toEqual([
      highestWave,
      latest,
      {
        name: "LEGACY NAME",
        score: 50,
        wave: 2,
        resets: 0,
        outcome: "won",
        createdAt: "2026-01-04T00:00:00.000Z",
      },
    ]);
  });

  it("preserves v2 submission ids and ledger internally while public scores expose no metadata", () => {
    const stored = { ...score({ name: "OWNER", score: 500 }), submissionId: "submission-owner" };
    const document = decodeRankingDocument({
      version: 2,
      scores: [stored],
      processedSubmissions: [{ submissionId: "submission-owner", persistedAt: "2026-08-28T10:00:00.000Z" }],
    }, Date.parse("2026-08-28T12:00:00.000Z"));

    expect(document.scores[0]).toMatchObject({ submissionId: "submission-owner", name: "OWNER" });
    expect(document.processedSubmissions).toEqual([
      { submissionId: "submission-owner", persistedAt: "2026-08-28T10:00:00.000Z" },
    ]);
    expect(publicHighScores(document)).toEqual([score({ name: "OWNER", score: 500 })]);
    expect(publicHighScores(document)[0]).not.toHaveProperty("submissionId");
    expect(JSON.stringify(publicHighScores(document))).not.toContain("processedSubmissions");
  });

  it("prunes ledger entries older than 24 hours and keeps ids whose scores miss the top ten", () => {
    const scores = Array.from({ length: 11 }, (_, index) => ({
      ...score({
        name: `SCORE ${index}`,
        score: 1_000 - index,
        createdAt: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      }),
      submissionId: `submission-${index}`,
    }));

    const document = decodeRankingDocument({
      version: 2,
      scores,
      processedSubmissions: [
        { submissionId: "submission-10", persistedAt: "2026-08-27T12:00:01.000Z" },
        { submissionId: "expired-submission", persistedAt: "2026-08-27T11:59:59.000Z" },
      ],
    }, Date.parse("2026-08-28T12:00:00.000Z"));

    expect(document.scores).toHaveLength(10);
    expect(document.scores.some((entry) => entry.submissionId === "submission-10")).toBe(false);
    expect(document.processedSubmissions).toEqual([
      { submissionId: "submission-10", persistedAt: "2026-08-27T12:00:01.000Z" },
    ]);
  });

  it("treats null and malformed metadata as an empty v2 document without inventing ids", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-28T12:00:00.000Z"));

    expect(decodeRankingDocument(null).processedSubmissions).toEqual([]);

    const document = decodeRankingDocument({
      version: 2,
      scores: [{ name: "  malformed  ", score: 10, wave: 2, submissionId: "" }],
      processedSubmissions: [
        { submissionId: 123, persistedAt: "2026-08-28T12:00:00.000Z" },
        { submissionId: "bad-date", persistedAt: "not-a-date" },
      ],
    });

    expect(document.scores[0]).not.toHaveProperty("submissionId");
    expect(document.processedSubmissions).toEqual([]);
    expect(publicHighScores(document)).toEqual([
      {
        name: "MALFORMED",
        score: 10,
        wave: 2,
        resets: 0,
        outcome: "over",
        createdAt: "2026-08-28T12:00:00.000Z",
      },
    ]);
  });

  it("reads v2 blob data as public high scores without leaking the ledger", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "blob-token");
    const blobPayload = JSON.stringify({
      version: 2,
      scores: [{ ...score({ name: "BLOB", score: 300 }), submissionId: "blob-submission" }],
      processedSubmissions: [{ submissionId: "blob-submission", persistedAt: "2026-08-28T10:00:00.000Z" }],
    });
    blobGet.mockResolvedValue({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(blobPayload));
          controller.close();
        },
      }),
    });

    const scores = await readHighScores();

    expect(scores).toEqual([score({ name: "BLOB", score: 300 })]);
    expect(scores[0]).not.toHaveProperty("submissionId");
    expect(JSON.stringify(scores)).not.toContain("blob-submission");
  });
});
