import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAdsenseBannerSlotId,
  getAdsenseClientId,
  getAdsensePublisherId,
  getPublicAdsenseClientId,
} from "@/lib/adsense";

describe("AdSense identifiers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("removes the ca- prefix from the publisher ID", () => {
    vi.stubEnv("GOOGLE_ADSENSE_PUBLISHER_ID", "ca-pub-1234567890");

    expect(getAdsensePublisherId()).toBe("pub-1234567890");
    expect(getAdsenseClientId()).toBe("ca-pub-1234567890");
  });

  it("preserves a publisher ID that starts with pub-", () => {
    vi.stubEnv("GOOGLE_ADSENSE_PUBLISHER_ID", "pub-9876543210");

    expect(getAdsensePublisherId()).toBe("pub-9876543210");
    expect(getAdsenseClientId()).toBe("ca-pub-9876543210");
  });

  it("returns without throwing when the environment variable is absent", () => {
    vi.stubEnv("GOOGLE_ADSENSE_PUBLISHER_ID", undefined);

    expect(() => getAdsensePublisherId()).not.toThrow();
    expect(() => getAdsenseClientId()).not.toThrow();
  });
});

describe("AdSense banner (public, client-safe)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the public client ID when configured", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT_ID", "ca-pub-1234567890");

    expect(getPublicAdsenseClientId()).toBe("ca-pub-1234567890");
  });

  it("returns undefined when the public client ID is absent", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT_ID", undefined);

    expect(getPublicAdsenseClientId()).toBeUndefined();
  });

  it("returns the banner slot ID when configured", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADSENSE_BANNER_SLOT", "1122334455");

    expect(getAdsenseBannerSlotId()).toBe("1122334455");
  });

  it("returns undefined when the banner slot ID is absent", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADSENSE_BANNER_SLOT", undefined);

    expect(getAdsenseBannerSlotId()).toBeUndefined();
  });

  it("returns undefined for blank/whitespace-only values", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT_ID", "   ");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADSENSE_BANNER_SLOT", "   ");

    expect(getPublicAdsenseClientId()).toBeUndefined();
    expect(getAdsenseBannerSlotId()).toBeUndefined();
  });
});
