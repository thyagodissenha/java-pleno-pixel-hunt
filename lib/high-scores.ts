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

const SCORE_PATH = "java-pleno-pixel-hunt/high-scores.json";
const LOCAL_SCORE_FILE = path.join(process.cwd(), "data", "high-scores.json");

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

export async function readHighScores() {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const blob = await get(SCORE_PATH, { access: "private" });
      if (!blob) return [];
      const content = await new Response(blob.stream).text();
      return cleanScores(JSON.parse(content) as HighScore[]);
    } catch {
      return [];
    }
  }

  try {
    const content = await readFile(LOCAL_SCORE_FILE, "utf8");
    return cleanScores(JSON.parse(content) as HighScore[]);
  } catch {
    return [];
  }
}

export async function addHighScore(score: HighScore) {
  const nextScores = cleanScores([score, ...(await readHighScores())]);
  const payload = JSON.stringify(nextScores, null, 2);

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    await put(SCORE_PATH, payload, {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    });
  } else if (process.env.VERCEL) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required in production");
  } else {
    await writeFile(LOCAL_SCORE_FILE, payload);
  }

  return nextScores;
}
