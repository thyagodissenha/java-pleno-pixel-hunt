import { describe, expect, it, vi } from "vitest";
import {
  RateLimitUnavailableError,
  createRateLimitStore,
  hashRateLimitIdentifier,
} from "@/lib/score-rate-limit";

const credentials = {
  UPSTASH_REDIS_REST_TOKEN: "test-token",
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
};

describe("score rate limit store", () => {
  it("acquires a hashed Redis key atomically for ten seconds", async () => {
    const redis = { set: vi.fn().mockResolvedValue("OK") };
    const store = createRateLimitStore({ environment: "production", env: credentials, redis });

    await expect(store.acquire("203.0.113.7")).resolves.toEqual({
      allowed: true,
      backend: "redis",
      retryAfterMs: 10_000,
    });
    expect(redis.set).toHaveBeenCalledWith(
      `score:rate:${hashRateLimitIdentifier("203.0.113.7")}`,
      "1",
      { nx: true, ex: 10 },
    );
    expect(redis.set.mock.calls[0]?.[0]).not.toContain("203.0.113.7");
  });

  it("denies a Redis acquisition when NX does not acquire without another write", async () => {
    const redis = { set: vi.fn().mockResolvedValue(null) };
    const store = createRateLimitStore({ environment: "production", env: credentials, redis });

    await expect(store.acquire("198.51.100.9")).resolves.toEqual({
      allowed: false,
      backend: "redis",
      retryAfterMs: 10_000,
    });
    expect(redis.set).toHaveBeenCalledTimes(1);
  });

  it("allows Redis to acquire the same hashed key after the prior window expires", async () => {
    const redis = { set: vi.fn().mockResolvedValueOnce("OK").mockResolvedValueOnce(null).mockResolvedValueOnce("OK") };
    const store = createRateLimitStore({ environment: "production", env: credentials, redis });

    await expect(store.acquire("198.51.100.10")).resolves.toMatchObject({ allowed: true });
    await expect(store.acquire("198.51.100.10")).resolves.toMatchObject({ allowed: false });
    await expect(store.acquire("198.51.100.10")).resolves.toMatchObject({ allowed: true });
    expect(redis.set).toHaveBeenCalledTimes(3);
    expect(redis.set).toHaveBeenNthCalledWith(
      3,
      `score:rate:${hashRateLimitIdentifier("198.51.100.10")}`,
      "1",
      { nx: true, ex: 10 },
    );
  });

  it("keeps local acquisitions blocked until their original TTL expires", async () => {
    let now = 1_000;
    const store = createRateLimitStore({ environment: "test", now: () => now });

    await expect(store.acquire("192.0.2.4")).resolves.toMatchObject({ allowed: true, backend: "local-memory" });
    now = 5_000;
    await expect(store.acquire("192.0.2.4")).resolves.toEqual({
      allowed: false,
      backend: "local-memory",
      retryAfterMs: 6_000,
    });
    now = 11_000;
    await expect(store.acquire("192.0.2.4")).resolves.toMatchObject({ allowed: true, backend: "local-memory" });
  });

  it("fails closed without production credentials", async () => {
    const redisFactory = vi.fn();
    const logger = { error: vi.fn(), warn: vi.fn() };
    const store = createRateLimitStore({ environment: "production", env: {}, logger, redisFactory });

    await expect(store.acquire("203.0.113.8")).rejects.toBeInstanceOf(RateLimitUnavailableError);
    expect(redisFactory).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("Score rate limit unavailable", {
      backend: "redis",
      error: "MissingCredentials",
    });
  });

  it("fails closed on Redis errors and logs no clear identifier", async () => {
    const redis = { set: vi.fn().mockRejectedValue(new TypeError("network failed")) };
    const logger = { error: vi.fn(), warn: vi.fn() };
    const store = createRateLimitStore({ environment: "production", env: credentials, logger, redis });

    await expect(store.acquire("203.0.113.99")).rejects.toBeInstanceOf(RateLimitUnavailableError);
    expect(logger.error).toHaveBeenCalledWith("Score rate limit unavailable", {
      backend: "redis",
      error: "TypeError",
    });
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain("203.0.113.99");
  });

  it("creates Redis from the environment only in production", async () => {
    const redis = { set: vi.fn().mockResolvedValue("OK") };
    const redisFactory = vi.fn(() => redis);
    const productionStore = createRateLimitStore({ environment: "production", env: credentials, redisFactory });
    const developmentStore = createRateLimitStore({ environment: "development", env: credentials, redisFactory });

    await productionStore.acquire("198.51.100.1");
    await expect(developmentStore.acquire("198.51.100.1")).resolves.toMatchObject({ backend: "local-memory" });
    expect(redisFactory).toHaveBeenCalledTimes(1);
  });
});
