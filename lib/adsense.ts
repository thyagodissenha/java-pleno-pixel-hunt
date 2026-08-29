const DEFAULT_ADSENSE_PUBLISHER_ID = "pub-1628614843401924";

export function getAdsensePublisherId() {
  const rawPublisherId = process.env.GOOGLE_ADSENSE_PUBLISHER_ID?.trim() || DEFAULT_ADSENSE_PUBLISHER_ID;

  return rawPublisherId.startsWith("ca-") ? rawPublisherId.slice(3) : rawPublisherId;
}

export function getAdsenseClientId() {
  const publisherId = getAdsensePublisherId();
  return publisherId ? `ca-${publisherId}` : undefined;
}

export function getPublicAdsenseClientId() {
  const raw = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT_ID?.trim();
  return raw || undefined;
}

export function getAdsenseBannerSlotId() {
  const raw = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_BANNER_SLOT?.trim();
  return raw || undefined;
}
