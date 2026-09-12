import { describe, expect, it } from "vitest";
import { CONFIG } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/config";
import {
  advanceBreakFx,
  applyBarDamage,
  createFirewallState,
  registerKill,
  tryBreakShield,
} from "@/lib/pixel-hunt-engine/phases/secret-mainframe/firewall";

describe("createFirewallState (SECBOSS-01, SECBOSS-12)", () => {
  it("starts in SHIELD, phase 1, counter 0, bar full at CONFIG.BAR_HP", () => {
    const state = createFirewallState();

    expect(state.mode).toBe("SHIELD");
    expect(state.phaseIndex).toBe(1);
    expect(state.counter).toBe(0);
    expect(state.barHp).toBe(CONFIG.BAR_HP);
    expect(state.barMaxHp).toBe(CONFIG.BAR_HP);
    expect(state.won).toBe(false);
  });
});

describe("registerKill (SECBOSS-02..05)", () => {
  it("increments the counter by the normal weight during SHIELD", () => {
    const state = createFirewallState();
    const next = registerKill(state, CONFIG.W_PTS.normal);
    expect(next.counter).toBe(CONFIG.W_PTS.normal);
  });

  it("increments the counter by the elite weight (Cobra COBOL) during SHIELD", () => {
    const state = createFirewallState();
    const next = registerKill(state, CONFIG.W_PTS.elite);
    expect(next.counter).toBe(CONFIG.W_PTS.elite);
  });

  it("increments the counter by the reduced respawned-cron weight during SHIELD", () => {
    const state = createFirewallState();
    const next = registerKill(state, CONFIG.W_PTS.respawned);
    expect(next.counter).toBe(CONFIG.W_PTS.respawned);
  });

  it("does not increment the counter when a kill happens during DPS (no carryover to next barrier)", () => {
    const dpsState = { ...createFirewallState(), mode: "DPS" as const, counter: 0 };
    const next = registerKill(dpsState, CONFIG.W_PTS.normal);
    expect(next.counter).toBe(0);
    expect(next).toEqual(dpsState);
  });

  it("does not increment the counter when a kill happens during BREAK_FX", () => {
    const breakState = { ...createFirewallState(), mode: "BREAK_FX" as const, counter: 0 };
    const next = registerKill(breakState, CONFIG.W_PTS.elite);
    expect(next.counter).toBe(0);
  });
});

describe("tryBreakShield (SECBOSS-06, SECBOSS-07)", () => {
  it("stays in SHIELD while counter is below CONFIG.SHIELD_NEED", () => {
    const state = { ...createFirewallState(), counter: CONFIG.SHIELD_NEED - 1 };
    const next = tryBreakShield(state);
    expect(next.mode).toBe("SHIELD");
  });

  it("transitions to BREAK_FX exactly when the counter reaches CONFIG.SHIELD_NEED", () => {
    const state = { ...createFirewallState(), counter: CONFIG.SHIELD_NEED };
    const next = tryBreakShield(state);
    expect(next.mode).toBe("BREAK_FX");
  });

  it("discards overkill: the counter resets to 0 on the break, never carrying the excess", () => {
    const overkillState = { ...createFirewallState(), counter: CONFIG.SHIELD_NEED + 47 };
    const next = tryBreakShield(overkillState);
    expect(next.mode).toBe("BREAK_FX");
    expect(next.counter).toBe(0);
  });

  it("is a no-op outside of SHIELD", () => {
    const dpsState = { ...createFirewallState(), mode: "DPS" as const, counter: CONFIG.SHIELD_NEED + 10 };
    const next = tryBreakShield(dpsState);
    expect(next).toEqual(dpsState);
  });
});

describe("advanceBreakFx", () => {
  it("keeps counting down while time remains in BREAK_FX", () => {
    const state = { ...createFirewallState(), mode: "BREAK_FX" as const, breakFxTimer: 1 };
    const next = advanceBreakFx(state, 0.4);
    expect(next.mode).toBe("BREAK_FX");
    expect(next.breakFxTimer).toBeCloseTo(0.6);
  });

  it("transitions to DPS once the timer reaches 0", () => {
    const state = { ...createFirewallState(), mode: "BREAK_FX" as const, breakFxTimer: 0.3 };
    const next = advanceBreakFx(state, 0.3);
    expect(next.mode).toBe("DPS");
    expect(next.breakFxTimer).toBe(0);
  });

  it("is a no-op outside of BREAK_FX", () => {
    const state = createFirewallState();
    const next = advanceBreakFx(state, 5);
    expect(next).toEqual(state);
  });
});

describe("applyBarDamage (SECBOSS-01 implicit, SECBOSS-09, SECBOSS-10, SECBOSS-12)", () => {
  it("is a no-op outside of DPS (core not exposed during SHIELD/BREAK_FX)", () => {
    const shieldState = createFirewallState();
    const afterShield = applyBarDamage(shieldState, 999);
    expect(afterShield).toEqual(shieldState);

    const breakState = { ...createFirewallState(), mode: "BREAK_FX" as const };
    const afterBreak = applyBarDamage(breakState, 999);
    expect(afterBreak).toEqual(breakState);
  });

  it("decrements barHp during DPS without changing phase while HP remains", () => {
    const state = { ...createFirewallState(), mode: "DPS" as const };
    const next = applyBarDamage(state, 40);
    expect(next.mode).toBe("DPS");
    expect(next.barHp).toBe(CONFIG.BAR_HP - 40);
    expect(next.phaseIndex).toBe(1);
  });

  it("advances to the next phase when the bar reaches 0 (phase < 4): re-erects SHIELD, resets counter, full bar", () => {
    const state = { ...createFirewallState(), mode: "DPS" as const, barHp: 10, counter: 999 };
    const next = applyBarDamage(state, 10);
    expect(next.mode).toBe("SHIELD");
    expect(next.phaseIndex).toBe(2);
    expect(next.counter).toBe(0);
    expect(next.barHp).toBe(CONFIG.BAR_HP);
    expect(next.barMaxHp).toBe(CONFIG.BAR_HP);
    expect(next.won).toBe(false);
  });

  it("uses the doubled bar size (CONFIG.FINAL_BAR_HP) once phase 4 is reached", () => {
    const phase3State = { ...createFirewallState(), mode: "DPS" as const, phaseIndex: 3 as const, barHp: 5 };
    const next = applyBarDamage(phase3State, 5);
    expect(next.phaseIndex).toBe(4);
    expect(next.barHp).toBe(CONFIG.FINAL_BAR_HP);
    expect(next.barMaxHp).toBe(CONFIG.FINAL_BAR_HP);
    expect(next.mode).toBe("SHIELD");
  });

  it("declares victory when the 4th bar reaches 0, without re-erecting the shield", () => {
    const finalBarState = { ...createFirewallState(), mode: "DPS" as const, phaseIndex: 4 as const, barHp: 15 };
    const next = applyBarDamage(finalBarState, 15);
    expect(next.won).toBe(true);
    expect(next.barHp).toBe(0);
    expect(next.mode).toBe("DPS");
  });
});
