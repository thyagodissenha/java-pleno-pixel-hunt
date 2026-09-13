import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { skipOpeningCutsceneForTests } from "@/app/_hud/cutscene/OpeningCutscene";
import * as pixelHuntOrchestrator from "@/lib/pixel-hunt-engine/orchestrator";
import { SECRET_PHASES } from "@/lib/pixel-hunt-engine/phases/secret-phases";
import { PREVIEW_DRAWERS } from "@/app/_hud/neon/secret-phase-previews";

skipOpeningCutsceneForTests();

// JSDOM não implementa `scrollIntoView` — sem este stub, o efeito de
// auto-scroll do painel secreto (IDCLIPV14-05, `SecretPhasePanel`) lança
// `TypeError` sempre que o painel abre/navega, mesmo em testes que não
// verificam scroll nenhum. Testes que precisam afirmar a chamada usam
// `vi.spyOn(HTMLElement.prototype, "scrollIntoView")` por cima deste stub.
if (typeof HTMLElement.prototype.scrollIntoView !== "function") {
  HTMLElement.prototype.scrollIntoView = () => {};
}

const canvasContext = {
  fillRect: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  save: vi.fn(),
  strokeRect: vi.fn(),
  translate: vi.fn(),
  arc: vi.fn(),
  beginPath: vi.fn(),
  clip: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  lineTo: vi.fn(),
  moveTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  rect: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  stroke: vi.fn(),
  strokeText: vi.fn(),
  ellipse: vi.fn(),
  setLineDash: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

function typeKeys(keys: string) {
  for (const key of keys) fireEvent.keyDown(window, { key });
}

// NeonHud draws its status text on a <canvas> (mocked in these tests), so the
// gameState/status can't be asserted via a DOM heading like ClassicHud's
// <h1>{status}</h1> — it's only observable via this canvas's aria-label.
function neonHudCanvasLabel() {
  return document.querySelector(".qwen-hud-canvas")?.getAttribute("aria-label") ?? "";
}

describe("secret boss fight (idclip cheat code)", () => {
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
    vi.useRealTimers();
  });

  it("starts a real run against the secret boss when idclip is typed at the menu", () => {
    render(<Home />);

    typeKeys("idclip");
    fireEvent.keyDown(window, { key: "Enter" });
    // REACTOFICIAL-03: confirmar O Mainframe entra em combate imediatamente
    // (a transição de carregamento de IDCLIPMENU-22 deixou de existir).

    expect(screen.getByRole("heading", { name: "Em combate" })).toBeVisible();
    const bossCard = screen.getByText("Chefe atual").closest(".boss-card");
    expect(bossCard).not.toBeNull();
    expect(within(bossCard as HTMLElement).getByText("O Mainframe")).toBeVisible();
    const biomeCard = screen.getByText("Fase").closest(".biome-card");
    expect(biomeCard).not.toBeNull();
    expect(within(biomeCard as HTMLElement).getByText("Datacenter Esquecido")).toBeVisible();
    const progressCard = screen.getByText("Boss progress").closest(".progress-card");
    expect(progressCard).not.toBeNull();
    expect(within(progressCard as HTMLElement).getByText("Chefe secreto")).toBeVisible();
    const hpCard = screen.getByText("HP").closest(".hp-card");
    expect(hpCard).not.toBeNull();
    expect(within(hpCard as HTMLElement).getByText("100")).toBeVisible();
  });

  it("does not start the secret run for unrelated keystrokes", () => {
    render(<Home />);

    typeKeys("hello");

    expect(screen.getByRole("heading", { name: "Pronto" })).toBeVisible();
  });

  it("still opens the skins panel for idkfa (regression: secret boss trigger must not shadow it)", () => {
    render(<Home />);

    typeKeys("idkfa");

    expect(screen.getByRole("dialog", { name: "Personagens e Skins" })).toBeVisible();
  });

  it("returns to the title menu (real boss/biome reset) after leaving the secret run", () => {
    render(<Home />);
    typeKeys("idclip");
    fireEvent.keyDown(window, { key: "Enter" });

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Sair do jogo" }));

    expect(screen.getByRole("heading", { name: "Pronto" })).toBeVisible();
    const bossCard = screen.getByText("Chefe atual").closest(".boss-card");
    expect(bossCard).not.toBeNull();
    expect(within(bossCard as HTMLElement).getByText("Gerente de Sprint")).toBeVisible();
  });
});

