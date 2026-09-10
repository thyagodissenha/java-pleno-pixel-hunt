import { describe, expect, it } from "vitest";
import { secretMainframeGraph } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/graph";

describe("secretMainframeGraph (PHASEFLOW-07)", () => {
  it("entry/nodes produce an EnginePhase with id 'secret-mainframe'", () => {
    expect(secretMainframeGraph.entry).toBe("secret-mainframe");

    const phase = secretMainframeGraph.nodes[secretMainframeGraph.entry]();

    expect(phase.id).toBe("secret-mainframe");
  });

  it("has no outgoing transition for its only node — a terminal node never transitions", () => {
    expect(secretMainframeGraph.transitions["secret-mainframe"]).toBeUndefined();
  });
});
