import { afterEach, describe, expect, it, vi } from "vitest";
import { getAdsenseClientId, getAdsensePublisherId } from "@/lib/adsense";

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
