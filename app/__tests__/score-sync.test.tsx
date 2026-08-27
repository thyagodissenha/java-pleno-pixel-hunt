import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";

const HIGH_SCORE_KEY = "java-pleno-pixel-hunt-high-scores";
const PENDING_SCORE_KEY = "java-pleno-pixel-hunt-pending-scores";
const pendingScore = {
  name: "OFFLINE DEV",
  score: 900,
  wave: 3,
  resets: 1,
  outcome: "over" as const,
  createdAt: "2026-08-27T12:00:00.000Z",
};
const pendingEntry = {
  version: 1,
  submissionId: "11111111-1111-4111-8111-111111111111",
  score: pendingScore,
  enqueuedAt: "2026-08-27T12:00:01.000Z",
  attempts: 0,
  lastAttemptAt: null,
};
const secondPendingScore = {
  ...pendingScore,
  name: "SECOND DEV",
  score: 800,
  createdAt: "2026-08-27T12:00:02.000Z",
};
const secondPendingEntry = {
  ...pendingEntry,
  submissionId: "33333333-3333-4333-8333-333333333333",
  score: secondPendingScore,
  enqueuedAt: "2026-08-27T12:00:03.000Z",
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
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("preserves a submitted score in localStorage when the network fails", async () => {
    const animationFrames: FrameRequestCallback[] = [];
    let frameTime = performance.now();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(Math, "atan2").mockReturnValue(0);
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("22222222-2222-4222-8222-222222222222");
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    }));
    server.use(
      http.get("http://localhost/api/scores", () => HttpResponse.json({ scores: [] })),
      http.post("http://localhost/api/scores", () => HttpResponse.error()),
    );
    render(<Home />);
    fireEvent.click(screen.getByRole("menuitem", { name: "▶ Jogar" }));
    for (let batch = 0; batch < 20 && !screen.queryByRole("textbox", { name: "Digite seu nome" }); batch += 1) {
      act(() => {
        for (let frame = 0; frame < 100; frame += 1) {
          const callback = animationFrames.shift();
          frameTime += 33;
          callback?.(frameTime);
        }
      });
    }
    fireEvent.change(screen.getByRole("textbox", { name: "Digite seu nome" }), { target: { value: "Offline Dev" } });

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const savedScore = {
        name: "OFFLINE DEV",
        score: 0,
        wave: 1,
        resets: 0,
        outcome: "over",
        createdAt: expect.any(String),
      };
      expect(JSON.parse(localStorage.getItem(HIGH_SCORE_KEY) ?? "[]")).toEqual([savedScore]);
      expect(JSON.parse(localStorage.getItem(PENDING_SCORE_KEY) ?? "[]")).toEqual([
        {
          version: 1,
          submissionId: "22222222-2222-4222-8222-222222222222",
          score: savedScore,
          enqueuedAt: expect.any(String),
          attempts: 0,
          lastAttemptAt: null,
        },
      ]);
    });
  });

  it("does not submit or enqueue a score from a debug run", async () => {
    let postAttempts = 0;
    server.use(
      http.get("http://localhost/api/scores", () => HttpResponse.json({ scores: [] })),
      http.post("http://localhost/api/scores", () => {
        postAttempts += 1;
        return HttpResponse.json({ scores: [] }, { status: 201 });
      }),
    );
    render(<Home />);
    fireEvent.keyDown(window, { key: "F1" });
    fireEvent.click(screen.getByRole("button", { name: "Invocar Boss" }));
    fireEvent.keyDown(window, { key: "F1" });
    fireEvent.click(screen.getByRole("button", { name: "Testar Tela de Vitória" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Digite seu nome" }), {
      target: { value: "Debug Dev" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(screen.getByText("Score de debug não enviado.")).toBeVisible());
    expect(postAttempts).toBe(0);
    expect(localStorage.getItem(PENDING_SCORE_KEY)).toBeNull();
  });

  it("retries a pending own score with its stable id when the page loads", async () => {
    localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify([pendingScore]));
    localStorage.setItem(PENDING_SCORE_KEY, JSON.stringify([pendingEntry]));
    let syncedBody: unknown;
    let idempotencyKey: string | null = null;
    server.use(
      http.get("http://localhost/api/scores", () => HttpResponse.json({ scores: [] })),
      http.post("http://localhost/api/scores", async ({ request }) => {
        syncedBody = await request.json();
        idempotencyKey = request.headers.get("Idempotency-Key");
        return HttpResponse.json({ scores: [pendingScore], storage: "blob" }, { status: 201 });
      }),
    );

    render(<Home />);

    await waitFor(() => expect(syncedBody).toEqual(pendingScore));
    expect(idempotencyKey).toBe(pendingEntry.submissionId);
    expect(JSON.parse(localStorage.getItem(PENDING_SCORE_KEY) ?? "[]")).toEqual([]);
    expect(JSON.parse(localStorage.getItem(HIGH_SCORE_KEY) ?? "[]")).toEqual([pendingScore]);
  });

  it("retries a pending local score when the browser comes online", async () => {
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

    localStorage.setItem(PENDING_SCORE_KEY, JSON.stringify([pendingEntry]));
    act(() => window.dispatchEvent(new Event("online")));

    await waitFor(() => expect(postAttempts).toBe(1));
    expect(JSON.parse(localStorage.getItem(PENDING_SCORE_KEY) ?? "[]")).toEqual([]);
  });

  it("drains pending scores in FIFO order with ten seconds between POST starts", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime("2026-08-27T13:00:00.000Z");
    localStorage.setItem(PENDING_SCORE_KEY, JSON.stringify([pendingEntry, secondPendingEntry]));
    const postedNames: string[] = [];
    const postStarts: number[] = [];
    server.use(
      http.get("http://localhost/api/scores", () => HttpResponse.json({ scores: [] })),
      http.post("http://localhost/api/scores", async ({ request }) => {
        postStarts.push(Date.now());
        postedNames.push(((await request.json()) as { name: string }).name);
        return HttpResponse.json(
          { scores: [], storage: "blob", idempotent: postedNames.length === 1 },
          { status: postedNames.length === 1 ? 200 : 201 },
        );
      }),
    );

    render(<Home />);
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.waitFor(() => expect(postedNames).toEqual([pendingScore.name, secondPendingScore.name]));

    expect(postStarts[1] - postStarts[0]).toBeGreaterThanOrEqual(10_000);
    expect(JSON.parse(localStorage.getItem(PENDING_SCORE_KEY) ?? "[]")).toEqual([]);
  });

  it("shares one drain when load and online overlap", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.setItem(PENDING_SCORE_KEY, JSON.stringify([pendingEntry, secondPendingEntry]));
    let releaseFirst!: () => void;
    let inFlight = 0;
    let maxInFlight = 0;
    let postAttempts = 0;
    const firstResponse = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    server.use(
      http.get("http://localhost/api/scores", () => HttpResponse.json({ scores: [] })),
      http.post("http://localhost/api/scores", async () => {
        postAttempts += 1;
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        if (postAttempts === 1) await firstResponse;
        inFlight -= 1;
        return HttpResponse.json({ scores: [], storage: "blob" }, { status: 201 });
      }),
    );

    render(<Home />);
    await vi.waitFor(() => expect(postAttempts).toBe(1));
    act(() => {
      window.dispatchEvent(new Event("online"));
      window.dispatchEvent(new Event("online"));
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(postAttempts).toBe(1);

    releaseFirst();
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.waitFor(() => expect(postAttempts).toBe(2));
    expect(maxInFlight).toBe(1);
  });

  it.each([
    ["network", () => HttpResponse.error()],
    ["429", () => HttpResponse.json({ error: "wait" }, { status: 429 })],
    ["503", () => HttpResponse.json({ error: "unavailable" }, { status: 503 })],
  ])("keeps the current item and stops the drain after a %s failure", async (_kind, response) => {
    localStorage.setItem(PENDING_SCORE_KEY, JSON.stringify([pendingEntry, secondPendingEntry]));
    let postAttempts = 0;
    server.use(
      http.get("http://localhost/api/scores", () => HttpResponse.json({ scores: [] })),
      http.post("http://localhost/api/scores", () => {
        postAttempts += 1;
        return response();
      }),
    );

    render(<Home />);

    await waitFor(() => {
      const queue = JSON.parse(localStorage.getItem(PENDING_SCORE_KEY) ?? "[]");
      expect(queue).toEqual([
        { ...pendingEntry, attempts: 1, lastAttemptAt: expect.any(String) },
        secondPendingEntry,
      ]);
    });
    expect(postAttempts).toBe(1);
  });

  it("does not post or schedule a drain timer for an empty queue", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");
    let getAttempts = 0;
    let postAttempts = 0;
    server.use(
      http.get("http://localhost/api/scores", () => {
        getAttempts += 1;
        return HttpResponse.json({ scores: [] });
      }),
      http.post("http://localhost/api/scores", () => {
        postAttempts += 1;
        return HttpResponse.json({ scores: [] });
      }),
    );

    render(<Home />);
    await vi.waitFor(() => expect(getAttempts).toBe(1));
    await vi.advanceTimersByTimeAsync(0);

    expect(postAttempts).toBe(0);
    expect(setTimeoutSpy.mock.calls.some(([, delay]) => delay === 10_000)).toBe(false);
  });

  it("never turns scores loaded from GET into pending submissions", async () => {
    server.use(
      http.get("http://localhost/api/scores", () => HttpResponse.json({ scores: [pendingScore] })),
    );

    render(<Home />);

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(HIGH_SCORE_KEY) ?? "[]")).toEqual([pendingScore]);
    });
    expect(localStorage.getItem(PENDING_SCORE_KEY)).toBeNull();
  });

  it("keeps one valid pending entry per submission id and ignores malformed data", async () => {
    localStorage.setItem(PENDING_SCORE_KEY, JSON.stringify([
      pendingEntry,
      { ...pendingEntry },
      pendingScore,
      { ...pendingEntry, submissionId: "", score: { ...pendingScore, score: "third-party" } },
    ]));
    const submittedIds: Array<string | null> = [];
    server.use(
      http.get("http://localhost/api/scores", () => HttpResponse.json({ scores: [] })),
      http.post("http://localhost/api/scores", ({ request }) => {
        submittedIds.push(request.headers.get("Idempotency-Key"));
        return HttpResponse.json({ scores: [pendingScore], storage: "blob" }, { status: 201 });
      }),
    );

    render(<Home />);

    await waitFor(() => expect(submittedIds).toEqual([pendingEntry.submissionId]));
    expect(JSON.parse(localStorage.getItem(PENDING_SCORE_KEY) ?? "[]")).toEqual([]);
  });
});
