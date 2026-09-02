import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
  clip: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  lineTo: vi.fn(),
  moveTo: vi.fn(),
  rect: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  stroke: vi.fn(),
  strokeText: vi.fn(),
  // used by OpeningCutscene's word-wrapped dialog boxes
  measureText: vi.fn(() => ({ width: 0 })),
};

const server = setupServer();

let animationFrames: FrameRequestCallback[];
let frameTime: number;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

function advanceFrames(amount: number) {
  act(() => {
    for (let index = 0; index < amount; index += 1) {
      frameTime += 33;
      // Drain every callback queued for this tick (not just one) so an
      // independent rAF loop (e.g. PixelTitlePanels' decorative canvas)
      // mounted alongside the game loop can't steal frame slots meant
      // for it, the way a single shift() per tick would.
      const pending = animationFrames.splice(0, animationFrames.length);
      pending.forEach((callback) => callback(frameTime));
    }
  });
}

function startMatch() {
  act(() => {
    fireEvent.click(screen.getByRole("menuitem", { name: /^▶?\s*Jogar$/ }));
  });
}

describe("HUD layout (sponsor card removal, sound controls, power cooldown meter)", () => {
  beforeEach(() => {
    localStorage.clear();
    server.use(
      http.get("http://localhost/api/scores", () => HttpResponse.json({ scores: [] })),
      http.post("http://localhost/api/scores", () => HttpResponse.json({ scores: [] })),
    );
    const interceptedFetch = globalThis.fetch;
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? new URL(input, "http://localhost") : input;
      return interceptedFetch(url, init);
    });
    animationFrames = [];
    frameTime = performance.now();
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    }));
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
  });

  it("does not render the sponsor card in the game HUD (HUD-01)", () => {
    render(<Home />);
    startMatch();

    expect(screen.queryByText("Patrocínio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apoie o jogo" })).not.toBeInTheDocument();
  });

  it("keeps the sound controls (mute + volume) working, now in their own HUD slot (HUD-04)", () => {
    render(<Home />);
    startMatch();

    const muteButton = screen.getByRole("button", { name: "Mutar som" });
    fireEvent.click(muteButton);
    expect(screen.getByRole("button", { name: "Ativar som" })).toHaveAttribute("aria-pressed", "true");

    const volumeSlider = screen.getByRole("slider", { name: "Volume" });
    fireEvent.change(volumeSlider, { target: { value: "0.5" } });
    expect(volumeSlider).toHaveValue("0.5");
  });

  it("shows both the Rajada and Poder meters for the default character, which has a special power (HUD-05)", () => {
    const { container } = render(<Home />);
    startMatch();

    const utilityCard = container.querySelector(".utility-card");
    if (!utilityCard) throw new Error("Expected the utility-card HUD slot to exist");
    expect(within(utilityCard as HTMLElement).getByText("Rajada")).toBeInTheDocument();
    expect(within(utilityCard as HTMLElement).getByText("Poder")).toBeInTheDocument();
  });

  function powerMeterPercentage() {
    const powerLabel = screen.getByText("Poder");
    const meter = powerLabel.closest(".stamina-meter");
    if (!meter) throw new Error("Expected the power meter's stamina-meter wrapper to exist");
    const percentageText = meter.querySelector("small")?.textContent ?? "";
    return Number(percentageText.replace("%", ""));
  }

  it("shows the power meter at 100% right after a match starts, drops after Q, and climbs back afterwards (HUD-05)", () => {
    render(<Home />);
    startMatch();

    expect(powerMeterPercentage()).toBe(100);

    fireEvent.keyDown(window, { key: "d" });
    advanceFrames(18);
    fireEvent.keyDown(window, { key: "q" });

    expect(powerMeterPercentage()).toBe(0);

    advanceFrames(30);

    expect(powerMeterPercentage()).toBeGreaterThan(0);
  });
});

