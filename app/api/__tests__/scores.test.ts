import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const adapters = vi.hoisted(() => ({
  acquire: vi.fn(),
  claim: vi.fn(),
  complete: vi.fn(),
  release: vi.fn(),
  status: vi.fn(),
}));
const scores = vi.hoisted(() => ({ persist: vi.fn(), read: vi.fn(), snapshot: vi.fn() }));

vi.mock("@/lib/score-rate-limit", () => ({
  createRateLimitStore: () => ({ acquire: adapters.acquire }),
}));

vi.mock("@/lib/score-idempotency", () => ({
  createIdempotencyStore: () => ({
    claim: adapters.claim,
    complete: adapters.complete,
    release: adapters.release,
    status: adapters.status,
  }),
}));

vi.mock("@/lib/high-scores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/high-scores")>()),
  persistHighScore: scores.persist,
  readHighScores: scores.read,
  readRankingSnapshot: scores.snapshot,
}));

const scorePayload = { name: "DEV", score: 1200, wave: 4, resets: 1, outcome: "over" };
const emptySnapshot = { document: { version: 2, scores: [], processedSubmissions: [] }, etag: null };

async function loadRoute() {
  return import("@/app/api/scores/route");
}

function scoreRequest({ body = scorePayload, headers = {} }: { body?: unknown; headers?: HeadersInit } = {}) {
  return new Request("http://localhost/api/scores", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": "submission-1",
      "x-forwarded-for": "203.0.113.1",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("/api/scores", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T12:00:00.000Z"));
    adapters.acquire.mockReset().mockResolvedValue({ allowed: true, backend: "redis", retryAfterMs: 10_000 });
    adapters.claim.mockReset().mockResolvedValue({ state: "claimed", ownerToken: "owner-token-1" });
    adapters.complete.mockReset().mockResolvedValue("applied");
    adapters.release.mockReset().mockResolvedValue("applied");
    adapters.status.mockReset().mockResolvedValue({ state: "other" });
    scores.read.mockReset().mockResolvedValue([]);
    scores.snapshot.mockReset().mockResolvedValue(emptySnapshot);
    scores.persist.mockReset().mockImplementation(async (score) => ({ scores: [score], storage: "blob", idempotent: false }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sanitizes and orders every score returned by GET", async () => {
    scores.read.mockResolvedValue([
      { name: "  low  ", score: 10, wave: 2, resets: 0, outcome: "invalid", createdAt: null },
      { name: " high ", score: 900, wave: "3", resets: -2, outcome: "won", createdAt: 42 },
    ]);
    const { GET } = await loadRoute();

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      scores: [
        { name: "HIGH", score: 900, wave: 3, resets: 0, outcome: "won", createdAt: "2026-08-27T12:00:00.000Z" },
        { name: "LOW", score: 10, wave: 2, resets: 0, outcome: "over", createdAt: "2026-08-27T12:00:00.000Z" },
      ],
    });
  });

  it("sanitizes POST payloads before authoritative persistence and completes the owner claim", async () => {
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest({
      body: { name: "  java   pleno  ", score: 1_000_000, wave: 0, resets: -1, outcome: "invalid" },
    }));

    expect(response.status).toBe(201);
    expect(scores.persist).toHaveBeenCalledWith({
      name: "JAVA PLENO",
      score: 999_999,
      wave: 1,
      resets: 0,
      outcome: "over",
      createdAt: "2026-08-27T12:00:00.000Z",
    }, "submission-1");
    expect(adapters.complete).toHaveBeenCalledWith("submission-1", "owner-token-1");
    expect(adapters.release).not.toHaveBeenCalled();
    expect(adapters.status.mock.invocationCallOrder[0]).toBeLessThan(scores.snapshot.mock.invocationCallOrder[0]);
    expect(scores.snapshot.mock.invocationCallOrder[0]).toBeLessThan(adapters.acquire.mock.invocationCallOrder[0]);
    expect(adapters.acquire.mock.invocationCallOrder[0]).toBeLessThan(adapters.claim.mock.invocationCallOrder[0]);
  });

  it.each([
    ["origin marker", { ...scorePayload, origin: "debug" }],
    ["boolean marker", { ...scorePayload, debug: true }],
  ])("rejects an explicitly debug-originated payload by %s without adapters or Blob", async (_label, body) => {
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest({ body }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Scores de debug não são aceitos." });
    expect(adapters.status).not.toHaveBeenCalled();
    expect(adapters.acquire).not.toHaveBeenCalled();
    expect(adapters.claim).not.toHaveBeenCalled();
    expect(adapters.complete).not.toHaveBeenCalled();
    expect(adapters.release).not.toHaveBeenCalled();
    expect(scores.read).not.toHaveBeenCalled();
    expect(scores.snapshot).not.toHaveBeenCalled();
    expect(scores.persist).not.toHaveBeenCalled();
  });

  it("requires a valid Idempotency-Key before acquiring the throttle", async () => {
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest({ headers: { "Idempotency-Key": "invalid key" } }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Idempotency-Key inválido." });
    expect(adapters.status).not.toHaveBeenCalled();
    expect(adapters.acquire).not.toHaveBeenCalled();
    expect(scores.persist).not.toHaveBeenCalled();
  });

  it("returns Redis completed idempotent success before throttle and without a Blob write", async () => {
    adapters.status.mockResolvedValue({ state: "completed" });
    scores.read.mockResolvedValue([{ ...scorePayload, createdAt: "2026-08-26T12:00:00.000Z" }]);
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest());
    const body = await response.json() as { idempotent: boolean; scores: unknown[]; storage: string };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ idempotent: true, storage: "blob" });
    expect(body.scores).toHaveLength(1);
    expect(adapters.acquire).not.toHaveBeenCalled();
    expect(adapters.claim).not.toHaveBeenCalled();
    expect(scores.persist).not.toHaveBeenCalled();
  });

  it("returns Blob ledger idempotent success before throttle and without a write", async () => {
    scores.snapshot.mockResolvedValue({
      document: {
        version: 2,
        scores: [{ ...scorePayload, createdAt: "2026-08-26T12:00:00.000Z", submissionId: "submission-1" }],
        processedSubmissions: [{ submissionId: "submission-1", persistedAt: "2026-08-27T11:00:00.000Z" }],
      },
      etag: "etag-ledger",
    });
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      scores: [{ ...scorePayload, createdAt: "2026-08-26T12:00:00.000Z" }],
      storage: "blob",
      idempotent: true,
    });
    expect(adapters.acquire).not.toHaveBeenCalled();
    expect(adapters.claim).not.toHaveBeenCalled();
    expect(scores.persist).not.toHaveBeenCalled();
  });

  it("returns the exact 429 contract without claiming or persisting", async () => {
    adapters.acquire.mockResolvedValue({ allowed: false, backend: "redis", retryAfterMs: 8_000 });
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("10");
    expect(await response.json()).toEqual({ error: "Aguarde antes de enviar outro score.", retryAfterMs: 10_000 });
    expect(adapters.claim).not.toHaveBeenCalled();
    expect(scores.persist).not.toHaveBeenCalled();
  });

  it("returns 503 on a Redis error without persisting", async () => {
    adapters.status.mockRejectedValue(new Error("Redis unavailable"));
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Não foi possível salvar o ranking agora." });
    expect(scores.persist).not.toHaveBeenCalled();
  });

  it("returns a transient conflict for an in-flight claim without persistence", async () => {
    adapters.claim.mockResolvedValue({ state: "in-flight" });
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Submissão em processamento." });
    expect(scores.persist).not.toHaveBeenCalled();
  });

  it("returns success after Blob confirmation and deduplicates the retry when Redis complete throws", async () => {
    adapters.complete.mockRejectedValue(new Error("complete failed"));
    scores.snapshot
      .mockResolvedValueOnce(emptySnapshot)
      .mockResolvedValue({
        document: {
          version: 2,
          scores: [{ ...scorePayload, createdAt: "2026-08-27T12:00:00.000Z", submissionId: "submission-1" }],
          processedSubmissions: [{ submissionId: "submission-1", persistedAt: "2026-08-27T12:00:00.000Z" }],
        },
        etag: "etag-confirmed",
      });
    const { POST } = await loadRoute();

    const firstResponse = await POST(scoreRequest());
    const retryResponse = await POST(scoreRequest());

    expect(firstResponse.status).toBe(201);
    expect((await firstResponse.json() as { storage: string }).storage).toBe("blob");
    expect(retryResponse.status).toBe(200);
    expect(await retryResponse.json()).toEqual({
      scores: [{ ...scorePayload, createdAt: "2026-08-27T12:00:00.000Z" }],
      storage: "blob",
      idempotent: true,
    });
    expect(adapters.complete).toHaveBeenCalledWith("submission-1", "owner-token-1");
    expect(adapters.release).not.toHaveBeenCalled();
    expect(adapters.acquire).toHaveBeenCalledTimes(1);
    expect(adapters.claim).toHaveBeenCalledTimes(1);
    expect(scores.persist).toHaveBeenCalledTimes(1);
  });

  it("returns success after Blob confirmation when Redis complete reports ownership-lost", async () => {
    adapters.complete.mockResolvedValue("ownership-lost");
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest());

    expect(response.status).toBe(201);
    expect((await response.json() as { storage: string }).storage).toBe("blob");
    expect(adapters.release).not.toHaveBeenCalled();
  });

  it("releases the owner claim and returns 503 when Blob persistence fails before confirmation", async () => {
    scores.persist.mockRejectedValue(new Error("Blob failed"));
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest());

    expect(response.status).toBe(503);
    expect(adapters.release).toHaveBeenCalledWith("submission-1", "owner-token-1");
    expect(adapters.complete).not.toHaveBeenCalled();
  });
});
