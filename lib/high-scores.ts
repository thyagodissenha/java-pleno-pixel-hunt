import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { BlobPreconditionFailedError, get, put } from "@vercel/blob";

export type HighScore = {
  name: string;
  score: number;
  wave: number;
  resets?: number;
  outcome: "over" | "won";
  createdAt: string;
};

export type HighScoreStorage = "blob" | "local";

export type StoredHighScore = HighScore & {
  submissionId?: string;
};

export interface ProcessedSubmission {
  submissionId: string;
  persistedAt: string;
}

export interface RankingDocumentV2 {
  version: 2;
  scores: StoredHighScore[];
  processedSubmissions: ProcessedSubmission[];
}

export interface RankingSnapshot {
  document: RankingDocumentV2;
  etag: string | null;
}

export interface LedgerEntryV1 {
  submissionId: string;
  persistedAt: string;
  score?: StoredHighScore;
  source: "cycle-3" | "legacy-v2";
}

export interface LedgerShardV1 {
  version: 1;
  shard: number;
  legacyImported: boolean;
  entries: LedgerEntryV1[];
}

export interface LedgerShardSnapshot {
  document: LedgerShardV1;
  etag: string | null;
}

const SCORE_PATH = "java-pleno-pixel-hunt/high-scores.json";
const LEDGER_PATH_PREFIX = "java-pleno-pixel-hunt/score-ledger";
const LOCAL_SCORE_FILE = path.join(process.cwd(), "data", "high-scores.json");
const PROCESSED_SUBMISSION_TTL_MS = 24 * 60 * 60 * 1_000;
const MAX_BLOB_WRITE_ATTEMPTS = 3;

export function cleanScores(scores: HighScore[]) {
  return scores
    .filter((score) => Number.isFinite(score.score) && Number.isFinite(score.wave))
    .sort((a, b) => b.score - a.score || b.wave - a.wave || (b.resets ?? 0) - (a.resets ?? 0) || a.createdAt.localeCompare(b.createdAt))
    .slice(0, 10);
}

export function sanitizeScore(input: unknown): HighScore {
  const body = input && typeof input === "object" ? input as Partial<HighScore> : {};
  const rawName = typeof body.name === "string" ? body.name : "";
  const name = rawName.trim().replace(/\s+/g, " ").slice(0, 14).toUpperCase() || "DEV ANON";
  const score = Math.max(0, Math.min(999999, Math.floor(Number(body.score) || 0)));
  const wave = Math.max(1, Math.min(99, Math.floor(Number(body.wave) || 1)));
  const resets = Math.max(0, Math.min(99, Math.floor(Number(body.resets) || 0)));
  const outcome = body.outcome === "won" ? "won" : "over";

  return {
    name,
    score,
    wave,
    resets,
    outcome,
    createdAt: new Date().toISOString(),
  };
}

export function sanitizePublicScore(input: unknown): HighScore {
  const sanitized = sanitizeScore(input);
  if (!isRecord(input) || !validDateString(input.createdAt)) return sanitized;
  return { ...sanitized, createdAt: String(input.createdAt) };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object";
}

