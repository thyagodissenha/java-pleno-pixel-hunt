# Motor de Jogo Modular — Fix2 Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `_docs/specs/features/motor-de-jogo-modular-fix2/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase sampling (`lib/pixel-hunt-engine/__tests__/*.test.ts`, `lib/pixel-hunt-engine/phases/*/__tests__/*.test.ts`) and project guidelines. Guidelines found: `AGENTS.md` §10 (Stack: Vitest + Testing Library + Playwright), skill `testing-a11y`. No explicit coverage-threshold config found (`vitest.config.ts` has no `coverage.thresholds` block) — strong default applied where guidelines are silent.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Motor — regras de domínio (`physics.ts`, novo `weapon-progression.ts`, `types.ts` helpers) | unit | 1:1 com ACs do spec; todo edge case listado tem teste; **exceção nomeada**: dedupe puro sem mudança de comportamento (ENGINE-26, ENGINE-27) é coberto pela suíte existente como rede de regressão — não exige teste novo, só manutenção dos existentes verdes | `lib/pixel-hunt-engine/__tests__/*.test.ts` | `npm test` |
| Motor — Phases (`phases/normal-run/index.ts`, `phases/secret-mainframe/index.ts`) | unit | 1:1 com ACs; mudança de comportamento observável (ENGINE-25, `events.playerHit`) exige teste novo dedicado; mudança estrutural pura (ENGINE-28 discriminante) é coberta pela suíte existente | `lib/pixel-hunt-engine/phases/*/__tests__/*.test.ts` | `npm test` |
| Motor — Orchestrator (`orchestrator.ts`) | unit | Comportamento já coberto por `orchestrator*.test.ts` (8 arquivos existentes) — mudança estrutural (ENGINE-28) não exige teste novo, suíte existente é a rede de regressão | `lib/pixel-hunt-engine/__tests__/orchestrator*.test.ts` | `npm test` |
| Motor — Renderer (`renderer.ts` → `renderer/*.ts`) | none | **Piso existente confirmado: 0 arquivos de teste para `renderer.ts` hoje** (funções `(ctx, world) => void` sem valor de retorno, comentário do próprio arquivo confirma "puramente funções... sem mutar estado"). Split (ENGINE-29) não eleva esse piso — verificação é `npm run build && npm test` (regressão de todo o resto do motor) + inspeção visual manual (Independent Test do AC4 no spec) | — (sem diretório de teste) | `npm run build && npm test` + QA manual |
| Tipos puros (`PhaseState`, `NormalRunPhaseState`, `SecretMainframePhaseState` — apenas as declarações de tipo) | none | Build gate only — tipos não têm comportamento próprio a testar; o comportamento de quem os usa (`readState()`) já está na linha "Motor — Phases" acima | — | `npm run build` (tsc) |

## Gate Check Commands

> Gerado a partir de `package.json` (`scripts`).

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após tasks só com teste unitário (Vitest), sem mudança de build/tipo | `npm test` |
| Full | Após ENGINE-28 (mudança de tipo) e ENGINE-29 (split de arquivo) — precisa confirmar `tsc` limpo | `npm run build && npm test` |
| Build | Fim de cada fase e antes do commit final do último batch | `npm run build && npm run lint && npm test` |

E2E (`npm run test:e2e`) e SonarQube local **não** são gate por-task — rodam só ao fim da Fase 5 (ENGINE-29, meta de duplicação <15%) e na validação final do Verifier, consistente com o padrão já usado no fix1 (SonarQube não é MCP disponível nesta sessão — `CONNECT_TIMEOUT` reportado no fix1 — rodar via Docker local direto, como lá).

---

## Execution Plan

Phases são ordenadas e rodam sequencialmente — cada fase completa antes da próxima começar, e tasks dentro de uma fase executam em ordem. Ordem segue a recomendação do `design.md` (menor → maior risco).

### Phase 1: Dedupe de `emptyEvents()` (ENGINE-27)

```
T1
```

### Phase 2: Consolidar dano ao jogador (ENGINE-24, ENGINE-25)

```
T2
```

### Phase 3: Dedupe de `shotLanesForWeaponLevel`/`weaponLevelForWave` (ENGINE-26)

```
T3
```

### Phase 4: Tipar `phaseState` (ENGINE-28)

```
T4 → T5 → T6 → T7 → T8
```

### Phase 5: Split de `renderer.ts` (ENGINE-29)

