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

> **Emenda 2**: mesmas duas camadas continuam valendo — nenhuma camada nova. Cobertura estendida pra CHAR-13..23. `lib/characters.ts` ganha 2 personagens no mesmo teste de invariantes (CHAR-10) que já varre `CHARACTERS` genericamente. `app/page.tsx` ganha o seletor (cards + retrato canvas) e o despacho genérico por `kind`, testados em `hidden-menu.test.tsx`/`character-power.test.tsx` (arquivos já existentes, sem arquivo novo).

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após tasks só com teste unitário (T1, T4) | `npm test -- --run` |
| Full | Após tasks que tocam teste de componente/integração (T2, T5, T6) | `npm test -- --run && npm run build` |
| Build | Fim da feature (T3 e T7, últimas tasks de cada emenda) | `npm run lint && npm run build && npm test -- --run` |

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

### Phase 4 (Emenda 2): Dados dos 2 novos personagens

```
T4
```

### Phase 5 (Emenda 2): Seletor real (estado + UI de cards)

```
T5
```

### Phase 6 (Emenda 2): Despacho genérico de poder por `kind`

```
T6
```

### Phase 7 (Emenda 2): Diferenciação visual (cor + retrato + rótulo)

```
T7
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

### T4: Migrar `CharacterSpecialPower` para union por `kind` e adicionar Estagiário/SRE

**What**: Em `lib/characters.ts`: transformar `CharacterSpecialPower` numa union discriminada (`kind: "dash" | "haste" | "shield"`, cada variante com seus próprios campos — `dashDistance` só em `"dash"`, `durationSeconds` em `"haste"`/`"shield"`); adicionar `bodyColor: string` a `CharacterDefinition` (Dev Pleno ganha `bodyColor: "#0ea5e9"` explícito); adicionar as entradas "Estagiário" (`maxHp: 70, speed: 260, size: 20, bodyColor: "#2dd4bf"`, poder "Já Terminei!" `kind: "haste", cooldownSeconds: 10, durationSeconds: 4`) e "SRE" (`maxHp: 130, speed: 190, size: 28, bodyColor: "#64748b"`, poder "Modo Incident Response" `kind: "shield", cooldownSeconds: 30, durationSeconds: 2.5`) ao array `CHARACTERS`. Atualizar os objetos `CharacterSpecialPower` literais já existentes em `lib/__tests__/characters.test.ts` para incluir `kind: "dash"` (migração mecânica, sem mudar o que os testes afirmam).
**Where**: `lib/characters.ts` (modificado), `lib/__tests__/characters.test.ts` (modificado)
**Depends on**: T1 (o registry e os testes já existem; esta task migra a forma do tipo e acrescenta dados)
**Reuses**: Teste de invariantes de CHAR-10 (já varre `CHARACTERS` genericamente — cobre os 2 personagens novos automaticamente, sem escrever um teste novo por personagem)
**Requirement**: CHAR-13, CHAR-14, CHAR-15 (forma do tipo)

**Tools**:

- MCP: NONE
- Skill: `testing-a11y`

**Done when**:

- [x] `CharacterSpecialPower` é uma union discriminada por `kind`; `npm run build`/`tsc` não aceita mais um poder sem `kind` ou com campos da variante errada (checagem em tempo de compilação, não em teste)
- [x] `CHARACTERS` tem 3 entradas: "Dev Pleno" (`bodyColor: "#0ea5e9"`, poder `kind: "dash"`), "Estagiário" (`bodyColor: "#2dd4bf"`, poder `kind: "haste"`), "SRE" (`bodyColor: "#64748b"`, poder `kind: "shield"`) com os valores exatos acima (CHAR-13, CHAR-14)
- [x] O teste de invariantes existente (CHAR-10: `maxHp > 0`, `speed > 0`, `size > 0`, `cooldownSeconds >= 0`) passa para as 3 entradas sem precisar de um caso novo por personagem — só de estender a asserção pra cobrir os campos específicos de `kind` (`dashDistance > 0` quando `kind === "dash"`; `durationSeconds > 0` quando `kind` é `"haste"`/`"shield"`)
- [x] Testes existentes de `characters.test.ts` que constroem um `CharacterSpecialPower` literal (ex: no teste de genericidade CHAR-09) incluem `kind: "dash"` — migração sem enfraquecer nenhuma asserção
- [x] Gate check passes: `npm test -- --run`
- [x] Test count: suíte sobe de 211 para 211+N (N = novos casos de teste desta task, se houver; a maioria da cobertura vem de reuso do teste de invariantes já existente)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(characters): add kind-discriminated power union and Estagiário/SRE characters`

---

### T5: Seletor real no painel "skins" (estado de seleção + cards clicáveis)

