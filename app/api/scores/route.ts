import {
  cleanScores,
  ensureRankingEffect,
  persistLedgerIntent,
  readHighScores,
  readLedgerEntry,
  sanitizeScore,
} from "@/lib/high-scores";
import { createAbusePreflightStore } from "@/lib/score-abuse-preflight";
import { createIdempotencyStore } from "@/lib/score-idempotency";
import { createRateLimitStore } from "@/lib/score-rate-limit";

export const dynamic = "force-dynamic";

const abusePreflightStore = createAbusePreflightStore();
const rateLimitStore = createRateLimitStore();
const idempotencyStore = createIdempotencyStore();
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function requestIp(request: Request) {
  const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedIp || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function isDebugPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;
  return record.origin === "debug" || record.debug === true;
}

export async function GET() {
  const scores = cleanScores((await readHighScores()).map((score) => sanitizeScore(score)));

  return Response.json({ scores });
}

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json();
    if (isDebugPayload(payload)) {
      return Response.json({ error: "Scores de debug não são aceitos." }, { status: 400 });
    }

    const submissionId = request.headers.get("Idempotency-Key")?.trim();
    if (!submissionId || !IDEMPOTENCY_KEY_PATTERN.test(submissionId)) {
      return Response.json({ error: "Idempotency-Key inválido." }, { status: 400 });
    }

    const ip = requestIp(request);
    const preflight = await abusePreflightStore.consume(ip);
    if (!preflight.allowed) {
      return Response.json(
        { error: "Muitas tentativas. Tente novamente em breve.", retryAfterMs: preflight.retryAfterMs },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(preflight.retryAfterMs / 1_000)) },
        },
      );
    }

    await idempotencyStore.status(submissionId);
    const activeEntry = await readLedgerEntry(submissionId);
    if (activeEntry) {
      const result = await ensureRankingEffect(activeEntry);
      return Response.json({ ...result, idempotent: true });
    }

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

    const claim = await idempotencyStore.claim(submissionId);
    if (claim.state !== "claimed") {
      return Response.json({ error: "Submissão em processamento." }, { status: 409 });
    }

    try {
      let entry = await readLedgerEntry(submissionId);
      let idempotent = true;
      if (!entry) {
        const intent = await persistLedgerIntent(sanitizeScore(payload), submissionId);
        entry = intent.entry;
        idempotent = intent.idempotent;
      }

      const result = await ensureRankingEffect(entry);
      try {
        await idempotencyStore.complete(submissionId, claim.ownerToken);
      } catch {
        // The shard is authoritative after ranking confirmation.
      }

      return Response.json({ ...result, idempotent }, { status: idempotent ? 200 : 201 });
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
