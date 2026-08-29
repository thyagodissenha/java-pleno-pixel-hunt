import { describe, expect, it, vi } from "vitest";
import {
  AbusePreflightUnavailableError,
  createAbusePreflightStore,
} from "@/lib/score-abuse-preflight";

const credentials = {
  UPSTASH_REDIS_REST_TOKEN: "test-token",
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
};

describe("score abuse preflight store", () => {
  it("enforces the local 60 request fixed window and opens a new one at expiration", async () => {
    let now = 1_000;
    const store = createAbusePreflightStore({
      environment: "test",
      logger: { error: vi.fn(), warn: vi.fn() },
      now: () => now,
    });

    await expect(store.consume("203.0.113.10")).resolves.toEqual({
      allowed: true,
      retryAfterMs: 60_000,
      backend: "local-memory",
    });
    for (let request = 2; request <= 60; request += 1) {
      await expect(store.consume("203.0.113.10")).resolves.toMatchObject({ allowed: true });
    }
    await expect(store.consume("203.0.113.10")).resolves.toEqual({
      allowed: false,
      retryAfterMs: 60_000,
      backend: "local-memory",
    });

    now += 20_001;
    await expect(store.consume("203.0.113.10")).resolves.toEqual({
      allowed: false,
      retryAfterMs: 39_999,
      backend: "local-memory",
    });

    now = 61_000;
    await expect(store.consume("203.0.113.10")).resolves.toEqual({
      allowed: true,
      retryAfterMs: 60_000,
      backend: "local-memory",
    });
  });

  it("uses one Redis Lua operation per request without renewing the blocked window", async () => {
    let now = 5_000;
    let count = 0;
    let expiresAt = 0;
    const evalMock = vi.fn(async (script: string, keys: string[], args: string[]) => {
      expect(script).toContain('redis.call("PTTL", KEYS[1])');
      expect(script).toContain('redis.call("INCR", KEYS[1])');
      expect(keys[0]).toMatch(/^score:abuse:[a-f0-9]{64}$/);
      expect(keys[0]).not.toContain("203.0.113.20");
      expect(args).toEqual(["60000", "60"]);

      if (now >= expiresAt) {
        count = 1;
        expiresAt = now + 60_000;
        return [1, 60_000];
      }
      const ttl = expiresAt - now;
      if (count < 60) {
        count += 1;
        return [1, ttl];
      }
      return [0, ttl];
    });
    const store = createAbusePreflightStore({
      environment: "production",
      env: credentials,
      logger: { error: vi.fn(), warn: vi.fn() },
      redis: { eval: evalMock },
    });

    for (let request = 1; request <= 60; request += 1) {
      await expect(store.consume("203.0.113.20")).resolves.toMatchObject({ allowed: true, backend: "redis" });
    }
    await expect(store.consume("203.0.113.20")).resolves.toEqual({
      allowed: false,
      retryAfterMs: 60_000,
      backend: "redis",
    });
    now += 12_345;
    await expect(store.consume("203.0.113.20")).resolves.toEqual({
      allowed: false,
      retryAfterMs: 47_655,
      backend: "redis",
    });
    expect(expiresAt).toBe(65_000);
    expect(evalMock).toHaveBeenCalledTimes(62);
  });

  it.each([
    ["malformed result", "unexpected"],
    ["invalid missing TTL", [0, -1]],
    ["invalid decision", [2, 10_000]],
  ])("fails closed for a Redis %s", async (_label, result) => {
    const logger = { error: vi.fn(), warn: vi.fn() };
    const store = createAbusePreflightStore({
      environment: "production",
      env: credentials,
      logger,
      redis: { eval: vi.fn().mockResolvedValue(result) },
    });

    await expect(store.consume("203.0.113.30")).rejects.toBeInstanceOf(AbusePreflightUnavailableError);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("fails closed without production credentials and logs no sensitive request data", async () => {
    const logger = { error: vi.fn(), warn: vi.fn() };
    const store = createAbusePreflightStore({ environment: "production", env: {}, logger });

    await expect(store.consume("203.0.113.40")).rejects.toBeInstanceOf(AbusePreflightUnavailableError);
    expect(logger.error).toHaveBeenCalledWith("Score abuse preflight unavailable", {
      backend: "redis",
      error: "MissingCredentials",
    });
    const logged = JSON.stringify(logger.error.mock.calls);
    expect(logged).not.toContain("203.0.113.40");
    expect(logged).not.toMatch(/[a-f0-9]{64}/);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("fails closed on Redis service errors without logging identifiers or tokens", async () => {
    const logger = { error: vi.fn(), warn: vi.fn() };
    const store = createAbusePreflightStore({
      environment: "production",
      env: credentials,
      logger,
      redis: { eval: vi.fn().mockRejectedValue(new TypeError("network failed")) },
    });

    await expect(store.consume("203.0.113.50")).rejects.toBeInstanceOf(AbusePreflightUnavailableError);
    expect(logger.error).toHaveBeenCalledWith("Score abuse preflight unavailable", {
      backend: "redis",
      error: "TypeError",
    });
    const logged = JSON.stringify(logger.error.mock.calls);
    expect(logged).not.toContain("203.0.113.50");
    expect(logged).not.toContain("test-token");
    expect(logged).not.toMatch(/[a-f0-9]{64}/);
  });

  it("fails closed when the production Redis factory cannot initialize", async () => {
    const logger = { error: vi.fn(), warn: vi.fn() };
    const store = createAbusePreflightStore({
      environment: "production",
      env: credentials,
      logger,
      redisFactory: () => {
        throw new TypeError("factory failed");
      },
    });

    await expect(store.consume("203.0.113.60")).rejects.toBeInstanceOf(AbusePreflightUnavailableError);
    expect(logger.error).toHaveBeenCalledWith("Score abuse preflight unavailable", {
      backend: "redis",
      error: "TypeError",
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("identifies the local backend as non-distributed", () => {
    const logger = { error: vi.fn(), warn: vi.fn() };

    createAbusePreflightStore({ environment: "development", logger });

    expect(logger.warn).toHaveBeenCalledWith("Using non-distributed score abuse preflight", {
      backend: "local-memory",
    });
  });
});
