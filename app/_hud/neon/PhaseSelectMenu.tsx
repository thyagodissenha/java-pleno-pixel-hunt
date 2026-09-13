"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "./PhaseSelectMenu.css";

// Porta quase verbatim de `_docs/game-design/IDCLIP_React/PhaseSelectMenu.jsx` — React+DOM (não
// canvas), achado pronto na pasta, nunca integrado ao projeto. Único desvio do original: os cards
// ganham `role="button"` (ESTUDOREACT-05 do spec.md), necessário pra consultar por papel via
// Testing Library — o original é `<div onClick>` sem nenhuma semântica.

export type Phase = {
  id: number;
  name: string;
  sub: string;
  col: string;
  col2: string;
  tags: string[];
  time: string;
  diff: number;
  unlock: string;
  cheat: string;
};

export const DEFAULT_PHASES: Phase[] = [
  { id: 0, name: "O MAINFRAME", sub: "DATACENTER ESQUECIDO", col: "#d4ff5e", col2: "#5fd8c0", tags: ["4 FASES", "FIREWALL 100", "MOBS 3+ELITE"], time: "6-9 MIN", diff: 4, unlock: "ONDA 5 · 0 RESETS", cheat: "IDCLIP" },
  { id: 1, name: "HELL BRANCH", sub: "E1M1 HANGAR DE DEPLOYS", col: "#ff7f2a", col2: "#f53b3b", tags: ["4 SETORES", "TOKENS R/W/R", "BLACKOUT"], time: "8-12 MIN", diff: 5, unlock: "ONDA 6 · DOOM.WAD", cheat: "IDCLIP" },
  { id: 2, name: "GRAVEYARD SHIFT", sub: "A NOITE DOS DEADLINES VIVOS", col: "#b678ff", col2: "#59d31f", tags: ["TRICK OR TREAT", "FULL MOON", "FOG SAMHAIN"], time: "10-14 MIN", diff: 5, unlock: "2 SECRETAS · IDBOO · ???", cheat: "IDBOO" },
  { id: 3, name: "MAR DE STACK OVERFLOW", sub: "A BAÍA DOS COPY-PASTAS", col: "#f5d33b", col2: "#1a6e7a", tags: ["MARÉ", "ABORDAGENS", "KRAKEN"], time: "8-10 MIN", diff: 3, unlock: "LURE-ONLY · IDYARR", cheat: "IDYARR" },
  { id: 4, name: "GLACIER DE CHANGE FREEZE", sub: "O ANDAR CONGELADO", col: "#bfe8f2", col2: "#3b66f5", tags: ["INÉRCIA", "BLIZZARD", "CALOR"], time: "8-12 MIN", diff: 4, unlock: "TAG NO-HIT · IDMELT", cheat: "IDMELT" },
  { id: 5, name: "ESTAÇÃO ORBITAL", sub: "VÁCUO DE PRODUÇÃO", col: "#7dffe0", col2: "#ff5a4d", tags: ["ZERO-G", "SUCÇÃO", "ECLUSAS"], time: "10-14 MIN", diff: 5, unlock: "MAINFRAME SEM HEAL · IDORBIT", cheat: "IDORBIT" },
  { id: 6, name: "CASTELO DO MONOLITO", sub: "SIEGE DE LEGACY", col: "#f5d33b", col2: "#a32020", tags: ["SIEGE", "ÓLEO FERVENTE", "DRAGÃO"], time: "10-12 MIN", diff: 4, unlock: "HELL BRANCH PURIST · IDSIEGE", cheat: "IDSIEGE" },
  { id: 7, name: "META.ARCADE", sub: "O FLIPERAMA QUE JOGAVA DE VOLTA", col: "#ff3ba3", col2: "#3bfff5", tags: ["GÊNERO ROTATIVO", "GLITCH CRT", "BOSS-ESPELHO"], time: "12-15 MIN", diff: 5, unlock: "KONAMI CODE · IDCOIN", cheat: "IDCOIN" },
];

const CH = 160;
const GAP = 20;
const VIEW = 406;