```
T9 → T10 → T11 → T12 → T13
```

---

## Task Breakdown

### T1: Dedupe `emptyEvents()` em `emptyFrameEvents()` único

**What**: Adiciona `emptyFrameEvents(): FrameEvents` em `types.ts`, ao lado de `FrameEvents`; remove as 3 definições locais (`physics.ts`, `phases/normal-run/index.ts`, `phases/secret-mainframe/index.ts`) e troca as chamadas para importar a versão de `types.ts`.
**Where**: `lib/pixel-hunt-engine/types.ts` (novo export), `lib/pixel-hunt-engine/physics.ts:69-80`, `lib/pixel-hunt-engine/phases/normal-run/index.ts:42-53`, `lib/pixel-hunt-engine/phases/secret-mainframe/index.ts:33-44`
**Depends on**: None
**Reuses**: Shape idêntico já existente nas 3 cópias — extração literal, sem mudar nenhum campo.
**Requirement**: ENGINE-27

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `emptyFrameEvents()` exportada de `types.ts`, com o mesmo shape das 3 cópias atuais
- [ ] Nenhuma das 3 definições locais (`function emptyEvents()`) permanece em `physics.ts`/`normal-run/index.ts`/`secret-mainframe/index.ts`
- [ ] `grep -c "^function emptyEvents" lib/pixel-hunt-engine/physics.ts lib/pixel-hunt-engine/phases/normal-run/index.ts lib/pixel-hunt-engine/phases/secret-mainframe/index.ts` soma 0
- [ ] Gate check passa: `npm test`
- [ ] Contagem de testes: 421 (nenhum novo teste necessário — dedupe estrutural puro, suíte existente é a rede de regressão)

**Tests**: unit (suíte existente, sem teste novo — ver Coverage Expectation)
**Gate**: quick

**Commit**: `fix2: T1 dedupe emptyEvents() em types.ts`

---

### T2: Consolidar `applyPlayerDamage` + corrigir `events.playerHit` ausente

**What**: Extrai `applyPlayerDamage(world, audio, events, damage, burstCount)` em `physics.ts` (guarda `player.invincible <= 0` movida para dentro), usada por `resolveEnemyPlayerCollisions`; exporta a função e a usa em `stepSecretBossShots` (`phases/secret-mainframe/index.ts`), corrigindo a ausência de `events.playerHit = true` nesse caminho. Adiciona teste de regressão dedicado.
**Where**: `lib/pixel-hunt-engine/physics.ts:521-546` (nova função + `resolveEnemyPlayerCollisions` atualizado), `lib/pixel-hunt-engine/phases/secret-mainframe/index.ts:217-238` (`stepSecretBossShots` atualizado)
**Depends on**: None
**Reuses**: `burst`/`distance` de `geometry.ts` (já importados nos 2 arquivos)
**Requirement**: ENGINE-24, ENGINE-25

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `applyPlayerDamage` existe uma única vez em `physics.ts`, exportada, parametrizada por `damage`/`burstCount`
- [ ] `resolveEnemyPlayerCollisions` chama `applyPlayerDamage(world, audio, events, ENEMY_TOUCH_DAMAGE[enemy.kind], 16)`
- [ ] `stepSecretBossShots` chama `applyPlayerDamage(world, ctx.audio, events, 10, 12)` em vez do bloco inline duplicado
- [ ] `grep -c "run.damageFlash = 16" lib/pixel-hunt-engine/physics.ts lib/pixel-hunt-engine/phases/secret-mainframe/index.ts` soma 1 (não 2)
- [ ] Novo teste em `phases/secret-mainframe/__tests__/index.test.ts` (ou arquivo dedicado) confirma `events.playerHit === true` após dano por tiro do chefe secreto
- [ ] Gate check passa: `npm test`
- [ ] Contagem de testes: 422 (421 atuais + 1 novo)

**Tests**: unit — cobre ENGINE-24 AC1/AC2/AC4 (comportamento preservado) e ENGINE-25 AC3 (novo teste do bug corrigido)
**Gate**: quick

**Commit**: `fix2: T2 consolida applyPlayerDamage e corrige events.playerHit no chefe secreto`

---

### T3: Dedupe `shotLanesForWeaponLevel`/`weaponLevelForWave` em `weapon-progression.ts`

