import { describe, expect, it } from "vitest";
import { parseThemeCookie, serializeThemeCookie } from "@/lib/theme/theme-cookie";

describe("parseThemeCookie", () => {
  it("returns 'classico' when the cookie header has a valid classico value", () => {
    expect(parseThemeCookie("jphud-theme=classico")).toBe("classico");
  });

  it("returns 'neon' when the cookie header has a valid neon value", () => {
    expect(parseThemeCookie("jphud-theme=neon")).toBe("neon");
  });

  it("returns null when the jphud-theme cookie is absent (THEME-16 default fallback)", () => {
    expect(parseThemeCookie("other=1; another=2")).toBeNull();
    expect(parseThemeCookie("")).toBeNull();
  });

  it("returns null for a corrupted/invalid value instead of throwing (THEME-18)", () => {
    expect(parseThemeCookie("jphud-theme=xyz")).toBeNull();
  });

  it("extracts jphud-theme out of a header with multiple cookies", () => {
    expect(parseThemeCookie("a=1; jphud-theme=neon; b=2")).toBe("neon");
  });
});

describe("serializeThemeCookie", () => {
  it("serializes classico with the expected cookie attributes (THEME-15)", () => {
    expect(serializeThemeCookie("classico")).toBe(
      "jphud-theme=classico; path=/; max-age=31536000; samesite=lax",
    );
  });

  it("serializes neon with the expected cookie attributes (THEME-15)", () => {
    expect(serializeThemeCookie("neon")).toBe(
      "jphud-theme=neon; path=/; max-age=31536000; samesite=lax",
    );
  });
});
