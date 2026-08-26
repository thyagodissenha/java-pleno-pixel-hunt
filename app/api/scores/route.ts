import { addHighScore, readHighScores, sanitizeScore } from "@/lib/high-scores";

export const dynamic = "force-dynamic";

export async function GET() {
  const scores = await readHighScores();

  return Response.json({ scores });
}

export async function POST(request: Request) {
  try {
    const score = sanitizeScore(await request.json());
    const scores = await addHighScore(score);

    return Response.json({ scores }, { status: 201 });
  } catch {
    return Response.json(
      { error: "Não foi possível salvar o ranking agora." },
      { status: 503 },
    );
  }
}
