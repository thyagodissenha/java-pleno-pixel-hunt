# Sistema de Personagens Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `_docs/specs/features/sistema-personagens/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute. Guidelines found: `AGENTS.md` → `.agents/skills/testing-a11y/SKILL.md` (regras de teste: sempre `getByRole`/`getByLabelText`/`getByText`, comportamento visível > implementação), amostragem de `lib/__tests__/*.test.ts` (`characters.test.ts` a criar segue o padrão de `obstacles.test.ts`/`score-sync.test.ts`) e `app/__tests__/*.test.tsx` (`hidden-menu.test.tsx`, `game-debug.test.tsx` — render + `fireEvent.keyDown` + `screen.getByRole`).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Domínio puro (`lib/characters.ts`: registry, `resolveCharacter`, `resolveDashDirection`) | unit | Todos os branches; 1:1 com CHAR-01/02/09/10 e os Edge Cases de geometria da spec; nenhum caso listado fica sem teste | `lib/__tests__/characters.test.ts` | `npm test -- --run` |
| Componente/rota (`app/page.tsx`: painel "skins", ativação do poder, HUD de debug) | integration (render + `fireEvent`) | 1:1 com CHAR-03/04/05/06/07/08/11; cobertura preservada nos testes já existentes de `hidden-menu.test.tsx` que forem atualizados (placeholder → conteúdo real) | `app/__tests__/hidden-menu.test.tsx`, `app/__tests__/character-power.test.tsx` | `npm test -- --run` |

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após tasks só com teste unitário (T1) | `npm test -- --run` |
| Full | Após tasks que tocam teste de componente/integração (T2) | `npm test -- --run && npm run build` |
| Build | Fim da feature (T3, última task) | `npm run lint && npm run build && npm test -- --run` |

---

## Execution Plan

Fases sequenciais — cada uma depende inteiramente da anterior (não há trabalho independente nesta feature: é uma cadeia única).

### Phase 1: Registry de personagens (fundação)

```
T1
```

### Phase 2: Atributos do jogador + painel real

```
T2
```

### Phase 3: Poder especial ativo

```
T3
```

---

## Task Breakdown

### T1: Criar `lib/characters.ts` (registry, resolução e geometria do dash)

**What**: Criar o módulo `lib/characters.ts` com os tipos `CharacterSpecialPower`/`CharacterDefinition`, o array `CHARACTERS` (1 entrada: "Dev Pleno" com `maxHp: 100, speed: 210, size: 24`, poder "Refactor Dash" com `cooldownSeconds: 6, dashDistance: 140`), `DEFAULT_CHARACTER_ID`, `resolveCharacter(id)` (fallback para o primeiro item) e `resolveDashDirection(moveDirection, player, enemies)` (direção do movimento → inimigo mais próximo → `(0,-1)`).
**Where**: `lib/characters.ts` (novo), `lib/__tests__/characters.test.ts` (novo)
**Depends on**: None
**Reuses**: Fórmula de distância (`Math.hypot`) já usada em `app/page.tsx:160`, replicada localmente (não importada — `app/page.tsx` é arquivo de rota, ver `AD-008`)
**Requirement**: CHAR-01 (dados), CHAR-02, CHAR-09, CHAR-10

**Tools**:

- MCP: NONE
- Skill: `testing-a11y` (regras gerais de teste do projeto, mesmo sendo teste de função pura)

**Done when**:

