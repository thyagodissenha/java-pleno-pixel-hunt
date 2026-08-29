import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

function typeKeys(keys: string) {
  for (const key of keys) fireEvent.keyDown(window, { key });
}

describe("hidden skins menu", () => {
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

  it("opens the placeholder skins panel when iddqd is typed at the menu", () => {
    render(<Home />);

    typeKeys("iddqd");

    expect(screen.getByRole("dialog", { name: "Personagens e Skins" })).toBeVisible();
    expect(screen.getByText("Sistema em construção. Em breve você poderá escolher personagens e skins alternativos.")).toBeVisible();
  });

  it("opens the placeholder skins panel when idkfa is typed at the menu", () => {
    render(<Home />);

    typeKeys("idkfa");

    expect(screen.getByRole("dialog", { name: "Personagens e Skins" })).toBeVisible();
  });

  it("does not open the panel for unrelated keystrokes", () => {
    render(<Home />);

    typeKeys("hello");

    expect(screen.queryByRole("dialog", { name: "Personagens e Skins" })).not.toBeInTheDocument();
  });

  it("returns to the home menu from the skins panel", () => {
    render(<Home />);
    typeKeys("iddqd");

    fireEvent.click(screen.getByRole("button", { name: "Voltar ao início" }));

    expect(screen.queryByRole("dialog", { name: "Personagens e Skins" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^▶?\s*Jogar$/ })).toBeVisible();
  });

  it("ignores the cheat code once a match has started and the menu is left", () => {
    render(<Home />);

    act(() => {
      fireEvent.click(screen.getByRole("menuitem", { name: /^▶?\s*Jogar$/ }));
    });
    typeKeys("iddqd");

    expect(screen.queryByRole("dialog", { name: "Personagens e Skins" })).not.toBeInTheDocument();
  });
});
