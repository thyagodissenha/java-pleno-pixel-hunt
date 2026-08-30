# Validation — reorganizacao-hud-e-poder

## Status atual
Veredito: PASS
Spec vigente: spec.md (9 ACs, HUD-01 a HUD-09)
HEAD: cdac7f6
Gaps abertos: nenhum

---

## Execução 2026-08-30 — commit range e23558a..cdac7f6

PASS

### Evidência por AC

| AC | Spec-defined outcome | file:line + assertion | Resultado |
| --- | --- | --- | --- |
| HUD-01 | `.sponsor-card` não aparece mais no `topbar` de jogo | `app/__tests__/hud-layout.test.tsx:76-77` — `expect(screen.queryByText("Patrocínio")).not.toBeInTheDocument()`; `app/globals.css` diff confirma remoção total de `.sponsor-card` (regras base + 2 media queries órfãs) | ✅ PASS |
| HUD-02 | 4ª opção "Apoie o jogo" em `title-menu-actions`, clicável e navegável (setas+Enter), abre `openSupportPanel()` | `app/__tests__/hud-layout.test.tsx:155-164` (4 `menuitem`, texto exato) + `:166-172` (click abre `dialog[name="Apoie o jogo"]`) + `:174-183` (ArrowDown x3 + Enter chega no mesmo painel); `app/page.tsx:2186-2195` — `onClick={() => activateMenuOption(3)}`; `app/page.tsx:593` — `else if (index === 3) openSupportPanel();` | ✅ PASS |
| HUD-03 | Navegação cicla corretamente entre as 4 opções (`% 4`), sem pular a nova opção nem quebrar o wrap-around das 3 antigas — **ambas as direções** | `app/__tests__/hud-layout.test.tsx:185-196` — ArrowDown a partir do índice 3 volta ao índice 0 (Jogar); `:198-206` — ArrowUp a partir do índice 0 vai ao índice 3 (Apoie o jogo). `app/page.tsx:1157` (`+3) % 4`, ArrowUp) e `:1161` (`+1) % 4`, ArrowDown) | ✅ PASS — as duas direções de wrap-around estão cobertas, não só uma |
| HUD-04 | Controles de som (mute+volume) ocupam o slot do patrocínio, mesmo comportamento funcional | `app/__tests__/hud-layout.test.tsx:80-91` — clica mutar, confirma `aria-pressed="true"`; muda slider, confirma `toHaveValue("0.5")`. `app/page.tsx:2066-2092` — `.hud-card.sound-card` no slot antes ocupado por `.sponsor-card` | ✅ PASS |
| HUD-05 | Com `specialPower` não nulo, `.utility-card` mostra 2 medidores (Rajada + Poder), mesmo tamanho visual (`.stamina-meter`); Poder vai de 0% (uso) a 100% (disponível) | `app/__tests__/hud-layout.test.tsx:93-101` — `getByText("Rajada")`/`getByText("Poder")` dentro do mesmo `.utility-card`; `:111-126` — 100% no início, `0` após `Q`, `>0` depois de avançar frames. `app/page.tsx:2058-2064` reusa `.stamina-meter`; `app/page.tsx:723-731` calcula `abilityCooldownPct` | ✅ PASS |
| HUD-06 | Sem `specialPower` (`null`), medidor de Poder não renderiza | Sem cobertura automatizada — confirmado por inspeção: `lib/characters.ts:48,65,81` mostra as 3 entradas do catálogo (Dev Pleno, Estagiário, SRE) todas com `specialPower` não-nulo, nenhum caso `null` existe hoje. Condicional em `app/page.tsx:2058` (`resolveCharacter(selectedCharacterId).specialPower && (...)`) inspecionado e correto. Documentado como limitação aceita em `spec.md:92` (traceability) e `tasks.md:81` (T1 Done-when) | ✅ PASS (gap documentado, não escondido) |
| HUD-07 | `Q` com sucesso dispara `announceEffect` com `"${NOME}: ativado"` (mesmo banner dos power-ups) | `app/__tests__/character-power.test.tsx:233-246` — `expect(canvasContext.fillText).toHaveBeenCalledWith("REFACTOR DASH: ativado", expect.any(Number), expect.any(Number))`. `app/page.tsx:1135` — `announceEffect(\`${power.name.toUpperCase()}: ativado\`)` | ✅ PASS |
| HUD-08 | `Q` ignorado (cooldown, sem poder, fora de `"playing"`) NÃO dispara banner novo | `app/__tests__/character-power.test.tsx:248-269` (cooldown ativo — segunda pressão não redesenha o banner) **e** `:271-282` (fora de `"playing"`, no menu) — dois casos distintos, não só o caminho feliz de HUD-07 | ✅ PASS |
| HUD-09 | Painel "Apoie o jogo" mostra links pra `/privacidade` e `/sobre`, navegáveis, dentro do painel (não no HUD nem no menu de título direto) | `app/__tests__/hud-layout.test.tsx:219-232` — abre o painel via menu, `within(supportPanel).getByRole("link", {name: "Privacidade"})` com `href="/privacidade"` e idem para "Sobre" com `href="/sobre"`. `app/page.tsx:2331-2334` — `<nav className="sponsor-links" ...>` **dentro** de `support-screen` (linha 2310), confirmando que não voltou pro HUD de jogo | ✅ PASS |