**What**: Cria `lib/pixel-hunt-engine/weapon-progression.ts` com as 2 funções (movidas, não duplicadas); `physics.ts` e `phases/normal-run/wave-progression.ts` passam a importar de lá. `wave-progression.ts` mantém o re-export das 2 funções (mesmo nome) para não quebrar o import de `phases/normal-run/__tests__/wave-progression.test.ts`.
**Where**: `lib/pixel-hunt-engine/weapon-progression.ts` (novo), `lib/pixel-hunt-engine/physics.ts:36-46` (remove cópia local, importa), `lib/pixel-hunt-engine/phases/normal-run/wave-progression.ts:37-49` (remove definição local, importa + re-exporta)
**Depends on**: None
**Reuses**: Corpo das 2 funções já idêntico nas 2 cópias atuais — extração literal.
**Requirement**: ENGINE-26

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `weapon-progression.ts` exporta `shotLanesForWeaponLevel`/`weaponLevelForWave`, sem import de `physics.ts` nem de nenhuma Phase (módulo-kernel, zero dependência do motor)
- [ ] `physics.ts` importa as 2 funções de `weapon-progression.ts`, sem definição local
- [ ] `wave-progression.ts` importa de `weapon-progression.ts` e re-exporta com o mesmo nome (mantém `phases/normal-run/__tests__/wave-progression.test.ts` funcionando sem editar o teste)
- [ ] `grep -rn "^function shotLanesForWeaponLevel\|^export function shotLanesForWeaponLevel\|^function weaponLevelForWave\|^export function weaponLevelForWave" lib/pixel-hunt-engine/` retorna exatamente 1 ocorrência de cada (em `weapon-progression.ts`)
- [ ] Nenhum ciclo de import introduzido (`weapon-progression.ts` não importa de `physics.ts` nem de `wave-progression.ts`)
- [ ] Gate check passa: `npm test`
- [ ] Contagem de testes: 422 (inalterada em relação a T2 — dedupe estrutural puro, sem teste novo)

**Tests**: unit (suíte existente, sem teste novo — ver Coverage Expectation)
**Gate**: quick

**Commit**: `fix2: T3 dedupe shotLanesForWeaponLevel/weaponLevelForWave em weapon-progression.ts`

---

### T4-T6: Definir `PhaseState` + migrar `normal-run`/`secret-mainframe` (mesclados no Execute)

> **SPEC_DEVIATION (fronteira de task, não de comportamento):** durante o Execute, `npm run build` confirmou que T4 isolado não compila — `world.phaseState = {...}` são atribuições estruturais (não `as` casts), então o campo `phase` discriminante precisa existir nos 4 literais de `normal-run/index.ts`/`secret-mainframe/index.ts` desde o primeiro commit que muda o tipo de `EngineWorld.phaseState`. T4, T5 e T6 foram implementados e commitados juntos (um único commit) por essa amarra de compilação; T7 e T8 permanecem separados (são consumidores só-leitura via `as`, sem essa amarra). Nenhum AC de `spec.md` mudou — só a granularidade do commit.

### T4: Definir `PhaseState` (união discriminada) em `types.ts`

**What**: Adiciona `NormalRunPhaseState`, `SecretMainframePhaseState` (movida de `renderer.ts`) e `PhaseState = NormalRunPhaseState | SecretMainframePhaseState` (discriminante `phase: "normal-run" | "secret-mainframe"`, reusando o literal de `EnginePhase.id`) em `types.ts`; muda `EngineWorld.phaseState` de `unknown` para `PhaseState | null`.
**Where**: `lib/pixel-hunt-engine/types.ts:163-167` (campo `phaseState`), novo bloco de tipos
**Depends on**: None
**Reuses**: Literal `"normal-run" | "secret-mainframe"` já existente em `EnginePhase.id` (`phases/phase.ts:16`); shape de `SecretMainframePhaseState` já existente em `renderer.ts:42-48` (só muda de arquivo).
**Requirement**: ENGINE-28

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `PhaseState`, `NormalRunPhaseState`, `SecretMainframePhaseState` exportados de `types.ts`, cada um com campo `phase` discriminante
- [ ] `EngineWorld.phaseState: PhaseState | null` (não mais `unknown`)
- [ ] `npm run build` (`tsc`) passa sem novo erro (casts existentes em `readState()`/`renderer.ts`/`orchestrator.ts` ainda não migrados continuam válidos por enquanto — só o tipo declarado mudou)
- [ ] Gate check passa: `npm run build && npm test`

**Tests**: none (declaração de tipo pura — comportamento de quem consome é testado nos tasks seguintes)
**Gate**: full

