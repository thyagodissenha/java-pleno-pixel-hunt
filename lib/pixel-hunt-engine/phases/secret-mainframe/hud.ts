// HUD persistente da fase secreta "O Datacenter Esquecido" (design.md §
// Components → hud.ts; spec.md SECBOSS-22, 23, 24). Desenha, em espaço de
// tela (não de mundo), `O MAINFRAME — FASE n/4 NOME` no topo-centro, os 4
// pips das barras (gastas escuras/atual parcial/futuras cheias) e
// `FIREWALL x/100` (teal, em SHIELD/BREAK_FX) ou `CORE EXPOSTO!` piscando
// em vermelho (DPS). Chamado via `ViewState.drawHudOverlay` (T10),
// atribuído por `phases/secret-mainframe/index.ts` (integração completa na
// T13, fora deste batch). Nenhum import de `react`.

import { CONFIG } from "@/lib/pixel-hunt-engine/phases/secret-mainframe/config";
import { clamp } from "@/lib/pixel-hunt-engine/geometry";
import type { SecretMainframePhaseState } from "@/lib/pixel-hunt-engine/types";

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 540;

// Nomes de apresentação por fase — espelham `CONFIG.PHASES[n].dominantMob`
// (config.ts), sem afetar nenhum valor numérico/mecânica; só rótulo de HUD.
export const PHASE_NAMES: readonly [string, string, string, string] = [
  "DAEMON WAVE",
  "CRON PURGE",
  "COBOL SWARM",
  "MELTDOWN",
];

const PIP_WIDTH = 48;
const PIP_HEIGHT = 8;
const PIP_GAP = 8;

/**
 * Desenha o HUD persistente da fase secreta a partir do estado local da
 * Phase (`state.firewall`, T3). Screen-space — não depende de nenhuma
 * transformação de câmera/shake aplicada por `drawFrame` (T10).
 */
export function drawSecretPhaseHud(ctx: CanvasRenderingContext2D, state: SecretMainframePhaseState): void {
  const { firewall } = state;
  const phaseName = PHASE_NAMES[firewall.phaseIndex - 1] ?? PHASE_NAMES[0];

  // NOVO (T16, SECBOSS-35): vinheta vermelha nas bordas da tela, só na fase
  // 4 — sinaliza visualmente os modificadores agravados (HP/dano ×2,
  // telegraph +15%). Desenhada primeiro (atrás do resto do HUD).
  if (firewall.phaseIndex === 4) {
    ctx.save();
    const gradient = ctx.createRadialGradient(
      WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_HEIGHT * 0.28,
      WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_HEIGHT * 0.75,
    );
    gradient.addColorStop(0, "rgba(239,68,68,0)");
    gradient.addColorStop(1, "rgba(127,29,29,0.5)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.restore();
  }

  ctx.save();
  ctx.textAlign = "center";

  // `O MAINFRAME — FASE n/4 NOME` (spec.md SECBOSS-22).
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "bold 15px 'Courier New', monospace";
  ctx.fillText(`O MAINFRAME — FASE ${firewall.phaseIndex}/4 ${phaseName}`, WORLD_WIDTH / 2, 20);

  // 4 pips: gastas (fundo escuro), atual (parcial, refletindo barHp/barMaxHp
  // em DPS/BREAK_FX; cheia em SHIELD — o firewall protege a barra inteira),
  // futuras (cheias) — spec.md SECBOSS-23.
  const totalWidth = PIP_WIDTH * 4 + PIP_GAP * 3;
  const startX = WORLD_WIDTH / 2 - totalWidth / 2;
  const pipY = 28;
  for (let i = 0; i < 4; i += 1) {
    const pipPhase = i + 1;
    const x = startX + i * (PIP_WIDTH + PIP_GAP);
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(x, pipY, PIP_WIDTH, PIP_HEIGHT);
    if (pipPhase < firewall.phaseIndex) {
      continue; // gasta: só o fundo escuro
    }
    const fillRatio = pipPhase === firewall.phaseIndex && firewall.mode !== "SHIELD"
      ? clamp(firewall.barHp / firewall.barMaxHp, 0, 1)
      : 1;
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(x, pipY, PIP_WIDTH * fillRatio, PIP_HEIGHT);
  }

  // `FIREWALL x/100` (teal) ou `CORE EXPOSTO!` piscando (vermelho) — spec.md
  // SECBOSS-24.
  ctx.font = "bold 13px 'Courier New', monospace";
  if (firewall.mode === "DPS") {
    const blink = Math.sin(Date.now() / 120) > 0;
    ctx.fillStyle = blink ? "#ef4444" : "#7f1d1d";
    ctx.fillText("CORE EXPOSTO!", WORLD_WIDTH / 2, 46);
  } else {
    const shieldPoints = firewall.mode === "BREAK_FX" ? CONFIG.SHIELD_NEED : Math.floor(firewall.counter);
    ctx.fillStyle = "#2dd4bf";
    ctx.fillText(`FIREWALL ${shieldPoints}/${CONFIG.SHIELD_NEED}`, WORLD_WIDTH / 2, 46);
  }

  ctx.restore();
}