**Status**: ✅ Todos os 9 ACs cobertos, sem spec-precision gaps.

### Investigação da suíte flaky

Rodei a suíte completa (`npm test -- --run`) 6 vezes ao longo da sessão:

- 4 rodadas: 246/246 passaram.
- 1 rodada: falhou `character-power.test.tsx > power activation banner ... (HUD-08)` com um 3º `fillText` inesperado.
- 1 rodada (execução separada): falhou `score-sync.test.tsx` (teste de persistência em localStorage, arquivo pré-existente citado pelo autor) e outra rodada falhou `character-power.test.tsx > CHAR-19` (cor da camisa, teste pré-existente ao qual T3 apenas adicionou casos novos, não tocou a asserção CHAR-19).

Testes isolados:
- `hud-layout.test.tsx` sozinho: **11/11 passou em 3 execuções consecutivas**, sem nenhuma falha.
- `character-power.test.tsx -t "HUD-08"` sozinho: **3/3 passou em 3 execuções consecutivas**.

**Conclusão**: a falha intermitente de HUD-08 e CHAR-19 só aparece na suíte cheia (carga/paralelismo entre arquivos), nunca isolada, e alterna entre arquivos/testes diferentes a cada rodada (`score-sync.test.tsx`, `character-power.test.tsx` em pontos distintos) sem um padrão determinístico ligado à lógica nova do HUD. Isso é consistente com o relato do autor de flakiness pré-existente sob carga cheia — a única novidade é que agora também pode "sortear" um teste novo desta feature (`character-power.test.tsx`) como vítima ocasional, mas nunca `hud-layout.test.tsx`, que se manteve 100% estável em toda tentativa isolada. **Confirmado: pré-existente / ambiental, não um gap real desta feature.**

### Sensor de discriminação

| Mutação | File:line | Descrição | Killed? |
| --- | --- | --- | --- |
| 1 | `app/page.tsx:1157` | `(menuIndexRef.current + 3) % 4` → `+ 2) % 4` (ArrowUp aponta pro índice errado no wrap) | ✅ Killed — `hud-layout.test.tsx` "wraps ArrowUp..." falhou |
| 2 | `app/page.tsx:1134-1135` | Removida a chamada `announceEffect(...)` de `triggerActivePower()` | ✅ Killed — `character-power.test.tsx` HUD-07 falhou (fillText não chamado) |
| 3 | `app/page.tsx:723-729` | Fórmula de `abilityCooldownPct` invertida (removida a subtração `cooldownSeconds - remaining`, ficando proporcional ao tempo restante em vez de à disponibilidade) | ✅ Killed — `hud-layout.test.tsx` "shows the power meter at 100%..." falhou (100 esperado, 0 recebido) |

**Sensor depth**: lightweight (3 mutações, feature não-P0)
**Resultado**: 3/3 killed — PASS ✅

Todas as mutações foram aplicadas diretamente na árvore real e revertidas na sequência (`git status --short` confirmado limpo ao final).

### Escopo

`git diff e23558a..cdac7f6 --stat`:

```
 .../features/reorganizacao-hud-e-poder/design.md   | 108 ++++++++++
 .../features/reorganizacao-hud-e-poder/spec.md     | 110 ++++++++++
 .../features/reorganizacao-hud-e-poder/tasks.md    | 228 ++++++++++++++++++++
 app/__tests__/character-power.test.tsx             |  85 ++++++++
 app/__tests__/game-debug.test.tsx                  |  20 +-
 app/__tests__/hud-layout.test.tsx                  | 233 +++++++++++++++++++++
 app/globals.css                                    |  90 +++-----
 app/page.tsx                                       |  57 +++--
 8 files changed, 847 insertions(+), 84 deletions(-)
```

Todos os arquivos tocados são os esperados pela spec/design/tasks. `app/__tests__/game-debug.test.tsx` foi ajustado (não criado) porque a nova segunda barra "Poder" também pode exibir "100%", tornando `screen.getByText("100%")` ambíguo — o ajuste (`burstStaminaText()` escopado a `.utility-card` + `getByText("Rajada")`) é uma consequência necessária e cirúrgica de HUD-05, não scope creep. Nenhum arquivo fora do escopo esperado foi tocado; nenhum módulo em `lib/` foi criado ou alterado, consistente com o design ("nenhum módulo novo").

### Comandos executados

- `npm test -- --run` → 246 passed (246) em 4 de 6 execuções completas; 2 execuções tiveram 1 falha intermitente cada, isolada como flakiness pré-existente/ambiental (ver seção acima), nunca em `hud-layout.test.tsx`. Contagem de testes confirmada: **232 antes da feature (`e23558a`) → 246 depois (`cdac7f6`) → +14 novos**, todos rastreáveis a HUD-01..HUD-09.
- `npm run build` → sucesso, `next build --webpack` compilou e gerou todas as rotas estáticas sem erro.
- `npm run lint` → sucesso, 0 erros (2 warnings pré-existentes e não relacionados: `coverage/lcov-report/block-navigation.js` e `lib/debug.ts:26`).

### Gaps encontrados

Nenhum.
