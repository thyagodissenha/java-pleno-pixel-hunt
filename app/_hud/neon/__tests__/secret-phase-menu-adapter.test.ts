import { describe, expect, it } from "vitest";
import { toMenuPhases } from "@/app/_hud/neon/secret-phase-menu-adapter";
import type { SecretPhaseCard } from "@/app/_hud/hud-props";

// REACTOFICIAL-02: `toMenuPhases` é o único ponto que converte o dado canônico
// (`SecretPhaseCard`) pro formato que `PhaseSelectMenu` espera — cobre especificamente o detalhe
// que mais importa: `id` vira o ÍNDICE (não a string de `SECRET_PHASES`), porque é isso que
// `confirmSecretPhaseSelection(index)` recebe de volta via `onSelect`.
describe("secret phase menu adapter (REACTOFICIAL-02)", () => {
  const cards: SecretPhaseCard[] = [
    {
      id: "mainframe",
      name: "O Mainframe",
      subtitle: "Datacenter Esquecido",
      tags: ["4 fases", "Firewall 100"],
      estimatedTime: "6-9 min",
      difficulty: 4,
      locked: false,
      lockedHint: "",
    },
    {
      id: "hell-branch",
      name: "Hell Branch",
      subtitle: "E1M1 Hangar de Deploys",
      tags: ["4 setores"],
      estimatedTime: "8-12 min",
      difficulty: 5,
      locked: true,
      lockedHint: "Onda 6 · DOOM.WAD",
    },
  ];

  it("uses the array index as id, not the canonical string id", () => {
    const [mainframe, hellBranch] = toMenuPhases(cards);
    expect(mainframe.id).toBe(0);
    expect(hellBranch.id).toBe(1);
  });

  it("maps name/subtitle/time uppercased, tags/diff/unlock as-is from the canonical data", () => {
    const [mainframe, hellBranch] = toMenuPhases(cards);
    expect(mainframe.name).toBe("O MAINFRAME");
    expect(mainframe.sub).toBe("DATACENTER ESQUECIDO");
    expect(mainframe.time).toBe("6-9 MIN");
    expect(mainframe.tags).toEqual(["4 fases", "Firewall 100"]);
    expect(mainframe.diff).toBe(4);
    expect(hellBranch.unlock).toBe("Onda 6 · DOOM.WAD");
  });

  it("falls back to a generic unlock label when lockedHint is empty (unlocked phase)", () => {
    const [mainframe] = toMenuPhases(cards);
    expect(mainframe.unlock).toBe("DESBLOQUEADO");
  });

  it("attaches the phase's own color/cheat visuals by canonical id", () => {
    const [mainframe, hellBranch] = toMenuPhases(cards);
    expect(mainframe.col).toBe("#d4ff5e");
    expect(mainframe.cheat).toBe("IDCLIP");
    expect(hellBranch.col2).toBe("#f53b3b");
  });
});
