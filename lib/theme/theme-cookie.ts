export type ThemeId = "classico" | "neon";

const COOKIE_NAME = "jphud-theme";
const VALID_THEMES: ReadonlySet<string> = new Set<ThemeId>(["classico", "neon"]);
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function parseThemeCookie(cookieHeader: string): ThemeId | null {
  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) continue;
    const name = part.slice(0, separatorIndex).trim();
    if (name !== COOKIE_NAME) continue;
    const value = part.slice(separatorIndex + 1).trim();
    return VALID_THEMES.has(value) ? (value as ThemeId) : null;
  }
  return null;
}

export function serializeThemeCookie(theme: ThemeId): string {
  return `${COOKIE_NAME}=${theme}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
}