function validDateString(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function validSubmissionId(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export function ledgerShardIndex(submissionId: string) {
  const digest = createHash("sha256").update(submissionId.trim(), "utf8").digest();
  return digest[0] >>> 2;
}

export function ledgerShardPath(shard: number) {
  if (!Number.isInteger(shard) || shard < 0 || shard > 63) throw new RangeError("Invalid ledger shard");
  return `${LEDGER_PATH_PREFIX}/${String(shard).padStart(2, "0")}.json`;
}

function sanitizeStoredScore(input: unknown): StoredHighScore {
  const sanitized = sanitizeScore(input);

  if (!isRecord(input)) return sanitized;

  const stored: StoredHighScore = {
    ...sanitized,
    createdAt: validDateString(input.createdAt) ? String(input.createdAt) : sanitized.createdAt,
  };

  if (validSubmissionId(input.submissionId)) {
    stored.submissionId = String(input.submissionId);
  }

  return stored;
}

function cleanStoredScores(scores: StoredHighScore[]) {
  return cleanScores(scores).map((entry) => entry as StoredHighScore);
}

function normalizeProcessedSubmissions(input: unknown, now: number): ProcessedSubmission[] {
  if (!Array.isArray(input)) return [];

  return input.flatMap((entry): ProcessedSubmission[] => {
    if (!isRecord(entry) || !validSubmissionId(entry.submissionId) || !validDateString(entry.persistedAt)) {
      return [];
    }

    const persistedAt = String(entry.persistedAt);
    if (now - Date.parse(persistedAt) >= PROCESSED_SUBMISSION_TTL_MS) {
      return [];
    }

    return [{ submissionId: String(entry.submissionId), persistedAt }];
  });
}

function activeLedgerEntry(persistedAt: string, now: number) {
  return now < Date.parse(persistedAt) + PROCESSED_SUBMISSION_TTL_MS;
}

export function decodeLedgerShard(input: unknown, shard: number, now = Date.now()): LedgerShardV1 {
  const empty: LedgerShardV1 = { version: 1, shard, legacyImported: false, entries: [] };
  if (!isRecord(input) || input.version !== 1 || input.shard !== shard) return empty;

  const entries = Array.isArray(input.entries) ? input.entries.flatMap((entry): LedgerEntryV1[] => {
    if (!isRecord(entry) || !validSubmissionId(entry.submissionId) || !validDateString(entry.persistedAt)) return [];
    if (entry.source !== "cycle-3" && entry.source !== "legacy-v2") return [];

    const submissionId = String(entry.submissionId).trim();
    const persistedAt = String(entry.persistedAt);
    if (ledgerShardIndex(submissionId) !== shard || !activeLedgerEntry(persistedAt, now)) return [];

    const decoded: LedgerEntryV1 = { submissionId, persistedAt, source: entry.source };
    if (isRecord(entry.score)) {
      decoded.score = { ...sanitizeStoredScore(entry.score), submissionId };
    }
    return [decoded];
  }) : [];

  return {
    version: 1,
    shard,
    legacyImported: input.legacyImported === true,
    entries,
  };
}

export function decodeRankingDocument(input: unknown, now = Date.now()): RankingDocumentV2 {
  if (Array.isArray(input)) {
    return {
      version: 2,
      scores: cleanStoredScores(input.map(sanitizeStoredScore)),
      processedSubmissions: [],
    };
  }

  if (!isRecord(input) || input.version !== 2) {
    return { version: 2, scores: [], processedSubmissions: [] };
  }

  return {
    version: 2,
    scores: cleanStoredScores(Array.isArray(input.scores) ? input.scores.map(sanitizeStoredScore) : []),
    processedSubmissions: normalizeProcessedSubmissions(input.processedSubmissions, now),
  };
}

export function publicHighScores(document: RankingDocumentV2): HighScore[] {
  return cleanScores(document.scores.map((score) => ({
    name: score.name,
    score: score.score,
    wave: score.wave,
    resets: score.resets,
    outcome: score.outcome,
    createdAt: score.createdAt,
  })));
}

export function hasProcessedSubmission(document: RankingDocumentV2, submissionId: string) {
  return document.processedSubmissions.some((entry) => entry.submissionId === submissionId);
}

export async function readRankingSnapshot(now = Date.now()): Promise<RankingSnapshot> {
  const blob = await get(SCORE_PATH, { access: "private", useCache: false });
  if (!blob) return { document: decodeRankingDocument(null, now), etag: null };

  const content = blob.stream ? await new Response(blob.stream).text() : "null";
  return {
    document: decodeRankingDocument(JSON.parse(content), now),
    etag: blob.blob.etag || null,
  };
}

function importLegacyEntries(document: LedgerShardV1, ranking: RankingDocumentV2): LedgerShardV1 {
  const existingIds = new Set(document.entries.map((entry) => entry.submissionId));
  const scoresById = new Map(
    ranking.scores
      .filter((entry) => validSubmissionId(entry.submissionId))
      .map((entry) => [String(entry.submissionId).trim(), entry]),
  );
  const imported = ranking.processedSubmissions.flatMap((entry): LedgerEntryV1[] => {
    const submissionId = entry.submissionId.trim();
    if (existingIds.has(submissionId) || ledgerShardIndex(submissionId) !== document.shard) return [];
    const score = scoresById.get(submissionId);
    return [{
      submissionId,
      persistedAt: entry.persistedAt,
      ...(score ? { score: { ...score, submissionId } } : {}),
      source: "legacy-v2",
    }];
  });

  return { ...document, legacyImported: true, entries: [...document.entries, ...imported] };
}

export async function readLedgerShard(shard: number, now = Date.now()): Promise<LedgerShardSnapshot> {
  const blob = await get(ledgerShardPath(shard), { access: "private", useCache: false });
  const content = blob?.stream ? await new Response(blob.stream).text() : "null";
  let document = decodeLedgerShard(JSON.parse(content), shard, now);

  if (!document.legacyImported) {
    document = importLegacyEntries(document, (await readRankingSnapshot(now)).document);
  }

  return { document, etag: blob?.blob.etag || null };
}

export async function readLedgerEntry(submissionId: string, now = Date.now()) {
  const normalizedId = submissionId.trim();
  const snapshot = await readLedgerShard(ledgerShardIndex(normalizedId), now);
  return snapshot.document.entries.find((entry) => entry.submissionId === normalizedId);
}

function writeOptions(etag: string | null) {
  return {
    access: "private" as const,
    allowOverwrite: etag !== null,
    cacheControlMaxAge: 0,
    contentType: "application/json",
    ...(etag ? { ifMatch: etag } : {}),
  };
}

export async function persistLedgerIntent(score: HighScore, submissionId: string, now = Date.now()) {
  const normalizedId = submissionId.trim();
  const shard = ledgerShardIndex(normalizedId);
  const persistedAt = new Date(now).toISOString();
  let lastConflict: unknown;

  for (let attempt = 0; attempt < MAX_BLOB_WRITE_ATTEMPTS; attempt += 1) {
    const snapshot = await readLedgerShard(shard, now);
    const existing = snapshot.document.entries.find((entry) => entry.submissionId === normalizedId);
    if (existing) {
      return { entry: existing, idempotent: true };
    }

    const entry: LedgerEntryV1 = {
      submissionId: normalizedId,
      persistedAt,
      score: { ...score, submissionId: normalizedId },
      source: "cycle-3",
    };
    const document: LedgerShardV1 = {
      ...snapshot.document,
      entries: [...snapshot.document.entries, entry],
    };
    const payload = JSON.stringify(document, null, 2);

    try {
      await put(ledgerShardPath(shard), payload, writeOptions(snapshot.etag));
      return { entry, idempotent: false };
    } catch (error) {
      if (!(error instanceof BlobPreconditionFailedError)) throw error;
      lastConflict = error;
    }
  }

  throw lastConflict;
}

function rankingWithEffect(document: RankingDocumentV2, entry: LedgerEntryV1): RankingDocumentV2 {
  if (!entry.score) return document;
  return {
    version: 2,
    scores: cleanStoredScores([entry.score, ...document.scores]),
    processedSubmissions: document.processedSubmissions,
  };
}

export async function ensureRankingEffect(entry: LedgerEntryV1) {
  let lastConflict: unknown;

  for (let attempt = 0; attempt < MAX_BLOB_WRITE_ATTEMPTS; attempt += 1) {
    const snapshot = await readRankingSnapshot();
    if (!entry.score || snapshot.document.scores.some((score) => score.submissionId === entry.submissionId)) {
      return {
        scores: publicHighScores(snapshot.document),
        storage: "blob" as const,
        idempotent: true,
      };
    }

    const document = rankingWithEffect(snapshot.document, entry);
    if (!document.scores.some((score) => score.submissionId === entry.submissionId)) {
      return {
        scores: publicHighScores(document),
        storage: "blob" as const,
        idempotent: false,
      };
    }

    try {
      await put(SCORE_PATH, JSON.stringify(document, null, 2), writeOptions(snapshot.etag));
      return {
        scores: publicHighScores(document),
        storage: "blob" as const,
        idempotent: false,
      };
    } catch (error) {
      if (!(error instanceof BlobPreconditionFailedError)) throw error;
      lastConflict = error;
    }
  }

  throw lastConflict;
}

export async function persistHighScore(score: HighScore, submissionId: string, now = Date.now()) {
  const intent = await persistLedgerIntent(score, submissionId, now);
  const result = await ensureRankingEffect(intent.entry);
  return { ...result, idempotent: intent.idempotent || result.idempotent };
}

export async function readHighScores() {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      return publicHighScores((await readRankingSnapshot()).document);
    } catch {
      return [];
    }
  }

  try {
    const content = await readFile(LOCAL_SCORE_FILE, "utf8");
    return publicHighScores(decodeRankingDocument(JSON.parse(content)));
  } catch {
    return [];
  }
}

export async function addHighScore(score: HighScore) {
  const nextScores = cleanScores([score, ...(await readHighScores())]);
  const payload = JSON.stringify(nextScores, null, 2);

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await put(SCORE_PATH, payload, {
        access: "private",
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 0,
      });
      return { scores: nextScores, storage: "blob" as const };
    } catch {
      return { scores: nextScores, storage: "local" as const };
    }
  }

  if (!process.env.VERCEL) {
    try {
      await writeFile(LOCAL_SCORE_FILE, payload);
    } catch {
      // The browser keeps the fallback copy when local server storage is unavailable.
    }
  }

  return { scores: nextScores, storage: "local" as const };
}
