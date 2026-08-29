import { describe, expect, it, vi } from "vitest";
import {
  AbusePreflightUnavailableError,
  createAbusePreflightStore,
} from "@/lib/score-abuse-preflight";

const credentials = {
  UPSTASH_REDIS_REST_TOKEN: "test-token",
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
};

/**
 * Real Redis is not available in unit tests, so the Lua script's own text is
 * interpreted (not re-implemented) to decide pass/fail. Extracting the actual
 * comparison operator from the script string means a mutation to that
 * operator (e.g. `count < limit` -> `count <= limit`) changes this
 * evaluator's decision too, so the test that asserts a fixed 60-request
 * boundary can fail against it — closing the gap where a hand-rolled JS
 * re-implementation of the quota rule could never disagree with the script.
 */
class FakeRedisKeyStore {
  private readonly data = new Map<string, { value: string; expiresAt: number }>();

  constructor(private readonly now: () => number) {}

  get(key: string): string | null {
    const entry = this.data.get(key);
    if (!entry || this.now() >= entry.expiresAt) return null;
    return entry.value;
  }

  set(key: string, value: string, pxMs: number) {
    this.data.set(key, { value, expiresAt: this.now() + pxMs });
  }

  pttl(key: string): number {
    const entry = this.data.get(key);
    if (!entry) return -2;
    const remaining = entry.expiresAt - this.now();
    return remaining > 0 ? remaining : -2;
  }

  incr(key: string) {
    const entry = this.data.get(key);
    if (!entry) throw new Error("INCR on missing key");
    entry.value = String(Number(entry.value) + 1);
  }

  expiresAt(key: string): number | undefined {
    return this.data.get(key)?.expiresAt;
  }
}

function compareForOperator(operator: string) {
  const comparators: Record<string, (count: number, limit: number) => boolean> = {
    "<": (count, limit) => count < limit,
    "<=": (count, limit) => count <= limit,
    ">": (count, limit) => count > limit,
    ">=": (count, limit) => count >= limit,
    "==": (count, limit) => count === limit,
  };
  const comparator = comparators[operator];
  if (!comparator) throw new Error(`Unsupported score abuse preflight operator: ${operator}`);
  return comparator;
}

function runConsumeScript(script: string, store: FakeRedisKeyStore, keys: string[], args: string[]) {
  const operatorMatch = script.match(/if\s+count\s*(<=|>=|==|<|>)\s*tonumber\(ARGV\[2\]\)\s*then/);
  if (!operatorMatch) throw new Error("Unrecognized score abuse preflight script");
  const compare = compareForOperator(operatorMatch[1]);

  const key = keys[0];
  const ttlMs = Number(args[0]);
  const limit = Number(args[1]);
  const current = store.get(key);
  if (current === null) {
    store.set(key, "1", ttlMs);
    return [1, ttlMs];
  }

  const ttl = store.pttl(key);
  const count = Number(current);
  if (!Number.isFinite(count) || ttl <= 0) throw new Error("invalid score abuse preflight state");

  if (compare(count, limit)) {
    store.incr(key);
    return [1, ttl];
  }
  return [0, ttl];
}

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
    const keyStore = new FakeRedisKeyStore(() => now);
    let lastKey = "";
    const evalMock = vi.fn(async (script: string, keys: string[], args: string[]) => {
      expect(script).toContain('redis.call("PTTL", KEYS[1])');
      expect(script).toContain('redis.call("INCR", KEYS[1])');
      expect(keys[0]).toMatch(/^score:abuse:[a-f0-9]{64}$/);
      expect(keys[0]).not.toContain("203.0.113.20");
      expect(args).toEqual(["60000", "60"]);
      lastKey = keys[0];

      return runConsumeScript(script, keyStore, keys, args);
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
    expect(keyStore.expiresAt(lastKey)).toBe(65_000);
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