describe("secret phase select panel — neon theme uses PhaseSelectMenu (REACTOFICIAL-01/06)", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = "jphud-theme=neon; path=/";
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
    vi.unstubAllEnvs();
    vi.useRealTimers();
    document.cookie = "jphud-theme=; path=/; max-age=0";
  });

  it("opens PhaseSelectMenu (not the fight) when idclip is typed, with the game's chrome still visible around it (IDCLIPMENU-01, REACTOFICIAL-01)", () => {
    render(<Home />);

    typeKeys("idclip");

    expect(screen.getByText("JAVA PLENO PIXEL HUNT")).toBeVisible();
    expect(screen.getByRole("button", { name: /O MAINFRAME/ })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Em combate" })).not.toBeInTheDocument();
    // O chrome do jogo (HUD) continua fora do painel, sem ser substituído.
    expect(neonHudCanvasLabel()).toMatch(/^HUD do jogador — Pronto/);
  });

  it("shows real SECRET_PHASES data (name/subtitle/lockedHint), not a hardcoded copy — only O Mainframe unlocked (REACTOFICIAL-02)", () => {
    render(<Home />);
    typeKeys("idclip");

    const mainframe = screen.getByRole("button", { name: /O MAINFRAME/ });
    expect(within(mainframe).getByText("DATACENTER ESQUECIDO")).toBeVisible();
    expect(within(mainframe).queryByText("BLOQUEADO")).not.toBeInTheDocument();

    const hellBranch = SECRET_PHASES.find((phase) => phase.id === "hell-branch")!;
    const hellBranchCard = screen.getByRole("button", { name: /HELL BRANCH/ });
    expect(within(hellBranchCard).getByText(hellBranch.subtitle.toUpperCase())).toBeVisible();
    expect(within(hellBranchCard).getByText("BLOQUEADO")).toBeVisible();
  });

  it("navigating by arrow key and confirming a locked phase shows its real lockedHint toast, no loading, panel stays open (IDCLIPMENU-05/06/07)", () => {
    render(<Home />);
    typeKeys("idclip");

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });

    const hellBranch = SECRET_PHASES.find((phase) => phase.id === "hell-branch")!;
    expect(screen.getByText("BLOQUEADO — " + hellBranch.lockedHint)).toBeInTheDocument();
    expect(screen.queryByText(/CARREGANDO/)).not.toBeInTheDocument();
    expect(screen.getByText("JAVA PLENO PIXEL HUNT")).toBeVisible();
    expect(neonHudCanvasLabel()).toMatch(/^HUD do jogador — Pronto/);
  });

  it("confirming O Mainframe runs a single loading (the menu's own) then enters combat immediately, no second loading (IDCLIPMENU-04, REACTOFICIAL-03)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout"] });
    render(<Home />);
    typeKeys("idclip");

    fireEvent.click(screen.getByRole("button", { name: /O MAINFRAME/ }));
    expect(screen.getByText("CARREGANDO O MAINFRAME...")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1400);
    });

    expect(screen.queryByText("JAVA PLENO PIXEL HUNT")).not.toBeInTheDocument();
    expect(neonHudCanvasLabel()).toMatch(/^HUD do jogador — Em combate/);
    expect(document.querySelector(".qwen-footer-canvas")).toHaveAttribute(
      "aria-label",
      expect.stringContaining("O Mainframe"),
    );
  });

  it("does not start the fight or play the start sound twice when confirming O Mainframe fires synchronously twice in the same tick (double-trigger guard)", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout"] });
    const originalCreateEngine = pixelHuntOrchestrator.createEngine;
    let engineSpy: { start: ReturnType<typeof vi.spyOn>; playSound: ReturnType<typeof vi.spyOn> } | null = null;
    vi.spyOn(pixelHuntOrchestrator, "createEngine").mockImplementation((options) => {
      const engine = originalCreateEngine(options);
      engineSpy = {
        start: vi.spyOn(engine, "start"),
        playSound: vi.spyOn(engine, "playSound"),
      };
      return engine;
    });

    render(<Home />);
    typeKeys("idclip");
    const mainframeButton = screen.getByRole("button", { name: /O MAINFRAME/ });

    act(() => {
      fireEvent.click(mainframeButton);
      fireEvent.click(mainframeButton);
    });

    act(() => {
      vi.advanceTimersByTime(1400);
    });

    const playSoundCalls: unknown[] = engineSpy!.playSound.mock.calls.map((call: unknown[]) => call[0]);
    expect(playSoundCalls.filter((sound: unknown) => sound === "start")).toHaveLength(1);
    expect(engineSpy!.start).toHaveBeenCalledTimes(1);
  });

  it("confirming a phase unlocked only via cheat (not O Mainframe) still shows the real lockedHint toast, not the menu's own generic fallback (onSelect always routes through confirmSecretPhaseSelection)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout"] });
    render(<Home />);
    typeKeys("idclip");
    typeKeys("idboo");

    const graveyard = SECRET_PHASES.find((phase) => phase.id === "graveyard-shift")!;
    fireEvent.click(screen.getByRole("button", { name: /GRAVEYARD SHIFT/ }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1400);
    });

    expect(screen.getByRole("status")).toHaveTextContent(graveyard.lockedHint);
    expect(screen.queryByText(/plugue o loader/)).not.toBeInTheDocument();
    expect(neonHudCanvasLabel()).toMatch(/^HUD do jogador — Pronto/);
  });

  it("Escape closes the panel and returns to the home menu (IDCLIPMENU-06)", () => {
    render(<Home />);
    typeKeys("idclip");
    expect(screen.getByText("JAVA PLENO PIXEL HUNT")).toBeVisible();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByText("JAVA PLENO PIXEL HUNT")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Menu inicial" })).toBeVisible();
  });

  it('"Voltar ao início" closes the panel too, for mouse-only users (no keyboard Escape)', () => {
    render(<Home />);
    typeKeys("idclip");

    fireEvent.click(screen.getByRole("button", { name: "Voltar ao início" }));

    expect(screen.queryByText("JAVA PLENO PIXEL HUNT")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Menu inicial" })).toBeVisible();
  });

  describe("?autostart=mainframe (MFLAUNCH-02/03)", () => {
    afterEach(() => {
      window.history.pushState({}, "", "/");
    });

    it("launches the Mainframe fight directly on mount when ?autostart=mainframe is present at the home menu (MFLAUNCH-02)", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout"] });
      window.history.pushState({}, "", "/?autostart=mainframe");

      render(<Home />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1400);
      });

      expect(neonHudCanvasLabel()).toMatch(/^HUD do jogador — Em combate/);
      expect(document.querySelector(".qwen-footer-canvas")).toHaveAttribute(
        "aria-label",
        expect.stringContaining("O Mainframe"),
      );
    });

    it("ignores an unrelated ?autostart value and stays on the home menu (MFLAUNCH-03)", () => {
      window.history.pushState({}, "", "/?autostart=hell-branch");

      render(<Home />);

      expect(screen.queryByRole("dialog", { name: "Fases Secretas" })).not.toBeInTheDocument();
      expect(neonHudCanvasLabel()).toMatch(/^HUD do jogador — Pronto/);
    });
  });
});


