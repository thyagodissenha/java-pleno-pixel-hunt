const DEFAULT_ADSENSE_PUBLISHER_ID = "pub-1628614843401924";

export function getAdsensePublisherId() {
  const rawPublisherId = process.env.GOOGLE_ADSENSE_PUBLISHER_ID?.trim() || DEFAULT_ADSENSE_PUBLISHER_ID;

  return rawPublisherId.startsWith("ca-") ? rawPublisherId.slice(3) : rawPublisherId;
}

export function getAdsenseClientId() {
  const publisherId = getAdsensePublisherId();
  return publisherId ? `ca-${publisherId}` : undefined;
}
