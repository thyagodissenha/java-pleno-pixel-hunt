"use client";

import { useCallback, useEffect, useState } from "react";
import { parseThemeCookie, serializeThemeCookie, type ThemeId } from "@/lib/theme/theme-cookie";

const DEFAULT_THEME: ThemeId = "classico";

export function useThemePreference() {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    // document.cookie only exists client-side; this hydrates from it once
    // after mount to avoid an SSR/client markup mismatch.
    const saved = parseThemeCookie(document.cookie);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setThemeState(saved);
  }, []);

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
    document.cookie = serializeThemeCookie(next);
  }, []);

  return { theme, setTheme };
}