**Commit**: `fix2: T4 tipa EngineWorld.phaseState como uniao discriminada`

---

### T5: Migrar `normal-run/index.ts` para o discriminante `PhaseState`

**What**: `readState()` troca o cast `existing as NormalRunPhaseState | null` + checagem `"localGameState" in existing` por `world.phaseState?.phase === "normal-run" ? world.phaseState : <fresh>`; remove a definição local de `NormalRunPhaseState` (agora importada de `types.ts`); `enter()` popula `phaseState` incluindo o campo `phase: "normal-run"`.
**Where**: `lib/pixel-hunt-engine/phases/normal-run/index.ts:24-38` (`readState`), `:132` (`enter`, literal `{ localGameState: "playing" }` → inclui `phase: "normal-run"`)
**Depends on**: T4
**Reuses**: `PhaseState`/`NormalRunPhaseState` de `types.ts` (T4)
**Requirement**: ENGINE-28

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `readState()` usa o discriminante `phase === "normal-run"` em vez de `"localGameState" in existing`
- [ ] Nenhuma definição local de `NormalRunPhaseState` remanescente no arquivo (importado de `types.ts`)
- [ ] Todo literal que popula `world.phaseState` neste arquivo inclui `phase: "normal-run"`
- [ ] Gate check passa: `npm run build && npm test`
- [ ] Contagem de testes: 422 (inalterada — mudança estrutural pura, suíte existente já cobre `normal-run/index.ts` via `phases/normal-run/__tests__/index.test.ts`, 278 linhas)

**Tests**: unit (suíte existente, sem teste novo)
**Gate**: full

**Commit**: `fix2: T5 normal-run/index.ts usa discriminante de PhaseState`

---

### T6: Migrar `secret-mainframe/index.ts` para o discriminante `PhaseState`

**What**: `readState()` troca o cast `existing as Partial<SecretRunState> | null` + checagem tripla (`"localGameState" in existing && "cobolSnake" in existing`) por `world.phaseState?.phase === "secret-mainframe" ? world.phaseState : <fresh>`; `SecretRunState` (tipo local hoje) vira alias/import de `SecretMainframePhaseState` de `types.ts`, removendo a dependência de tipo em `renderer.ts`; todo literal que popula `phaseState` neste arquivo inclui `phase: "secret-mainframe"`.
**Where**: `lib/pixel-hunt-engine/phases/secret-mainframe/index.ts:14` (import), `:106-127` (`readState`), `:277-284` (`enter`)
**Depends on**: T4
**Reuses**: `PhaseState`/`SecretMainframePhaseState` de `types.ts` (T4)
**Requirement**: ENGINE-28

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `readState()` usa o discriminante `phase === "secret-mainframe"` em vez da checagem tripla de campos
- [ ] `SecretRunState` não é mais definida localmente com campos duplicados — vira o tipo `SecretMainframePhaseState` de `types.ts` (com `localGameState` já incluso no tipo movido em T4)
- [ ] Import de `SecretMainframePhaseState` migrado de `@/lib/pixel-hunt-engine/renderer` para `@/lib/pixel-hunt-engine/types`
- [ ] Todo literal que popula `world.phaseState` neste arquivo inclui `phase: "secret-mainframe"`
- [ ] Gate check passa: `npm run build && npm test`
- [ ] Contagem de testes: 422 (inalterada — suíte existente já cobre via `phases/secret-mainframe/__tests__/index.test.ts`, 199 linhas)

**Tests**: unit (suíte existente, sem teste novo)
**Gate**: full

**Commit**: `fix2: T6 secret-mainframe/index.ts usa discriminante de PhaseState`

---

### T7: Migrar `readSecretPhaseState` (`renderer.ts`) para o discriminante `PhaseState`

**What**: Remove a definição local de `SecretMainframePhaseState` em `renderer.ts` (agora vive em `types.ts`, movida em T4); `readSecretPhaseState()` troca a checagem `!state.cobolSnake || !state.meetingZones || !state.secretBossShots` por `world.phaseState?.phase === "secret-mainframe" ? world.phaseState : null`.
**Where**: `lib/pixel-hunt-engine/renderer.ts:42-53`
**Depends on**: T4, T6 (garante que `SecretMainframePhaseState` já foi realocada e `secret-mainframe/index.ts` já a importa de `types.ts` antes de mudar o outro lado do mesmo tipo)
**Reuses**: `SecretMainframePhaseState` de `types.ts` (T4)
**Requirement**: ENGINE-28

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `renderer.ts` importa `SecretMainframePhaseState` de `@/lib/pixel-hunt-engine/types`, sem definição local
- [ ] `readSecretPhaseState()` usa o discriminante `phase === "secret-mainframe"` em vez da checagem tripla de campos
- [ ] Gate check passa: `npm run build && npm test`
- [ ] Contagem de testes: 422 (inalterada — comportamento de desenho não muda, sem teste dedicado de `renderer.ts` hoje, ver matriz)

