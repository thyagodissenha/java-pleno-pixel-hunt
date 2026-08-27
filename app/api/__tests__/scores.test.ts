import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const blob = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
}));

vi.mock("@vercel/blob", () => blob);

const scorePayload = {
  name: "DEV",
  score: 1200,
  wave: 4,
  resets: 1,
  outcome: "over",
};

async function loadPost() {
  const route = await import("@/app/api/scores/route");
  return route.POST;
}

function scoreRequest(headers: HeadersInit = {}) {
  return new Request("http://localhost/api/scores", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(scorePayload),
  });
}

describe("POST /api/scores", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T12:00:00.000Z"));
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
    blob.get.mockReset().mockResolvedValue(null);
    blob.put.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("returns a local fallback when Blob throws a configuration error", async () => {
    blob.put.mockRejectedValueOnce(new Error("Missing token"));
    const POST = await loadPost();

    const response = await POST(scoreRequest({ "x-forwarded-for": "203.0.113.1" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      scores: [{ ...scorePayload, name: "DEV", createdAt: "2026-08-27T12:00:00.000Z" }],
      storage: "local",
    });
  });

  it("returns a local fallback when the Blob token is absent", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", undefined);
    const POST = await loadPost();

    const response = await POST(scoreRequest({ "x-forwarded-for": "203.0.113.2" }));
    const body = await response.json() as { storage: string };

    expect(response.status).toBe(200);
    expect(body.storage).toBe("local");
  });

  it("accepts another submission from the forwarded IP after ten seconds", async () => {
    const POST = await loadPost();

    const firstResponse = await POST(scoreRequest({ "x-forwarded-for": "203.0.113.4" }));
    vi.advanceTimersByTime(10_000);
    const secondResponse = await POST(scoreRequest({ "x-forwarded-for": "203.0.113.4" }));

    expect(firstResponse.status).toBe(201);
    expect(await firstResponse.json()).toEqual({
      scores: [{ ...scorePayload, name: "DEV", createdAt: "2026-08-27T12:00:00.000Z" }],
      storage: "blob",
    });
    expect(secondResponse.status).toBe(201);
  });

  it("throttles the forwarded IP for ten seconds", async () => {
    const POST = await loadPost();
    await POST(scoreRequest({ "x-forwarded-for": "203.0.113.3, 198.51.100.1" }));

    const response = await POST(scoreRequest({ "x-forwarded-for": "203.0.113.3, 192.0.2.1" }));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("10");
    expect(await response.json()).toEqual({
      error: "Aguarde antes de enviar outro score.",
      retryAfterMs: 10_000,
    });
  });

  it("uses x-real-ip when x-forwarded-for is absent", async () => {
    const POST = await loadPost();
    await POST(scoreRequest({ "x-real-ip": "198.51.100.8" }));
    vi.advanceTimersByTime(4_000);

    const response = await POST(scoreRequest({ "x-real-ip": "198.51.100.8" }));
    const body = await response.json() as { retryAfterMs: number };

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("6");
    expect(body.retryAfterMs).toBe(6_000);
  });
});
