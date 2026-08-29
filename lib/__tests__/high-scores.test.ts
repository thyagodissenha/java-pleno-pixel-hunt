import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanScores,
  decodeLedgerShard,
  decodeRankingDocument,
  ensureRankingEffect,
  ledgerShardIndex,
  ledgerShardPath,
  persistHighScore,
  persistLedgerIntent,
  publicHighScores,
  readHighScores,
  readLedgerEntry,
  readLedgerShard,
  readRankingSnapshot,
  sanitizeScore,
  type HighScore,
} from "@/lib/high-scores";

const blobGet = vi.hoisted(() => vi.fn());
const blobPut = vi.hoisted(() => vi.fn());
const BlobPreconditionFailedError = vi.hoisted(() => class BlobPreconditionFailedError extends Error {});

vi.mock("@vercel/blob", () => ({
  BlobPreconditionFailedError,
  get: blobGet,
  put: blobPut,
}));

const score = (overrides: Partial<HighScore>): HighScore => ({
  name: "DEV",
  score: 100,
  wave: 1,
  resets: 0,
  outcome: "over",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

function blobStream(payload: unknown) {
  const text = JSON.stringify(payload);
  const stream = new Response(text).body;
  if (!stream) throw new Error("Missing test response body");

  return stream;
}

function blobSnapshot(payload: unknown, etag: string) {
  return {
    stream: blobStream(payload),
    blob: { etag },
  };
}

describe("sanitizeScore", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("normalizes whitespace, truncates names, and converts them to uppercase", () => {
    const result = sanitizeScore({ name: "  java   pleno developer  " });

    expect(result.name).toBe("JAVA PLENO DEV");
  });

  it("returns the specified fallback score for an invalid payload", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T12:00:00.000Z"));

    expect(sanitizeScore(null)).toEqual({
      name: "DEV ANON",
      score: 0,
      wave: 1,
      resets: 0,
      outcome: "over",
      createdAt: "2026-08-27T12:00:00.000Z",
    });
  });

  it("clamps score, wave, and resets to their upper limits", () => {
    const result = sanitizeScore({ score: 1_000_000, wave: 100, resets: 100 });

    expect(result.score).toBe(999_999);
    expect(result.wave).toBe(99);
    expect(result.resets).toBe(99);
  });

  it("clamps score, wave, and resets to their lower limits", () => {
    const result = sanitizeScore({ score: -1, wave: -1, resets: -1 });

    expect(result.score).toBe(0);
    expect(result.wave).toBe(1);
    expect(result.resets).toBe(0);
  });
});

describe("cleanScores", () => {
  it("sorts by descending score and wave, then ascending creation date", () => {
    const latest = score({ name: "LATEST", score: 200, wave: 3, createdAt: "2026-01-03T00:00:00.000Z" });
    const highestWave = score({ name: "WAVE", score: 200, wave: 4, createdAt: "2026-01-02T00:00:00.000Z" });
    const earliest = score({ name: "EARLIEST", score: 200, wave: 3, createdAt: "2026-01-01T00:00:00.000Z" });
    const lowestScore = score({ name: "LOWEST", score: 100, wave: 99 });

    expect(cleanScores([latest, lowestScore, earliest, highestWave])).toEqual([
      highestWave,
      earliest,
      latest,
      lowestScore,
    ]);
  });
});