**Tests**: none (ver Coverage Expectation da camada Renderer)
**Gate**: full

**Commit**: `fix2: T7 renderer.ts usa discriminante de PhaseState`

---

### T8: Migrar `readPhaseLocalGameState` (`orchestrator.ts`) para acesso direto ao campo comum

**What**: Troca `(world.phaseState as { localGameState?: unknown } | null)?.localGameState` por `world.phaseState?.localGameState ?? null` — acesso direto sem cast, já que `localGameState` existe nos dois membros do union `PhaseState`.
**Where**: `lib/pixel-hunt-engine/orchestrator.ts:171-174`
**Depends on**: T4
**Reuses**: `PhaseState` de `types.ts` (T4)
**Requirement**: ENGINE-28

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `readPhaseLocalGameState()` não usa mais `as { localGameState?: unknown } | null`
- [ ] `grep -n "phaseState: unknown" lib/pixel-hunt-engine/types.ts` não retorna resultado (confirma T4+T5+T6+T7+T8 fecharam todos os 4 pontos de leitura)
- [ ] Gate check passa: `npm run build && npm test`
- [ ] Contagem de testes: 422 (inalterada — `orchestrator*.test.ts`, 8 arquivos, já cobre `readPhaseLocalGameState` indiretamente via `tick()`/snapshot)

**Tests**: unit (suíte existente, sem teste novo)
**Gate**: build

**Commit**: `fix2: T8 orchestrator.ts le localGameState direto do union PhaseState`

---

### T9: Extrair `renderer/phase-state.ts`

**What**: Move `readSecretPhaseState()` (já atualizada em T7) para o novo arquivo `lib/pixel-hunt-engine/renderer/phase-state.ts`. Primeiro passo da divisão de `renderer.ts` em diretório — os demais tasks desta fase dependem deste arquivo existir antes de mover as funções `draw*` que o consomem.
**Where**: `lib/pixel-hunt-engine/renderer/phase-state.ts` (novo), `lib/pixel-hunt-engine/renderer.ts` (remove a função movida)
**Depends on**: T7
**Reuses**: `readSecretPhaseState()` já corrigida em T7 — só muda de arquivo.
**Requirement**: ENGINE-29

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `renderer/phase-state.ts` exporta `readSecretPhaseState`
- [ ] `renderer.ts` importa de `./phase-state` em vez de definir localmente
- [ ] Gate check passa: `npm run build && npm test`

**Tests**: none (ver Coverage Expectation da camada Renderer)
**Gate**: full

**Commit**: `fix2: T9 extrai renderer/phase-state.ts`

---

### T10: Extrair `renderer/actors.ts`

**What**: Move `drawActor`, `drawMainframeBoss`, `drawPlayer`, `drawObstacle`, `drawPowerUp` para `lib/pixel-hunt-engine/renderer/actors.ts` (funções que desenham uma entidade individual do mundo).
**Where**: `lib/pixel-hunt-engine/renderer/actors.ts` (novo), `lib/pixel-hunt-engine/renderer.ts` (remove as 5 funções, importa)
**Depends on**: T9
**Reuses**: `drawCharacterBody`/`pixelRect` de `character-sprite.ts`, `powerUpLabels` (mapa já existente no arquivo — avaliar se migra junto com `drawPowerUp` ou fica compartilhado; se só `drawPowerUp` usa, migra junto)
**Requirement**: ENGINE-29

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `renderer/actors.ts` exporta as 5 funções, sem lógica de desenho alterada (mesmo output visual)
- [ ] `renderer.ts` importa de `./actors`, sem definição local
- [ ] Gate check passa: `npm run build && npm test`

**Tests**: none (ver Coverage Expectation da camada Renderer)
**Gate**: full

**Commit**: `fix2: T10 extrai renderer/actors.ts`

---

### T11: Extrair `renderer/overlays.ts`