const CHEAT_MSG: Record<string, string> = {
  idboo: "IDBOO — GRAVEYARD SHIFT LIBERADO. Ele sabe que você chamou.",
  idyarr: "IDYARR — MAR DE STACK OVERFLOW LIBERADO. Yo-ho-ho, dev.",
  idmelt: "IDMELT — GLACIER LIBERADO. Aquece aí.",
  idorbit: "IDORBIT — ESTAÇÃO ORBITAL LIBERADA. Gravidade off.",
  idsiege: "IDSIEGE — CASTELO DO MONOLITO LIBERADO. Arma as catapultas.",
  idcoin: "IDCOIN — META.ARCADE LIBERADO. Insira ficha.",
};

const CHEAT_INDEX: Record<string, number> = { idboo: 2, idyarr: 3, idmelt: 4, idorbit: 5, idsiege: 6, idcoin: 7 };

const KONAMI = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];

function Preview({ id, onEgg }: { id: number; onEgg: () => void }) {
  switch (id) {
    case 0:
      return (
        <>
          <div className="psm-cab" />
          <span className="psm-led psm-l1" />
          <span className="psm-led psm-l2" />
          <span className="psm-led psm-l3" />
          <div className="psm-ring" />
        </>
      );
    case 1:
      return (
        <>
          <div className="psm-penta" />
          <span className="psm-bar psm-b1">🛢️</span>
          <span className="psm-bar psm-b2">🛢️</span>
          <span className="psm-skull">💀</span>
        </>
      );
    case 2:
      return (
        <>
          <span className="psm-moon">🌕</span>
          <span
            className="psm-pump"
            data-egg="1"
            onClick={(e) => {
              e.stopPropagation();
              onEgg();
            }}
          >
            🎃
          </span>
          <span className="psm-ghost">👻</span>
        </>
      );
    case 3:
      return (
        <>
          <div className="psm-wv psm-wv1" />
          <div className="psm-wv psm-wv2" />
          <span className="psm-squid">🦑</span>
        </>
      );
    case 4:
      return (
        <>
          <span className="psm-flake">❄</span>
          <span className="psm-cup">☕</span>
          <span className="psm-snow psm-s1" />
          <span className="psm-snow psm-s2" />
          <span className="psm-snow psm-s3" />
        </>
      );
    case 5:
      return (
        <>
          <span className="psm-star psm-st1" />
          <span className="psm-star psm-st2" />
          <span className="psm-star psm-st3" />
          <span className="psm-sat">🛰️</span>
          <div className="psm-breach" />
        </>
      );
    case 6:
      return (
        <>
          <span className="psm-castle">🏰</span>
          <span className="psm-torch psm-t1">🔥</span>
          <span className="psm-torch psm-t2">🔥</span>
        </>
      );
    default:
      return (
        <>
          <div className="psm-gl psm-gl1" />
          <div className="psm-gl psm-gl2" />
          <span className="psm-joy">🕹️</span>
          <span className="psm-inv">👾</span>
        </>
      );
  }
}

export type PhaseSelectMenuProps = {
  phases?: Phase[];
  unlocked?: boolean[];
  onSelect?: (id: number) => boolean | void;
  cheats?: boolean;
  title?: string;
};