describe("ranking document codec", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    blobGet.mockReset();
    blobPut.mockReset();
  });

  it("keeps legacy arrays compatible with sanitized and sorted public scores", () => {
    const latest = score({ name: "LATEST", score: 200, wave: 3, createdAt: "2026-01-03T00:00:00.000Z" });
    const highestWave = score({ name: "WAVE", score: 200, wave: 4, createdAt: "2026-01-02T00:00:00.000Z" });
    const malformed = { name: "  legacy   name  ", score: "50", wave: "2", outcome: "won", createdAt: "2026-01-04T00:00:00.000Z" };

    const document = decodeRankingDocument([latest, malformed, highestWave], Date.parse("2026-08-28T12:00:00.000Z"));

    expect(document.version).toBe(2);
    expect(document.processedSubmissions).toEqual([]);
    expect(publicHighScores(document)).toEqual([
      highestWave,
      latest,
      {
        name: "LEGACY NAME",
        score: 50,
        wave: 2,
        resets: 0,
        outcome: "won",
        createdAt: "2026-01-04T00:00:00.000Z",
      },
    ]);
  });

  it("preserves v2 submission ids and ledger internally while public scores expose no metadata", () => {
    const stored = { ...score({ name: "OWNER", score: 500 }), submissionId: "submission-owner" };
    const document = decodeRankingDocument({
      version: 2,
      scores: [stored],
      processedSubmissions: [{ submissionId: "submission-owner", persistedAt: "2026-08-28T10:00:00.000Z" }],
    }, Date.parse("2026-08-28T12:00:00.000Z"));

    expect(document.scores[0]).toMatchObject({ submissionId: "submission-owner", name: "OWNER" });
    expect(document.processedSubmissions).toEqual([
      { submissionId: "submission-owner", persistedAt: "2026-08-28T10:00:00.000Z" },
    ]);
    expect(publicHighScores(document)).toEqual([score({ name: "OWNER", score: 500 })]);
    expect(publicHighScores(document)[0]).not.toHaveProperty("submissionId");
    expect(JSON.stringify(publicHighScores(document))).not.toContain("processedSubmissions");
  });

  it("prunes ledger entries older than 24 hours and keeps ids whose scores miss the top ten", () => {
    const scores = Array.from({ length: 11 }, (_, index) => ({
      ...score({
        name: `SCORE ${index}`,
        score: 1_000 - index,
        createdAt: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      }),
      submissionId: `submission-${index}`,
    }));

    const document = decodeRankingDocument({
      version: 2,
      scores,
      processedSubmissions: [
        { submissionId: "submission-10", persistedAt: "2026-08-27T12:00:01.000Z" },
        { submissionId: "expired-submission", persistedAt: "2026-08-27T11:59:59.000Z" },
      ],
    }, Date.parse("2026-08-28T12:00:00.000Z"));

    expect(document.scores).toHaveLength(10);
    expect(document.scores.some((entry) => entry.submissionId === "submission-10")).toBe(false);
    expect(document.processedSubmissions).toEqual([
      { submissionId: "submission-10", persistedAt: "2026-08-27T12:00:01.000Z" },
    ]);
  });

  it("treats null and malformed metadata as an empty v2 document without inventing ids", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-28T12:00:00.000Z"));

    expect(decodeRankingDocument(null).processedSubmissions).toEqual([]);

    const document = decodeRankingDocument({
      version: 2,
      scores: [{ name: "  malformed  ", score: 10, wave: 2, submissionId: "" }],
      processedSubmissions: [
        { submissionId: 123, persistedAt: "2026-08-28T12:00:00.000Z" },
        { submissionId: "bad-date", persistedAt: "not-a-date" },
      ],
    });

    expect(document.scores[0]).not.toHaveProperty("submissionId");
    expect(document.processedSubmissions).toEqual([]);
    expect(publicHighScores(document)).toEqual([
      {
        name: "MALFORMED",
        score: 10,
        wave: 2,
        resets: 0,
        outcome: "over",
        createdAt: "2026-08-28T12:00:00.000Z",
      },
    ]);
  });

  it("reads v2 blob data as public high scores without leaking the ledger", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "blob-token");
    const blobPayload = JSON.stringify({
      version: 2,
      scores: [{ ...score({ name: "BLOB", score: 300 }), submissionId: "blob-submission" }],
      processedSubmissions: [{ submissionId: "blob-submission", persistedAt: "2026-08-28T10:00:00.000Z" }],
    });
    blobGet.mockResolvedValue({
      stream: new Response(blobPayload).body,
      blob: { etag: "blob-etag" },
    });

    const scores = await readHighScores();

    expect(scores).toEqual([score({ name: "BLOB", score: 300 })]);
    expect(scores[0]).not.toHaveProperty("submissionId");
    expect(JSON.stringify(scores)).not.toContain("blob-submission");
  });
});

