import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";

const RATE_LIMIT_TTL_MS = 10_000;
const RATE_LIMIT_TTL_SECONDS = RATE_LIMIT_TTL_MS / 1_000;

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterMs: number;
  backend: "redis" | "local-memory";
}

export interface RateLimitStore {
  acquire(ip: string): Promise<RateLimitDecision>;
}

interface RedisRateLimitClient {
  set(key: string, value: string, options: { nx: true; ex: number }): Promise<unknown>;
}

interface RateLimitLogger {
  error(message: string, context: { backend: "redis"; error: string }): void;
  warn(message: string, context: { backend: "local-memory" }): void;
}

interface CreateRateLimitStoreOptions {
  env?: Record<string, string | undefined>;
  environment?: string;
  logger?: RateLimitLogger;
  now?: () => number;
  redis?: RedisRateLimitClient;
  redisFactory?: () => RedisRateLimitClient;
}

export class RateLimitUnavailableError extends Error {
  constructor() {
    super("Score rate limit unavailable");
    this.name = "RateLimitUnavailableError";
  }
}

export function hashRateLimitIdentifier(ip: string) {
  return createHash("sha256").update(ip).digest("hex");
}

function errorClass(error: unknown) {
  return error instanceof Error ? error.constructor.name : "UnknownError";
}

function unavailableStore(logger: RateLimitLogger, reason: string): RateLimitStore {
  return {
    async acquire() {
      logger.error("Score rate limit unavailable", { backend: "redis", error: reason });
      throw new RateLimitUnavailableError();
    },
  };
}

function redisStore(redis: RedisRateLimitClient, logger: RateLimitLogger): RateLimitStore {
  return {
    async acquire(ip) {
      try {
        const key = `score:rate:${hashRateLimitIdentifier(ip)}`;
        const acquired = await redis.set(key, "1", { nx: true, ex: RATE_LIMIT_TTL_SECONDS });
        return { allowed: Boolean(acquired), backend: "redis", retryAfterMs: RATE_LIMIT_TTL_MS };
      } catch (error) {
        logger.error("Score rate limit unavailable", { backend: "redis", error: errorClass(error) });
        throw new RateLimitUnavailableError();
      }
    },
  };
}

function localMemoryStore(now: () => number, logger: RateLimitLogger): RateLimitStore {
  const expirations = new Map<string, number>();
  logger.warn("Using non-distributed score rate limit", { backend: "local-memory" });

  return {
    async acquire(ip) {
      const key = hashRateLimitIdentifier(ip);
      const currentTime = now();
      const expiresAt = expirations.get(key);
      if (expiresAt !== undefined && expiresAt > currentTime) {
        return { allowed: false, backend: "local-memory", retryAfterMs: expiresAt - currentTime };
      }

      expirations.set(key, currentTime + RATE_LIMIT_TTL_MS);
      return { allowed: true, backend: "local-memory", retryAfterMs: RATE_LIMIT_TTL_MS };
    },
  };
}

export function createRateLimitStore(options: CreateRateLimitStoreOptions = {}): RateLimitStore {
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
