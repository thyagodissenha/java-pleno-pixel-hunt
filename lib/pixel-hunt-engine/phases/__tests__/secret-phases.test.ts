import { describe, expect, it } from "vitest";
import { SECRET_PHASES } from "@/lib/pixel-hunt-engine/phases/secret-phases";
import { secretMainframeGraph } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/graph";

describe("SECRET_PHASES (menu-secreto-idclip data)", () => {
  // IDCLIPV14-07/09: o painel v1.4 cresce de 2 pra 8 fases (mockup
  // `_docs/game-design/IDCLIP v1.4.html`), na mesma ordem do array `PH`.
  it("has exactly 8 entries", () => {
    expect(SECRET_PHASES).toHaveLength(8);
  });

  it("has unique ids across all entries, in the mockup v1.4 order", () => {
    const ids = SECRET_PHASES.map((phase) => phase.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      "mainframe",
      "hell-branch",
      "graveyard-shift",
      "mar-stack-overflow",
      "glacier",
      "estacao-orbital",
      "castelo-monolito",
      "meta-arcade",
    ]);
  });

  it("the mainframe entry references the real secretMainframeGraph (same reference, not a copy)", () => {
    const mainframe = SECRET_PHASES.find((phase) => phase.id === "mainframe");
    expect(mainframe).toBeDefined();
    expect(mainframe?.graph).toBe(secretMainframeGraph);
  });

  it("every non-mainframe entry has graph: null (only 'O Mainframe' is playable, IDCLIPV14-07)", () => {
    const nonMainframe = SECRET_PHASES.filter((phase) => phase.id !== "mainframe");
    expect(nonMainframe).toHaveLength(7);
    nonMainframe.forEach((phase) => {
      expect(phase.graph).toBeNull();
    });
  });

  it("every entry has all required fields populated", () => {
    for (const phase of SECRET_PHASES) {
      expect(phase.id).toBeTruthy();
      expect(phase.name).toBeTruthy();
      expect(phase.subtitle).toBeTruthy();
      expect(Array.isArray(phase.tags)).toBe(true);
      expect(phase.tags.length).toBeGreaterThan(0);
      expect(phase.estimatedTime).toBeTruthy();
      expect(typeof phase.difficulty).toBe("number");
      expect(typeof phase.lockedHint).toBe("string");
    }
  });
});
