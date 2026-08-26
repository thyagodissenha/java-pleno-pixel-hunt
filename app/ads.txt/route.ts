import { getAdsensePublisherId } from "@/lib/adsense";

export const dynamic = "force-dynamic";

export function GET() {
  const publisherId = getAdsensePublisherId();
  const body = publisherId
    ? `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`
    : "# Configure GOOGLE_ADSENSE_PUBLISHER_ID=pub-0000000000000000 para ativar o ads.txt.\n";

  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
