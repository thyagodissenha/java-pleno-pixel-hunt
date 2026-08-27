import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const adapters = vi.hoisted(() => ({ acquire: vi.fn(), claim: vi.fn(), complete: vi.fn(), release: vi.fn() }));
const scores = vi.hoisted(() => ({ add: vi.fn(), read: vi.fn() }));

vi.mock("@/lib/score-rate-limit", () => ({
  createRateLimitStore: () => ({ acquire: adapters.acquire }),
}));

vi.mock("@/lib/score-idempotency", () => ({
  createIdempotencyStore: () => ({
    claim: adapters.claim,
    complete: adapters.complete,
    release: adapters.release,
  }),
}));

vi.mock("@/lib/high-scores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/high-scores")>()),
  addHighScore: scores.add,
  readHighScores: scores.read,
}));

const scorePayload = { name: "DEV", score: 1200, wave: 4, resets: 1, outcome: "over" };

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
    adapters.claim.mockReset().mockResolvedValue("claimed");
    adapters.complete.mockReset().mockResolvedValue(undefined);
    adapters.release.mockReset().mockResolvedValue(undefined);
    scores.read.mockReset().mockResolvedValue([]);
    scores.add.mockReset().mockImplementation(async (score) => ({ scores: [score], storage: "blob" }));
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

  it("sanitizes POST payloads before persistence and completes the claim", async () => {
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest({
      body: { name: "  java   pleno  ", score: 1_000_000, wave: 0, resets: -1, outcome: "invalid" },
    }));

    expect(response.status).toBe(201);
    expect(scores.add).toHaveBeenCalledWith({
      name: "JAVA PLENO",
      score: 999_999,
      wave: 1,
      resets: 0,
      outcome: "over",
      createdAt: "2026-08-27T12:00:00.000Z",
    });
    expect(adapters.complete).toHaveBeenCalledWith("submission-1");
    expect(adapters.release).not.toHaveBeenCalled();
  });

  it("rejects an explicitly debug-originated payload without persistence", async () => {
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest({ body: { ...scorePayload, origin: "debug" } }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Scores de debug não são aceitos." });
    expect(adapters.acquire).not.toHaveBeenCalled();
    expect(scores.add).not.toHaveBeenCalled();
  });

  it("requires a valid Idempotency-Key before acquiring the throttle", async () => {
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest({ headers: { "Idempotency-Key": "invalid key" } }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Idempotency-Key inválido." });
    expect(adapters.acquire).not.toHaveBeenCalled();
    expect(scores.add).not.toHaveBeenCalled();
  });

  it("returns the exact 429 contract without claiming or persisting", async () => {
    adapters.acquire.mockResolvedValue({ allowed: false, backend: "redis", retryAfterMs: 8_000 });
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("10");
    expect(await response.json()).toEqual({ error: "Aguarde antes de enviar outro score.", retryAfterMs: 10_000 });
    expect(adapters.claim).not.toHaveBeenCalled();
    expect(scores.add).not.toHaveBeenCalled();
  });

  it("returns 503 on a Redis error without persisting", async () => {
    adapters.acquire.mockRejectedValue(new Error("Redis unavailable"));
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Não foi possível salvar o ranking agora." });
    expect(scores.add).not.toHaveBeenCalled();
  });

  it("returns an idempotent success without a second write", async () => {
    adapters.claim.mockResolvedValue("completed");
    scores.read.mockResolvedValue([{ ...scorePayload, createdAt: "2026-08-26T12:00:00.000Z" }]);
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest());
    const body = await response.json() as { idempotent: boolean; scores: unknown[] };

    expect(response.status).toBe(200);
    expect(body.idempotent).toBe(true);
    expect(body.scores).toHaveLength(1);
    expect(scores.add).not.toHaveBeenCalled();
    expect(adapters.complete).not.toHaveBeenCalled();
  });

  it("returns a transient conflict for an in-flight claim without persistence", async () => {
    adapters.claim.mockResolvedValue("in-flight");
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Submissão em processamento." });
    expect(scores.add).not.toHaveBeenCalled();
  });

  it("releases the claim when Blob persistence falls back to local storage", async () => {
    scores.add.mockResolvedValue({
      scores: [{ ...scorePayload, createdAt: "2026-08-27T12:00:00.000Z" }],
      storage: "local",
    });
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest());

    expect(response.status).toBe(200);
    expect((await response.json() as { storage: string }).storage).toBe("local");
    expect(adapters.release).toHaveBeenCalledWith("submission-1");
    expect(adapters.complete).not.toHaveBeenCalled();
  });

  it("releases the claim when score persistence throws", async () => {
    scores.add.mockRejectedValue(new Error("Blob failed"));
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest());

    expect(response.status).toBe(503);
    expect(adapters.release).toHaveBeenCalledWith("submission-1");
    expect(adapters.complete).not.toHaveBeenCalled();
  });
});
