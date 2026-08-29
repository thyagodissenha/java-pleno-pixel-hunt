import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HIGH_SCORE_KEY,
  type HighScore,
  PENDING_SCORE_KEY,
  type PendingScoreEntry,
  enqueuePendingScore,
  isHighScore,
  isPendingScoreEntry,
  isPersistedScoreResponse,
  loadHighScores,
  loadPendingScores,
  mergeHighScores,
  postPendingScore,
  removePendingScore,
  saveHighScores,
  savePendingScores,
  scoreIdentity,
  updatePendingScoreAttempt,
  waitForNextScorePost,
} from "@/lib/score-sync";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

const score = (overrides: Partial<HighScore> = {}): HighScore => ({
  name: "DEV",
  score: 100,
  wave: 1,
  resets: 0,
  outcome: "over",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const pendingEntry = (overrides: Partial<PendingScoreEntry> = {}): PendingScoreEntry => ({
  version: 1,
  submissionId: "11111111-1111-4111-8111-111111111111",
  score: score(),
  enqueuedAt: "2026-01-01T00:00:01.000Z",
  attempts: 0,
  lastAttemptAt: null,
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
  const interceptedFetch = globalThis.fetch;
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? new URL(input, "http://localhost") : input;
    return interceptedFetch(url, init);
  });
});

afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("loadHighScores / saveHighScores", () => {
  it("returns an empty array when nothing is stored", () => {
    expect(loadHighScores()).toEqual([]);
  });

  it("returns an empty array for malformed JSON", () => {
    localStorage.setItem(HIGH_SCORE_KEY, "not json");
    expect(loadHighScores()).toEqual([]);
  });

  it("returns an empty array when the stored value is not an array", () => {
    localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify({ not: "an array" }));
    expect(loadHighScores()).toEqual([]);
  });

  it("saves and reloads scores, capped at 10 entries", () => {
    const scores = Array.from({ length: 12 }, (_, index) => score({ name: `P${index}`, score: index }));
    saveHighScores(scores);
    const stored = JSON.parse(localStorage.getItem(HIGH_SCORE_KEY) ?? "[]");
    expect(stored).toHaveLength(10);
    expect(loadHighScores()).toHaveLength(10);
  });
});

describe("isHighScore", () => {
  it("accepts a well-formed high score", () => {
    expect(isHighScore(score())).toBe(true);
  });

  it("accepts a high score without resets (optional field)", () => {
    const full = score();
    const rest: Partial<HighScore> = { ...full };
    delete rest.resets;
    expect(isHighScore(rest)).toBe(true);
  });

  it("rejects non-object values", () => {
    expect(isHighScore(null)).toBe(false);
    expect(isHighScore("high score")).toBe(false);
  });

  it("rejects a value missing required fields", () => {
    expect(isHighScore({ name: "DEV" })).toBe(false);
  });

  it("rejects an invalid outcome", () => {
    expect(isHighScore(score({ outcome: "draw" as HighScore["outcome"] }))).toBe(false);
  });
});

describe("isPendingScoreEntry", () => {
  it("accepts a well-formed pending entry", () => {
    expect(isPendingScoreEntry(pendingEntry())).toBe(true);
  });

  it("rejects a wrong version", () => {
    expect(isPendingScoreEntry({ ...pendingEntry(), version: 2 })).toBe(false);
  });

  it("rejects an empty submissionId", () => {
    expect(isPendingScoreEntry({ ...pendingEntry(), submissionId: "" })).toBe(false);
  });

  it("rejects an entry whose score is invalid", () => {
    expect(isPendingScoreEntry({ ...pendingEntry(), score: { name: "DEV" } })).toBe(false);
  });

  it("rejects negative or non-integer attempts", () => {
    expect(isPendingScoreEntry({ ...pendingEntry(), attempts: -1 })).toBe(false);
    expect(isPendingScoreEntry({ ...pendingEntry(), attempts: 1.5 })).toBe(false);
  });
});

describe("loadPendingScores / savePendingScores", () => {
  it("returns an empty array when nothing is stored", () => {
    expect(loadPendingScores()).toEqual([]);
  });

  it("returns an empty array for malformed JSON", () => {
    localStorage.setItem(PENDING_SCORE_KEY, "not json");
    expect(loadPendingScores()).toEqual([]);
  });

  it("saves and reloads pending entries", () => {
    savePendingScores([pendingEntry()]);
    expect(loadPendingScores()).toEqual([pendingEntry()]);
  });

  it("deduplicates by submissionId and drops malformed entries", () => {
    localStorage.setItem(PENDING_SCORE_KEY, JSON.stringify([
      pendingEntry(),
      { ...pendingEntry() },
      score(),
      { ...pendingEntry(), submissionId: "" },
    ]));
    expect(loadPendingScores()).toEqual([pendingEntry()]);
  });
});

