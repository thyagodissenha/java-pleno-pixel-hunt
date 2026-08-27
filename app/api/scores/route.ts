import { addHighScore, readHighScores, sanitizeScore } from "@/lib/high-scores";

export const dynamic = "force-dynamic";

const SCORE_SUBMISSION_INTERVAL_MS = 10_000;
const submissionTimes = new Map<string, number>();

function requestIp(request: Request) {
  const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedIp || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function GET() {
  const scores = await readHighScores();

  return Response.json({ scores });
}

export async function POST(request: Request) {
  try {
    const score = sanitizeScore(await request.json());
    const ip = requestIp(request);
    const now = Date.now();
    const lastSubmission = submissionTimes.get(ip);

    if (lastSubmission !== undefined && now - lastSubmission < SCORE_SUBMISSION_INTERVAL_MS) {
      const retryAfterMs = SCORE_SUBMISSION_INTERVAL_MS - (now - lastSubmission);
      return Response.json(
        { error: "Aguarde antes de enviar outro score.", retryAfterMs },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
        },
      );
    }

    submissionTimes.set(ip, now);
    const result = await addHighScore(score);

    return Response.json(result, { status: result.storage === "blob" ? 201 : 200 });
  } catch {
    return Response.json(
      { error: "Não foi possível salvar o ranking agora." },
      { status: 503 },
    );
  }
}
