# Reorganização do HUD e Feedback do Poder Especial Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `_docs/specs/features/reorganizacao-hud-e-poder/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute. Guidelines found: `AGENTS.md` → `.agents/skills/testing-a11y/SKILL.md` (regras de teste: sempre `getByRole`/`getByLabelText`/`getByText`, comportamento visível > implementação); amostragem de `app/__tests__/hidden-menu.test.tsx`/`character-power.test.tsx` (render + `fireEvent` + `screen.getByRole`, canvas mockado, `NODE_ENV=development` quando precisa dos status de debug).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Componente/rota (`app/page.tsx`: layout do HUD, menu de título, banner de ativação) | integration (render + `fireEvent`) | 1:1 com HUD-01 a HUD-08; edge case HUD-06 (sem poder) coberto por inspeção de código, não por teste automatizado — nenhum personagem real do catálogo tem `specialPower: null` hoje (mesma limitação já aceita para o caso de `player.fury` na feature `sistema-personagens`) | `app/__tests__/hud-layout.test.tsx` (novo), `app/__tests__/character-power.test.tsx` (estendido) | `npm test -- --run` |

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Não se aplica nesta feature (nenhuma task é unit-only) | `npm test -- --run` |
| Full | Após qualquer task (todas tocam componente/integração) | `npm test -- --run && npm run build` |
| Build | Fim da feature (última task) | `npm run lint && npm run build && npm test -- --run` |

---

## Execution Plan

As 3 tasks são mutuamente independentes (tocam regiões diferentes do JSX/lógica de `app/page.tsx`) — sem cadeia de dependência real entre elas, mas execução ainda sequencial (sem sub-agent, abaixo do limiar).

### Phase 1: Layout do HUD (patrocínio → som + medidor de poder)

```
T1
```

### Phase 2: "Apoie o jogo" no menu + navegação por teclado

```
T2
```

### Phase 3: Aviso de ativação do poder

```
T3
```

---

## Task Breakdown

### T1: Reorganizar o HUD — remover patrocínio, mover controles de som, adicionar medidor de cooldown do poder

**What**: Remover o `<aside className="hud-card sponsor-card">` do `topbar`. Adicionar `abilityCooldownPct` (`useState`, produção) calculado em `syncHud()` a partir de `abilityCooldownRemaining`/`power.cooldownSeconds` (100 quando não há poder). No `.utility-card`, adicionar um segundo `<span className="stamina-meter">` (rótulo "Poder", mesma estrutura de `strong`/`i`/`small` da Rajada) condicionado a `activeCharacter.specialPower` não ser `null`. Mover `.sound-controls` (mute + volume) pra um novo `<div className="hud-card sound-card" aria-label="Controles de som">` no slot antes ocupado pelo patrocínio. Remover as regras CSS `.sponsor-card` (incluindo as 2 de `display: none` em mídia mobile/landscape, que ficam órfãs) e adicionar `.hud-card.sound-card` com o ajuste mínimo de padding/alinhamento necessário.
**Where**: `app/page.tsx` (modificado), `app/globals.css` (modificado), `app/__tests__/hud-layout.test.tsx` (novo)
**Depends on**: None
**Reuses**: Classe `.stamina-meter` (CSS e forma de JSX) já usada pela Rajada; padrão de state 0-100 de `burstStaminaPct`; classe base `.hud-card` já usada por `jdk-card`/`wave-card`/etc.
**Requirement**: HUD-01, HUD-04, HUD-05, HUD-06

**Tools**:

- MCP: NONE
- Skill: `testing-a11y`

**Done when**:

- [x] `.sponsor-card`/"Patrocínio" não aparece mais em nenhum lugar do `topbar` renderizado (HUD-01)
- [x] Os controles de som (botão de mute + slider de volume) continuam funcionando (mutar, ajustar volume) e agora ficam num card próprio no slot antes ocupado pelo patrocínio (HUD-04)
- [x] Com o "Dev Pleno" selecionado (padrão, tem `specialPower`), o `.utility-card` mostra 2 medidores (`role`/estrutura de `.stamina-meter`): Rajada e Poder, mesma estrutura visual — teste afirma a presença de ambos por `getByText("Rajada")`/`getByText("Poder")` dentro do mesmo card (HUD-05)
- [x] O medidor de Poder reflete `abilityCooldownPct`: 100% logo no início da partida (reset já zera `abilityCooldownRemaining`), cai após usar `Q`, sobe de volta com o tempo — verificável via o texto de porcentagem renderizado (mesmo padrão já usado para `burstStaminaPct`) (HUD-05)
- [x] HUD-06 (sem medidor quando `specialPower` é `null`): sem cobertura automatizada — nenhum personagem real do catálogo tem esse caso hoje; verificado por inspeção do código-fonte do condicional (`{activeCharacter.specialPower && (...)}`), documentado como limitação aceita (mesmo padrão do caso `player.fury` em `sistema-personagens`)
- [x] Gate check passes: `npm test -- --run && npm run build`
- [x] Test count: suíte sobe com os testes novos de `hud-layout.test.tsx`; nenhum teste existente muda de contagem ou quebra

