import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { MenuPanel, SecretPhaseCard } from "@/app/_hud/hud-props";

// Palavras/frases de cultura dev flutuando no fundo do painel (IDCLIPMENU-20,
// fix1, neon-only via `richLayout`) — reaproveita o conteúdo de
// `_docs/game-design/Menu_IDCLIP.html` § WORDS como referência. Array
// ESTÁTICO em escopo de módulo, posição/delay fixos, SEM `Math.random()` em
// nenhum ponto: gerar posição aleatória no corpo do componente causaria
// hydration mismatch entre o HTML do servidor e o primeiro render do
// cliente (ver design.md § Risco de hidratação). Puramente decorativo.
type FloatWord = { text: string; top: string; left: string; delaySeconds: number };

const FLOAT_WORDS: readonly FloatWord[] = [
  { text: "JAVA", top: "8%", left: "6%", delaySeconds: 0 },
  { text: "MEETING", top: "70%", left: "78%", delaySeconds: 1.5 },
  { text: "CALL PRA ONTEM!", top: "45%", left: "42%", delaySeconds: 3 },
  { text: "$ deploy --prod", top: "12%", left: "60%", delaySeconds: 0.8 },
  { text: "git push --force", top: "60%", left: "10%", delaySeconds: 2.2 },
  { text: "SPRINT REVIEW", top: "28%", left: "22%", delaySeconds: 3.6 },
  { text: "TODO: refatorar", top: "82%", left: "48%", delaySeconds: 1.1 },
];

// Painel "Fases Secretas" compartilhado entre os temas neon e clássico
// (achado (c) do code-review pós T1-T7 — ver design.md, addendum
// "extração de SecretPhasePanel"). JSX idêntico ao bloco duplicado
// anteriormente em NeonHud.tsx/ClassicHud.tsx; a única diferença visual
// entre os temas é o `renderPreview` opcional (só o neon passa
// `<SecretPhasePreview>`), preservada via prop em vez de duplicar o bloco.
export type SecretPhasePanelProps = {
  secretPhases: SecretPhaseCard[];
  menuIndex: number;
  secretPhaseToast: string | null;
  setSecretPhaseIndex: (index: number) => void;
  confirmSecretPhaseSelection: (index: number) => void;
  setMenuPanel: (panel: MenuPanel) => void;
  renderPreview?: (phaseId: string) => ReactNode;
  // IDCLIPMENU-22/23 (fix1): quando presente, o painel renderiza SÓ a tela
  // de carregamento (nada de cards/toast/botão "Voltar") — compartilhado
  // pelos dois temas, independente de `richLayout`.
  loadingPhase?: SecretPhaseCard | null;
  // IDCLIPMENU-17/18/19 (fix1): layout lado-a-lado, número grande e
  // setas/glow de seleção — opt-in, só o tema neon passa `true`
  // (`NeonHud.tsx`). O clássico não passa nada (`undefined`/falsy), então
  // continua produzindo EXATAMENTE o mesmo markup de card de hoje.
  richLayout?: boolean;
};