describe("secret phase select panel — classic theme parity (IDCLIPMENU-09/10/11)", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = "jphud-theme=classico; path=/";
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
    vi.unstubAllEnvs();
    vi.useRealTimers();
    document.cookie = "jphud-theme=; path=/; max-age=0";
  });

  it("shows the Mainframe/Hell Branch phase cards with the classic palette, no neon wrapper (IDCLIPMENU-09)", () => {
    render(<Home />);

    typeKeys("idclip");

    const dialog = screen.getByRole("dialog", { name: "Fases Secretas" });
    expect(within(dialog).getByText("O Mainframe")).toBeVisible();
    expect(within(dialog).getByText("Datacenter Esquecido")).toBeVisible();
    expect(within(dialog).getByText("Desbloqueado")).toBeVisible();
    expect(within(dialog).getByText("Hell Branch")).toBeVisible();
    const hellBranchCard = screen.getByRole("button", { name: /Hell Branch/ });
    expect(within(hellBranchCard).getByText("🔒 Em breve")).toBeVisible();
    expect(document.querySelector(".study-outer-frame")).not.toBeInTheDocument();
    expect(dialog.querySelectorAll("canvas.secret-phase-preview")).toHaveLength(0);
  });

  it("never renders the neon-only rich layout (number, arrows, info wrapper) in the classic theme (regression IDCLIPMENU-17/18/19)", () => {
    render(<Home />);
    typeKeys("idclip");

    const dialog = screen.getByRole("dialog", { name: "Fases Secretas" });
    expect(dialog.querySelectorAll(".secret-phase-info")).toHaveLength(0);
    expect(dialog.querySelectorAll(".secret-phase-number")).toHaveLength(0);
    expect(dialog.querySelectorAll(".secret-phase-arrow")).toHaveLength(0);
    expect(within(dialog).queryByText("01")).not.toBeInTheDocument();

    // IDCLIPMENU-19 (fix cycle 1): reposicionar o tempo estimado no neon não
    // pode mexer no clássico — continua fora de qualquer wrapper de canto,
    // direto dentro do `.secret-phase-card` (mesmo lugar de sempre).
    expect(dialog.querySelectorAll(".secret-phase-corner")).toHaveLength(0);
    const mainframeCard = screen.getByRole("button", { name: /O Mainframe/ });
    expect(within(mainframeCard).getByText("6-9 min")).toBeInTheDocument();
    expect(mainframeCard.querySelector(".secret-phase-meta")).not.toBeNull();
  });

  it("never renders the floating decorative words in the classic theme (regression IDCLIPMENU-20)", () => {
    render(<Home />);
    typeKeys("idclip");

    const dialog = screen.getByRole("dialog", { name: "Fases Secretas" });
    expect(dialog.querySelectorAll(".secret-phase-float-layer")).toHaveLength(0);
  });

  it("never renders the scanline/vinheta overlay in the classic theme (regression IDCLIPMENU-21)", () => {
    render(<Home />);
    typeKeys("idclip");

    const dialog = screen.getByRole("dialog", { name: "Fases Secretas" });
    expect(dialog.querySelectorAll(".secret-phase-atmosphere-overlay")).toHaveLength(0);
  });

  // IDCLIPV14-01/18: mesma mecânica de scroll no clássico, sem decoração.
  it("wraps the phase list in a scrollable viewport in the classic theme too (IDCLIPV14-01/18)", () => {
    render(<Home />);
    typeKeys("idclip");

    const dialog = screen.getByRole("dialog", { name: "Fases Secretas" });
    const viewport = dialog.querySelector(".secret-phase-viewport");
    expect(viewport).not.toBeNull();
    expect(viewport?.querySelectorAll(".secret-phase-card")).toHaveLength(8);
  });

  // IDCLIPV14-02: thumb decorativo (Opção C) é neon-only — o clássico usa a
  // scrollbar nativa escondida sem substituto visual (design.md § SecretPhasePanel).
  it("does not render the decorative scrollbar thumb in the classic theme (regression, IDCLIPV14-02)", () => {
    render(<Home />);
    typeKeys("idclip");

    const dialog = screen.getByRole("dialog", { name: "Fases Secretas" });
    expect(dialog.querySelector(".secret-phase-scrollbar-track")).toBeNull();
    expect(dialog.querySelector(".secret-phase-scrollbar-thumb")).toBeNull();
  });

  // IDCLIPV14-13: label "FASE 0N" é neon-only (regression).
  it("does not render the FASE 0N label in the classic theme (regression, IDCLIPV14-13)", () => {
    render(<Home />);
    typeKeys("idclip");

    const dialog = screen.getByRole("dialog", { name: "Fases Secretas" });
    expect(dialog.querySelectorAll(".secret-phase-index-label")).toHaveLength(0);
  });

  // IDCLIPV14-15: hint "ENTER PARA ENTRAR" é neon-only (regression).
  it("does not render the ENTER PARA ENTRAR hint in the classic theme (regression, IDCLIPV14-15)", () => {
    render(<Home />);
    typeKeys("idclip");

    expect(screen.queryByText("ENTER PARA ENTRAR")).not.toBeInTheDocument();
  });

  // IDCLIPV14-16/17: cabeçalho/rodapé customizados são neon-only — o
  // clássico mantém o `<h2>Fases Secretas</h2>` de sempre, sem rodapé novo.
  it("keeps the plain <h2>Fases Secretas</h2> header and no custom footer in the classic theme (regression, IDCLIPV14-16/17)", () => {
    render(<Home />);
    typeKeys("idclip");

    const dialog = screen.getByRole("dialog", { name: "Fases Secretas" });
    expect(within(dialog).getByRole("heading", { name: "Fases Secretas" })).toBeVisible();
    expect(within(dialog).queryByText("JAVA PLENO PIXEL HUNT")).not.toBeInTheDocument();
    expect(
      within(dialog).queryByText("↑/↓ SELECIONAR · ENTER CONFIRMAR · SCROLL/ARRASTAR · CHEATS: IDCLIP"),
    ).not.toBeInTheDocument();
  });

  it("navigates and highlights a card without changing gameState, identically to the neon theme (IDCLIPMENU-11)", () => {
    render(<Home />);
    typeKeys("idclip");

    const mainframeCard = screen.getByRole("button", { name: /O Mainframe/ });
    const hellBranchCard = screen.getByRole("button", { name: /Hell Branch/ });
    expect(mainframeCard).toHaveAttribute("aria-current", "true");

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(hellBranchCard).toHaveAttribute("aria-current", "true");
    expect(mainframeCard).toHaveAttribute("aria-current", "false");
    expect(screen.getByRole("heading", { name: "Pronto" })).toBeVisible();
  });

  it("confirming O Mainframe starts the exact same boss fight in the classic theme, instantly (IDCLIPMENU-11, REACTOFICIAL-03)", () => {
    render(<Home />);
    typeKeys("idclip");

    fireEvent.click(screen.getByRole("button", { name: /O Mainframe/ }));

    expect(screen.getByRole("heading", { name: "Em combate" })).toBeVisible();
    const bossCard = screen.getByText("Chefe atual").closest(".boss-card");
    expect(bossCard).not.toBeNull();
    expect(within(bossCard as HTMLElement).getByText("O Mainframe")).toBeVisible();
  });

  it("shows no loading transition at all when confirming O Mainframe in the classic theme (REACTOFICIAL-03)", () => {
    render(<Home />);
    typeKeys("idclip");

    fireEvent.click(screen.getByRole("button", { name: /O Mainframe/ }));

    expect(document.querySelector(".secret-phase-loading")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Em combate" })).toBeVisible();
  });

  it("confirming Hell Branch never starts a fase and shows the blocking toast in the classic theme (IDCLIPMENU-11)", () => {
    render(<Home />);
    typeKeys("idclip");

    fireEvent.click(screen.getByRole("button", { name: /Hell Branch/ }));

    expect(screen.queryByRole("heading", { name: "Em combate" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Fases Secretas" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Onda 6 · DOOM.WAD");
    expect(document.querySelector(".secret-phase-loading")).not.toBeInTheDocument();
  });

  it("Escape returns to the home menu and Enter never falls back to 'Jogar', in the classic theme (IDCLIPMENU-06/07/11)", () => {
    render(<Home />);
    typeKeys("idclip");
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });

    expect(screen.queryByRole("heading", { name: "Em combate" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Fases Secretas" })).toBeVisible();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Fases Secretas" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pronto" })).toBeVisible();
  });

  it("switching theme (classic <-> neon) and reopening idclip renders the panel in the current theme (IDCLIPMENU-10)", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("menuitem", { name: "Configurações" }));
    fireEvent.click(screen.getByRole("radio", { name: "Neon" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    typeKeys("idclip");

    expect(document.querySelector(".study-outer-frame")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Fases Secretas" })).toBeVisible();
  });
});

describe("secret boss fight rendering (drives real animation frames)", () => {
  let animationFrames: FrameRequestCallback[];
  let frameTime: number;

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
    vi.useRealTimers();
  });

  function advanceFrames(amount: number) {
    act(() => {
      for (let index = 0; index < amount; index += 1) {
        frameTime += 33;
        const pending = animationFrames.splice(0, animationFrames.length);
        pending.forEach((callback) => callback(frameTime));
      }
    });
  }

  it("renders the datacenter arena, the mainframe boss and the daemon/cron roster without throwing", () => {
    render(<Home />);
    typeKeys("idclip");
    fireEvent.keyDown(window, { key: "Enter" });
    // REACTOFICIAL-03: entrada em combate é imediata (sem transição de
    // carregamento) — os frames já refletem o Mainframe assim que avançam.

    expect(() => advanceFrames(10)).not.toThrow();

    const fillTextCalls = canvasContext.fillText.mock.calls.map((call) => call[0]);
    expect(fillTextCalls).toContain("O Mainframe");
    expect(fillTextCalls).toContain("Daemon");
    expect(fillTextCalls).toContain("Cron Job");

    expect(fillTextCalls).toContain("Rack");
    expect(fillTextCalls).toContain("CRT");
    expect(fillTextCalls).not.toContain("Kanban");
  });
});

// IDCLIPV14-11/12: cada uma das 8 fases do painel v1.4 tem sua própria
// função de desenho de preview (canvas 96x56), registrada em
// `PREVIEW_DRAWERS` por `id`. Testado direto contra o módulo (sem precisar
// montar `<Home />`), já que é uma função pura de Canvas 2D — mesma
// primitiva 2D mockada (`canvasContext`) já usada pelo resto da suíte.
describe("secret phase preview drawers (IDCLIPV14-11/12)", () => {
  const previewCtx = {
    fillRect: vi.fn(),
    fillText: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    strokeRect: vi.fn(),
    translate: vi.fn(),
    arc: vi.fn(),
    beginPath: vi.fn(),
    clip: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    rect: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    stroke: vi.fn(),
    strokeText: vi.fn(),
    ellipse: vi.fn(),
    setLineDash: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("draws the Graveyard Shift preview without throwing, not falling back to the Mainframe drawer", () => {
    expect(PREVIEW_DRAWERS["graveyard-shift"]).toBeDefined();
    expect(PREVIEW_DRAWERS["graveyard-shift"]).not.toBe(PREVIEW_DRAWERS.mainframe);
    expect(() =>
      PREVIEW_DRAWERS["graveyard-shift"](previewCtx as unknown as CanvasRenderingContext2D, 96, 56, 1),
    ).not.toThrow();
    expect(previewCtx.fillRect).toHaveBeenCalled();
  });

  it("draws the Mar de Stack Overflow preview without throwing, not falling back to the Mainframe drawer", () => {
    expect(PREVIEW_DRAWERS["mar-stack-overflow"]).toBeDefined();
    expect(PREVIEW_DRAWERS["mar-stack-overflow"]).not.toBe(PREVIEW_DRAWERS.mainframe);
    expect(() =>
      PREVIEW_DRAWERS["mar-stack-overflow"](previewCtx as unknown as CanvasRenderingContext2D, 96, 56, 1),
    ).not.toThrow();
    expect(previewCtx.fillRect).toHaveBeenCalled();
  });

  it("draws the Glacier de Change Freeze preview without throwing, not falling back to the Mainframe drawer", () => {
    expect(PREVIEW_DRAWERS.glacier).toBeDefined();
    expect(PREVIEW_DRAWERS.glacier).not.toBe(PREVIEW_DRAWERS.mainframe);
    expect(() =>
      PREVIEW_DRAWERS.glacier(previewCtx as unknown as CanvasRenderingContext2D, 96, 56, 1),
    ).not.toThrow();
    expect(previewCtx.fillRect).toHaveBeenCalled();
  });

  it("draws the Estação Orbital preview without throwing, not falling back to the Mainframe drawer", () => {
    expect(PREVIEW_DRAWERS["estacao-orbital"]).toBeDefined();
    expect(PREVIEW_DRAWERS["estacao-orbital"]).not.toBe(PREVIEW_DRAWERS.mainframe);
    expect(() =>
      PREVIEW_DRAWERS["estacao-orbital"](previewCtx as unknown as CanvasRenderingContext2D, 96, 56, 1),
    ).not.toThrow();
    expect(previewCtx.fillRect).toHaveBeenCalled();
  });

  it("draws the Castelo do Monolito preview without throwing, not falling back to the Mainframe drawer", () => {
    expect(PREVIEW_DRAWERS["castelo-monolito"]).toBeDefined();
    expect(PREVIEW_DRAWERS["castelo-monolito"]).not.toBe(PREVIEW_DRAWERS.mainframe);
    expect(() =>
      PREVIEW_DRAWERS["castelo-monolito"](previewCtx as unknown as CanvasRenderingContext2D, 96, 56, 1),
    ).not.toThrow();
    expect(previewCtx.fillRect).toHaveBeenCalled();
  });

  it("draws the Meta.Arcade preview without throwing, not falling back to the Mainframe drawer", () => {
    expect(PREVIEW_DRAWERS["meta-arcade"]).toBeDefined();
    expect(PREVIEW_DRAWERS["meta-arcade"]).not.toBe(PREVIEW_DRAWERS.mainframe);
    expect(() =>
      PREVIEW_DRAWERS["meta-arcade"](previewCtx as unknown as CanvasRenderingContext2D, 96, 56, 1),
    ).not.toThrow();
    expect(previewCtx.fillRect).toHaveBeenCalled();
  });

  it("registers all 8 v1.4 phases with their own preview drawer — none falls back to the Mainframe scene (IDCLIPV14-11/12)", () => {
    SECRET_PHASES.forEach((phase) => {
      const drawer = PREVIEW_DRAWERS[phase.id];
      expect(drawer).toBeDefined();
      if (phase.id !== "mainframe") {
        expect(drawer).not.toBe(PREVIEW_DRAWERS.mainframe);
      }
      expect(() => drawer(previewCtx as unknown as CanvasRenderingContext2D, 96, 56, 1)).not.toThrow();
    });
  });
});