describe("partitioned authoritative ledger", () => {
  afterEach(() => {
    blobGet.mockReset();
    blobPut.mockReset();
  });

  it("selects all 64 shards from fixed SHA-256 UTF-8 vectors after trimming only", () => {
    expect(ledgerShardIndex("submission-1")).toBe(39);
    expect(ledgerShardIndex("  submission-1  ")).toBe(39);
    expect(ledgerShardIndex("áé漢字")).toBe(8);
    expect(ledgerShardIndex("CASE")).toBe(52);
    expect(ledgerShardIndex("case")).toBe(46);
    expect(ledgerShardIndex("vector-49")).toBe(0);
    expect(ledgerShardIndex("vector-68")).toBe(63);
  });

  it("uses stable two-digit decimal paths for the shard bounds", () => {
    expect(ledgerShardPath(0)).toBe("java-pleno-pixel-hunt/score-ledger/00.json");
    expect(ledgerShardPath(63)).toBe("java-pleno-pixel-hunt/score-ledger/63.json");
  });

  it("decodes the shard model without inventing a legacy score", () => {
    const document = decodeLedgerShard({
      version: 1,
      shard: 39,
      legacyImported: true,
      entries: [
        {
          submissionId: "submission-1",
          persistedAt: "2026-08-28T10:00:00.000Z",
          source: "legacy-v2",
        },
      ],
    }, 39, Date.parse("2026-08-28T12:00:00.000Z"));

    expect(document).toEqual({
      version: 1,
      shard: 39,
      legacyImported: true,
      entries: [
        {
          submissionId: "submission-1",
          persistedAt: "2026-08-28T10:00:00.000Z",
          source: "legacy-v2",
        },
      ],
    });
    expect(document.entries[0]).not.toHaveProperty("score");
  });

  it("looks up an id in exactly its selected shard without scanning others", async () => {
    blobGet.mockResolvedValue(blobSnapshot({
      version: 1,
      shard: 39,
      legacyImported: true,
      entries: [{
        submissionId: "submission-1",
        persistedAt: "2026-08-28T10:00:00.000Z",
        score: { ...score({ name: "SHARDED" }), submissionId: "submission-1" },
        source: "cycle-3",
      }],
    }, "etag-shard"));

    await expect(readLedgerEntry("submission-1", Date.parse("2026-08-28T12:00:00.000Z"))).resolves.toMatchObject({
      submissionId: "submission-1",
      source: "cycle-3",
      score: { name: "SHARDED", submissionId: "submission-1" },
    });
    expect(blobGet).toHaveBeenCalledTimes(1);
    expect(blobGet).toHaveBeenCalledWith("java-pleno-pixel-hunt/score-ledger/39.json", {
      access: "private",
      useCache: false,
    });
  });

  it("imports only active legacy v2 ids that belong to the opened shard", async () => {
    blobGet.mockImplementation(async (pathname: string) => {
      if (pathname.endsWith("score-ledger/39.json")) return null;
      if (pathname.endsWith("high-scores.json")) {
        return blobSnapshot({
          version: 2,
          scores: [
            { ...score({ name: "IMPORTED" }), submissionId: "submission-1" },
            { ...score({ name: "OTHER" }), submissionId: "case" },
          ],
          processedSubmissions: [
            { submissionId: "submission-1", persistedAt: "2026-08-28T10:00:00.000Z" },
            { submissionId: "case", persistedAt: "2026-08-28T10:00:00.000Z" },
            { submissionId: "shard39-6", persistedAt: "2026-08-28T11:00:00.000Z" },
            { submissionId: "shard39-16", persistedAt: "2026-08-27T11:59:59.000Z" },
          ],
        }, "etag-ranking");
      }
      throw new Error(`Unexpected Blob path: ${pathname}`);
    });

    const snapshot = await readLedgerShard(39, Date.parse("2026-08-28T12:00:00.000Z"));

    expect(snapshot.etag).toBeNull();
    expect(snapshot.document.legacyImported).toBe(true);
    expect(snapshot.document.entries).toEqual([
      {
        submissionId: "submission-1",
        persistedAt: "2026-08-28T10:00:00.000Z",
        score: { ...score({ name: "IMPORTED" }), submissionId: "submission-1" },
        source: "legacy-v2",
      },
      {
        submissionId: "shard39-6",
        persistedAt: "2026-08-28T11:00:00.000Z",
        source: "legacy-v2",
      },
    ]);
    expect(snapshot.document.entries[1]).not.toHaveProperty("score");
    expect(blobGet.mock.calls.map(([pathname]) => pathname)).toEqual([
      "java-pleno-pixel-hunt/score-ledger/39.json",
      "java-pleno-pixel-hunt/high-scores.json",
    ]);
    expect(JSON.stringify(publicHighScores((await readRankingSnapshot()).document))).not.toContain("submission-1");
  });
});

