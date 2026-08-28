import { createHash, randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";

const CLAIM_TTL_SECONDS = 60;
const COMPLETED_TTL_SECONDS = 24 * 60 * 60;

export type IdempotencyClaim =
  | { state: "claimed"; ownerToken: string }
  | { state: "completed" }
  | { state: "in-flight" }
  | "claimed"
  | "completed"
  | "in-flight";

export type OwnershipResult = "applied" | "ownership-lost";

export interface IdempotencyStore {
  claim(submissionId: string): Promise<IdempotencyClaim>;
  status(submissionId: string): Promise<{ state: "completed" } | { state: "other" }>;
  complete(submissionId: string, ownerToken?: string): Promise<OwnershipResult>;
  release(submissionId: string, ownerToken?: string): Promise<OwnershipResult>;
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
  ownerTokenFactory?: () => string;
  redis?: RedisIdempotencyClient;
  redisFactory?: () => RedisIdempotencyClient;
}

interface LocalEntry {
  state: "in-flight" | "completed";
  expiresAt: number;
  ownerToken?: string;
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
  const fail = async (): Promise<never> => {
    logger.error("Score idempotency unavailable", { backend: "redis", error: reason });
    throw new IdempotencyUnavailableError();
  };

  return { claim: fail, status: fail, complete: fail, release: fail };
}

function isCompleted(value: unknown) {
  return value === "completed";
}

function isInFlight(value: unknown) {
  return typeof value === "string" && value.startsWith("in-flight:");
}

function ownerValue(ownerToken: string | undefined) {
  return `in-flight:${ownerToken}`;
}

function ownershipResult(value: unknown): OwnershipResult {
  return value === 1 ? "applied" : "ownership-lost";
}

function redisStore(
  redis: RedisIdempotencyClient,
  logger: IdempotencyLogger,
  ownerTokenFactory: () => string,
): IdempotencyStore {
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
        if (isCompleted(current)) return { state: "completed" };
        if (isInFlight(current)) return { state: "in-flight" };

        const ownerToken = ownerTokenFactory();
        const acquired = await redis.set(key, ownerValue(ownerToken), { nx: true, ex: CLAIM_TTL_SECONDS });
        if (acquired) return { state: "claimed", ownerToken };

        return isCompleted(await redis.get(key)) ? { state: "completed" } : { state: "in-flight" };
      });
    },
    status(submissionId) {
      return run(async () => {
        return isCompleted(await redis.get(idempotencyKey(submissionId))) ? { state: "completed" } : { state: "other" };
      });
    },
    complete(submissionId, ownerToken) {
      return run(async () => {
        const result = await redis.eval(COMPLETE_SCRIPT, [idempotencyKey(submissionId)], [
          ownerValue(ownerToken),
          "completed",
          String(COMPLETED_TTL_SECONDS),
        ]);
        return ownershipResult(result);
      });
    },
    release(submissionId, ownerToken) {
      return run(async () => {
        return ownershipResult(await redis.eval(RELEASE_SCRIPT, [idempotencyKey(submissionId)], [ownerValue(ownerToken)]));
      });
    },
  };
}

function localMemoryStore(now: () => number, logger: IdempotencyLogger, ownerTokenFactory: () => string): IdempotencyStore {
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
      if (entry?.state === "completed") return { state: "completed" };
      if (entry?.state === "in-flight") return { state: "in-flight" };

      const ownerToken = ownerTokenFactory();
      entries.set(submissionId, { state: "in-flight", ownerToken, expiresAt: now() + CLAIM_TTL_SECONDS * 1_000 });
      return { state: "claimed", ownerToken };
    },
    async status(submissionId) {
      return currentEntry(submissionId)?.state === "completed" ? { state: "completed" } : { state: "other" };
    },
    async complete(submissionId, ownerToken) {
      const entry = currentEntry(submissionId);
      if (entry?.state === "in-flight" && entry.ownerToken === ownerToken) {
        entries.set(submissionId, { state: "completed", expiresAt: now() + COMPLETED_TTL_SECONDS * 1_000 });
        return "applied";
      }
      return "ownership-lost";
    },
    async release(submissionId, ownerToken) {
      const entry = currentEntry(submissionId);
      if (entry?.state === "in-flight" && entry.ownerToken === ownerToken) {
        entries.delete(submissionId);
        return "applied";
      }
      return "ownership-lost";
    },
  };
}

export function createIdempotencyStore(options: CreateIdempotencyStoreOptions = {}): IdempotencyStore {
  const environment = options.environment ?? process.env.NODE_ENV;
  const env = options.env ?? process.env;
  const logger = options.logger ?? console;
  const ownerTokenFactory = options.ownerTokenFactory ?? randomUUID;

  if (environment !== "production") {
    return localMemoryStore(options.now ?? Date.now, logger, ownerTokenFactory);
  }

  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return unavailableStore(logger, "MissingCredentials");
  }

  try {
    const redis = options.redis ?? (options.redisFactory ?? (() => Redis.fromEnv()))();
    return redisStore(redis, logger, ownerTokenFactory);
  } catch (error) {
    return unavailableStore(logger, errorClass(error));
  }
}
