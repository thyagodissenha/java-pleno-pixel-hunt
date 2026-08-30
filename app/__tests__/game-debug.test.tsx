import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { DEBUG_ACTION_EVENT } from "@/lib/debug";

const canvasContext = {
  fillRect: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  save: vi.fn(),
  strokeRect: vi.fn(),
  translate: vi.fn(),
};

const server = setupServer();

let animationFrames: FrameRequestCallback[];
let frameTime: number;
let postAttempts: number;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

function advanceFrames(amount: number) {
  act(() => {
    for (let index = 0; index < amount; index += 1) {
      const callback = animationFrames.shift();
      frameTime += 33;
      callback?.(frameTime);
    }
  });
}

// The HUD now shows two "stamina-meter"-style gauges side by side (Rajada + the special
// power's cooldown, added by the "reorganizacao-hud-e-poder" feature) — both can render the
// same percentage text, so burst stamina must be looked up within the Rajada meter specifically
// rather than by its percentage text alone.
function burstStaminaText() {
  const utilityCard = document.querySelector(".utility-card");
  if (!utilityCard) throw new Error("Expected the utility-card HUD slot to exist");
  const meter = within(utilityCard as HTMLElement).getByText("Rajada").closest(".stamina-meter");
  if (!meter) throw new Error("Expected the Rajada label to live inside a stamina-meter");
  return meter.querySelector("small");
}

function snapshotGameState() {
  return {
    heading: screen.getByRole("heading", { level: 1 }).textContent,
    bossProgress: screen.getByText("0/14 mobs").textContent,
    stamina: burstStaminaText()?.textContent ?? null,
    bossHealth: screen.queryByRole("status", { name: "Vida do boss debug" })?.textContent ?? null,
    powerUps: screen.queryByRole("status", { name: "Power-ups debug" })?.textContent ?? null,
    postAttempts,
    highScores: localStorage.getItem("java-pleno-pixel-hunt-high-scores"),
    pendingScores: localStorage.getItem("java-pleno-pixel-hunt-pending-scores"),
  };
}

describe("game debug tools", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv("NODE_ENV", "development");
    postAttempts = 0;
    server.use(
      http.get("http://localhost/api/scores", () => HttpResponse.json({ scores: [] })),
      http.post("http://localhost/api/scores", () => {
        postAttempts += 1;
        return HttpResponse.json({ scores: [] });
      }),
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
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("toggles the debug HUD with F1 and focuses its first action", () => {
    render(<Home />);

    fireEvent.keyDown(window, { key: "F1" });

    const dialog = screen.getByRole("dialog", { name: "Ferramentas de debug" });
    expect(dialog.tagName).toBe("DIALOG");
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toBeVisible();
    expect(screen.getByRole("button", { name: "Invocar Boss" })).toHaveFocus();

    fireEvent.keyDown(window, { key: "F1" });

    expect(screen.queryByRole("dialog", { name: "Ferramentas de debug" })).not.toBeInTheDocument();
  });

  it("updates debug state when the native dialog closes", () => {
    render(<Home />);
    fireEvent.keyDown(window, { key: "F1" });
    const dialog = screen.getByRole("dialog", { name: "Ferramentas de debug" });

    fireEvent(dialog, new Event("close"));

    expect(screen.queryByRole("dialog", { name: "Ferramentas de debug" })).not.toBeInTheDocument();
  });

  it("invokes a full-health boss and starts the match", () => {
    render(<Home />);
    fireEvent.keyDown(window, { key: "F1" });

    fireEvent.click(screen.getByRole("button", { name: "Invocar Boss" }));

    expect(screen.getByRole("heading", { level: 1, name: "Em combate" })).toBeVisible();
    expect(screen.getByText("Chefe em combate")).toBeVisible();
  });

  it("exposes the spawned boss entity at full health", () => {
    render(<Home />);
    fireEvent.keyDown(window, { key: "F1" });

    fireEvent.click(screen.getByRole("button", { name: "Invocar Boss" }));

    expect(screen.getByRole("status", { name: "Vida do boss debug" })).toHaveTextContent("188/188 HP");
  });

  it("exposes the power-up created in the arena by F3", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(<Home />);

    fireEvent.keyDown(window, { key: "F3" });

    expect(screen.getByRole("status", { name: "Power-ups debug" })).toHaveTextContent("1 power-up disponível");
  });

  it("resets the current debug run without retaining spawned entities", () => {
    render(<Home />);
    fireEvent.keyDown(window, { key: "F2" });
    expect(screen.getByRole("status", { name: "Vida do boss debug" })).toHaveTextContent("188/188 HP");

    fireEvent(window, new CustomEvent(DEBUG_ACTION_EVENT, { detail: "reset" }));

    expect(screen.getByRole("heading", { level: 1, name: "Em combate" })).toBeVisible();
    expect(screen.queryByRole("status", { name: "Vida do boss debug" })).not.toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Power-ups debug" })).not.toBeInTheDocument();
    expect(screen.getByText("0/14 mobs")).toBeVisible();
  });

  it("restores stamina after it has been consumed", () => {
    render(<Home />);
    fireEvent.keyDown(window, { key: "F1" });
    fireEvent.click(screen.getByRole("button", { name: "Invocar Boss" }));
    fireEvent.keyDown(window, { key: " " });
    advanceFrames(18);
    fireEvent.keyUp(window, { key: " " });
    expect(burstStaminaText()).not.toHaveTextContent("100%");

    fireEvent.keyDown(window, { key: "F1" });
    fireEvent.click(screen.getByRole("button", { name: "Max Estamina" }));

    expect(burstStaminaText()).toHaveTextContent("100%");
  });

  it("opens the high-score entry screen after a debug victory", () => {
    render(<Home />);
    fireEvent.keyDown(window, { key: "F1" });

    fireEvent.click(screen.getByRole("button", { name: "Testar Tela de Vitória" }));

    expect(screen.getByRole("dialog", { name: "Ranking de maiores pontuações" })).toBeVisible();
    expect(screen.getByText("Missão completa")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Digite seu nome" })).toBeVisible();
  });

  it("ignores a forged debug event in production without side effects", async () => {
    vi.stubEnv("NODE_ENV", "production");
    render(<Home />);
    await waitFor(() => expect(localStorage.getItem("java-pleno-pixel-hunt-high-scores")).toBe("[]"));
    const before = snapshotGameState();

    fireEvent(window, new CustomEvent(DEBUG_ACTION_EVENT, { detail: "spawn_boss" }));

    expect(screen.getByRole("heading", { level: 1, name: "Pronto" })).toBeVisible();
    expect(screen.queryByText("Chefe em combate")).not.toBeInTheDocument();
    expect(snapshotGameState()).toEqual(before);
  });

  it("ignores a debug event outside the allowlist without side effects", async () => {
    render(<Home />);
    await waitFor(() => expect(localStorage.getItem("java-pleno-pixel-hunt-high-scores")).toBe("[]"));
    const before = snapshotGameState();

    fireEvent(window, new CustomEvent(DEBUG_ACTION_EVENT, { detail: "spawn-anything" }));

    expect(screen.getByRole("heading", { level: 1, name: "Pronto" })).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Ferramentas de debug" })).not.toBeInTheDocument();
    expect(snapshotGameState()).toEqual(before);
  });
});