- [x] `CHARACTERS` contém exatamente 1 personagem com os valores acima; `DEFAULT_CHARACTER_ID` aponta para ele
- [x] `resolveCharacter(undefined)` e `resolveCharacter("id-inexistente")` retornam `CHARACTERS[0]` (CHAR-02)
- [x] Teste com uma 2ª entrada de personagem **só no arquivo de teste** (não no catálogo real) prova que `resolveCharacter` resolve genericamente por `id`, sem nenhuma mudança de código além do array de teste (CHAR-09)
- [x] Teste varre `CHARACTERS` e afirma `maxHp > 0`, `speed > 0`, `size > 0`, e (quando `specialPower` não é `null`) `cooldownSeconds >= 0` para cada entrada (CHAR-10)
- [x] `resolveDashDirection` coberto: direção de movimento não-nula é normalizada (vetor unitário); parado com inimigos em tela mira no mais próximo; parado sem inimigos retorna `(0,-1)`; inimigo exatamente na posição do jogador não gera `NaN`/divisão por zero (Edge Cases da spec)
- [x] Gate check passes: `npm test -- --run`
- [x] Test count: suíte total sobe de 195 para 195+N (N = testes novos deste arquivo)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(characters): add character registry with resolver and dash direction`

---

### T2: Inicializar o jogador a partir do registry e mostrar dados reais no painel "skins"

**What**: Adicionar `const activeCharacter = resolveCharacter(DEFAULT_CHARACTER_ID);` em module scope de `app/page.tsx` (junto de `adsenseClientId`); trocar os literais `hp: 100, maxHp: 100, size: 24, speed: 210` da criação do `player` (~linha 638) por `activeCharacter.maxHp/size/speed`; substituir o placeholder "Sistema em construção..." do painel `menuPanel === "skins"` pelo nome do personagem, atributos (`maxHp`, `speed`, `size`) e poder especial (nome, descrição, cooldown) lidos de `activeCharacter`.
**Where**: `app/page.tsx` (modificado), `app/__tests__/hidden-menu.test.tsx` (modificado — a asserção do texto placeholder é substituída pela asserção do conteúdo real, já que CHAR-08 supersede intencionalmente o comportamento da feature anterior)
**Depends on**: T1 (precisa de `resolveCharacter`/`CHARACTERS`/`DEFAULT_CHARACTER_ID`)
**Reuses**: Painel `menuPanel === "skins"` já existente (feature de cheat code desta sessão); padrão de teste de `hidden-menu.test.tsx`
**Requirement**: CHAR-01 (wiring), CHAR-08, CHAR-11

**Tools**:

- MCP: NONE
- Skill: `testing-a11y`

**Done when**:

- [x] `player.hp`/`player.maxHp`/`player.size`/`player.speed` na criação vêm de `activeCharacter`, não mais de literais (CHAR-01)
- [x] Painel "skins" mostra nome do personagem, `maxHp`, `speed`, `size` e (nome + descrição + cooldown) do poder especial — texto "Sistema em construção..." não aparece mais (CHAR-08)
- [x] Teste em `hidden-menu.test.tsx` atualizado: a asserção antiga do placeholder é substituída por uma que verifica o conteúdo real (nome "Dev Pleno", valores de atributo, nome do poder "Refactor Dash") — mudança sinalizada aqui, não silenciosa
- [x] Nenhuma chave nova de `localStorage` é introduzida para seleção de personagem — confirmado por inspeção/grep (CHAR-11, verificação por ausência conforme `design.md`)
- [x] Gate check passes: `npm test -- --run && npm run build`
- [x] Test count: mesma contagem de `it(...)` em `hidden-menu.test.tsx` de antes (1 asserção trocada de conteúdo, não removida) + nenhuma queda no total da suíte

**Tests**: integration
**Gate**: full

**Commit**: `feat(characters): initialize player from character registry and show real data in hidden panel`

---

### T3: Poder especial ativo ("Refactor Dash" — tecla Q, cooldown)

**What**: Adicionar ao motor do jogo (efeito único de `app/page.tsx`): variáveis de closure `abilityCooldownRemaining`, `lastMoveX`, `lastMoveY`; em `update(delta)`, decrementar o cooldown e gravar `lastMoveX/lastMoveY = move.x/move.y` a cada frame; nova função `triggerActivePower()` (guarda `gameState === "playing"`, guarda de cooldown, chama `resolveDashDirection`, `clamp` no destino, inicia cooldown); no `onKeyDown`, branch `if (event.key.toLowerCase() === "q" && !event.repeat) triggerActivePower();`; em `resetWaveOne()`, `abilityCooldownRemaining = 0;`. Estender o HUD de debug (atrás de `isDebugAllowed()`, mesmo padrão de `debugBossHealth`/`debugPowerUpCount`) com dois `role="status"` novos — cooldown do poder e posição do jogador — necessários para tornar CHAR-03/04/05 verificáveis sem ler pixels do canvas (ver `design.md` Tech Decisions).
**Where**: `app/page.tsx` (modificado), `app/__tests__/character-power.test.tsx` (novo)
**Depends on**: T2 (precisa de `activeCharacter` já existindo e do `player` já inicializado a partir dele)
**Reuses**: `normalize`/`clamp`/`distance` já existentes; `resolveDashDirection` de T1; padrão de debug HUD (`isDebugAllowed()`, `role="status"`) e padrão de teste de `game-debug.test.tsx` (canvas mock, `requestAnimationFrame` stub, `advanceFrames`, `vi.stubEnv("NODE_ENV", "development")`)
**Requirement**: CHAR-03, CHAR-04, CHAR-05, CHAR-06, CHAR-07

**Tools**:

- MCP: NONE
- Skill: `testing-a11y`

**Done when**:

- [x] `Q` durante `gameState === "playing"` com cooldown zerado dispara o dash: posição do jogador muda na direção esperada pela distância `dashDistance` do personagem, e o cooldown passa a ser `cooldownSeconds` (CHAR-03)
- [x] `Q` pressionado de novo enquanto o cooldown ainda está ativo não move o jogador nem reseta o cooldown (CHAR-04)
- [x] `Q` disparado como evento `repeat: true` **antes de qualquer ativação anterior** (cooldown ainda em 0) é ignorado — isola a guarda de "borda de subida" do bloqueio por cooldown (CHAR-05)
- [x] Após um reset de partida (evento de debug `reset`, ou nova partida), o cooldown volta a 0 imediatamente (CHAR-06)
- [x] `Q` pressionado fora de `gameState === "playing"` (ex: ainda no menu, antes de "Jogar") não tem efeito (CHAR-07)
- [x] Segurar `Q` (múltiplos eventos `keydown` com `repeat: true` seguidos) não dispara o poder mais de uma vez por pressionamento real (parte de CHAR-05)
- [x] Gate check passes: `npm run lint && npm run build && npm test -- --run`
- [x] Test count: suíte sobe com os testes novos de `character-power.test.tsx`; nenhum teste existente muda de contagem ou quebra

**Tests**: integration
**Gate**: build

**Commit**: `feat(characters): add Refactor Dash active power with cooldown`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3

Phase 1:  T1
Phase 2:  T2
Phase 3:  T3
```