**What**: Adicionar `selectedCharacterId` (`useState`, default `DEFAULT_CHARACTER_ID`) e `selectedCharacterIdRef` (sincronizado via `useEffect`, mesmo padrão de `menuPanelRef`) em `app/page.tsx`. Trocar o sheet único do painel `menuPanel === "skins"` por um `<div role="radiogroup" aria-label="Escolha de personagem">` com `CHARACTERS.map(...)` gerando um `<button role="radio" aria-checked={character.id === selectedCharacterId}>` por personagem (nome, atributos, poder — mesmo conteúdo que já existe hoje, só que repetido genericamente por personagem, não fixo pro "Dev Pleno"); `onClick` chama `setSelectedCharacterId(character.id)`. Em `resetWaveOne()` (dentro do motor do jogo), adicionar `activeCharacter = resolveCharacter(selectedCharacterIdRef.current);` antes de reaplicar `player.maxHp/speed/size/hp` — isso faz `activeCharacter` deixar de ser `const` de module scope e virar `let` de closure, atualizado a cada início de partida/reset.
**Where**: `app/page.tsx` (modificado), `app/__tests__/hidden-menu.test.tsx` (modificado — os testes que hoje afirmam o conteúdo fixo do "Dev Pleno" continuam válidos ao selecioná-lo por ser o padrão; novos testes cobrem clicar em outro personagem)
**Depends on**: T4 (precisa das 3 entradas do registry para o seletor fazer sentido)
**Reuses**: Painel "skins" e o teste de abertura via `iddqd`/`idkfa` já existentes; padrão de estado+ref já usado pra `menuPanel`/`gameState`
**Requirement**: CHAR-21 (seletor, sem o retrato ainda — isso é T7), CHAR-22, CHAR-23

**Tools**:

- MCP: NONE
- Skill: `testing-a11y` (papéis ARIA corretos: `radiogroup`/`radio`)

**Done when**:

- [x] O painel "skins" renderiza 3 `role="radio"` (um por `CHARACTERS`), cada um com nome, atributos e poder (nome/descrição/cooldown) do personagem correspondente — gerado por `.map()`, não hardcoded (CHAR-21, parte não-visual)
- [x] O personagem selecionado tem `aria-checked="true"`; os outros `"false"` — clicar num diferente move o `aria-checked` (CHAR-22)
- [x] Selecionar o "Estagiário" e clicar "Jogar" faz a partida começar com `maxHp` 70 — verificável pela HUD de vida já existente (`screen.getByText("70")` após o game start), sem precisar de nenhum hook de debug novo (CHAR-22)
- [x] Recarregar o componente (novo `render(<Home />)`, simulando reload) volta ao "Dev Pleno" selecionado por padrão, mesmo que uma instância anterior tivesse selecionado outro personagem — sem `localStorage` novo (CHAR-23)
- [x] Gate check passes: `npm test -- --run && npm run build`
- [x] Test count: suíte sobe com os testes novos de seleção; nenhum teste existente de `hidden-menu.test.tsx` muda de contagem ou quebra

**Tests**: integration
**Gate**: full

**Commit**: `feat(characters): add real character selector with click-to-select cards`

---

### T6: Despacho genérico de poder por `kind` (haste e shield)

**What**: Generalizar `triggerActivePower()` em `app/page.tsx`: em vez de assumir sempre dash, despachar por `power.kind` — `"dash"` mantém o comportamento já existente (`resolveDashDirection` + `clamp`); `"haste"` faz `player.haste = power.durationSeconds`; `"shield"` faz `player.invincible = Math.max(player.invincible, power.durationSeconds)`. Estender o HUD de debug (mesmo gate `isDebugAllowed()`) com um novo `role="status"` — `debugPlayerEffects`, expondo `{ haste, invincible }` arredondados — necessário pra provar que os efeitos foram aplicados sem ler pixels do canvas.
**Where**: `app/page.tsx` (modificado), `app/__tests__/character-power.test.tsx` (modificado)
**Depends on**: T5 (precisa do seletor pra trocar de personagem antes de iniciar a partida e testar haste/shield — sem seletor, só dá pra testar o Dev Pleno/dash)
**Reuses**: Guardas de cooldown/borda de subida/reset/estado já existentes em `triggerActivePower` (CHAR-04/05/06/07) — nenhuma delas muda, só o corpo que decide QUAL efeito aplicar; padrão de debug HUD já estabelecido em T3
**Requirement**: CHAR-15 (despacho, parte comportamental), CHAR-16, CHAR-17, CHAR-18

**Tools**:

- MCP: NONE
- Skill: `testing-a11y`

**Done when**:

