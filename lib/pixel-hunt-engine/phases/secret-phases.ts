// Dado puro (sem `react`) das fases secretas disponíveis no painel `idclip`
// (IDCLIPMENU-02, IDCLIPMENU-14). `graph: null` marca uma fase que ainda não
// tem `PhaseGraph` implementado — quando "Hell Branch" ganhar seu grafo real,
// a única mudança necessária aqui é trocar esse `null` pelo grafo (nenhuma
// mudança de UI é exigida, ver design.md).

import { secretMainframeGraph } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/graph";
import type { PhaseGraph } from "@/lib/pixel-hunt-engine/types";

export type SecretPhaseDefinition = {
  id: string;
  name: string;
  subtitle: string;
  tags: readonly string[];
  estimatedTime: string;
  difficulty: number;
  lockedHint: string;
  graph: PhaseGraph | null;
};

export const SECRET_PHASES: readonly SecretPhaseDefinition[] = [
  {
    id: "mainframe",
    name: "O Mainframe",
    subtitle: "Datacenter Esquecido",
    tags: ["4 fases", "Firewall 100", "Mobs 3+elite"],
    estimatedTime: "6-9 min",
    difficulty: 4,
    lockedHint: "",
    graph: secretMainframeGraph,
  },
  {
    id: "hell-branch",
    name: "Hell Branch",
    subtitle: "E1M1 Hangar de Deploys",
    tags: ["4 setores", "Tokens R/W/R", "Blackout"],
    estimatedTime: "8-12 min",
    difficulty: 5,
    lockedHint: "Onda 6 · DOOM.WAD",
    graph: null,
  },
  {
    id: "graveyard-shift",
    name: "Graveyard Shift",
    subtitle: "A Noite dos Deadlines Vivos",
    tags: ["Trick or Treat", "Full Moon", "Fog Samhain"],
    estimatedTime: "10-14 min",
    difficulty: 5,
    lockedHint: "2 secretas · idboo · ???",
    graph: null,
  },
  {
    id: "mar-stack-overflow",
    name: "Mar de Stack Overflow",
    subtitle: "A Baía dos Copy-Pastas",
    tags: ["Maré", "Abordagens", "Kraken"],
    estimatedTime: "8-10 min",
    difficulty: 3,
    lockedHint: "Lure-only · idyarr",
    graph: null,
  },
  {
    id: "glacier",
    name: "Glacier de Change Freeze",
    subtitle: "O Andar Congelado",
    tags: ["Inércia", "Blizzard", "Calor"],
    estimatedTime: "8-12 min",
    difficulty: 4,
    lockedHint: "Tag no-hit · idmelt",
    graph: null,
  },
  {
    id: "estacao-orbital",
    name: "Estação Orbital",
    subtitle: "Vácuo de Produção",
    tags: ["Zero-G", "Sucção", "Eclusas"],
    estimatedTime: "10-14 min",
    difficulty: 5,
    lockedHint: "Mainframe sem heal · idorbit",
    graph: null,
  },
  {
    id: "castelo-monolito",
    name: "Castelo do Monolito",
    subtitle: "Siege de Legacy",
    tags: ["Siege", "Óleo Fervente", "Dragão"],
    estimatedTime: "10-12 min",
    difficulty: 4,
    lockedHint: "Hell Branch purist · idsiege",
    graph: null,
  },
  {
    id: "meta-arcade",
    name: "Meta.Arcade",
    subtitle: "O Fliperama que Jogava de Volta",
    tags: ["Gênero Rotativo", "Glitch CRT", "Boss-Espelho"],
    estimatedTime: "12-15 min",
    difficulty: 5,
    lockedHint: "Konami code · idcoin",
    graph: null,
  },
];