**Tests**: integration
**Gate**: full

**Commit**: `feat(hud): remove sponsor card, relocate sound controls, add power cooldown meter`

---

### T2: "Apoie o jogo" como 4ª opção do menu de título

**What**: Adicionar um 4º `<button role="menuitem" aria-current={menuIndex === 3}>Apoie o jogo</button>` em `title-menu-actions`, com `onClick={() => activateMenuOption(3)}`. Em `activateMenuOption`, trocar o `else` genérico por `else if (index === 2) setMenuPanel("help"); else if (index === 3) openSupportPanel();`. Em `onKeyDown` (navegação do menu de título), trocar `(menuIndexRef.current + 2) % 3` por `(menuIndexRef.current + 3) % 4` (seta pra cima) e `(menuIndexRef.current + 1) % 3` por `(menuIndexRef.current + 1) % 4` (seta pra baixo).
**Where**: `app/page.tsx` (modificado), `app/__tests__/hud-layout.test.tsx` (mesmo arquivo de T1, seção nova)
**Depends on**: None
**Reuses**: `openSupportPanel()` já existente, chamado tal como está; padrão de teste de clique/teclado já usado em `hidden-menu.test.tsx` (`fireEvent.keyDown`, `screen.getByRole("menuitem", ...)`)
**Requirement**: HUD-02, HUD-03

**Tools**:

- MCP: NONE
- Skill: `testing-a11y`

**Done when**:

- [x] O menu de título mostra 4 `role="menuitem"`: Jogar, High Scores, Como Jogar, Apoie o jogo (HUD-02)
- [x] Clicar em "Apoie o jogo" (ou navegar até ele com seta + Enter) abre o mesmo painel de apoio (mesma tela que já existe hoje, acessível antes só pelo card do HUD) (HUD-02)
- [x] Navegar com seta pra baixo a partir da 4ª opção (índice 3) volta pro índice 0 (Jogar); navegar com seta pra cima a partir do índice 0 vai pro índice 3 (Apoie o jogo) — prova que o wrap-around `% 4` funciona nas duas direções, sem pular nenhuma opção (HUD-03)
- [x] As 3 opções já existentes (Jogar, High Scores, Como Jogar) continuam navegáveis e clicáveis exatamente como antes
- [x] Gate check passes: `npm test -- --run && npm run build`
- [x] Test count: suíte sobe com os testes novos; nenhum teste existente muda de contagem ou quebra

**Tests**: integration
**Gate**: full

**Commit**: `feat(hud): add "Apoie o jogo" as a 4th title menu option`

---

### T3: Aviso na tela ao ativar o poder especial

**What**: Em `triggerActivePower()`, depois que o efeito é aplicado com sucesso (passou por todas as guardas: `gameState === "playing"`, tem poder, fora de cooldown) e antes/depois de setar `abilityCooldownRemaining`, chamar `announceEffect(`${power.name.toUpperCase()}: ativado`);` — mesma função já usada pelos power-ups pra desenhar o banner central no canvas.
**Where**: `app/page.tsx` (modificado), `app/__tests__/character-power.test.tsx` (estendido)
**Depends on**: None
**Reuses**: `announceEffect()` já existente, chamada tal como está; mecanismo de banner (`effectMessage`/`effectBanner`) sem nenhuma mudança
**Requirement**: HUD-07, HUD-08

**Tools**:

- MCP: NONE
- Skill: `testing-a11y`

**Done when**:

- [x] Pressionar `Q` com o poder disponível durante uma partida ativa dispara `announceEffect` com o texto `"${NOME DO PODER EM MAIÚSCULAS}: ativado"` — verificável via a mesma técnica já usada nos testes de power-up (`canvasContext.fillText` chamado com o texto esperado) (HUD-07)
- [x] Pressionar `Q` enquanto o poder está em cooldown NÃO dispara um novo `announceEffect` (o texto do banner, se algum já estava visível, não muda) (HUD-08)
- [x] Pressionar `Q` fora de `gameState === "playing"` (ex: ainda no menu) NÃO dispara `announceEffect` (HUD-08)
- [x] O comportamento de dash/haste/shield em si (teleporte, buff, escudo) continua idêntico ao já testado em `character-power.test.tsx` — nenhum teste existente muda de asserção
- [x] Gate check passes: `npm run lint && npm run build && npm test -- --run`
- [x] Test count: suíte sobe com os testes novos; nenhum teste existente muda de contagem ou quebra

**Tests**: integration
**Gate**: build

**Commit**: `feat(hud): announce special power activation with the power-up banner`

---

### T4: Restaurar os links de Privacidade/Sobre dentro de "Apoie o jogo"

**What**: Adicionar um `<nav aria-label="Links institucionais">` com links pra `/privacidade` e `/sobre` (usando `next/link`, mesmo componente `Link` já usado em outros lugares) dentro do painel `support-screen` ("Apoie o jogo") — restaura o acesso que existia via `.sponsor-links` no HUD antes de T1 remover o card de patrocínio. Adicionar o CSS mínimo necessário (reaproveitando o estilo visual que `.sponsor-links`/`.sponsor-links a` tinham antes de serem removidos em T1, se ainda fizer sentido, ou um estilo simples equivalente).
**Where**: `app/page.tsx` (modificado — painel `support-screen`), `app/globals.css` (modificado), `app/__tests__/hud-layout.test.tsx` (estendido)
**Depends on**: T2 (o painel "Apoie o jogo" só é alcançável pelo menu depois de T2; tecnicamente o painel já existia antes, mas o teste de T4 usa o fluxo de menu criado em T2)
**Reuses**: Componente `Link` do `next/link` já usado no arquivo; estilo visual que `.sponsor-links` tinha antes de T1 remover
**Requirement**: HUD-09

**Tools**:

- MCP: NONE
- Skill: `testing-a11y`

**Done when**:

- [x] O painel "Apoie o jogo" mostra links pra `/privacidade` e `/sobre`, visíveis e navegáveis (HUD-09)
- [x] Teste confirma que abrir "Apoie o jogo" (via menu) e depois `getByRole("link", { name: "Privacidade" })`/`"Sobre"` encontra os links corretos com `href` esperado
- [x] Nenhum teste existente de T1/T2/T3 muda de contagem ou quebra
- [x] Gate check passes: `npm run lint && npm run build && npm test -- --run`

**Tests**: integration
**Gate**: build

**Commit**: `fix(hud): restore Privacidade/Sobre links inside the Apoie o jogo panel`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3

Phase 1:  T1
Phase 2:  T2
Phase 3:  T3
```

Execução sequencial (sem sub-agent, abaixo do limiar de delegação) — mas T1/T2/T3 não têm dependência real entre si, só ordem de commit. 3 tasks totais ≤ ~8.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Layout do HUD | 2 arquivos modificados (JSX + CSS) + 1 teste novo | ✅ Granular (um deliverable coeso: reorganização do `topbar`) |
| T2: "Apoie o jogo" no menu | 1 arquivo modificado (3 pontos relacionados: botão, `activateMenuOption`, aritmética de navegação) + teste na mesma suite de T1 | ✅ Granular (uma única feature — adicionar uma opção de menu — os 3 pontos são facetas inseparáveis) |
| T3: Aviso de ativação do poder | 1 arquivo modificado (1 linha nova) + 1 teste estendido | ✅ Granular (mudança mínima e cirúrgica) |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Nenhuma seta de entrada | ✅ Match |
| T2 | None | Nenhuma seta de entrada | ✅ Match |
| T3 | None | Nenhuma seta de entrada | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1: Layout do HUD | Componente/rota (`app/page.tsx`) | integration | integration | ✅ OK |
| T2: "Apoie o jogo" no menu | Componente/rota (`app/page.tsx`) | integration | integration | ✅ OK |
| T3: Aviso de ativação do poder | Componente/rota (`app/page.tsx`) | integration | integration | ✅ OK |

Nenhuma violação — todas as tasks que criam/modificam camada com teste obrigatório incluem o teste na mesma task.

---

## Ferramentas por task (confirmar antes do Execute)

**Skills disponíveis usadas**: `testing-a11y` (T1, T2, T3 — regras de teste do projeto).
**MCPs**: nenhum necessário — não há biblioteca externa nova nem API desconhecida nesta feature.

Confirma essa atribuição de ferramentas antes de eu seguir pro Execute?