**What**: Move `drawDim`, `drawOverlay`, `drawVictoryOverlay` para `lib/pixel-hunt-engine/renderer/overlays.ts`.
**Where**: `lib/pixel-hunt-engine/renderer/overlays.ts` (novo), `lib/pixel-hunt-engine/renderer.ts` (remove as 3 funções, importa)
**Depends on**: T9
**Reuses**: nenhuma dependência externa nova.
**Requirement**: ENGINE-29

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `renderer/overlays.ts` exporta as 3 funções, sem lógica de desenho alterada
- [ ] `renderer.ts` importa de `./overlays`, sem definição local
- [ ] Gate check passa: `npm run build && npm test`

**Tests**: none (ver Coverage Expectation da camada Renderer)
**Gate**: full

**Commit**: `fix2: T11 extrai renderer/overlays.ts`

---

### T12: Extrair `renderer/world.ts` (inclui bloco inline de meeting zones/cobol snake)

**What**: Move `drawGrid`, `drawDatacenterFloor`, `drawFinalChoiceScene` para `lib/pixel-hunt-engine/renderer/world.ts`; extrai o bloco hoje inline em `drawFrame` (linhas 567-607 atuais: desenho de `meetingZones`/`cobolSnake` trail) para uma função nomeada neste mesmo arquivo (ex. `drawSecretRunOverlay(ctx, phaseState)`), endereçando a duplicação interna de padrão (`pixelRect`/`ctx.arc`/`ctx.fillText`) apontada pelo SonarQube no fix1.
**Where**: `lib/pixel-hunt-engine/renderer/world.ts` (novo), `lib/pixel-hunt-engine/renderer.ts` (remove as 3 funções + o bloco inline, chama a nova função)
**Depends on**: T9
**Reuses**: `readSecretPhaseState` de `./phase-state` (T9)
**Requirement**: ENGINE-29

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `renderer/world.ts` exporta `drawGrid`, `drawDatacenterFloor`, `drawFinalChoiceScene`, `drawSecretRunOverlay` (ou nome equivalente), sem lógica de desenho alterada
- [ ] `drawFrame` (ainda em `renderer.ts` neste ponto) chama `drawSecretRunOverlay(ctx, secretPhaseState)` em vez do bloco inline de 40 linhas
- [ ] Gate check passa: `npm run build && npm test`

**Tests**: none (ver Coverage Expectation da camada Renderer)
**Gate**: full

**Commit**: `fix2: T12 extrai renderer/world.ts e nomeia bloco inline de secret-run overlay`

---

### T13: `renderer/index.ts` como fachada final + confirmação de duplicação

**What**: Converte `renderer.ts` no diretório `lib/pixel-hunt-engine/renderer/index.ts` — só resta `drawFrame` (fachada pública, orquestração de save/translate/restore, ordem de desenho, banners) + `ViewState`, importando de `./actors`, `./world`, `./overlays`, `./phase-state`. Deleta o antigo `lib/pixel-hunt-engine/renderer.ts`. Roda SonarQube local para confirmar queda de duplicação.
**Where**: `lib/pixel-hunt-engine/renderer/index.ts` (novo, substitui `renderer.ts`)
**Depends on**: T10, T11, T12
**Reuses**: Todas as extrações anteriores (T9-T12) — este task só remonta a fachada.
**Requirement**: ENGINE-29

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `lib/pixel-hunt-engine/renderer.ts` não existe mais; `lib/pixel-hunt-engine/renderer/index.ts` exporta `drawFrame`/`ViewState` com a mesma assinatura pública de hoje
- [ ] `phases/normal-run/index.ts` e `phases/secret-mainframe/index.ts` continuam importando de `@/lib/pixel-hunt-engine/renderer` sem mudança de path
- [ ] Gate check passa: `npm run build && npm run lint && npm test`
- [ ] `npm run test:e2e` passa (fim de fase — confirma nenhuma regressão visual detectável pelos testes Playwright existentes)
- [ ] SonarQube local confirma duplicação em `renderer/` abaixo de 15% (meta do AC3 de ENGINE-29; baseline 35.7% registrado no fix1)
- [ ] QA manual: menu, run normal, chefe, fase secreta, escolha final — sem regressão visual perceptível
- [ ] Contagem de testes: 422 (inalterada — reorganização estrutural pura)

**Tests**: none (ver Coverage Expectation da camada Renderer) + QA manual + SonarQube
**Gate**: build

