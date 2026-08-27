import { describe, expect, it, vi } from "vitest";
import {
  IdempotencyUnavailableError,
  createIdempotencyStore,
} from "@/lib/score-idempotency";

const credentials = {
  UPSTASH_REDIS_REST_TOKEN: "test-token",
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
};

type TestRedisClient = {
  get: ReturnType<typeof vi.fn<(key: string) => Promise<unknown>>>;
  set: ReturnType<typeof vi.fn<(key: string, value: string, options: { nx: true; ex: number }) => Promise<unknown>>>;
  eval: ReturnType<typeof vi.fn<(script: string, keys: string[], args: string[]) => Promise<unknown>>>;
};

function redisClient(overrides: Partial<TestRedisClient> = {}): TestRedisClient {
  return {
    get: vi.fn<(key: string) => Promise<unknown>>().mockResolvedValue(null),
    set: vi.fn<(key: string, value: string, options: { nx: true; ex: number }) => Promise<unknown>>().mockResolvedValue("OK"),
    eval: vi.fn<(script: string, keys: string[], args: string[]) => Promise<unknown>>().mockResolvedValue(1),
    ...overrides,
  };
}

describe("score idempotency store", () => {
  it("allows one local claimant and reports concurrent claims as in-flight", async () => {
    const store = createIdempotencyStore({ environment: "test", logger: { error: vi.fn(), warn: vi.fn() } });

    await expect(Promise.all([store.claim("submission-1"), store.claim("submission-1")])).resolves.toEqual([
      "claimed",
      "in-flight",
    ]);
  });

  it("claims a shared key atomically with a transient expiration", async () => {
    const redis = redisClient();
    const store = createIdempotencyStore({ environment: "production", env: credentials, redis });

    await expect(store.claim("submission-2")).resolves.toBe("claimed");
    expect(redis.set).toHaveBeenCalledWith(expect.stringMatching(/^score:idempotency:[a-f0-9]{64}$/), "in-flight", {
      nx: true,
      ex: 60,
    });
    expect(JSON.stringify(redis.set.mock.calls)).not.toContain("submission-2");
  });

  it("keeps a completed local claim idempotent for 24 hours", async () => {
    let now = 1_000;
    const store = createIdempotencyStore({
      environment: "development",
      logger: { error: vi.fn(), warn: vi.fn() },
      now: () => now,
    });

    await expect(store.claim("submission-3")).resolves.toBe("claimed");
    await store.complete("submission-3");
    now += 86_399_000;
    await expect(store.claim("submission-3")).resolves.toBe("completed");
    now += 1_000;
    await expect(store.claim("submission-3")).resolves.toBe("claimed");
  });

  it("completes only an in-flight Redis claim with a 24-hour expiration", async () => {
    const redis = redisClient();
    const store = createIdempotencyStore({ environment: "production", env: credentials, redis });

    await store.complete("submission-4");
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("GET", KEYS[1]) == ARGV[1]'),
      [expect.stringMatching(/^score:idempotency:[a-f0-9]{64}$/)],
      ["in-flight", "completed", "86400"],
    );
  });

  it("releases an in-flight claim without releasing a completed claim", async () => {
    const store = createIdempotencyStore({ environment: "test", logger: { error: vi.fn(), warn: vi.fn() } });

    await store.claim("failed-write");
    await store.release("failed-write");
    await expect(store.claim("failed-write")).resolves.toBe("claimed");

    await store.claim("completed-write");
    await store.complete("completed-write");
    await store.release("completed-write");
    await expect(store.claim("completed-write")).resolves.toBe("completed");
  });

  it("fails closed on production Redis errors instead of using local memory", async () => {
    const redis = redisClient({
      get: vi.fn<(key: string) => Promise<unknown>>().mockRejectedValue(new TypeError("network failed")),
    });
    const logger = { error: vi.fn(), warn: vi.fn() };
    const store = createIdempotencyStore({ environment: "production", env: credentials, logger, redis });

    await expect(store.claim("submission-5")).rejects.toBeInstanceOf(IdempotencyUnavailableError);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("Score idempotency unavailable", {
      backend: "redis",
      error: "TypeError",
    });
  });
});
