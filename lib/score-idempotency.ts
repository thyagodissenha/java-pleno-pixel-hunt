import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";

const CLAIM_TTL_SECONDS = 60;
const COMPLETED_TTL_SECONDS = 24 * 60 * 60;

export type IdempotencyClaim = "claimed" | "completed" | "in-flight";

export interface IdempotencyStore {
  claim(submissionId: string): Promise<IdempotencyClaim>;
  complete(submissionId: string): Promise<void>;
  release(submissionId: string): Promise<void>;
}

interface RedisIdempotencyClient {
  get(key: string): Promise<unknown>;
  set(key: string, value: string, options: { nx: true; ex: number }): Promise<unknown>;
  eval(script: string, keys: string[], args: string[]): Promise<unknown>;
}

interface IdempotencyLogger {
  error(message: string, context: { backend: "redis"; error: string }): void;
  warn(message: string, context: { backend: "local-memory" }): void;
}

interface CreateIdempotencyStoreOptions {
  env?: Record<string, string | undefined>;
  environment?: string;
  logger?: IdempotencyLogger;
  now?: () => number;
  redis?: RedisIdempotencyClient;
  redisFactory?: () => RedisIdempotencyClient;
}

interface LocalEntry {
  state: "in-flight" | "completed";
  expiresAt: number;
}

const COMPLETE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  redis.call("SET", KEYS[1], ARGV[2], "EX", ARGV[3])
  return 1
end
return 0
`;

const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

export class IdempotencyUnavailableError extends Error {
  constructor() {
    super("Score idempotency unavailable");
    this.name = "IdempotencyUnavailableError";
  }
}

function idempotencyKey(submissionId: string) {
  const identifier = createHash("sha256").update(submissionId).digest("hex");
  return `score:idempotency:${identifier}`;
}

function errorClass(error: unknown) {
  return error instanceof Error ? error.constructor.name : "UnknownError";
}

function unavailableStore(logger: IdempotencyLogger, reason: string): IdempotencyStore {
  const fail = async () => {
    logger.error("Score idempotency unavailable", { backend: "redis", error: reason });
    throw new IdempotencyUnavailableError();
  };

  return { claim: fail, complete: fail, release: fail };
}

function redisStore(redis: RedisIdempotencyClient, logger: IdempotencyLogger): IdempotencyStore {
  const run = async <T>(operation: () => Promise<T>) => {
    try {
      return await operation();
    } catch (error) {
      logger.error("Score idempotency unavailable", { backend: "redis", error: errorClass(error) });
      throw new IdempotencyUnavailableError();
    }
  };

  return {
    claim(submissionId) {
      return run(async () => {
        const key = idempotencyKey(submissionId);
        const current = await redis.get(key);
        if (current === "completed") return "completed";
        if (current === "in-flight") return "in-flight";

        const acquired = await redis.set(key, "in-flight", { nx: true, ex: CLAIM_TTL_SECONDS });
        if (acquired) return "claimed";

        return (await redis.get(key)) === "completed" ? "completed" : "in-flight";
      });
    },
    complete(submissionId) {
      return run(async () => {
        await redis.eval(COMPLETE_SCRIPT, [idempotencyKey(submissionId)], [
          "in-flight",
          "completed",
          String(COMPLETED_TTL_SECONDS),
        ]);
      });
    },
    release(submissionId) {
      return run(async () => {
        await redis.eval(RELEASE_SCRIPT, [idempotencyKey(submissionId)], ["in-flight"]);
      });
    },
  };
}

function localMemoryStore(now: () => number, logger: IdempotencyLogger): IdempotencyStore {
  const entries = new Map<string, LocalEntry>();
  logger.warn("Using non-distributed score idempotency", { backend: "local-memory" });

  function currentEntry(submissionId: string) {
    const entry = entries.get(submissionId);
    if (entry && entry.expiresAt <= now()) {
      entries.delete(submissionId);
      return undefined;
    }
    return entry;
  }

  return {
    async claim(submissionId) {
      const entry = currentEntry(submissionId);
      if (entry?.state === "completed") return "completed";
      if (entry?.state === "in-flight") return "in-flight";

      entries.set(submissionId, { state: "in-flight", expiresAt: now() + CLAIM_TTL_SECONDS * 1_000 });
      return "claimed";
    },
    async complete(submissionId) {
      if (currentEntry(submissionId)?.state === "in-flight") {
        entries.set(submissionId, { state: "completed", expiresAt: now() + COMPLETED_TTL_SECONDS * 1_000 });
      }
    },
    async release(submissionId) {
      if (currentEntry(submissionId)?.state === "in-flight") entries.delete(submissionId);
    },
  };
}

export function createIdempotencyStore(options: CreateIdempotencyStoreOptions = {}): IdempotencyStore {
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