**Commit**: `fix2: T13 renderer/index.ts como fachada final do split`

> **Nota de execução:** `npm run test:e2e` não pôde rodar nesta sessão — outra sessão de chat tem um dev server ativo neste mesmo diretório (`localhost:3000`, PID externo), e o Next.js recusa subir uma segunda instância (mesmo em porta diferente, 3100, usada pelo Playwright). Matar o processo de outra sessão foi descartado por segurança. Em vez disso: (1) SonarQube local rodado diretamente via `npx sonarqube-scanner` (mesmo padrão do fix1, bypass do MCP) — confirma **0.0% de duplicação** em todos os 5 arquivos de `renderer/` (baseline 35.7%, meta <15% folgadamente batida); (2) QA manual via Browser pane apontado para o dev server já ativo (`localhost:3000`) confirmou renderização correta do menu (jogador, obstáculo "desk" com label, grid de piso, HUD sincronizado) sem erros de console — navegação além do menu não foi possível por uma questão de mapeamento de coordenadas da ferramenta de automação de browser (não uma regressão de código: build+lint+423 testes unitários continuam verdes, incluindo os testes de `phases/secret-mainframe` que exercitam a fase secreta programaticamente). `npm run test:e2e` fica como pendência para rodar fora desta sessão (branch não fechada, ver `validation.md`).

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