export function SecretPhasePanel({
  secretPhases,
  menuIndex,
  secretPhaseToast,
  setSecretPhaseIndex,
  confirmSecretPhaseSelection,
  setMenuPanel,
  renderPreview,
  loadingPhase,
  richLayout,
}: SecretPhasePanelProps) {
  const loadingRef = useRef<HTMLDivElement>(null);
  // IDCLIPV14-01: viewport rolável (scroll nativo) que envolve
  // `.secret-phase-list` — compartilhado pelos dois temas, a mecânica de
  // scroll não depende de `richLayout`.
  const viewportRef = useRef<HTMLDivElement>(null);
  // IDCLIPV14-05: um ref por card, pra auto-scroll ao navegar por seta.
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // IDCLIPV14-02/03/04 (Opção C do design.md, neon-only via `richLayout`):
  // thumb decorativo por cima do scroll nativo escondido. `isDragging` é o
  // único estado de React aqui (muda raramente — início/fim do arrasto);
  // `top`/`height` do thumb são escritos direto em `thumbRef.current.style`
  // dentro de `updateThumb`, sem `useState`, pra não re-renderizar a cada
  // tick de `scroll` (dezenas de eventos por segundo).
  const thumbRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // IDCLIPMENU-26 (fix1): move o foco pro bloco de loading assim que ele
  // aparece, pra não deixar o contexto de acessibilidade órfão em
  // `document.body` durante a transição. `tabIndex={-1}` permite foco
  // programático sem entrar na ordem de tab natural.
  useEffect(() => {
    if (loadingPhase) {
      loadingRef.current?.focus();
    }
  }, [loadingPhase]);

  // IDCLIPV14-05: mantém o card recém-selecionado sempre visível dentro do
  // viewport rolável, rolando o mínimo necessário (`block: "nearest"`) —
  // igual ao mockup v1.4. Roda nos dois temas (fonte de verdade do scroll
  // continua sendo o `overflow-y:auto` nativo do `.secret-phase-viewport`,
  // T9); `scrollIntoView` não é implementado pelo JSDOM, então os testes
  // mockam `HTMLElement.prototype.scrollIntoView`.
  useEffect(() => {
    cardRefs.current[menuIndex]?.scrollIntoView({ block: "nearest" });
  }, [menuIndex]);

  // IDCLIPV14-02: recalcula `top`/`height` do thumb decorativo a partir do
  // estado real do scroll nativo (`scrollTop`/`scrollHeight`/`clientHeight`)
  // — nunca duplica a fonte de verdade (design.md § Risco). Chamado no
  // `onScroll` do viewport (ambos os temas — no clássico o thumb nem existe
  // no DOM, `thumbRef.current` é `null` e a função só retorna cedo) e uma
  // vez no mount/quando a lista muda de tamanho.
  const updateThumb = useCallback(() => {
    const viewport = viewportRef.current;
    const thumb = thumbRef.current;
    if (!viewport || !thumb) return;
    const { scrollTop, scrollHeight, clientHeight } = viewport;
    if (scrollHeight <= clientHeight) {
      thumb.style.top = "0px";
      thumb.style.height = "100%";
      return;
    }
    const thumbHeight = Math.max((clientHeight / scrollHeight) * clientHeight, 24);
    const maxThumbTop = clientHeight - thumbHeight;
    const maxScrollTop = scrollHeight - clientHeight;
    const thumbTop = maxScrollTop > 0 ? (scrollTop / maxScrollTop) * maxThumbTop : 0;
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.top = `${thumbTop}px`;
  }, []);

  useEffect(() => {
    updateThumb();
  }, [updateThumb, secretPhases.length]);

  // IDCLIPV14-04: arrasto do thumb — só o próprio thumb (clicar na track fora
  // dele pra saltar não é um AC desta spec, fora de escopo). Registra
  // `pointermove`/`pointerup` no `window` (não no thumb) pra não perder o
  // arrasto se o ponteiro sair da faixa estreita da track.
  const onThumbPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const viewport = viewportRef.current;
    const thumb = thumbRef.current;
    if (!viewport || !thumb) return;
    setIsDragging(true);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const rect = viewport.getBoundingClientRect();
      const thumbHeight = thumb.offsetHeight;
      const maxThumbTop = viewport.clientHeight - thumbHeight;
      const maxScrollTop = viewport.scrollHeight - viewport.clientHeight;
      if (maxThumbTop <= 0 || maxScrollTop <= 0) return;
      const relativeTop = moveEvent.clientY - rect.top - thumbHeight / 2;
      const clampedTop = Math.min(Math.max(relativeTop, 0), maxThumbTop);
      viewport.scrollTop = (clampedTop / maxThumbTop) * maxScrollTop;
    };

    const onPointerUp = () => {
      setIsDragging(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }, []);

  if (loadingPhase) {
    return (
      <div className="secret-phase-loading" role="status" aria-live="polite" tabIndex={-1} ref={loadingRef}>
        <p className="secret-phase-loading-text">CARREGANDO {loadingPhase.name.toUpperCase()}...</p>
        <div className="secret-phase-loading-bar" aria-hidden="true">
          <div className="secret-phase-loading-bar-fill" />
        </div>
      </div>
    );
  }

  return (
    <>
      {richLayout ? (
        // IDCLIPV14-16: cabeçalho próprio do painel secreto (título com glow
        // + subtítulo) — substitui o `<h2>` compartilhado só aqui, decisão
        // aceita explicitamente pelo pedido "100% igual ao mockup"
        // (spec.md § "Cabeçalho e rodapé próprios do painel secreto"). O
        // clássico mantém o `<h2>Fases Secretas</h2>` de sempre.
        <>
          <h1 className="secret-phase-title">JAVA PLENO PIXEL HUNT</h1>
          <p className="secret-phase-subtitle-header">SELEÇÃO DE FASE · 8 FASES · CHEATS IDCLIP</p>
        </>
      ) : (
        <h2>Fases Secretas</h2>
      )}
      {richLayout && (
        <div className="secret-phase-float-layer" aria-hidden="true">
          {FLOAT_WORDS.map((word) => (
            <span
              key={word.text}
              style={{ top: word.top, left: word.left, animationDelay: `${word.delaySeconds}s` }}
            >
              {word.text}
            </span>
          ))}
        </div>
      )}
      {richLayout && <div className="secret-phase-atmosphere-overlay" aria-hidden="true" />}
      {/* fix-cycle-1 (IDCLIPV14-01/02/03/04/06): a track/thumb decorativos e o
          fade de borda precisam ficar FORA do elemento com `overflow-y:auto`
          (`.secret-phase-viewport`) — um `position:absolute` cujo containing
          block é o próprio scroller vira parte do conteúdo rolável e rola
          junto (some da área visível assim que `scrollTop > 0`, achado do
          code-review confirmado por repro real). `.secret-phase-scroll-area`
          é o novo wrapper comum (SEM overflow, só `position:relative`) —
          track/thumb e o fade (`::before`/`::after` do wrapper, ver
          globals.css/neon.css) ficam pinados visualmente enquanto o
          `.secret-phase-viewport` rola por baixo, como irmão. */}
      <div className="secret-phase-scroll-area">
      <div className="secret-phase-viewport" ref={viewportRef} onScroll={updateThumb}>
      <div className="secret-phase-list" aria-label="Fases secretas disponíveis">
        {secretPhases.map((phase, index) => (
          <button
            key={phase.id}
            ref={(el) => {
              cardRefs.current[index] = el;
            }}
            type="button"
            aria-current={menuIndex === index}
            className={
              (menuIndex === index ? "character-card character-card-selected" : "character-card") +
              " secret-phase-card" +
              (phase.locked ? " secret-phase-locked" : "")
            }
            onMouseEnter={() => setSecretPhaseIndex(index)}
            onClick={() => {
              setSecretPhaseIndex(index);
              confirmSecretPhaseSelection(index);
            }}
          >
            {renderPreview?.(phase.id)}
            {richLayout ? (
              <div className="secret-phase-info">
                <p className="secret-phase-index-label">{"FASE " + String(index + 1).padStart(2, "0")}</p>
                <h3>{phase.name}</h3>
                <p className="secret-phase-subtitle">{phase.subtitle}</p>
                <ul className="secret-phase-tags">
                  {phase.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
                <div className="secret-phase-difficulty" aria-label={`Dificuldade ${phase.difficulty} de 5`}>
                  {Array.from({ length: 5 }).map((_, pipIndex) => (
                    <span
                      key={pipIndex}
                      className={pipIndex < phase.difficulty ? "secret-phase-pip secret-phase-pip-filled" : "secret-phase-pip"}
                    />
                  ))}
                </div>
                <p className="secret-phase-status">{phase.locked ? "🔒 Em breve" : "Desbloqueado"}</p>
              </div>
            ) : (
              <>
                <h3>{phase.name}</h3>
                <p className="secret-phase-subtitle">{phase.subtitle}</p>
                <ul className="secret-phase-tags">
                  {phase.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
                <p className="secret-phase-meta">{phase.estimatedTime}</p>
                <div className="secret-phase-difficulty" aria-label={`Dificuldade ${phase.difficulty} de 5`}>
                  {Array.from({ length: 5 }).map((_, pipIndex) => (
                    <span
                      key={pipIndex}
                      className={pipIndex < phase.difficulty ? "secret-phase-pip secret-phase-pip-filled" : "secret-phase-pip"}
                    />
                  ))}
                </div>
                <p className="secret-phase-status">{phase.locked ? "🔒 Em breve" : "Desbloqueado"}</p>
              </>
            )}
            {richLayout && (
              // IDCLIPMENU-19 (fix cycle 1): número grande + tempo estimado
              // empilhados no canto direito do card ("com o tempo estimado
              // abaixo dele" — spec.md AC IDCLIPMENU-19). Antes o tempo
              // estimado vivia dentro de `.secret-phase-info` (coluna
              // esquerda); agora mora junto do número, no mesmo container.
              <div className="secret-phase-corner">
                <span className="secret-phase-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="secret-phase-corner-time">{phase.estimatedTime}</p>
              </div>
            )}
            {richLayout && menuIndex === index && (
              <>
                <span className="secret-phase-arrow secret-phase-arrow-left" aria-hidden="true">▶</span>
                <span className="secret-phase-arrow secret-phase-arrow-right" aria-hidden="true">◀</span>
                <p className="secret-phase-enter-hint">ENTER PARA ENTRAR</p>
              </>
            )}
          </button>
        ))}
      </div>
      </div>
      {richLayout && (
        <div className="secret-phase-scrollbar-track">
          <div
            className={"secret-phase-scrollbar-thumb" + (isDragging ? " is-dragging" : "")}
            ref={thumbRef}
            onPointerDown={onThumbPointerDown}
          />
        </div>
      )}
      </div>
      {secretPhaseToast && (
        <p role="status" className="secret-phase-toast">{secretPhaseToast}</p>
      )}
      {richLayout && (
        // IDCLIPV14-17: rodapé de instruções — só o cheat ativo (`idclip`),
        // sem listar os 6 cheats por-fase não-funcionais (out of scope,
        // spec.md).
        <p className="secret-phase-footer-hint">
          ↑/↓ SELECIONAR · ENTER CONFIRMAR · SCROLL/ARRASTAR · CHEATS: IDCLIP
        </p>
      )}
      <div className="menu-actions">
        <button type="button" onClick={() => setMenuPanel("home")}>Voltar ao início</button>
      </div>
    </>
  );
}