describe("authoritative blob persistence", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    blobGet.mockReset();
    blobPut.mockReset();
  });

  it("reads ranking snapshots without cache and writes with the same ETag", async () => {
    blobGet.mockResolvedValue(blobSnapshot({
      version: 2,
      scores: [score({ name: "OLD", score: 100 })],
      processedSubmissions: [],
    }, "etag-1"));
    blobPut.mockResolvedValue({ etag: "etag-2" });

    const result = await ensureRankingEffect({
      submissionId: "submission-new",
      persistedAt: "2026-08-28T12:00:00.000Z",
      score: { ...score({ name: "NEW", score: 200 }), submissionId: "submission-new" },
      source: "cycle-3",
    });

    expect(blobGet).toHaveBeenCalledWith("java-pleno-pixel-hunt/high-scores.json", {
      access: "private",
      useCache: false,
    });
    expect(blobPut).toHaveBeenCalledWith(
      "java-pleno-pixel-hunt/high-scores.json",
      expect.stringContaining('"submissionId": "submission-new"'),
      {
        access: "private",
        allowOverwrite: true,
        cacheControlMaxAge: 0,
        contentType: "application/json",
        ifMatch: "etag-1",
      },
    );
    expect(result).toEqual({
      scores: [score({ name: "NEW", score: 200 }), score({ name: "OLD", score: 100 })],
      storage: "blob",
      idempotent: false,
    });
  });

  it("creates an absent shard without overwrite", async () => {
    blobGet.mockResolvedValue(null);
    blobPut.mockResolvedValue({ etag: "created" });

    await expect(persistLedgerIntent(score({ name: "FIRST" }), "first-id", Date.parse("2026-08-28T12:00:00.000Z"))).resolves.toMatchObject({
      idempotent: false,
    });
    expect(blobPut).toHaveBeenCalledWith(
      ledgerShardPath(ledgerShardIndex("first-id")),
      expect.stringContaining('"submissionId": "first-id"'),
      expect.objectContaining({ allowOverwrite: false }),
    );
  });

  it("returns idempotent success without writing when the same submission id is already in the ledger", async () => {
    blobGet.mockResolvedValue(blobSnapshot({
      version: 1,
      shard: ledgerShardIndex("same-id"),
      legacyImported: true,
      entries: [{
        submissionId: "same-id",
        persistedAt: "2026-08-28T10:00:00.000Z",
        score: { ...score({ name: "DONE", score: 500 }), submissionId: "same-id" },
        source: "cycle-3",
      }],
    }, "etag-done"));

    const result = await persistLedgerIntent(score({ name: "DUP", score: 999 }), "same-id", Date.parse("2026-08-28T12:00:00.000Z"));

    expect(result.idempotent).toBe(true);
    expect(result.entry).toMatchObject({ submissionId: "same-id", persistedAt: "2026-08-28T10:00:00.000Z" });
    expect(blobPut).not.toHaveBeenCalled();
  });

  it("retries shard conflicts with a fresh ETag and preserves distinct ids while cleaning expired entries", async () => {
    blobGet
      .mockResolvedValueOnce(blobSnapshot({ version: 1, shard: 39, legacyImported: true, entries: [] }, "etag-1"))
      .mockResolvedValueOnce(blobSnapshot({
        version: 1,
        shard: 39,
        legacyImported: true,
        entries: [
          { submissionId: "shard39-6", persistedAt: "2026-08-28T11:59:00.000Z", source: "cycle-3" },
          { submissionId: "shard39-36", persistedAt: "2026-08-27T11:59:59.000Z", source: "cycle-3" },
        ],
      }, "etag-2"));
    blobPut
      .mockRejectedValueOnce(new BlobPreconditionFailedError())
      .mockResolvedValueOnce({ etag: "etag-merged" });

    await expect(persistLedgerIntent(score({ name: "MINE", score: 400 }), "shard39-16", Date.parse("2026-08-28T12:00:00.000Z"))).resolves.toMatchObject({
      idempotent: false,
    });

    const merged = JSON.parse(blobPut.mock.calls[1][1]);
    expect(merged.entries.map((entry: { submissionId: string }) => entry.submissionId)).toEqual(["shard39-6", "shard39-16"]);
    expect(blobPut.mock.calls[0][2]).toMatchObject({ ifMatch: "etag-1" });
    expect(blobPut.mock.calls[1][2]).toMatchObject({ ifMatch: "etag-2" });
    expect(blobPut).toHaveBeenCalledTimes(2);
  });

  it("fails after three shard conflicts without touching the ranking or declaring persistence", async () => {
    const shard = ledgerShardIndex("limited-id");
    blobGet.mockImplementation(async () => blobSnapshot({ version: 1, shard, legacyImported: true, entries: [] }, "etag-conflict"));
    blobPut.mockRejectedValue(new BlobPreconditionFailedError());

    await expect(persistHighScore(score({ name: "LIMIT" }), "limited-id", Date.parse("2026-08-28T12:00:00.000Z"))).rejects.toBeInstanceOf(BlobPreconditionFailedError);
    expect(blobGet).toHaveBeenCalledTimes(3);
    expect(blobPut).toHaveBeenCalledTimes(3);
    expect(blobGet.mock.calls.every(([pathname]) => pathname === ledgerShardPath(shard))).toBe(true);
    expect(blobPut.mock.calls.every(([pathname]) => pathname === ledgerShardPath(shard))).toBe(true);
  });

  it("treats an entry as active only before the exact 24-hour boundary", () => {
    const input = {
      version: 1,
      shard: 39,
      legacyImported: true,
      entries: [{ submissionId: "submission-1", persistedAt: "2026-08-27T12:00:00.000Z", source: "cycle-3" }],
    };

    expect(decodeLedgerShard(input, 39, Date.parse("2026-08-28T11:59:59.999Z")).entries).toHaveLength(1);
    expect(decodeLedgerShard(input, 39, Date.parse("2026-08-28T12:00:00.000Z")).entries).toHaveLength(0);
  });

  it("resolves a same-id shard race without a second occurrence", async () => {
    const persistedAt = "2026-08-28T12:00:00.000Z";
    blobGet
      .mockResolvedValueOnce(blobSnapshot({ version: 1, shard: 39, legacyImported: true, entries: [] }, "etag-1"))
      .mockResolvedValueOnce(blobSnapshot({
        version: 1,
        shard: 39,
        legacyImported: true,
        entries: [{ submissionId: "submission-1", persistedAt, source: "cycle-3" }],
      }, "etag-2"));
    blobPut.mockRejectedValueOnce(new BlobPreconditionFailedError());

    const result = await persistLedgerIntent(score({ name: "RACE" }), "submission-1", Date.parse(persistedAt));

    expect(result).toMatchObject({ idempotent: true, entry: { submissionId: "submission-1", persistedAt } });
    expect(blobPut).toHaveBeenCalledTimes(1);
  });

  it("retries ranking conflicts with the ETag from the fresh ranking read", async () => {
    const entry = {
      submissionId: "ranking-id",
      persistedAt: "2026-08-28T12:00:00.000Z",
      score: { ...score({ name: "RANKING" }), submissionId: "ranking-id" },
      source: "cycle-3" as const,
    };
    blobGet
      .mockResolvedValueOnce(blobSnapshot({ version: 2, scores: [], processedSubmissions: [] }, "etag-1"))
      .mockResolvedValueOnce(blobSnapshot({ version: 2, scores: [], processedSubmissions: [] }, "etag-2"));
    blobPut.mockRejectedValueOnce(new BlobPreconditionFailedError()).mockResolvedValueOnce({ etag: "etag-3" });

    await expect(ensureRankingEffect(entry)).resolves.toMatchObject({ storage: "blob", idempotent: false });
    expect(blobPut.mock.calls[0][2]).toMatchObject({ ifMatch: "etag-1" });
    expect(blobPut.mock.calls[1][2]).toMatchObject({ ifMatch: "etag-2" });
  });

  it("keeps a confirmed shard intention when ranking fails and repairs it on retry", async () => {
    const submissionId = "partial-id";
    const shard = ledgerShardIndex(submissionId);
    let shardPayload: unknown = { version: 1, shard, legacyImported: true, entries: [] };
    let rankingPayload: unknown = { version: 2, scores: [], processedSubmissions: [] };
    let rankingWrites = 0;
    blobGet.mockImplementation(async (pathname: string) => {
      if (pathname === ledgerShardPath(shard)) return blobSnapshot(shardPayload, "etag-shard");
      if (pathname === "java-pleno-pixel-hunt/high-scores.json") return blobSnapshot(rankingPayload, "etag-ranking");
      throw new Error(`Unexpected Blob path: ${pathname}`);
    });
    blobPut.mockImplementation(async (pathname: string, payload: string) => {
      if (pathname === ledgerShardPath(shard)) {
        shardPayload = JSON.parse(payload);
        return { etag: "etag-shard-next" };
      }
      rankingWrites += 1;
      if (rankingWrites === 1) throw new TypeError("ranking unavailable");
      rankingPayload = JSON.parse(payload);
      return { etag: "etag-ranking-next" };
    });

    await expect(persistHighScore(score({ name: "RECOVER" }), submissionId, Date.parse("2026-08-28T12:00:00.000Z"))).rejects.toThrow("ranking unavailable");
    expect(JSON.stringify(shardPayload)).toContain(submissionId);
    await expect(persistHighScore(score({ name: "RECOVER" }), submissionId, Date.parse("2026-08-28T12:00:00.000Z"))).resolves.toMatchObject({
      storage: "blob",
      idempotent: true,
    });
    expect((rankingPayload as { scores: unknown[] }).scores).toHaveLength(1);
    expect(blobPut.mock.calls.map(([pathname]) => pathname)).toEqual([
      ledgerShardPath(shard),
      "java-pleno-pixel-hunt/high-scores.json",
      "java-pleno-pixel-hunt/high-scores.json",
    ]);
  });

  it("returns snapshot ETags from the authoritative blob document", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "blob-token");
    blobGet.mockResolvedValue(blobSnapshot({
      version: 2,
      scores: [{ ...score({ name: "SNAPSHOT" }), submissionId: "snapshot-id" }],
      processedSubmissions: [{ submissionId: "snapshot-id", persistedAt: "2026-08-28T10:00:00.000Z" }],
    }, "etag-snapshot"));

    await expect(readRankingSnapshot()).resolves.toMatchObject({
      etag: "etag-snapshot",
      document: {
        processedSubmissions: [{ submissionId: "snapshot-id", persistedAt: "2026-08-28T10:00:00.000Z" }],
      },
    });
  });
});