Execução estritamente sequencial — é uma cadeia única de dependências (T1 → T2 → T3), não há trabalho independente nesta feature. 3 tasks totais ≤ ~8 → **execução inline, sem sub-agent** (abaixo do limiar de delegação).

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Registry + resolver + geometria do dash | 1 módulo novo + 1 arquivo de teste | ✅ Granular (um deliverable coeso: o registry inteiro é um único conceito) |
| T2: Atributos do jogador + painel real | 1 arquivo modificado (2 pontos: criação do `player`, conteúdo do painel) + 1 teste modificado | ✅ Granular (2 mudanças no mesmo arquivo, cohesas — ambas expõem o mesmo dado, `activeCharacter`; mescladas por necessidade de testabilidade, ver `design.md`) |
| T3: Poder especial ativo | 1 arquivo modificado (5 pontos relacionados: cooldown, direção, trigger, keydown, reset, debug HUD) + 1 teste novo | ✅ Granular (uma única mecânica — o poder ativo; os 5 pontos são facetas inseparáveis da mesma feature, nenhum é testável isoladamente) |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Nenhuma seta de entrada | ✅ Match |
| T2 | T1 | Fase 2 depois da Fase 1 | ✅ Match |
| T3 | T2 | Fase 3 depois da Fase 2 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1: Registry + resolver + geometria do dash | Domínio puro (`lib/characters.ts`) | unit | unit | ✅ OK |
| T2: Atributos do jogador + painel real | Componente/rota (`app/page.tsx`) | integration | integration | ✅ OK |
| T3: Poder especial ativo | Componente/rota (`app/page.tsx`) | integration | integration | ✅ OK |

Nenhuma violação — todas as tasks que criam/modificam camada com teste obrigatório incluem o teste na mesma task. Nenhum "testado em outra task" usado como desculpa.

---

## Ferramentas por task (confirmar antes do Execute)

**Skills disponíveis usadas**: `testing-a11y` (T1, T2, T3 — regras de teste do projeto).
**MCPs**: nenhum necessário — não há biblioteca externa nova nem API desconhecida nesta feature.

Confirma essa atribuição de ferramentas antes de eu seguir pro Execute?
