import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";

const canvasContext = {
  fillRect: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  save: vi.fn(),
  strokeRect: vi.fn(),
  translate: vi.fn(),
  // used by PixelTitlePanels' decorative title-screen canvas
  arc: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  lineTo: vi.fn(),
  moveTo: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  stroke: vi.fn(),
  strokeText: vi.fn(),
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

function openSettings() {
  fireEvent.click(screen.getByRole("menuitem", { name: "Configurações" }));
}

describe("settings panel (theme picker + volume, THEME-10..14)", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = "jphud-theme=; path=/; max-age=0";
    server.use(
      http.get("http://localhost/api/scores", () => HttpResponse.json({ scores: [] })),
      http.post("http://localhost/api/scores", () => HttpResponse.json({ scores: [] })),
    );
    vi.stubGlobal("requestAnimationFrame", vi.fn());
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      canvasContext as unknown as CanvasRenderingContext2D,
    );
  });

  afterEach(() => {
    cleanup();
    server.resetHandlers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.cookie = "jphud-theme=; path=/; max-age=0";
  });

  it("shows Clássico selected by default and Neon as the alternative (THEME-10, THEME-16)", () => {
    render(<Home />);
    openSettings();

    expect(screen.getByRole("radio", { name: "Clássico" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Neon" })).toHaveAttribute("aria-checked", "false");
  });

  it("switches ClassicHud to NeonHud immediately when 'Neon' is clicked, no reload (THEME-11, THEME-12)", () => {
    render(<Home />);
    expect(document.querySelector(".qwen-hud-canvas")).not.toBeInTheDocument();

    openSettings();
    fireEvent.click(screen.getByRole("radio", { name: "Neon" }));

    expect(document.querySelector(".qwen-hud-canvas")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Neon" })).toHaveAttribute("aria-checked", "true");
  });

  it("switches NeonHud back to ClassicHud when 'Clássico' is clicked (THEME-11)", () => {
    document.cookie = "jphud-theme=neon; path=/";
    render(<Home />);
    expect(document.querySelector(".qwen-hud-canvas")).toBeInTheDocument();

    openSettings();
    fireEvent.click(screen.getByRole("radio", { name: "Clássico" }));

    expect(document.querySelector(".qwen-hud-canvas")).not.toBeInTheDocument();
    expect(screen.getByText("Java Pleno Pixel Hunt")).toBeInTheDocument();
  });

  it("persists the theme choice as a cookie so it survives a remount (THEME-15)", () => {
    const { unmount } = render(<Home />);
    openSettings();
    fireEvent.click(screen.getByRole("radio", { name: "Neon" }));
    unmount();

    render(<Home />);

    expect(document.querySelector(".qwen-hud-canvas")).toBeInTheDocument();
  });

  it("adjusting volume in Configurações updates the same volume state the HUD sound control uses, not a duplicate (THEME-13)", () => {
    render(<Home />);
    openSettings();

    const settingsPanel = screen.getByRole("dialog", { name: "Configurações" });
    const settingsVolume = within(settingsPanel).getByRole("slider", { name: "Volume" });
    fireEvent.change(settingsVolume, { target: { value: "0.8" } });
    expect(settingsVolume).toHaveValue("0.8");

    fireEvent.click(within(settingsPanel).getByRole("button", { name: "Voltar" }));

    const hudVolume = screen.getByRole("slider", { name: "Volume" });
    expect(hudVolume).toHaveValue("0.8");
  });

  it("'Voltar' returns to the home menu, keeping the newly selected theme (THEME-14)", () => {
    render(<Home />);
    openSettings();
    fireEvent.click(screen.getByRole("radio", { name: "Neon" }));

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.queryByRole("dialog", { name: "Configurações" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("menuitem")).toHaveLength(5);
    expect(document.querySelector(".qwen-hud-canvas")).toBeInTheDocument();
  });
});

describe("theme persistence and fallback (THEME-15..18)", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = "jphud-theme=; path=/; max-age=0";
    server.use(
      http.get("http://localhost/api/scores", () => HttpResponse.json({ scores: [] })),
      http.post("http://localhost/api/scores", () => HttpResponse.json({ scores: [] })),
    );
    vi.stubGlobal("requestAnimationFrame", vi.fn());
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      canvasContext as unknown as CanvasRenderingContext2D,
    );
  });

  afterEach(() => {
    cleanup();
    server.resetHandlers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.cookie = "jphud-theme=; path=/; max-age=0";
  });

  it("selecting Neon, unmounting and remounting Home applies Neon again on the new mount (THEME-15, THEME-17)", () => {
    const { unmount } = render(<Home />);
    openSettings();
    fireEvent.click(screen.getByRole("radio", { name: "Neon" }));
    expect(document.cookie).toContain("jphud-theme=neon");
    unmount();

    render(<Home />);

    expect(document.querySelector(".qwen-hud-canvas")).toBeInTheDocument();
  });

  it("mounts in Clássico without throwing when the theme cookie holds a corrupted/invalid value (THEME-18)", () => {
    document.cookie = "jphud-theme=xyz-not-a-theme; path=/";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Home />)).not.toThrow();

    expect(document.querySelector(".qwen-hud-canvas")).not.toBeInTheDocument();
    expect(screen.getByText("Java Pleno Pixel Hunt")).toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
