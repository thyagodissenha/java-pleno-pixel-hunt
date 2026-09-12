import { describe, expect, it, vi } from "vitest";
import { drawActor } from "@/lib/pixel-hunt-engine/renderer/actors";
import type { Actor } from "@/lib/pixel-hunt-engine/types";

// Fix cycle 2 (SECBOSS-01): `drawActor`'s generic health bar always reads
// `actor.hp`/`actor.maxHp` — for the `secretBoss`, whose hp/maxHp are forced
// to a fixed "sentinel" value every frame (`syncBossHpSentinel`,
// `phases/secret-mainframe/index.ts`), this bar always rendered ~100%
// full/green, contradicting the real progress shown by the dedicated HUD
// (`drawSecretPhaseHud`). `Actor.hideHealthBar?` (types.ts) suppresses it.
//
// No real canvas is needed: a fake `CanvasRenderingContext2D` records every
// `fillRect` call together with the `fillStyle` in effect at call time
// (mirroring `pixelRect`'s `ctx.fillStyle = color; ctx.fillRect(...)`
// pattern) — the health bar's fill color (`#84cc16`) is a reliable,
// implementation-stable marker for "the bar was drawn".
function makeRecordingCtx() {
  const fillRectCalls: Array<{ fillStyle: string; x: number; y: number; w: number; h: number }> = [];
  const ctx = {
    fillStyle: "",
    font: "",
    textAlign: "start" as CanvasTextAlign,
    fillRect(x: number, y: number, w: number, h: number) {
      fillRectCalls.push({ fillStyle: (ctx as unknown as { fillStyle: string }).fillStyle, x, y, w, h });
    },
    fillText: vi.fn(),
  } as unknown as CanvasRenderingContext2D & { fillRectCalls: typeof fillRectCalls };
  (ctx as unknown as { fillRectCalls: typeof fillRectCalls }).fillRectCalls = fillRectCalls;
  return ctx as CanvasRenderingContext2D & { fillRectCalls: typeof fillRectCalls };
}

function makeActor(overrides: Partial<Actor> = {}): Actor {
  return {
    x: 100,
    y: 100,
    vx: 0,
    vy: 0,
    hp: 260,
    maxHp: 520,
    speed: 0,
    size: 64,
    kind: "secretBoss",
    label: "O Mainframe",
    ...overrides,
  };
}

describe("drawActor — hideHealthBar (fix cycle 2, SECBOSS-01)", () => {
  it("does not draw the generic health bar fill when hideHealthBar is true", () => {
    const ctx = makeRecordingCtx();
    const actor = makeActor({ hideHealthBar: true });

    drawActor(ctx, actor, 0);

    const barFillCalls = ctx.fillRectCalls.filter((call) => call.fillStyle === "#84cc16");
    expect(barFillCalls).toHaveLength(0);
  });

  it("draws the generic health bar fill when hideHealthBar is not set (no regression for other Actors)", () => {
    const ctx = makeRecordingCtx();
    const actor = makeActor({ kind: "daemon", label: "Daemon", hideHealthBar: undefined });

    drawActor(ctx, actor, 0);

    const barFillCalls = ctx.fillRectCalls.filter((call) => call.fillStyle === "#84cc16");
    expect(barFillCalls).toHaveLength(1);
    // Reflete a proporção real hp/maxHp (260/520 = 0.5 * actor.size = 32).
    expect(barFillCalls[0].w).toBe(32);
  });
});