- [x] Selecionar "Estagiário", iniciar partida, pressionar `Q` fora de cooldown: `debugPlayerEffects` mostra `haste > 0` igual a `durationSeconds` (4) e o cooldown geral passa a `10` (CHAR-16)
- [x] Selecionar "SRE", iniciar partida, pressionar `Q` fora de cooldown: `debugPlayerEffects` mostra `invincible >= 2.5` e o cooldown geral passa a `30` (CHAR-17)
- [x] Repetir para "Estagiário" (ou "SRE") os mesmos testes já existentes de CHAR-04 (bloqueio durante cooldown) e CHAR-07 (sem efeito fora de `"playing"`), confirmando que o comportamento é idêntico ao do "Dev Pleno"/dash — prova CHAR-18 na prática, não só por inspeção de código
- [x] O "Dev Pleno"/dash continua funcionando exatamente como antes (nenhum teste de T3 quebra ou muda de asserção)
- [x] Gate check passes: `npm test -- --run && npm run build`
- [x] Test count: suíte sobe com os novos testes de haste/shield; nenhum teste existente de `character-power.test.tsx` muda de contagem ou quebra

**Tests**: integration
**Gate**: full

**Commit**: `feat(characters): dispatch active power generically by kind (haste, shield)`

---

### T7: Diferenciação visual (cor do corpo, retrato no seletor, nome no rótulo em jogo)

**What**: Extrair de `drawPlayer()` uma função `drawCharacterBody(ctx, x, y, { bodyColor, faceColor = "#f5d0a9", runOffset = 0 })` (cabelo, rosto, corpo/camisa, braços, pernas, olhos — sem sombra/anel de foco/barras de fúria/arma/texto, que continuam em `drawPlayer()`). `drawPlayer()` passa a chamar essa função com `bodyColor: player.fury > 0 ? "#f97316" : activeCharacter.bodyColor` e `faceColor`/`runOffset` computados como já são hoje; o rótulo de texto acima do jogador passa de `"Java Pleno"` fixo para `activeCharacter.name`. No painel "skins" (dos cards de T5), adicionar um `<canvas>` pequeno por card; um `useEffect` (dependente de `menuPanel`) desenha 1x em cada canvas via `drawCharacterBody` (sem animação, pose fixa) quando o painel abre.
**Where**: `app/page.tsx` (modificado), `app/__tests__/hidden-menu.test.tsx` (modificado — cobre o retrato), `app/__tests__/character-power.test.tsx` (modificado — cobre cor em jogo e rótulo)
**Depends on**: T6 (é a última camada, depende de T4 pro campo `bodyColor` e T5 pros cards onde o retrato entra)
**Reuses**: `pixelRect` já existente; mock global de `getContext` já usado em todos os testes de componente (os `<canvas>` novos recebem o mesmo mock automaticamente)
**Requirement**: CHAR-19, CHAR-20, CHAR-21 (retrato)

**Tools**:

- MCP: NONE
- Skill: `testing-a11y`

**Done when**:

- [x] Selecionar "Estagiário", iniciar partida, avançar 1 frame: entre as chamadas capturadas de `canvasContext.fillRect` (via wrapper de teste que registra `ctx.fillStyle` no momento da chamada), existe uma com cor `"#2dd4bf"` e dimensões da camisa (16x13) — prova que o corpo é desenhado com a cor do personagem ativo, não mais fixo em `"#0ea5e9"` (CHAR-19)
- [ ] Com "Dev Pleno" em fúria (`player.fury > 0`, reproduzível via cenário de combate ou debug), a cor da camisa continua `"#f97316"` (laranja) independentemente do personagem — a fúria continua sobrepondo a cor do corpo (regressão de comportamento já existente, não deve quebrar). **Não coberto por teste automatizado** — não há um caminho de debug determinístico para forçar `player.fury > 0` nesta suíte (só via coleta de power-up "refactor", cujo spawn é randomizado); verificado apenas por inspeção de código: o ternário `player.fury > 0 ? "#f97316" : activeCharacter.bodyColor` em `app/page.tsx` manteve a condição e o branch verdadeiro idênticos ao código anterior (`player.fury > 0 ? "#f97316" : "#0ea5e9"`), só o branch falso mudou de literal para campo. Ver "Desvios/observações" no relatório final.
- [x] `canvasContext.fillText` é chamado com o nome do personagem ativo (ex: `"Estagiário"`) durante a partida, não mais `"Java Pleno"` fixo (CHAR-20)
- [x] Cada card do seletor (T5) contém um elemento `<canvas>`; abrir o painel "skins" dispara pelo menos uma chamada de desenho (`fillRect`) por card — confirma que o retrato é desenhado, não só que a tag existe (CHAR-21)
- [x] Reabrir o painel "skins" (fechar e abrir de novo) não acumula desenhos duplicados nem gera erro — o `useEffect` limpa/redesenha corretamente
- [x] Gate check passes: `npm run lint && npm run build && npm test -- --run`
- [x] Test count: suíte sobe com os testes novos de cor/retrato/rótulo; nenhum teste existente muda de contagem ou quebra

