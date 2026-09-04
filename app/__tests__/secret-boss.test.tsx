import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { skipOpeningCutsceneForTests } from "@/app/_hud/cutscene/OpeningCutscene";

skipOpeningCutsceneForTests();

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
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

function typeKeys(keys: string) {
  for (const key of keys) fireEvent.keyDown(window, { key });
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
  });

  it("starts a real run against the secret boss when idclip is typed at the menu", () => {
    render(<Home />);

    typeKeys("idclip");

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

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Sair do jogo" }));

    expect(screen.getByRole("heading", { name: "Pronto" })).toBeVisible();
    const bossCard = screen.getByText("Chefe atual").closest(".boss-card");
    expect(bossCard).not.toBeNull();
    expect(within(bossCard as HTMLElement).getByText("Gerente de Sprint")).toBeVisible();
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
