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
    const store = createIdempotencyStore({
      environment: "test",
      logger: { error: vi.fn(), warn: vi.fn() },
      ownerTokenFactory: () => "local-owner-1",
    });

    await expect(Promise.all([store.claim("submission-1"), store.claim("submission-1")])).resolves.toEqual([
      { state: "claimed", ownerToken: "local-owner-1" },
      { state: "in-flight" },
    ]);
  });

  it("claims a shared key atomically with an owner token and transient expiration", async () => {
    const redis = redisClient();
    const logger = { error: vi.fn(), warn: vi.fn() };
    const store = createIdempotencyStore({
      environment: "production",
      env: credentials,
      logger,
      redis,
      ownerTokenFactory: () => "owner-token-a",
    });

    await expect(store.claim("submission-2")).resolves.toEqual({
      state: "claimed",
      ownerToken: "owner-token-a",
    });
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^score:idempotency:[a-f0-9]{64}$/),
      "in-flight:owner-token-a",
      { nx: true, ex: 60 },
    );
    expect(JSON.stringify(redis.set.mock.calls)).not.toContain("submission-2");
    expect(JSON.stringify(logger)).not.toContain("owner-token-a");
  });

  it("creates different Redis owner tokens for distinct acquisitions", async () => {
    const redis = redisClient();
    const ownerTokenFactory = vi.fn<() => string>()
      .mockReturnValueOnce("owner-token-1")
      .mockReturnValueOnce("owner-token-2");
    const logger = { error: vi.fn(), warn: vi.fn() };
    const store = createIdempotencyStore({
      environment: "production",
      env: credentials,
      logger,
      redis,
      ownerTokenFactory,
    });

    await expect(store.claim("submission-distinct-a")).resolves.toEqual({
      state: "claimed",
      ownerToken: "owner-token-1",
    });
    await expect(store.claim("submission-distinct-b")).resolves.toEqual({
      state: "claimed",
      ownerToken: "owner-token-2",
    });
    expect(ownerTokenFactory).toHaveBeenCalledTimes(2);
    expect(redis.set.mock.calls.map((call) => call[1])).toEqual(["in-flight:owner-token-1", "in-flight:owner-token-2"]);
    expect(JSON.stringify(logger)).not.toContain("owner-token-1");
    expect(JSON.stringify(logger)).not.toContain("owner-token-2");
  });

  it("uses a second Redis GET when SET NX loses the race", async () => {
    const redis = redisClient({
      get: vi.fn<(key: string) => Promise<unknown>>()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce("completed"),
      set: vi.fn<(key: string, value: string, options: { nx: true; ex: number }) => Promise<unknown>>()
        .mockResolvedValue(null),
    });
    const store = createIdempotencyStore({
      environment: "production",
      env: credentials,
      redis,
      ownerTokenFactory: () => "race-loser",
    });

    await expect(store.claim("submission-race")).resolves.toEqual({ state: "completed" });
    expect(redis.get).toHaveBeenCalledTimes(2);
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^score:idempotency:[a-f0-9]{64}$/),
      "in-flight:race-loser",
      { nx: true, ex: 60 },
    );
  });

  it("reports an existing owner token as in-flight without exposing it", async () => {
    const redis = redisClient({
      get: vi.fn<(key: string) => Promise<unknown>>().mockResolvedValue("in-flight:other-owner"),
    });
    const store = createIdempotencyStore({ environment: "production", env: credentials, redis });

    await expect(store.claim("submission-owned")).resolves.toEqual({ state: "in-flight" });
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("keeps a completed local claim idempotent for 24 hours", async () => {
    let now = 1_000;
    const store = createIdempotencyStore({
      environment: "development",
      logger: { error: vi.fn(), warn: vi.fn() },
      now: () => now,
      ownerTokenFactory: () => "local-owner-2",
    });

    await expect(store.claim("submission-3")).resolves.toEqual({ state: "claimed", ownerToken: "local-owner-2" });
    await store.complete("submission-3", "local-owner-2");
    now += 86_399_000;
    await expect(store.claim("submission-3")).resolves.toEqual({ state: "completed" });
    now += 1_000;
    await expect(store.claim("submission-3")).resolves.toEqual({ state: "claimed", ownerToken: "local-owner-2" });
  });

  it("mirrors owner-token loss and TTL boundaries in the local store", async () => {
    let now = 10_000;
    const ownerTokenFactory = vi.fn<() => string>()
      .mockReturnValueOnce("local-owner-old")
      .mockReturnValueOnce("local-owner-current")
      .mockReturnValueOnce("local-owner-after-complete");
    const logger = { error: vi.fn(), warn: vi.fn() };
    const store = createIdempotencyStore({
      environment: "test",
      logger,
      now: () => now,
      ownerTokenFactory,
    });

    await expect(store.claim("local-submission")).resolves.toEqual({
      state: "claimed",
      ownerToken: "local-owner-old",
    });
    now += 59_999;
    await expect(store.claim("local-submission")).resolves.toEqual({ state: "in-flight" });

    now += 1;
    await expect(store.claim("local-submission")).resolves.toEqual({
      state: "claimed",
      ownerToken: "local-owner-current",
    });
    await expect(store.complete("local-submission", "local-owner-old")).resolves.toBe("ownership-lost");
    await expect(store.release("local-submission", "local-owner-old")).resolves.toBe("ownership-lost");
    await expect(store.claim("local-submission")).resolves.toEqual({ state: "in-flight" });

    await expect(store.complete("local-submission", "local-owner-current")).resolves.toBe("applied");
    now += 86_399_999;
    await expect(store.status("local-submission")).resolves.toEqual({ state: "completed" });
    await expect(store.claim("local-submission")).resolves.toEqual({ state: "completed" });

    now += 1;
    await expect(store.status("local-submission")).resolves.toEqual({ state: "other" });
    await expect(store.claim("local-submission")).resolves.toEqual({
      state: "claimed",
      ownerToken: "local-owner-after-complete",
    });
    expect(logger.warn).toHaveBeenCalledWith("Using non-distributed score idempotency", { backend: "local-memory" });
  });

  it("does not use local memory when production Redis credentials are missing", async () => {
    const logger = { error: vi.fn(), warn: vi.fn() };
    const store = createIdempotencyStore({ environment: "production", env: {}, logger });

    await expect(store.claim("missing-redis")).rejects.toBeInstanceOf(IdempotencyUnavailableError);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("Score idempotency unavailable", {
      backend: "redis",
      error: "MissingCredentials",
    });
  });

  it("completes only the owned Redis claim with a 24-hour expiration", async () => {
    const redis = redisClient();
    const store = createIdempotencyStore({ environment: "production", env: credentials, redis });

    await expect(store.complete("submission-4", "owner-token-b")).resolves.toBe("applied");
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("GET", KEYS[1]) == ARGV[1]'),
      [expect.stringMatching(/^score:idempotency:[a-f0-9]{64}$/)],
      ["in-flight:owner-token-b", "completed", "86400"],
    );
  });

  it("returns ownership-lost when Redis CAS returns 0 and preserves the newer owner", async () => {
    let storedValue = "in-flight:new-owner-token";
    const redis = redisClient({
      get: vi.fn<(key: string) => Promise<unknown>>().mockImplementation(async () => storedValue),
      eval: vi.fn<(script: string, keys: string[], args: string[]) => Promise<unknown>>().mockImplementation(async (_script, _keys, args) => {
        if (storedValue !== args[0]) return 0;
        storedValue = args[1];
        return 1;
      }),
    });
    const store = createIdempotencyStore({ environment: "production", env: credentials, redis });

    await expect(store.complete("submission-stale", "old-owner-token")).resolves.toBe("ownership-lost");
    expect(redis.eval).toHaveBeenCalledWith(expect.any(String), [expect.any(String)], [
      "in-flight:old-owner-token",
      "completed",
      "86400",
    ]);
    await expect(store.claim("submission-stale")).resolves.toEqual({ state: "in-flight" });
    expect(storedValue).toBe("in-flight:new-owner-token");
  });

  it("releases an in-flight claim without releasing a completed claim", async () => {
    let token = 0;
    const store = createIdempotencyStore({
      environment: "test",
      logger: { error: vi.fn(), warn: vi.fn() },
      ownerTokenFactory: () => `local-owner-${++token}`,
    });

    await expect(store.claim("failed-write")).resolves.toEqual({ state: "claimed", ownerToken: "local-owner-1" });
    await store.release("failed-write", "local-owner-1");
    await expect(store.claim("failed-write")).resolves.toEqual({ state: "claimed", ownerToken: "local-owner-2" });

    await expect(store.claim("completed-write")).resolves.toEqual({ state: "claimed", ownerToken: "local-owner-3" });
    await store.complete("completed-write", "local-owner-3");
    await store.release("completed-write", "local-owner-3");
    await expect(store.claim("completed-write")).resolves.toEqual({ state: "completed" });
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
