"use client";

import PhaseSelectMenu from "@/app/_hud/neon/PhaseSelectMenu";

// Rota de estudo isolada (_docs/specs/features/estudo-menu-idclip-react/spec.md) — porta pro
// projeto `_docs/game-design/IDCLIP_React/PhaseSelectMenu.jsx`, uma implementação alternativa do
// menu secreto em React+DOM (não canvas), achada pronta na pasta e nunca integrada. Sem nenhuma
// ligação com o painel oficial `secret-phase-panel.tsx` — `unlocked` reflete o mesmo invariante já
// estabelecido no resto do projeto (só "O Mainframe" jogável, o resto bloqueado). `onSelect`
// (MFLAUNCH-01/04, mesmo padrão já usado em `estudo-menu-idclip-v14`) redireciona só o Mainframe
// (id 0) pro jogo real via `/?autostart=mainframe` (app/page.tsx já trata esse parâmetro) — as
// outras 7 fases continuam com o fallback de toast do próprio componente.
const ONLY_MAINFRAME_UNLOCKED = [true, false, false, false, false, false, false, false];

function handlePhaseSelect(id: number) {
  if (id === 0) {
    window.location.assign("/?autostart=mainframe");
    return true;
  }
}

export default function EstudoMenuIdclipReact() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        margin: 0,
        padding: "24px 0",
        background: "#070b0d",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
      <PhaseSelectMenu unlocked={ONLY_MAINFRAME_UNLOCKED} onSelect={handlePhaseSelect} />
    </main>
  );
}