export default function PhaseSelectMenu({
  phases = DEFAULT_PHASES,
  unlocked,
  onSelect,
  cheats = true,
  title = "JAVA PLENO PIXEL HUNT",
}: PhaseSelectMenuProps) {
  const [sel, setSelS] = useState(0);
  const [bonus, setBonus] = useState<Set<number>>(() => new Set());
  const [scroll, setScroll] = useState(0);
  const [toast, setToast] = useState<{ m: string; n: number } | null>(null);
  const [load, setLoad] = useState<Phase | null>(null);
  const [fk, setFk] = useState(0);
  const selR = useRef(0);
  const bufR = useRef("");
  const konR = useRef(0);
  const eggR = useRef(0);
  const tnR = useRef(0);
  const vpR = useRef<HTMLDivElement>(null);
  const sbR = useRef<HTMLDivElement>(null);
  const dragR = useRef<number | null>(null);

  const CONTENT = phases.length * CH + (phases.length - 1) * GAP;
  const MAX = CONTENT - VIEW;
  const thH = (VIEW * VIEW) / CONTENT;

  const isUnlocked = useCallback((i: number) => (unlocked ? !!unlocked[i] : true) || bonus.has(i), [unlocked, bonus]);
  const say = (m: string) => {
    tnR.current += 1;
    setToast({ m, n: tnR.current });
  };
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const setSel = (i: number) => {
    selR.current = i;
    setSelS(i);
    const y = i * (CH + GAP);
    setScroll((s) => (y < s ? y : y + CH > s + VIEW ? y + CH - VIEW : s));
  };
  const unlock = (i: number, m: string) => {
    if (isUnlocked(i)) {
      say(m);
      return;
    }
    setBonus((b) => new Set(b).add(i));
    setFk((f) => f + 1);
    say(m);
  };
  const confirm = (i: number) => {
    if (load) return;
    if (!isUnlocked(i)) {
      say("BLOQUEADO — " + phases[i].unlock);
      return;
    }
    setLoad(phases[i]);
    setTimeout(() => {
      setLoad(null);
      // `onSelect` pode devolver `true` pra sinalizar que assumiu a transição (ex: redirecionar
      // pro jogo real) — nesse caso o componente NÃO mostra seu próprio toast de fallback. Se
      // devolver `false`/`undefined` (ou não existir), mantém o comportamento original: mostra o
      // toast "plugue o loader" (necessário pras fases desbloqueadas só via cheat/Konami/easter
      // egg, que continuam sem handler real por trás).
      if (onSelect?.(phases[i].id) !== true) say("onSelect(" + phases[i].id + ") — plugue o loader");
    }, 1400);
  };
  const eggClick = () => {
    eggR.current += 1;
    if (eggR.current >= 3) unlock(2, "A ABÓBORA SORRIU DE VOLTA — GRAVEYARD SHIFT LIBERADO");
    else say("a abóbora piscou... (" + eggR.current + "/3)");
  };

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "enter"].includes(k)) e.preventDefault();
      if (k === "arrowup" || k === "w") setSel((selR.current + phases.length - 1) % phases.length);
      if (k === "arrowdown" || k === "s") setSel((selR.current + 1) % phases.length);
      if (k === "enter") confirm(selR.current);
      if (!cheats) return;
      if (KONAMI.includes(k) || /^[a-z]$/.test(k)) {
        if (k === KONAMI[konR.current]) {
          konR.current += 1;
          if (konR.current === KONAMI.length) {
            konR.current = 0;
            unlock(7, "KONAMI CODE! META.ARCADE LIBERADO — 1UP");
          }
        } else konR.current = k === KONAMI[0] ? 1 : 0;
      }
      if (/^[a-z]$/.test(k)) {
        bufR.current = (bufR.current + k).slice(-7);
        for (const c in CHEAT_MSG) {
          if (bufR.current.endsWith(c)) {
            unlock(CHEAT_INDEX[c], CHEAT_MSG[c]);
          }
        }
        if (bufR.current.endsWith("idclip")) say("IDCLIP ATIVO — SELEÇÃO DE FASE");
      }
    };
    const wh = (e: WheelEvent) => {
      e.preventDefault();
      setScroll((s) => Math.max(0, Math.min(MAX, s + e.deltaY * 0.5)));
    };
    const mm = (e: MouseEvent) => {
      if (dragR.current == null || !sbR.current) return;
      const r = sbR.current.getBoundingClientRect();
      const y = e.clientY - r.top - dragR.current;
      setScroll(Math.max(0, Math.min(MAX, (y / (VIEW - thH)) * MAX)));
    };
    const mu = () => {
      dragR.current = null;
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
    const vp = vpR.current;
    vp && vp.addEventListener("wheel", wh, { passive: false });
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
      vp && vp.removeEventListener("wheel", wh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cheats, MAX, thH, phases.length]);

  const thTop = (scroll / MAX) * (VIEW - thH);
  return (
    <div className="psm-wrap">
      <div className="psm-title">{title}</div>
      <div className="psm-uline" />
      <div className="psm-sub">SELEÇÃO DE FASE · {phases.length} FASES · CHEATS IDCLIP</div>
      <div className="psm-vp" ref={vpR}>
        {phases.map((p, i) => {
          const y = i * (CH + GAP) - scroll;
          if (y < -CH - 10 || y > VIEW + 10) return null;
          const un = isUnlocked(i);
          return (
            <div
              key={p.id}
              role="button"
              className={"psm-card" + (sel === i ? " psm-sel" : "")}
              style={{ top: y + "px", "--col": p.col } as React.CSSProperties}
              onMouseEnter={() => setSel(i)}
              onClick={(e) => {
                if ((e.target as HTMLElement).dataset && (e.target as HTMLElement).dataset.egg) return;
                setSel(i);
                confirm(i);
              }}
            >
              <div className={"psm-pv psm-pv" + i}>
                <Preview id={i} onEgg={eggClick} />
              </div>
              <div className="psm-info">
                <div className="psm-lbl" style={{ color: p.col2 }}>
                  FASE 0{i + 1}
                </div>
                <div className="psm-nm" style={{ color: p.col, textShadow: "0 0 8px " + p.col }}>
                  {p.name}
                </div>
                <div className="psm-sb2">{p.sub}</div>
                <div className="psm-chips">
                  {p.tags.map((t, k) => (
                    <span key={k} className="psm-chip" style={{ borderColor: p.col2, color: p.col2 }}>
                      {t}
                    </span>
                  ))}
                </div>
                <div className="psm-row">
                  <span>DIFF</span>
                  {[0, 1, 2, 3, 4].map((d) => (
                    <span key={d} className="psm-pip" style={{ background: d < p.diff ? p.col : "#22302a" }} />
                  ))}
                  <span className="psm-tm">{p.time}</span>
                </div>
                <div className="psm-unl" style={{ color: un ? "#5c8a6e" : "#6e3f3f" }}>
                  {(un ? "UNLOCK: " : "🔒 ") + p.unlock}
                </div>
              </div>
              <div className="psm-bign" style={{ color: p.col }}>
                0{i + 1}
              </div>
              {un && (
                <div className="psm-ctag" style={{ color: p.col2 }}>
                  /{" " + p.cheat}
                </div>
              )}
              {sel === i && (
                <div className="psm-enter" style={{ color: p.col }}>
                  ENTER PARA ENTRAR
                </div>
              )}
              {!un && <div className="psm-lock">BLOQUEADO</div>}
            </div>
          );
        })}
        <div
          className="psm-sb"
          ref={sbR}
          onMouseDown={(e) => {
            dragR.current = thH / 2;
            const r = sbR.current!.getBoundingClientRect();
            const y = e.clientY - r.top - dragR.current;
            setScroll(Math.max(0, Math.min(MAX, (y / (VIEW - thH)) * MAX)));
          }}
        >
          <div className="psm-thumb" style={{ top: thTop + "px", height: thH + "px" }} />
        </div>
      </div>
      <div className="psm-foot">
        ↑/↓ SELECIONAR · ENTER · SCROLL/ARRASTAR · CHEATS: IDCLIP IDBOO IDYARR IDMELT IDORBIT IDSIEGE IDCOIN
      </div>
      {toast && (
        <div className="psm-toast" key={toast.n}>
          {toast.m}
        </div>
      )}
      {load && (
        <div className="psm-load">
          <div className="psm-lnm" style={{ color: load.col, textShadow: "0 0 10px " + load.col }}>
            CARREGANDO {load.name}...
          </div>
          <div className="psm-lbar" style={{ borderColor: load.col }}>
            <div className="psm-lfill" style={{ background: load.col }} />
          </div>
        </div>
      )}
      {fk > 0 && <div className="psm-flash" key={fk} />}
      <div className="psm-ver">v2.1-react · IDCLIP</div>
    </div>
  );
}