Phase 1:  T1
Phase 2:  T2
Phase 3:  T3
Phase 4:  T4 ──→ T5 ──→ T6 ──→ T7 ──→ T8
Phase 5:  T9 ──→ T10 ──→ T11 ──→ T12 ──→ T13
```

Execução é estritamente sequencial dentro de cada fase. 13 tasks no total — acima do limiar de ~8 que aciona a oferta de sub-agentes (ver Sub-Agent Delegation no SKILL.md). Empacotamento sugerido em 2 batches, respeitando fronteira de fase:

- **Batch 1**: Fases 1-4 (T1-T8, 8 tasks) — dedupe de `emptyEvents`, `applyPlayerDamage`/`events.playerHit`, `shotLanesForWeaponLevel`/`weaponLevelForWave`, e a tipagem completa de `phaseState` nos 4 call sites.
- **Batch 2**: Fase 5 (T9-T13, 5 tasks) — split de `renderer.ts`, maior esforço e único item com verificação via SonarQube + QA manual.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Dedupe `emptyEvents()` | 1 conceito (fábrica única), 4 arquivos tocados de forma mecânica | ✅ Granular (mudança única e cesiva — mesmo padrão de 1 linha em cada chamador) |
| T2: Consolidar `applyPlayerDamage` + fix `playerHit` | 1 função compartilhada + correção de bug associada, 2 arquivos + 1 teste | ✅ Granular (extração e correção são a mesma unidade de trabalho — extrair sem corrigir deixaria o bug via helper compartilhado inconsistente) |
| T3: Dedupe `shotLanesForWeaponLevel`/`weaponLevelForWave` | 1 módulo novo, 2 arquivos consumidores atualizados | ✅ Granular |
| T4: Definir `PhaseState` em `types.ts` | 1 arquivo, declarações de tipo | ✅ Granular |
| T5: Migrar `normal-run/index.ts` | 1 arquivo | ✅ Granular |
| T6: Migrar `secret-mainframe/index.ts` | 1 arquivo | ✅ Granular |
| T7: Migrar `readSecretPhaseState` (`renderer.ts`) | 1 função em 1 arquivo | ✅ Granular |
| T8: Migrar `readPhaseLocalGameState` (`orchestrator.ts`) | 1 função em 1 arquivo | ✅ Granular |
| T9: Extrair `renderer/phase-state.ts` | 1 arquivo novo, 1 função movida | ✅ Granular |
| T10: Extrair `renderer/actors.ts` | 1 arquivo novo, 5 funções coesas (mesma área: desenho de entidades) | ✅ Granular (coeso — mesma regra "2-3+ coisas relacionadas no mesmo arquivo = OK se coeso") |
| T11: Extrair `renderer/overlays.ts` | 1 arquivo novo, 3 funções coesas | ✅ Granular |
| T12: Extrair `renderer/world.ts` | 1 arquivo novo, 3 funções + 1 bloco inline nomeado, todas coesas (área "mundo/cena") | ✅ Granular |
| T13: `renderer/index.ts` fachada final | 1 arquivo (substitui `renderer.ts`), remonta imports | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Nenhuma seta de entrada (Fase 1 isolada) | ✅ Match |
| T2 | None | Nenhuma seta de entrada (Fase 2 isolada) | ✅ Match |
| T3 | None | Nenhuma seta de entrada (Fase 3 isolada) | ✅ Match |
| T4 | None | Nenhuma seta de entrada (início da Fase 4) | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T4 | T4 → T6 (via T5 na sequência linear da fase, mas dependência real é só T4) | ✅ Match — sequência linear da fase reflete ordem de execução, não implica dependência extra |
| T7 | T4, T6 | T6 → T7 (sequência linear); dependência declarada no corpo inclui T4 e T6 | ✅ Match |
| T8 | T4 | T7 → T8 (sequência linear); dependência real é só T4 | ✅ Match — mesma observação de T6 |
| T9 | T7 | T8 → T9 (sequência linear); dependência real é T7 | ✅ Match — Fase 5 só pode iniciar após Fase 4 completa (T7 é o predecessor real, T8 é só quem fecha a fase anterior) |
| T10 | T9 | T9 → T10 | ✅ Match |
| T11 | T9 | T10 → T11 (sequência linear); dependência real é só T9 | ✅ Match |
| T12 | T9 | T11 → T12 (sequência linear); dependência real é só T9 | ✅ Match |
| T13 | T10, T11, T12 | T12 → T13 (sequência linear); dependência declarada no corpo inclui T10, T11, T12 | ✅ Match |

**Nota**: dentro de cada fase, a execução é estritamente sequencial (T5 antes de T6 antes de T7...) mesmo quando a dependência *real* de dados é só no primeiro task da fase (T4 para T5-T8; T9 para T10-T12) — isso é intencional: um único worker por batch executa em ordem, então a sequência linear do diagrama reflete a ordem de execução real, não uma cadeia de dependência de dados mais estrita do que a declarada em cada task.

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1: Dedupe `emptyEvents()` | Motor — domínio (`types.ts`/`physics.ts`) | unit, com exceção nomeada para dedupe puro | unit (suíte existente) | ✅ OK |
| T2: `applyPlayerDamage` + fix `playerHit` | Motor — domínio + Phase | unit, 1:1 com AC (mudança de comportamento) | unit (novo teste dedicado) | ✅ OK |
| T3: Dedupe `shotLanes`/`weaponLevelForWave` | Motor — domínio | unit, com exceção nomeada para dedupe puro | unit (suíte existente) | ✅ OK |
| T4: `PhaseState` em `types.ts` | Tipos puros | none — build gate only | none | ✅ OK |
| T5: `normal-run/index.ts` | Motor — Phase | unit, exceção para mudança estrutural pura | unit (suíte existente) | ✅ OK |
| T6: `secret-mainframe/index.ts` | Motor — Phase | unit, exceção para mudança estrutural pura | unit (suíte existente) | ✅ OK |
| T7: `readSecretPhaseState` (`renderer.ts`) | Motor — Renderer | none (piso existente) | none | ✅ OK |
| T8: `orchestrator.ts` | Motor — Orchestrator | unit, exceção para mudança estrutural pura | unit (suíte existente) | ✅ OK |
| T9: `renderer/phase-state.ts` | Motor — Renderer | none (piso existente) | none | ✅ OK |
| T10: `renderer/actors.ts` | Motor — Renderer | none (piso existente) | none | ✅ OK |
| T11: `renderer/overlays.ts` | Motor — Renderer | none (piso existente) | none | ✅ OK |
| T12: `renderer/world.ts` | Motor — Renderer | none (piso existente) | none | ✅ OK |
| T13: `renderer/index.ts` fachada | Motor — Renderer | none (piso existente) + QA manual + SonarQube (explícito no AC3 do spec) | none + QA manual + SonarQube | ✅ OK |

Nenhuma violação — todo `Tests: none` corresponde a uma linha da matriz que também diz `none` para aquela camada (Renderer, hoje sem cobertura unitária, e Tipos puros, sem comportamento próprio).

---

## Tips

- **Fases são ordenadas** — cada fase completa antes da próxima; tasks rodam em ordem dentro da fase
- **Reuses = economia de token** — sempre referenciar código existente
- **Um commit por task** — formato `fix2: TN <descrição>`, seguindo a convenção já usada em `motor-de-jogo-modular`/`motor-de-jogo-modular-fix1`
