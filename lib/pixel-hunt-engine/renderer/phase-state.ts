// Leitura do estado local da fase secreta a partir de `world.phaseState`.
// Fix2, T9 (ENGINE-29) — primeiro passo do split de `renderer.ts` em
// diretório; os demais submódulos desta pasta (`actors.ts`, `world.ts`)
// consomem esta função para desenhar entidades específicas da fase secreta.

import type { EngineWorld, SecretMainframePhaseState } from "@/lib/pixel-hunt-engine/types";

// `SecretMainframePhaseState` — tipo canônico em `types.ts` (fix2,
// ENGINE-28). O renderer só sabe desenhá-lo se ele existir (fluxo normal
// não o define).
export function readSecretPhaseState(world: EngineWorld): SecretMainframePhaseState | null {
  return world.phaseState?.phase === "secret-mainframe" ? world.phaseState : null;
}
