import type { SecretPhaseCard } from "@/app/_hud/hud-props";
import type { Phase } from "@/app/_hud/neon/PhaseSelectMenu";

// REACTOFICIAL-02: `SECRET_PHASES`/`secretPhases` (fonte canônica) nunca teve cor ou "cheat" de
// exibição — são dados puramente visuais do mockup, sem equivalente no domínio real. Mantidos
// aqui, só no ponto de integração, em vez de mudar o schema canônico (`SecretPhaseDefinition`)
// por um campo decorativo. Valores extraídos 1:1 de `DEFAULT_PHASES` (PhaseSelectMenu.tsx).
export const PHASE_VISUALS: Record<string, { col: string; col2: string; cheat: string }> = {
  mainframe: { col: "#d4ff5e", col2: "#5fd8c0", cheat: "IDCLIP" },
  "hell-branch": { col: "#ff7f2a", col2: "#f53b3b", cheat: "IDCLIP" },
  "graveyard-shift": { col: "#b678ff", col2: "#59d31f", cheat: "IDBOO" },
  "mar-stack-overflow": { col: "#f5d33b", col2: "#1a6e7a", cheat: "IDYARR" },
  glacier: { col: "#bfe8f2", col2: "#3b66f5", cheat: "IDMELT" },
  "estacao-orbital": { col: "#7dffe0", col2: "#ff5a4d", cheat: "IDORBIT" },
  "castelo-monolito": { col: "#f5d33b", col2: "#a32020", cheat: "IDSIEGE" },
  "meta-arcade": { col: "#ff3ba3", col2: "#3bfff5", cheat: "IDCOIN" },
};

// `Phase.id` é o ÍNDICE dentro do array (0-7), não a string de `SECRET_PHASES` — é o que
// `confirmSecretPhaseSelection(index)` espera receber de volta via `onSelect`.
export function toMenuPhases(secretPhases: readonly SecretPhaseCard[]): Phase[] {
  return secretPhases.map((phase, index) => ({
    id: index,
    name: phase.name.toUpperCase(),
    sub: phase.subtitle.toUpperCase(),
    tags: [...phase.tags],
    time: phase.estimatedTime.toUpperCase(),
    diff: phase.difficulty,
    unlock: phase.lockedHint || "DESBLOQUEADO",
    ...PHASE_VISUALS[phase.id],
  }));
}
