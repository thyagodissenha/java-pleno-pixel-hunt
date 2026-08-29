import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const adapters = vi.hoisted(() => ({
  preflight: vi.fn(),
  acquire: vi.fn(),
  claim: vi.fn(),
  complete: vi.fn(),
  release: vi.fn(),
  status: vi.fn(),
}));
const scores = vi.hoisted(() => ({
  ensure: vi.fn(),
  intent: vi.fn(),
  ledgerEntry: vi.fn(),
  read: vi.fn(),
}));

vi.mock("@/lib/score-abuse-preflight", () => ({
  createAbusePreflightStore: () => ({ consume: adapters.preflight }),
}));

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
  ensureRankingEffect: scores.ensure,
  persistLedgerIntent: scores.intent,
  readHighScores: scores.read,
  readLedgerEntry: scores.ledgerEntry,
}));

const scorePayload = { name: "DEV", score: 1200, wave: 4, resets: 1, outcome: "over" };
const createdAt = "2026-08-27T12:00:00.000Z";
const sanitizedScore = { ...scorePayload, createdAt };

function ledgerEntry(score = sanitizedScore) {
  return {
    submissionId: "submission-1",
    persistedAt: createdAt,
    score: { ...score, submissionId: "submission-1" },
    source: "cycle-3" as const,
  };
}

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
    vi.setSystemTime(new Date(createdAt));
    adapters.preflight.mockReset().mockResolvedValue({ allowed: true, backend: "redis", retryAfterMs: 60_000 });
    adapters.acquire.mockReset().mockResolvedValue({ allowed: true, backend: "redis", retryAfterMs: 10_000 });
    adapters.claim.mockReset().mockResolvedValue({ state: "claimed", ownerToken: "owner-token-1" });
    adapters.complete.mockReset().mockResolvedValue("applied");
    adapters.release.mockReset().mockResolvedValue("applied");
    adapters.status.mockReset().mockResolvedValue({ state: "other" });
    scores.read.mockReset().mockResolvedValue([]);
    scores.ledgerEntry.mockReset().mockResolvedValue(undefined);
    scores.intent.mockReset().mockImplementation(async (score, submissionId) => ({
      entry: {
        submissionId,
        persistedAt: score.createdAt,
        score: { ...score, submissionId },
        source: "cycle-3",
      },
      idempotent: false,
    }));
    scores.ensure.mockReset().mockResolvedValue({ scores: [sanitizedScore], storage: "blob", idempotent: false });
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
        { name: "HIGH", score: 900, wave: 3, resets: 0, outcome: "won", createdAt },
        { name: "LOW", score: 10, wave: 2, resets: 0, outcome: "over", createdAt },
      ],
    });
  });

  it("preserves each score's own stored createdAt instead of collapsing them to the current request time", async () => {
    scores.read.mockResolvedValue([
      { name: "FIRST", score: 300, wave: 3, resets: 0, outcome: "over", createdAt: "2026-08-20T09:15:00.000Z" },
      { name: "SECOND", score: 200, wave: 2, resets: 0, outcome: "over", createdAt: "2026-08-21T10:30:00.000Z" },
    ]);
    const { GET } = await loadRoute();

    const response = await GET();
    const payload = (await response.json()) as { scores: { createdAt: string }[] };

    expect(payload.scores.map((entry) => entry.createdAt)).toEqual([
      "2026-08-20T09:15:00.000Z",
      "2026-08-21T10:30:00.000Z",
    ]);
  });

  it("orders a new score through preflight, shard intention, ranking, and owner completion", async () => {
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest({
      body: { name: "  java   pleno  ", score: 1_000_000, wave: 0, resets: -1, outcome: "invalid" },
    }));

    expect(response.status).toBe(201);
    expect(scores.intent).toHaveBeenCalledWith({
      name: "JAVA PLENO",
      score: 999_999,
      wave: 1,
      resets: 0,
      outcome: "over",
      createdAt,
    }, "submission-1");
    expect(scores.ensure).toHaveBeenCalledWith(expect.objectContaining({ submissionId: "submission-1" }));
    expect(adapters.complete).toHaveBeenCalledWith("submission-1", "owner-token-1");
    expect(adapters.release).not.toHaveBeenCalled();
    expect(adapters.preflight.mock.invocationCallOrder[0]).toBeLessThan(adapters.status.mock.invocationCallOrder[0]);
    expect(adapters.status.mock.invocationCallOrder[0]).toBeLessThan(scores.ledgerEntry.mock.invocationCallOrder[0]);
    expect(scores.ledgerEntry.mock.invocationCallOrder[0]).toBeLessThan(adapters.acquire.mock.invocationCallOrder[0]);
    expect(adapters.acquire.mock.invocationCallOrder[0]).toBeLessThan(adapters.claim.mock.invocationCallOrder[0]);
    expect(adapters.claim.mock.invocationCallOrder[0]).toBeLessThan(scores.ledgerEntry.mock.invocationCallOrder[1]);
    expect(scores.ledgerEntry.mock.invocationCallOrder[1]).toBeLessThan(scores.intent.mock.invocationCallOrder[0]);
    expect(scores.intent.mock.invocationCallOrder[0]).toBeLessThan(scores.ensure.mock.invocationCallOrder[0]);
  });

  it.each([
    ["origin marker", { ...scorePayload, origin: "debug" }],
    ["boolean marker", { ...scorePayload, debug: true }],
  ])("rejects an explicitly debug-originated payload by %s before preflight or persistence", async (_label, body) => {
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest({ body }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Scores de debug não são aceitos." });
    expect(adapters.preflight).not.toHaveBeenCalled();
    expect(adapters.status).not.toHaveBeenCalled();
    expect(adapters.acquire).not.toHaveBeenCalled();
    expect(adapters.claim).not.toHaveBeenCalled();
    expect(scores.ledgerEntry).not.toHaveBeenCalled();
    expect(scores.intent).not.toHaveBeenCalled();
    expect(scores.ensure).not.toHaveBeenCalled();
  });

  it("requires a valid Idempotency-Key before preflight", async () => {
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest({ headers: { "Idempotency-Key": "invalid key" } }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Idempotency-Key inválido." });
    expect(adapters.preflight).not.toHaveBeenCalled();
    expect(adapters.status).not.toHaveBeenCalled();
    expect(scores.ledgerEntry).not.toHaveBeenCalled();
  });

  it("allows the first 60 validated duplicates and rejects the 61st before every downstream dependency", async () => {
    const entry = ledgerEntry();
    let requests = 0;
    adapters.preflight.mockImplementation(async () => {
      requests += 1;
      return requests <= 60
        ? { allowed: true, backend: "redis", retryAfterMs: 60_000 }
        : { allowed: false, backend: "redis", retryAfterMs: 1_250 };
    });
    scores.ledgerEntry.mockResolvedValue(entry);
    const { POST } = await loadRoute();

    let sixtiethResponse: Response | undefined;
    for (let request = 1; request <= 60; request += 1) {
      sixtiethResponse = await POST(scoreRequest());
    }
    const blockedResponse = await POST(scoreRequest({ headers: { "Idempotency-Key": "rotated-id" } }));

    expect(sixtiethResponse?.status).toBe(200);
    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.headers.get("Retry-After")).toBe("2");
    expect(await blockedResponse.json()).toEqual({
      error: "Muitas tentativas. Tente novamente em breve.",
      retryAfterMs: 1_250,
    });
    expect(adapters.preflight).toHaveBeenCalledTimes(61);
    expect(adapters.status).toHaveBeenCalledTimes(60);
    expect(scores.ledgerEntry).toHaveBeenCalledTimes(60);
    expect(scores.ensure).toHaveBeenCalledTimes(60);
    expect(adapters.acquire).not.toHaveBeenCalled();
    expect(adapters.claim).not.toHaveBeenCalled();
  });

  it("returns 503 when preflight is unavailable with zero downstream side effects", async () => {
    adapters.preflight.mockRejectedValue(new Error("Redis unavailable"));
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Não foi possível salvar o ranking agora." });
    expect(adapters.status).not.toHaveBeenCalled();
    expect(adapters.acquire).not.toHaveBeenCalled();
    expect(adapters.claim).not.toHaveBeenCalled();
    expect(scores.ledgerEntry).not.toHaveBeenCalled();
    expect(scores.intent).not.toHaveBeenCalled();
    expect(scores.ensure).not.toHaveBeenCalled();
  });

  it("treats Redis completed as a hint and never succeeds without an active shard", async () => {
    adapters.status.mockResolvedValue({ state: "completed" });
    adapters.claim.mockResolvedValue({ state: "completed" });
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Submissão em processamento." });
    expect(adapters.preflight).toHaveBeenCalledTimes(1);
    expect(scores.ledgerEntry).toHaveBeenCalledTimes(1);
    expect(adapters.acquire).toHaveBeenCalledTimes(1);
    expect(scores.intent).not.toHaveBeenCalled();
    expect(scores.ensure).not.toHaveBeenCalled();
  });

  it("repairs the ranking from an active shard before success without functional throttle", async () => {
    adapters.status.mockResolvedValue({ state: "completed" });
    scores.ledgerEntry.mockResolvedValue(ledgerEntry());
    scores.ensure.mockResolvedValue({ scores: [sanitizedScore], storage: "blob", idempotent: false });
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ scores: [sanitizedScore], storage: "blob", idempotent: true });
    expect(adapters.preflight.mock.invocationCallOrder[0]).toBeLessThan(scores.ledgerEntry.mock.invocationCallOrder[0]);
    expect(scores.ledgerEntry.mock.invocationCallOrder[0]).toBeLessThan(scores.ensure.mock.invocationCallOrder[0]);
    expect(adapters.acquire).not.toHaveBeenCalled();
    expect(adapters.claim).not.toHaveBeenCalled();
    expect(scores.intent).not.toHaveBeenCalled();
  });

  it("returns the exact functional throttle 429 after preflight without claiming or writing", async () => {
    adapters.acquire.mockResolvedValue({ allowed: false, backend: "redis", retryAfterMs: 8_000 });
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("10");
    expect(await response.json()).toEqual({ error: "Aguarde antes de enviar outro score.", retryAfterMs: 10_000 });
    expect(adapters.preflight).toHaveBeenCalledTimes(1);
    expect(adapters.claim).not.toHaveBeenCalled();
    expect(scores.intent).not.toHaveBeenCalled();
    expect(scores.ensure).not.toHaveBeenCalled();
  });

  it("returns a transient conflict for an in-flight claim without persistence", async () => {
    adapters.claim.mockResolvedValue({ state: "in-flight" });
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Submissão em processamento." });
    expect(scores.intent).not.toHaveBeenCalled();
    expect(scores.ensure).not.toHaveBeenCalled();
  });

  it("closes the post-claim race from the shard without creating a second intention", async () => {
    scores.ledgerEntry.mockResolvedValueOnce(undefined).mockResolvedValueOnce(ledgerEntry());
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest());

    expect(response.status).toBe(200);
    expect(scores.intent).not.toHaveBeenCalled();
    expect(scores.ensure).toHaveBeenCalledTimes(1);
    expect(adapters.complete).toHaveBeenCalledWith("submission-1", "owner-token-1");
    expect(adapters.release).not.toHaveBeenCalled();
  });

  it("returns success after ranking confirmation and deduplicates retry when complete throws", async () => {
    const entry = ledgerEntry();
    adapters.complete.mockRejectedValue(new Error("complete failed"));
    scores.ledgerEntry
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(entry);
    const { POST } = await loadRoute();

    const firstResponse = await POST(scoreRequest());
    const retryResponse = await POST(scoreRequest());

    expect(firstResponse.status).toBe(201);
    expect((await firstResponse.json() as { storage: string }).storage).toBe("blob");
    expect(retryResponse.status).toBe(200);
    expect(await retryResponse.json()).toEqual({ scores: [sanitizedScore], storage: "blob", idempotent: true });
    expect(adapters.release).not.toHaveBeenCalled();
    expect(adapters.acquire).toHaveBeenCalledTimes(1);
    expect(adapters.claim).toHaveBeenCalledTimes(1);
    expect(scores.intent).toHaveBeenCalledTimes(1);
    expect(scores.ensure).toHaveBeenCalledTimes(2);
  });

  it("returns success after ranking confirmation when complete reports ownership-lost", async () => {
    adapters.complete.mockResolvedValue("ownership-lost");
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest());

    expect(response.status).toBe(201);
    expect((await response.json() as { storage: string }).storage).toBe("blob");
    expect(adapters.release).not.toHaveBeenCalled();
  });

  it("keeps the shard intention, releases the current owner, and returns 503 when ranking fails", async () => {
    scores.ensure.mockRejectedValue(new Error("ranking failed"));
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest());

    expect(response.status).toBe(503);
    expect(scores.intent).toHaveBeenCalledTimes(1);
    expect(adapters.release).toHaveBeenCalledWith("submission-1", "owner-token-1");
    expect(adapters.complete).not.toHaveBeenCalled();
  });

  it("releases the current owner and touches zero ranking when shard confirmation fails", async () => {
    scores.intent.mockRejectedValue(new Error("shard failed"));
    const { POST } = await loadRoute();

    const response = await POST(scoreRequest());

    expect(response.status).toBe(503);
    expect(adapters.release).toHaveBeenCalledWith("submission-1", "owner-token-1");
    expect(scores.ensure).not.toHaveBeenCalled();
    expect(adapters.complete).not.toHaveBeenCalled();
  });

  it("returns a friendly retryable response with the real Blob boundary when its token is absent", async () => {
    const previousToken = process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    vi.doUnmock("@/lib/high-scores");
    vi.resetModules();

    try {
      const { POST } = await loadRoute();
      const response = await POST(scoreRequest());

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "Não foi possível salvar o ranking agora." });
      expect(adapters.preflight).toHaveBeenCalledTimes(1);
      expect(adapters.status).toHaveBeenCalledTimes(1);
      expect(adapters.acquire).not.toHaveBeenCalled();
      expect(adapters.claim).not.toHaveBeenCalled();
    } finally {
      if (previousToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
      else process.env.BLOB_READ_WRITE_TOKEN = previousToken;
    }
  });
});