describe("enqueuePendingScore / removePendingScore / updatePendingScoreAttempt", () => {
  it("enqueues a new entry", () => {
    enqueuePendingScore(pendingEntry());
    expect(loadPendingScores()).toEqual([pendingEntry()]);
  });

  it("does not duplicate an entry with the same submissionId", () => {
    enqueuePendingScore(pendingEntry());
    enqueuePendingScore(pendingEntry());
    expect(loadPendingScores()).toHaveLength(1);
  });

  it("removes an entry by submissionId", () => {
    const second = pendingEntry({ submissionId: "22222222-2222-4222-8222-222222222222" });
    savePendingScores([pendingEntry(), second]);
    removePendingScore(pendingEntry().submissionId);
    expect(loadPendingScores()).toEqual([second]);
  });

  it("bumps attempts and lastAttemptAt for the matching entry only", () => {
    const second = pendingEntry({ submissionId: "22222222-2222-4222-8222-222222222222" });
    savePendingScores([pendingEntry(), second]);
    updatePendingScoreAttempt(pendingEntry().submissionId, "2026-01-01T00:05:00.000Z");
    expect(loadPendingScores()).toEqual([
      { ...pendingEntry(), attempts: 1, lastAttemptAt: "2026-01-01T00:05:00.000Z" },
      second,
    ]);
  });
});

describe("isPersistedScoreResponse", () => {
  it("returns true for blob storage", () => {
    expect(isPersistedScoreResponse({ storage: "blob" })).toBe(true);
  });

  it("returns true for an idempotent response", () => {
    expect(isPersistedScoreResponse({ storage: "local", idempotent: true })).toBe(true);
  });

  it("returns false for a non-persisted local response", () => {
    expect(isPersistedScoreResponse({ storage: "local" })).toBe(false);
  });
});

describe("waitForNextScorePost", () => {
  it("resolves immediately when there is no previous post", async () => {
    await expect(waitForNextScorePost(null)).resolves.toBeUndefined();
  });

  it("waits out the remaining delay up to 10 seconds since the previous post", async () => {
    vi.useFakeTimers();
    const previousPostStartedAt = Date.now() - 4_000;
    const promise = waitForNextScorePost(previousPostStartedAt);
    let resolved = false;
    promise.then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(5_999);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(resolved).toBe(true);
  });

  it("does not wait when the previous post is already 10+ seconds old", async () => {
    vi.useFakeTimers();
    const previousPostStartedAt = Date.now() - 10_000;
    let resolved = false;
    waitForNextScorePost(previousPostStartedAt).then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(resolved).toBe(true);
  });
});

describe("postPendingScore", () => {
  it("posts the score payload with the submissionId as Idempotency-Key", async () => {
    let idempotencyKey: string | null = null;
    let body: unknown;
    server.use(
      http.post("http://localhost/api/scores", async ({ request }) => {
        idempotencyKey = request.headers.get("Idempotency-Key");
        body = await request.json();
        return HttpResponse.json({ scores: [score()], storage: "blob" }, { status: 201 });
      }),
    );

    const result = await postPendingScore(pendingEntry());

    expect(idempotencyKey).toBe(pendingEntry().submissionId);
    expect(body).toEqual(score());
    expect(result).toEqual({ scores: [score()], storage: "blob" });
  });

  it("throws when the response is not ok", async () => {
    server.use(
      http.post("http://localhost/api/scores", () => HttpResponse.json({ error: "wait" }, { status: 429 })),
    );

    await expect(postPendingScore(pendingEntry())).rejects.toThrow("Score sync failed");
  });
});

describe("scoreIdentity", () => {
  it("combines createdAt and name", () => {
    expect(scoreIdentity(score())).toBe("2026-01-01T00:00:00.000Z:DEV");
  });
});

describe("mergeHighScores", () => {
  it("deduplicates by identity, keeping the last occurrence", () => {
    const original = score({ score: 100 });
    const updated = score({ score: 200 });
    expect(mergeHighScores([original], [updated])).toEqual([updated]);
  });

  it("sorts by score desc, then wave desc, then resets desc, then createdAt asc", () => {
    const low = score({ name: "LOW", score: 50, createdAt: "2026-01-01T00:00:01.000Z" });
    const high = score({ name: "HIGH", score: 200, createdAt: "2026-01-01T00:00:02.000Z" });
    const tieHigherWave = score({ name: "TIE-WAVE", score: 100, wave: 3, createdAt: "2026-01-01T00:00:03.000Z" });
    const tieLowerWave = score({ name: "TIE-LOW-WAVE", score: 100, wave: 1, createdAt: "2026-01-01T00:00:04.000Z" });
    expect(mergeHighScores([low, high, tieHigherWave, tieLowerWave])).toEqual([
      high,
      tieHigherWave,
      tieLowerWave,
      low,
    ]);
  });

  it("caps the result at 10 entries", () => {
    const scores = Array.from({ length: 15 }, (_, index) => score({ name: `P${index}`, score: index }));
    expect(mergeHighScores(scores)).toHaveLength(10);
  });
});
