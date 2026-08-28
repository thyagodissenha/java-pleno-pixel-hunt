import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";

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

const SCORE_PATH = "java-pleno-pixel-hunt/high-scores.json";
const LOCAL_SCORE_FILE = path.join(process.cwd(), "data", "high-scores.json");
const PROCESSED_SUBMISSION_TTL_MS = 24 * 60 * 60 * 1_000;

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

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object";
}

function validDateString(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function validSubmissionId(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function sanitizeStoredScore(input: unknown): StoredHighScore {
  const sanitized = sanitizeScore(input);

  if (!isRecord(input)) return sanitized;

  const stored: StoredHighScore = {
    ...sanitized,
    createdAt: validDateString(input.createdAt) ? input.createdAt : sanitized.createdAt,
  };

  if (validSubmissionId(input.submissionId)) {
    stored.submissionId = input.submissionId;
  }

  return stored;
}

function cleanStoredScores(scores: StoredHighScore[]) {
  return cleanScores(scores).map((entry) => entry as StoredHighScore);
}

function normalizeProcessedSubmissions(input: unknown, now: number): ProcessedSubmission[] {
  if (!Array.isArray(input)) return [];

  return input.filter((entry): entry is ProcessedSubmission => {
    if (!isRecord(entry) || !validSubmissionId(entry.submissionId) || !validDateString(entry.persistedAt)) {
      return false;
    }

    return now - Date.parse(entry.persistedAt) < PROCESSED_SUBMISSION_TTL_MS;
  }).map((entry) => ({
    submissionId: entry.submissionId,
    persistedAt: entry.persistedAt,
  }));
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
  return cleanScores(document.scores.map(({ submissionId: _submissionId, ...score }) => score));
}

export async function readHighScores() {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const blob = await get(SCORE_PATH, { access: "private" });
      if (!blob) return [];
      const content = await new Response(blob.stream).text();
      return publicHighScores(decodeRankingDocument(JSON.parse(content)));
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
