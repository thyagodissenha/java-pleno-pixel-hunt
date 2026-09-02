import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";

// Nenhuma chamada a skipOpeningCutsceneForTests() aqui de propósito — este
// arquivo testa justamente o comportamento da cutscene ainda ativa (não
// pulada), diferente dos outros specs de HUD que a pulam para testar o
// menu real.

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
  rect: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  stroke: vi.fn(),
  strokeText: vi.fn(),
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
      const pending = animationFrames.splice(0, animationFrames.length);
      pending.forEach((callback) => callback(frameTime));
    }
  });
}

describe("opening cutscene (not yet skipped)", () => {
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

  it("does not start a match when Space is pressed while the cutscene is still playing", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: "Pronto" })).toBeVisible();

    fireEvent.keyDown(window, { key: " " });
    advanceFrames(5);

    expect(screen.getByRole("heading", { level: 1, name: "Pronto" })).toBeVisible();
    expect(screen.queryByRole("heading", { level: 1, name: "Em combate" })).not.toBeInTheDocument();
  });

  it("does not navigate menu items with arrow keys while the cutscene is still playing", () => {
    render(<Home />);
    const playItem = screen.getByRole("menuitem", { name: /^▶?\s*Jogar$/ });
    expect(playItem).toHaveAttribute("aria-current", "true");

    fireEvent.keyDown(window, { key: "ArrowDown" });
    advanceFrames(5);

    expect(playItem).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("menuitem", { name: "High Scores" })).toHaveAttribute("aria-current", "false");
  });

  it("lets Space start a match normally once the cutscene has been dismissed via click", () => {
    render(<Home />);
    const cutsceneCanvas = document.querySelector(".cutscene-canvas");
    if (!cutsceneCanvas) throw new Error("Expected the opening cutscene canvas to be present");

    // 3 cenas x (pular a digitação + esperar o fade de saída) — dá tempo de
    // sobra pra cada transição de fade (FADE_SPEED faz ~0.45s ≈ 14 frames
    // de 33ms) e finaliza a cutscene.
    for (let scene = 0; scene < 3; scene += 1) {
      fireEvent.pointerDown(cutsceneCanvas);
      advanceFrames(20);
      fireEvent.pointerDown(cutsceneCanvas);
      advanceFrames(20);
    }

    expect(document.querySelector(".cutscene-overlay")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByRole("heading", { level: 1, name: "Em combate" })).toBeVisible();
  });
});
