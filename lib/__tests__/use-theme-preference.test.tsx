import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useThemePreference } from "@/lib/theme/use-theme-preference";

function ThemeProbe() {
  const { theme, setTheme } = useThemePreference();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button type="button" onClick={() => setTheme("neon")}>
        Selecionar Neon
      </button>
    </div>
  );
}

function clearThemeCookie() {
  document.cookie = "jphud-theme=; path=/; max-age=0";
}

beforeEach(() => {
  clearThemeCookie();
});

afterEach(() => {
  cleanup();
  clearThemeCookie();
});

describe("useThemePreference", () => {
  it("defaults to classico when no cookie is present (THEME-16)", () => {
    render(<ThemeProbe />);
    expect(screen.getByTestId("theme")).toHaveTextContent("classico");
  });

  it("applies the saved theme from the cookie on mount (THEME-17)", () => {
    document.cookie = "jphud-theme=neon; path=/";
    render(<ThemeProbe />);
    expect(screen.getByTestId("theme")).toHaveTextContent("neon");
  });

  it("falls back to classico when the cookie holds an invalid value, without throwing (THEME-18)", () => {
    document.cookie = "jphud-theme=xyz; path=/";
    expect(() => render(<ThemeProbe />)).not.toThrow();
    expect(screen.getByTestId("theme")).toHaveTextContent("classico");
  });

  it("setTheme updates the returned value and writes the cookie (THEME-15)", () => {
    render(<ThemeProbe />);

    fireEvent.click(screen.getByRole("button", { name: "Selecionar Neon" }));

    expect(screen.getByTestId("theme")).toHaveTextContent("neon");
    expect(document.cookie).toContain("jphud-theme=neon");
  });
});
