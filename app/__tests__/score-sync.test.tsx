import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";

const HIGH_SCORE_KEY = "java-pleno-pixel-hunt-high-scores";
const pendingScore = {
  name: "OFFLINE DEV",
  score: 900,
  wave: 3,
  resets: 1,
  outcome: "over" as const,
  createdAt: "2026-08-27T12:00:00.000Z",
};
const server = setupServer();
const canvasContext = {
  fillRect: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  save: vi.fn(),
  strokeRect: vi.fn(),
  translate: vi.fn(),
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

describe("offline score synchronization", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv("NODE_ENV", "development");
    const interceptedFetch = globalThis.fetch;
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? new URL(input, "http://localhost") : input;
      return interceptedFetch(url, init);
    });
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
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

  it("preserves a submitted score in localStorage when the network fails", async () => {
    server.use(
      http.get("http://localhost/api/scores", () => HttpResponse.json({ scores: [] })),
      http.post("http://localhost/api/scores", () => HttpResponse.error()),
    );
    render(<Home />);
    fireEvent.keyDown(window, { key: "F1" });
    fireEvent.click(screen.getByRole("button", { name: "Testar Tela de Vitória" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Digite seu nome" }), { target: { value: "Offline Dev" } });

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(HIGH_SCORE_KEY) ?? "[]")).toEqual([
        {
          name: "OFFLINE DEV",
          score: 0,
          wave: 1,
          resets: 0,
          outcome: "won",
          createdAt: expect.any(String),
        },
      ]);
    });
  });

  it("retries a pending local score when the page loads", async () => {
    localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify([pendingScore]));
    let syncedBody: unknown;
    server.use(
      http.get("http://localhost/api/scores", () => HttpResponse.json({ scores: [] })),
      http.post("http://localhost/api/scores", async ({ request }) => {
        syncedBody = await request.json();
        return HttpResponse.json({ scores: [pendingScore], storage: "blob" }, { status: 201 });
      }),
    );

    render(<Home />);

    await waitFor(() => expect(syncedBody).toEqual(pendingScore));
    expect(JSON.parse(localStorage.getItem(HIGH_SCORE_KEY) ?? "[]")).toEqual([pendingScore]);
  });

  it("retries a pending local score when the browser comes online", async () => {
    localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify([pendingScore]));
    let getAttempts = 0;
    let postAttempts = 0;
    server.use(
      http.get("http://localhost/api/scores", () => {
        getAttempts += 1;
        return getAttempts === 1 ? HttpResponse.error() : HttpResponse.json({ scores: [] });
      }),
      http.post("http://localhost/api/scores", () => {
        postAttempts += 1;
        return HttpResponse.json({ scores: [pendingScore], storage: "blob" }, { status: 201 });
      }),
    );
    render(<Home />);
    await waitFor(() => expect(getAttempts).toBe(1));

    act(() => window.dispatchEvent(new Event("online")));

    await waitFor(() => expect(postAttempts).toBe(1));
    expect(JSON.parse(localStorage.getItem(HIGH_SCORE_KEY) ?? "[]")).toEqual([pendingScore]);
  });
});
