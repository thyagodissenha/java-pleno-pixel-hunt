import {
  cleanScores,
  hasProcessedSubmission,
  persistHighScore,
  publicHighScores,
  readHighScores,
  readRankingSnapshot,
  sanitizeScore,
} from "@/lib/high-scores";
import type { IdempotencyClaim } from "@/lib/score-idempotency";
import { createIdempotencyStore } from "@/lib/score-idempotency";
import { createRateLimitStore } from "@/lib/score-rate-limit";

export const dynamic = "force-dynamic";

const rateLimitStore = createRateLimitStore();
const idempotencyStore = createIdempotencyStore();
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

type RouteClaim =
  | { state: "claimed"; ownerToken: string }
  | { state: "completed" }
  | { state: "in-flight" };

function requestIp(request: Request) {
  const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedIp || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function claimState(claim: IdempotencyClaim): RouteClaim {
  if (typeof claim === "string") {
    if (claim === "claimed") throw new Error("Claim owner token missing");
    return { state: claim };
  }

  return claim;
}

export async function GET() {
  const scores = cleanScores((await readHighScores()).map((score) => sanitizeScore(score)));

  return Response.json({ scores });
}

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json();
    const payloadRecord = payload && typeof payload === "object" ? payload as Record<string, unknown> : undefined;
    if (payloadRecord?.origin === "debug" || payloadRecord?.debug === true) {
      return Response.json({ error: "Scores de debug não são aceitos." }, { status: 400 });
    }

    const submissionId = request.headers.get("Idempotency-Key")?.trim();
    if (!submissionId || !IDEMPOTENCY_KEY_PATTERN.test(submissionId)) {
      return Response.json({ error: "Idempotency-Key inválido." }, { status: 400 });
    }

    if ((await idempotencyStore.status(submissionId)).state === "completed") {
      const scores = cleanScores((await readHighScores()).map((score) => sanitizeScore(score)));
      return Response.json({ scores, storage: "blob", idempotent: true });
    }

    const snapshot = await readRankingSnapshot();
    if (hasProcessedSubmission(snapshot.document, submissionId)) {
      return Response.json({ scores: publicHighScores(snapshot.document), storage: "blob", idempotent: true });
    }

    const ip = requestIp(request);
    const rateLimit = await rateLimitStore.acquire(ip);

    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Aguarde antes de enviar outro score.", retryAfterMs: 10_000 },
        {
          status: 429,
          headers: { "Retry-After": "10" },
        },
      );
    }

    const claim = claimState(await idempotencyStore.claim(submissionId));
    if (claim.state === "completed") {
      const scores = cleanScores((await readHighScores()).map((score) => sanitizeScore(score)));
      return Response.json({ scores, storage: "blob", idempotent: true });
    }
    if (claim.state === "in-flight") {
      return Response.json({ error: "Submissão em processamento." }, { status: 409 });
    }

    try {
      const score = sanitizeScore(payload);
      const result = await persistHighScore(score, submissionId);
      if (result.storage === "blob") {
        try {
          await idempotencyStore.complete(submissionId, claim.ownerToken);
        } catch {
          // Blob is authoritative after confirmation; a retry will dedupe by submissionId.
        }

        return Response.json(result, { status: result.idempotent ? 200 : 201 });
      }

      await idempotencyStore.release(submissionId, claim.ownerToken);
      return Response.json(
        { error: "Não foi possível salvar o ranking agora." },
        { status: 503 },
      );
    } catch (error) {
      await idempotencyStore.release(submissionId, claim.ownerToken);
      throw error;
    }
  } catch {
    return Response.json(
      { error: "Não foi possível salvar o ranking agora." },
      { status: 503 },
    );
  }
}