describe("title menu 'Apoie o jogo' option (5th menu item)", () => {
  beforeEach(() => {
    localStorage.clear();
    server.use(
      http.get("http://localhost/api/scores", () => HttpResponse.json({ scores: [] })),
      http.post("http://localhost/api/scores", () => HttpResponse.json({ scores: [] })),
    );
    const interceptedFetch = globalThis.fetch;
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? new URL(input, "http://localhost") : input;
      return interceptedFetch(url, init);
    });
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
  });

  it("shows 5 menu items: Jogar, High Scores, Configurações, Como Jogar, Apoie o jogo (HUD-02, THEME-13)", () => {
    render(<Home />);

    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent("Jogar");
    expect(items[1]).toHaveTextContent("High Scores");
    expect(items[2]).toHaveTextContent("Configurações");
    expect(items[3]).toHaveTextContent("Como Jogar");
    expect(items[4]).toHaveTextContent("Apoie o jogo");
  });

  it("opens the support panel when 'Apoie o jogo' is clicked (HUD-02)", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("menuitem", { name: "Apoie o jogo" }));

    expect(screen.getByRole("dialog", { name: "Apoie o jogo" })).toBeVisible();
  });

  it("opens the support panel when 'Apoie o jogo' is reached via ArrowDown + Enter from Jogar (HUD-02)", () => {
    render(<Home />);

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });

    expect(screen.getByRole("dialog", { name: "Apoie o jogo" })).toBeVisible();
  });

  it("wraps ArrowDown from the 5th option (index 4) back to the 1st (Jogar) (HUD-03)", () => {
    render(<Home />);

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: /Apoie o jogo/ })).toHaveAttribute("aria-current", "true");

    fireEvent.keyDown(window, { key: "ArrowDown" });

    expect(screen.getByRole("menuitem", { name: /^▶?\s*Jogar$/ })).toHaveAttribute("aria-current", "true");
  });

  it("wraps ArrowUp from the 1st option (index 0) to the 5th (Apoie o jogo) (HUD-03)", () => {
    render(<Home />);

    expect(screen.getByRole("menuitem", { name: /^▶?\s*Jogar$/ })).toHaveAttribute("aria-current", "true");

    fireEvent.keyDown(window, { key: "ArrowUp" });

    expect(screen.getByRole("menuitem", { name: /Apoie o jogo/ })).toHaveAttribute("aria-current", "true");
  });

  it("still navigates and activates the pre-existing options (Jogar, High Scores, Como Jogar) as before", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("menuitem", { name: "High Scores" }));
    expect(screen.getByRole("dialog", { name: "High Scores" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao início" }));

    fireEvent.click(screen.getByRole("menuitem", { name: "Como Jogar" }));
    expect(screen.getByRole("dialog", { name: "Como jogar" })).toBeVisible();
  });

  it("clicking 'Configurações' (index 2) pauses/opens settings state without touching the other panels (THEME-13)", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("menuitem", { name: "Configurações" }));

    expect(screen.queryByRole("dialog", { name: "High Scores" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Como jogar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Apoie o jogo" })).not.toBeInTheDocument();
  });

  it("shows Privacidade/Sobre links inside the 'Apoie o jogo' panel (HUD-09)", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("menuitem", { name: "Apoie o jogo" }));

    const supportPanel = screen.getByRole("dialog", { name: "Apoie o jogo" });
    const privacyLink = within(supportPanel).getByRole("link", { name: "Privacidade" });
    const aboutLink = within(supportPanel).getByRole("link", { name: "Sobre" });

    expect(privacyLink).toBeVisible();
    expect(privacyLink).toHaveAttribute("href", "/privacidade");
    expect(aboutLink).toBeVisible();
    expect(aboutLink).toHaveAttribute("href", "/sobre");
  });
});

describe("theme dispatch (ClassicHud/NeonHud)", () => {
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

  it("renders ClassicHud (DOM topbar, no canvas header) by default with no theme cookie (THEME-02, THEME-16)", () => {
    render(<Home />);

    expect(screen.getByText("Java Pleno Pixel Hunt")).toBeInTheDocument();
    expect(document.querySelector(".qwen-hud-canvas")).not.toBeInTheDocument();
    expect(screen.getAllByRole("menuitem")).toHaveLength(5);
  });

  it("renders NeonHud (canvas header/footer) when the theme cookie is 'neon' (THEME-02, THEME-17)", () => {
    document.cookie = "jphud-theme=neon; path=/";
    render(<Home />);

    expect(document.querySelector(".qwen-hud-canvas")).toBeInTheDocument();
    expect(document.querySelector(".qwen-footer-canvas")).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem")).toHaveLength(5);
  });

  it("keeps High Scores/Como Jogar/Apoie o jogo reachable in the neon theme too (THEME-04 parity smoke test)", () => {
    document.cookie = "jphud-theme=neon; path=/";
    render(<Home />);

    fireEvent.click(screen.getByRole("menuitem", { name: "High Scores" }));
    expect(screen.getByRole("dialog", { name: "High Scores" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao início" }));

    fireEvent.click(screen.getByRole("menuitem", { name: "Apoie o jogo" }));
    expect(screen.getByRole("dialog", { name: "Apoie o jogo" })).toBeVisible();
  });
});