**Tests**: integration
**Gate**: build

**Commit**: `feat(characters): differentiate characters visually (body color, portrait, in-game label)`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7

Phase 1:  T1
Phase 2:  T2
Phase 3:  T3
Phase 4:  T4
Phase 5:  T5
Phase 6:  T6
Phase 7:  T7
```

Execução estritamente sequencial — é uma cadeia única de dependências (T1 → T2 → T3 → T4 → T5 → T6 → T7), não há trabalho independente nesta feature. 7 tasks totais ≤ ~8 → **execução inline, sem sub-agent** (abaixo do limiar de delegação). T1-T3 já concluídas (Emenda 1, `Verified`); T4-T7 são a Emenda 2.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Registry + resolver + geometria do dash | 1 módulo novo + 1 arquivo de teste | ✅ Granular (um deliverable coeso: o registry inteiro é um único conceito) |
| T2: Atributos do jogador + painel real | 1 arquivo modificado (2 pontos: criação do `player`, conteúdo do painel) + 1 teste modificado | ✅ Granular (2 mudanças no mesmo arquivo, cohesas — ambas expõem o mesmo dado, `activeCharacter`; mescladas por necessidade de testabilidade, ver `design.md`) |
| T3: Poder especial ativo | 1 arquivo modificado (5 pontos relacionados: cooldown, direção, trigger, keydown, reset, debug HUD) + 1 teste novo | ✅ Granular (uma única mecânica — o poder ativo; os 5 pontos são facetas inseparáveis da mesma feature, nenhum é testável isoladamente) |
| T4: Union por `kind` + Estagiário/SRE | 1 módulo modificado (tipo + dados) + 1 teste modificado | ✅ Granular (mudança de forma do tipo e adição de dados são o mesmo conceito: "o registry agora suporta 3 personagens de tipos de poder diferentes") |
| T5: Seletor real (estado + cards) | 1 arquivo modificado (estado/ref + JSX do painel + `resetWaveOne`) + 1 teste modificado | ✅ Granular (uma única feature — "escolher personagem" — estado e UI são inseparáveis: um sem o outro não é testável nem demonstrável) |
| T6: Despacho genérico por `kind` | 1 arquivo modificado (`triggerActivePower` + debug HUD) + 1 teste modificado | ✅ Granular (uma única mecânica — generalizar o despacho — o debug HUD novo é exigido pela própria testabilidade desta task, mesmo padrão de T3) |
| T7: Diferenciação visual | 1 arquivo modificado (extração de função de desenho + 3 pontos de uso: cor em jogo, retrato no seletor, rótulo) + 2 testes modificados | ✅ Granular (uma única feature — "aparência distinta" — os 3 pontos são facetas da mesma extração de `drawCharacterBody`, nenhum testável isoladamente sem os outros dois existirem) |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Nenhuma seta de entrada | ✅ Match |
| T2 | T1 | Fase 2 depois da Fase 1 | ✅ Match |
| T3 | T2 | Fase 3 depois da Fase 2 | ✅ Match |
| T4 | T1 | Fase 4 depois da Fase 3 (cadeia única) | ✅ Match |
| T5 | T4 | Fase 5 depois da Fase 4 | ✅ Match |
| T6 | T5 | Fase 6 depois da Fase 5 | ✅ Match |
| T7 | T6 (e T4/T5 indiretamente) | Fase 7 depois da Fase 6 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1: Registry + resolver + geometria do dash | Domínio puro (`lib/characters.ts`) | unit | unit | ✅ OK |
| T2: Atributos do jogador + painel real | Componente/rota (`app/page.tsx`) | integration | integration | ✅ OK |
| T3: Poder especial ativo | Componente/rota (`app/page.tsx`) | integration | integration | ✅ OK |
| T4: Union por `kind` + Estagiário/SRE | Domínio puro (`lib/characters.ts`) | unit | unit | ✅ OK |
| T5: Seletor real (estado + cards) | Componente/rota (`app/page.tsx`) | integration | integration | ✅ OK |
| T6: Despacho genérico por `kind` | Componente/rota (`app/page.tsx`) | integration | integration | ✅ OK |
| T7: Diferenciação visual | Componente/rota (`app/page.tsx`) | integration | integration | ✅ OK |

Nenhuma violação — todas as tasks que criam/modificam camada com teste obrigatório incluem o teste na mesma task. Nenhum "testado em outra task" usado como desculpa.

---

## Ferramentas por task (confirmar antes do Execute)

**Skills disponíveis usadas**: `testing-a11y` (T1-T7 — regras de teste do projeto).
**MCPs**: nenhum necessário — não há biblioteca externa nova nem API desconhecida nesta feature.

Confirma essa atribuição de ferramentas antes de eu seguir pro Execute (T4-T7 — T1-T3 já concluídas)?
