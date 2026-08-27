import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";

const canvasContext = {
  fillRect: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  save: vi.fn(),
  strokeRect: vi.fn(),
  translate: vi.fn(),
};

let animationFrames: FrameRequestCallback[];
let frameTime: number;

function advanceFrames(amount: number) {
  act(() => {
    for (let index = 0; index < amount; index += 1) {
      const callback = animationFrames.shift();
      frameTime += 33;
      callback?.(frameTime);
    }
  });
}

describe("game debug tools", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ scores: [] })));
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
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("toggles the debug HUD with F1 and focuses its first action", () => {
    render(<Home />);

    fireEvent.keyDown(window, { key: "F1" });

    expect(screen.getByRole("dialog", { name: "Ferramentas de debug" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Invocar Boss" })).toHaveFocus();

    fireEvent.keyDown(window, { key: "F1" });

    expect(screen.queryByRole("dialog", { name: "Ferramentas de debug" })).not.toBeInTheDocument();
  });

  it("invokes a full-health boss and starts the match", () => {
    render(<Home />);
    fireEvent.keyDown(window, { key: "F1" });

    fireEvent.click(screen.getByRole("button", { name: "Invocar Boss" }));

    expect(screen.getByRole("heading", { level: 1, name: "Em combate" })).toBeVisible();
    expect(screen.getByText("Chefe em combate")).toBeVisible();
  });

  it("restores stamina after it has been consumed", () => {
    render(<Home />);
    fireEvent.keyDown(window, { key: "F1" });
    fireEvent.click(screen.getByRole("button", { name: "Invocar Boss" }));
    fireEvent.keyDown(window, { key: " " });
    advanceFrames(18);
    fireEvent.keyUp(window, { key: " " });
    expect(screen.getByText(/^\d+%$/)).not.toHaveTextContent("100%");

    fireEvent.keyDown(window, { key: "F1" });
    fireEvent.click(screen.getByRole("button", { name: "Max Estamina" }));

    expect(screen.getByText("100%")).toBeVisible();
  });

  it("opens the high-score entry screen after a debug victory", () => {
    render(<Home />);
    fireEvent.keyDown(window, { key: "F1" });

    fireEvent.click(screen.getByRole("button", { name: "Testar Tela de Vitória" }));

    expect(screen.getByRole("dialog", { name: "Ranking de maiores pontuações" })).toBeVisible();
    expect(screen.getByText("Missão completa")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Digite seu nome" })).toBeVisible();
  });
});
