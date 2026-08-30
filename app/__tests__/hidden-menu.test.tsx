import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { CHARACTERS } from "@/lib/characters";

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

    const dialog = screen.getByRole("dialog", { name: "Personagens e Skins" });
    expect(dialog).toBeVisible();
    expect(within(dialog).getByRole("heading", { name: "Dev Pleno" })).toBeVisible();
    expect(within(dialog).getByText("100")).toBeVisible();
    expect(within(dialog).getByText("210")).toBeVisible();
    expect(within(dialog).getByText("24")).toBeVisible();
    expect(within(dialog).getByText("Refactor Dash", { exact: false })).toBeVisible();
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

  it("ignores the cheat code while viewing the High Scores submenu", () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("menuitem", { name: "High Scores" }));

    typeKeys("iddqd");

    expect(screen.queryByRole("dialog", { name: "Personagens e Skins" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "High Scores" })).toBeVisible();
  });

  it("discards a partial buffer accumulated before leaving the home panel", () => {
    render(<Home />);
    typeKeys("id");
    fireEvent.click(screen.getByRole("menuitem", { name: "High Scores" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao início" }));

    typeKeys("dqd");

    expect(screen.queryByRole("dialog", { name: "Personagens e Skins" })).not.toBeInTheDocument();
  });

  it("renders one selectable radio card per registry character, Dev Pleno checked by default (CHAR-21, CHAR-22)", () => {
    render(<Home />);
    typeKeys("iddqd");

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(CHARACTERS.length);
    for (const character of CHARACTERS) {
      const radio = screen.getByRole("radio", { name: new RegExp(character.name) });
      expect(radio).toHaveAttribute(
        "aria-checked",
        character.id === CHARACTERS[0].id ? "true" : "false",
      );
    }
  });

  it("moves aria-checked to the clicked character card (CHAR-22)", () => {
    render(<Home />);
    typeKeys("iddqd");

    const estagiario = CHARACTERS.find((character) => character.id === "estagiario");
    if (!estagiario) throw new Error("Expected an Estagiário entry in CHARACTERS for this test");

    fireEvent.click(screen.getByRole("radio", { name: new RegExp(estagiario.name) }));

    expect(screen.getByRole("radio", { name: new RegExp(estagiario.name) })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: new RegExp(CHARACTERS[0].name) })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("starts the next match with the selected character's maxHp instead of the default's (CHAR-22)", () => {
    render(<Home />);
    typeKeys("iddqd");

    const estagiario = CHARACTERS.find((character) => character.id === "estagiario");
    if (!estagiario) throw new Error("Expected an Estagiário entry in CHARACTERS for this test");

    fireEvent.click(screen.getByRole("radio", { name: new RegExp(estagiario.name) }));
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Jogar" }));
    });

    expect(screen.getByText(String(estagiario.maxHp))).toBeVisible();
  });

  it("resets the selection back to the default character on a fresh render, simulating a reload (CHAR-23)", () => {
    const { unmount } = render(<Home />);
    typeKeys("iddqd");
    const estagiario = CHARACTERS.find((character) => character.id === "estagiario");
    if (!estagiario) throw new Error("Expected an Estagiário entry in CHARACTERS for this test");
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(estagiario.name) }));
    expect(screen.getByRole("radio", { name: new RegExp(estagiario.name) })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    unmount();

    render(<Home />);
    typeKeys("iddqd");

    expect(screen.getByRole("radio", { name: new RegExp(CHARACTERS[0].name) })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("draws a static portrait canvas for every character card when the skins panel opens (CHAR-21)", () => {
    render(<Home />);
    const fillRectCallsBefore = canvasContext.fillRect.mock.calls.length;

    typeKeys("iddqd");

    const dialog = screen.getByRole("dialog", { name: "Personagens e Skins" });
    const canvases = dialog.querySelectorAll("canvas");
    expect(canvases).toHaveLength(CHARACTERS.length);
    expect(canvasContext.fillRect.mock.calls.length).toBeGreaterThan(fillRectCallsBefore);
  });

  it("re-opens the skins panel without throwing and keeps exactly one portrait canvas per card (CHAR-21 edge case)", () => {
    render(<Home />);
    typeKeys("iddqd");
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao início" }));

    expect(() => typeKeys("iddqd")).not.toThrow();

    const dialog = screen.getByRole("dialog", { name: "Personagens e Skins" });
    expect(dialog.querySelectorAll("canvas")).toHaveLength(CHARACTERS.length);
  });
});
