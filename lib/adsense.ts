export function getAdsensePublisherId() {
  const rawPublisherId = process.env.GOOGLE_ADSENSE_PUBLISHER_ID?.trim();
  if (!rawPublisherId) return undefined;

  return rawPublisherId.startsWith("ca-") ? rawPublisherId.slice(3) : rawPublisherId;
}

export function getAdsenseClientId() {
  const publisherId = getAdsensePublisherId();
  return publisherId ? `ca-${publisherId}` : undefined;
}
