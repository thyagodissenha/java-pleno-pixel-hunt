import { Redis } from "@upstash/redis";
import { hashRateLimitIdentifier } from "@/lib/score-rate-limit";

const PREFLIGHT_LIMIT = 60;
const PREFLIGHT_TTL_MS = 60_000;

export interface AbusePreflightDecision {
  allowed: boolean;
  retryAfterMs: number;
  backend: "redis" | "local-memory";
}

export interface AbusePreflightStore {
  consume(ip: string): Promise<AbusePreflightDecision>;
}

interface RedisAbusePreflightClient {
  eval(script: string, keys: string[], args: string[]): Promise<unknown>;
}

interface AbusePreflightLogger {
  error(message: string, context: { backend: "redis"; error: string }): void;
  warn(message: string, context: { backend: "local-memory" }): void;
}

interface CreateAbusePreflightStoreOptions {
  env?: Record<string, string | undefined>;
  environment?: string;
  logger?: AbusePreflightLogger;
  now?: () => number;
  redis?: RedisAbusePreflightClient;
  redisFactory?: () => RedisAbusePreflightClient;
}

interface LocalWindow {
  count: number;
  expiresAt: number;
}

const CONSUME_SCRIPT = `
local current = redis.call("GET", KEYS[1])
if not current then
  redis.call("SET", KEYS[1], "1", "PX", ARGV[1])
  return {1, tonumber(ARGV[1])}
end

local ttl = redis.call("PTTL", KEYS[1])
local count = tonumber(current)
if not count or ttl <= 0 then
  return redis.error_reply("invalid score abuse preflight state")
end

if count < tonumber(ARGV[2]) then
  redis.call("INCR", KEYS[1])
  return {1, ttl}
end

return {0, ttl}
`;

export class AbusePreflightUnavailableError extends Error {
  constructor() {
    super("Score abuse preflight unavailable");
    this.name = "AbusePreflightUnavailableError";
  }
}

function errorClass(error: unknown) {
  return error instanceof Error ? error.constructor.name : "UnknownError";
}

function unavailableStore(logger: AbusePreflightLogger, reason: string): AbusePreflightStore {
  return {
    async consume() {
      logger.error("Score abuse preflight unavailable", { backend: "redis", error: reason });
      throw new AbusePreflightUnavailableError();
    },
  };
}

function parseRedisDecision(result: unknown): AbusePreflightDecision {
  if (!Array.isArray(result) || result.length !== 2) throw new TypeError("Invalid Redis preflight result");
  const [allowed, retryAfterMs] = result;
  if ((allowed !== 0 && allowed !== 1) || !Number.isInteger(retryAfterMs) || retryAfterMs <= 0) {
    throw new TypeError("Invalid Redis preflight result");
  }
  return { allowed: allowed === 1, retryAfterMs, backend: "redis" };
}

function redisStore(redis: RedisAbusePreflightClient, logger: AbusePreflightLogger): AbusePreflightStore {
  return {
    async consume(ip) {
      try {
        const key = `score:abuse:${hashRateLimitIdentifier(ip)}`;
        const result = await redis.eval(CONSUME_SCRIPT, [key], [String(PREFLIGHT_TTL_MS), String(PREFLIGHT_LIMIT)]);
        return parseRedisDecision(result);
      } catch (error) {
        logger.error("Score abuse preflight unavailable", { backend: "redis", error: errorClass(error) });
        throw new AbusePreflightUnavailableError();
      }
    },
  };
}

function localMemoryStore(now: () => number, logger: AbusePreflightLogger): AbusePreflightStore {
  const windows = new Map<string, LocalWindow>();
  logger.warn("Using non-distributed score abuse preflight", { backend: "local-memory" });

  return {
    async consume(ip) {
      const key = hashRateLimitIdentifier(ip);
      const currentTime = now();
      let window = windows.get(key);
      if (!window || currentTime >= window.expiresAt) {
        window = { count: 1, expiresAt: currentTime + PREFLIGHT_TTL_MS };
        windows.set(key, window);
        return { allowed: true, retryAfterMs: PREFLIGHT_TTL_MS, backend: "local-memory" };
      }

      const retryAfterMs = window.expiresAt - currentTime;
      if (window.count >= PREFLIGHT_LIMIT) {
        return { allowed: false, retryAfterMs, backend: "local-memory" };
      }

      window.count += 1;
      return { allowed: true, retryAfterMs, backend: "local-memory" };
    },
  };
}

export function createAbusePreflightStore(
  options: CreateAbusePreflightStoreOptions = {},
): AbusePreflightStore {
  const environment = options.environment ?? process.env.NODE_ENV;
  const env = options.env ?? process.env;
  const logger = options.logger ?? console;

  if (environment !== "production") {
    return localMemoryStore(options.now ?? Date.now, logger);
  }

  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return unavailableStore(logger, "MissingCredentials");
  }

  try {
    const redis = options.redis ?? (options.redisFactory ?? (() => Redis.fromEnv()))();
    return redisStore(redis, logger);
  } catch (error) {
    return unavailableStore(logger, errorClass(error));
  }
}
