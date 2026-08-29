export type HighScore = {
  name: string;
  score: number;
  wave: number;
  resets?: number;
  outcome: "over" | "won";
  createdAt: string;
};

export type PendingScoreEntry = {
  version: 1;
  submissionId: string;
  score: HighScore;
  enqueuedAt: string;
  attempts: number;
  lastAttemptAt: string | null;
};

export type ScoreApiResponse = {
  scores?: HighScore[];
  storage?: "blob" | "local";
  idempotent?: boolean;
};

export const HIGH_SCORE_KEY = "java-pleno-pixel-hunt-high-scores";
export const PENDING_SCORE_KEY = "java-pleno-pixel-hunt-pending-scores";

export function loadHighScores(): HighScore[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(HIGH_SCORE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as HighScore[];
    return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
  } catch {
    return [];
  }
}

export function saveHighScores(scores: HighScore[]) {
  window.localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(scores.slice(0, 10)));
}

export function isHighScore(value: unknown): value is HighScore {
  if (!value || typeof value !== "object") return false;
  const score = value as Partial<HighScore>;
  return typeof score.name === "string"
    && Number.isFinite(score.score)
    && Number.isFinite(score.wave)
    && (score.resets === undefined || Number.isFinite(score.resets))
    && (score.outcome === "over" || score.outcome === "won")
    && typeof score.createdAt === "string";
}

export function isPendingScoreEntry(value: unknown): value is PendingScoreEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<PendingScoreEntry>;
  return entry.version === 1
    && typeof entry.submissionId === "string"
    && entry.submissionId.length > 0
    && isHighScore(entry.score)
    && typeof entry.enqueuedAt === "string"
    && Number.isInteger(entry.attempts)
    && Number(entry.attempts) >= 0
    && (entry.lastAttemptAt === null || typeof entry.lastAttemptAt === "string");
}

export function loadPendingScores(): PendingScoreEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(PENDING_SCORE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return [];
    const unique = new Map<string, PendingScoreEntry>();
    for (const entry of parsed) {
      if (isPendingScoreEntry(entry) && !unique.has(entry.submissionId)) {
        unique.set(entry.submissionId, entry);
      }
    }
    return [...unique.values()];
  } catch {
    return [];
  }
}

export function savePendingScores(entries: PendingScoreEntry[]) {
  window.localStorage.setItem(PENDING_SCORE_KEY, JSON.stringify(entries));
}

export function enqueuePendingScore(entry: PendingScoreEntry) {
  const pending = loadPendingScores();
  if (!pending.some((candidate) => candidate.submissionId === entry.submissionId)) {
    savePendingScores([...pending, entry]);
  }
}

export function removePendingScore(submissionId: string) {
  savePendingScores(loadPendingScores().filter((entry) => entry.submissionId !== submissionId));
}

export function updatePendingScoreAttempt(submissionId: string, attemptedAt: string) {
  savePendingScores(loadPendingScores().map((entry) => entry.submissionId === submissionId
    ? { ...entry, attempts: entry.attempts + 1, lastAttemptAt: attemptedAt }
    : entry));
}

export function isPersistedScoreResponse(payload: ScoreApiResponse) {
  return payload.storage === "blob" || payload.idempotent === true;
}

export async function waitForNextScorePost(previousPostStartedAt: number | null) {
  if (previousPostStartedAt === null) return;
  const remainingDelay = Math.max(0, 10_000 - (Date.now() - previousPostStartedAt));
  if (remainingDelay > 0) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, remainingDelay));
  }
}

export async function postPendingScore(pendingScore: PendingScoreEntry): Promise<ScoreApiResponse> {
  const response = await fetch("/api/scores", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": pendingScore.submissionId,
    },
    body: JSON.stringify(pendingScore.score),
  });
  if (!response.ok) throw new Error("Score sync failed");
  return response.json() as Promise<ScoreApiResponse>;
}

export function scoreIdentity(score: HighScore) {
  return `${score.createdAt}:${score.name}`;
}

export function mergeHighScores(...scoreGroups: HighScore[][]) {
  const uniqueScores = new Map<string, HighScore>();
  for (const score of scoreGroups.flat()) uniqueScores.set(scoreIdentity(score), score);
  return [...uniqueScores.values()]
    .sort((a, b) => b.score - a.score || b.wave - a.wave || (b.resets ?? 0) - (a.resets ?? 0) || a.createdAt.localeCompare(b.createdAt))
    .slice(0, 10);
}
