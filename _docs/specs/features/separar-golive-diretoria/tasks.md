# Separar Go-Live/Diretoria Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `_docs/specs/features/separar-golive-diretoria/design.md`
**Status**: Verified (PASS, Rodada 2) — ver `validation.md`. Próximo: `/code-review`.

---

## Execution Log (batch worker, T1–T7, branch `feat/separar-golive-diretoria`)

| Task | Commit | Status |
| --- | --- | --- |
| T1 | `477d070` feat(engine): grow boss/biome roster to 5 waves | ✅ Done |
| T2 | `8787570` feat(engine): add wave-5 obstacle theme "Sala do Conselho" | ✅ Done |
| T3 | `f3c67ff` feat(engine): add wave-5 floor palette "Sala do Conselho" | ✅ Done |
| T4 | `4edd58d` test(engine): update isFinalBoss coverage for the 5-wave roster | ✅ Done |
| T5 | `e612ec4` test(engine): cover wave-5 node and 3-phase final boss escalation | ✅ Done |
| T6 | `838a4fe` test(engine): update spawn coverage for the split wave-4/wave-5 bosses | ✅ Done |
| T7 | `63c4bc1` test(engine): full regression + cross-check for the 5-wave roster | ✅ Done |

**Gate final:** `npm test` → 445 passed, 0 failed. `npm run build` → ok. `npm run test:e2e` → bloqueado pelo lock conhecido de `.next/dev` (ambiente, não código — mesma pendência já registrada em `STATE.md` para features anteriores).

**Desvios:** nenhum `SPEC_DEVIATION`. Dois testes pré-existentes quebraram transiente após T1 (exatamente o cenário antecipado em `spec.md` Assumption A5/Edge Cases e `design.md` § Error Handling Strategy) — corrigidos em T4/T6 conforme já previsto no plano de tasks.

**Verifier Rodada 1:** FAIL — 5 gaps de cobertura (nenhuma regressão funcional). Ver `validation.md`.
**Fix cycle 1:** `c08946f`, `092070d`, `24d726a`, `5c20264` — fecha os 5 gaps só com testes + 1 `export` de visibilidade.
**Verifier Rodada 2:** PASS ✅ — 449/449 testes, sensor 3/3 mortas, nenhum gap restante. Ver `validation.md`.

**Próximo passo:** `/code-review` na branch, conforme instrução do usuário.

---

## Test Coverage Matrix

> Generated from codebase sampling (`lib/pixel-hunt-engine/phases/normal-run/__tests__/*.test.ts`, `lib/pixel-hunt-engine/__tests__/*.test.ts`) + `package.json` scripts + `e2e/*.spec.ts`. Guidelines found: `AGENTS.md` (§6 "Regras para tarefas de implementação" — atualizar/criar testes quando aplicável), no dedicated coverage-threshold config found (no `vitest.config.ts` coverage gate, no CI workflow file). Strong default applied where AGENTS.md doesn't specify depth.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Engine domain logic (`phases/normal-run/**`, `physics.ts`, `boss.ts`, `graph.ts`) | unit | All branches touched by the roster growing to 5; 1:1 to spec ACs GOLIVESPLIT-01 a 08; existing parametric tests (already derive from `bossNames.length`, confirmed by reading `graph.test.ts`/`waves.test.ts`/`boss.test.ts`) must keep passing without literal edits | `lib/pixel-hunt-engine/**/__tests__/*.test.ts` | `npm test` |
| Renderer (`renderer/world.ts` — `drawGrid` theme colors) | none | No existing test suite covers pixel/color output today (pre-existing gap, documented in `design.md` § Risks & Concerns) — build gate + manual QA only | `lib/pixel-hunt-engine/renderer/` | `npm run build` (+ manual visual check) |
| E2E full-run flow (`e2e/final-choice-click.spec.ts`, `e2e/full-run.spec.ts`) | e2e | Confirmed already generic (uses debug `F2`/`spawn_boss` loop + comment referencing `bossNames.length - 1`, not a literal wave number) — re-run as regression, no edit expected | `e2e/*.spec.ts` | `npm run test:e2e` (best-effort — this environment has a known `.next/dev` lock conflict from concurrent sessions per `STATE.md` handoff; if blocked, report as environment pendency, not a code gap) |

## Gate Check Commands

> Generated from `package.json` — confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | After each task (T1–T6) touching unit-tested code | `npm test` |
| Full | After the last task of the batch (T7) and before the Verifier runs | `npm test && npm run build` (+ `npm run test:e2e` best-effort, see matrix note) |
| Build | Sanity check if a task only touches data/config with no direct test | `npm run build` |

---

## Execution Plan

Uma única fase — a feature inteira cabe em 1 batch (~7 tasks, dentro do orçamento de 1 worker por batch).

### Fase 1: Crescer o roster de 4 para 5 e validar

```
T1 → T2 → T3 → T4 → T5 → T6 → T7
```

---

## Task Breakdown

### T1: Crescer `bossNames`/`biomeNames` para 5 entradas

**What**: Adicionar `bossNames[4] = "Comitê Executivo"` e `biomeNames[4] = "Sala do Conselho"` em `wave-progression.ts` (Assumptions A1/A2 do spec, aprovadas provisoriamente pelo usuário).
**Where**: `lib/pixel-hunt-engine/phases/normal-run/wave-progression.ts`
**Depends on**: None
**Reuses**: Os 2 arrays já existentes (só cresce, não muda estrutura)
**Requirement**: GOLIVESPLIT-05, GOLIVESPLIT-09

**Tools**:
- MCP: NONE (edição direta de arquivo)
- Skill: NONE

**Done when**:
- [ ] `bossNames.length === 5` e `biomeNames.length === 5`
- [ ] `wave-progression.test.ts` (se existir asserção de conteúdo/tamanho literal dos arrays) atualizado para as 5 entradas
- [ ] Gate check passa: `npm test`
- [ ] Nenhum teste pré-existente quebrado por este passo isolado

**Tests**: unit
**Gate**: quick

---

### T2: Novo tema de obstáculos da onda 5 em `spawn.ts`

**What**: Subir `BIOME_COUNT` de 4 para 5 e adicionar o 5º conjunto de `obstacleTemplates` (tema "Sala do Conselho": `board`/`chair`/`rack`, ver `design.md` § Data Models).
**Where**: `lib/pixel-hunt-engine/phases/normal-run/spawn.ts`
**Depends on**: T1 (usa os nomes já adicionados como referência de comentário/contexto, mas é uma edição independente de arquivo)
**Reuses**: `ObstacleKind` já existente (`chair`/`rack`/`board`, sem novo kind)
**Requirement**: GOLIVESPLIT-10

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `BIOME_COUNT === 5` em `spawn.ts`
- [ ] `obstacleTemplates()` retorna um 5º array (índice 4) com objetos usando kinds já existentes no tipo `ObstacleKind`
- [ ] Gate check passa: `npm test`

**Tests**: unit (cobertura indireta via testes de spawn/obstacle existentes, se houver; nenhum teste de pixel/render exigido — ver matrix)
**Gate**: quick

---

### T3: Nova paleta de piso da onda 5 em `renderer/world.ts`

**What**: Subir o segundo `BIOME_COUNT` (duplicado, ver `design.md` § Risks) de 4 para 5 e adicionar a 5ª cor de `floor`/`tile` em `drawGrid`.
**Where**: `lib/pixel-hunt-engine/renderer/world.ts`
**Depends on**: T1
**Reuses**: Os 2 arrays de cor já existentes (`floor`, `tile`), só cresce
**Requirement**: GOLIVESPLIT-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `BIOME_COUNT === 5` em `renderer/world.ts`
- [ ] `floor`/`tile` têm uma 5ª cor distinta das 4 existentes
- [ ] Gate check passa: `npm run build` (sem teste unitário de render, ver matrix)

**Tests**: none (build gate — ver Test Coverage Matrix, layer "Renderer")
**Gate**: build

---

### T4: Testes de `isFinalBoss`/onda-4-não-final em `boss.ts`

**What**: Cobrir explicitamente que, com `bossNames.length === 5`, `isFinalBoss(3)` (onda 4) é `false` e `isFinalBoss(4)` (onda 5) é `true` — os 2 ACs centrais da separação (spec P1 story 1, AC1/AC3; P1 story 2, AC1).
**Where**: `lib/pixel-hunt-engine/phases/normal-run/__tests__/boss.test.ts`
**Depends on**: T1
**Reuses**: `isFinalBoss()` já existente, sem mudança de assinatura
**Requirement**: GOLIVESPLIT-01, GOLIVESPLIT-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Teste novo/atualizado confirma `isFinalBoss(bossNames.length - 2) === false` (onda 4, não mais final)
- [ ] Teste novo/atualizado confirma `isFinalBoss(bossNames.length - 1) === true` (onda 5, final)
- [ ] Gate check passa: `npm test`
- [ ] Contagem de testes reportada (sem exclusão silenciosa)

**Tests**: unit
**Gate**: quick

---

### T5: Testes de grafo — `wave-5` gerado, `wave-4 → wave-5 → final-choice`

**What**: Atualizar/estender `graph.test.ts` para confirmar 6 nós (`wave-1..5` + `final-choice`), a aresta `wave-4 → wave-5` (chefe da onda 4 morto, não escalando) e `wave-5 → final-choice` (Diretoria morta na sub-fase 3). Cobre spec P1 story 1 AC3 e P1 story 2 AC3.
**Where**: `lib/pixel-hunt-engine/phases/normal-run/__tests__/graph.test.ts`
**Depends on**: T1, T4
**Reuses**: `buildNormalRunGraph()`/`normalRunGraph` já existente (nenhuma mudança de código nesta task, só teste)
**Requirement**: GOLIVESPLIT-03, GOLIVESPLIT-06, GOLIVESPLIT-07, GOLIVESPLIT-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Teste "has exactly bossNames.length + 1 nodes" continua passando (já parametrizado — confirmar, não reescrever se já cobre)
- [ ] Novo teste (ou extensão do "plays through" existente) percorre `wave-1 → wave-2 → wave-3 → wave-4 → wave-5 → final-choice`, com o chefe da onda 4 morrendo de vez (sem sub-fase) e o da onda 5 exigindo as 3 sub-fases antes de `events.bossDefeated` real
- [ ] Gate check passa: `npm test`
- [ ] Contagem de testes reportada

**Tests**: unit
**Gate**: quick

---

### T6: Testes de spawn — onda 4 sem `bossPhase`, onda 5 com `bossPhase: 1`

**What**: Cobrir que o Actor do chefe da onda 4 nasce sem `bossPhase` (usa a fórmula não-final `hp: 160 + wave×28`, padrão `bossIndex % 4` = 3) e o da onda 5 nasce com `bossPhase: 1` (usa `finalBossHp(1, 5)`). Cobre spec P1 story 1 AC1/AC4 e P1 story 2 AC1.
**Where**: `lib/pixel-hunt-engine/phases/normal-run/__tests__/spawn.test.ts` (ou o arquivo de teste de spawn/boss já existente equivalente — confirmar nome exato ao abrir a pasta `__tests__`)
**Depends on**: T1, T4
**Reuses**: `spawnEnemy()`/`computeBossVolleyPlan()` já existentes, sem mudança de lógica
**Requirement**: GOLIVESPLIT-01, GOLIVESPLIT-02, GOLIVESPLIT-04, GOLIVESPLIT-05, GOLIVESPLIT-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Teste confirma `spawnEnemy(world_com_bossIndex_3, "boss", ...).bossPhase === undefined` e HP/tamanho batem a fórmula não-final
- [ ] Teste confirma `spawnEnemy(world_com_bossIndex_4, "boss", ...).bossPhase === 1` e HP bate `finalBossHp(1, 5)`
- [ ] Gate check passa: `npm test`
- [ ] Contagem de testes reportada

**Tests**: unit
**Gate**: quick

---

### T7: Regressão completa + verificação cruzada de tema + reachability do mob "Legado"

**What**: Rodar a suíte inteira (`npm test`, `npm run build`, `npm run test:e2e` best-effort) e corrigir qualquer teste pré-existente que quebrou por um valor hardcoded (HP/score/kill-target) que assumia implicitamente 4 ondas em vez de derivar da fórmula (`finalBossHp`/`bossKillTarget`) — ver `spec.md` Edge Cases e Assumption A5. Verificar manualmente (leitura de código, sem novo teste dedicado — layer "Renderer" é `none` na matrix) que `BIOME_COUNT` foi atualizado nos 2 arquivos (T2, T3) e que os 3 arrays (`bossNames`, `biomeNames`, `obstacleTemplates`) têm 5 entradas cada, alinhados por índice. Confirmar (comentário/nota no commit, sem novo código) que o mob "Legado" (`wave >= 5`) está agora alcançável.
**Where**: Qualquer arquivo de teste que precisar de correção pontual (reportar quais); nenhuma mudança de código de produção nesta task além de eventual fix de teste.
**Depends on**: T1, T2, T3, T4, T5, T6
**Reuses**: N/A — task de verificação, não de implementação
**Requirement**: GOLIVESPLIT-11 (verificação), cross-cutting sobre todos os outros IDs

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `npm test` 100% verde (contagem total reportada, incluindo os novos testes de T4–T6)
- [ ] `npm run build` sem erros
- [ ] `npm run test:e2e` executado (ou reportado como bloqueado por ambiente, com o motivo — não tratar como falha de código se for o lock conhecido de `.next/dev`)
- [ ] Nota no resumo confirmando os 2 `BIOME_COUNT` e os 3 arrays em 5 entradas alinhadas
- [ ] Nenhum SPEC_DEVIATION necessário (se algum teste quebrado revelar um gap de spec real em vez de um simples ajuste de fórmula, PARAR e reportar como achado (b), não corrigir silenciosamente)

**Tests**: unit + build + e2e (best-effort) — task de fechamento, não introduz camada nova
**Gate**: full

**Commit**: `test(engine): full regression + cross-check for the 5-wave roster (T7)`

---

## Phase Execution Map

```
Fase 1:  T1 → T2 → T3 → T4 → T5 → T6 → T7
```

Execução estritamente sequencial, 1 worker (batch único, feature pequena — conforme instrução do usuário de não fragmentar em 1 worker por task).

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Crescer `bossNames`/`biomeNames` | 1 arquivo, 2 arrays de dados | ✅ Granular |
| T2: Tema de obstáculos onda 5 | 1 arquivo, 1 constante + 1 array | ✅ Granular |
| T3: Paleta de piso onda 5 | 1 arquivo, 1 constante + 2 arrays de cor | ✅ Granular |
| T4: Testes `isFinalBoss` | 1 arquivo de teste, 1 função sob teste | ✅ Granular |
| T5: Testes de grafo | 1 arquivo de teste, 1 grafo sob teste | ✅ Granular |
| T6: Testes de spawn (boss não-final/final) | 1 arquivo de teste, 1 função sob teste (`spawnEnemy`) | ✅ Granular |
| T7: Regressão + verificação cruzada | Cross-cutting por natureza (fechamento de feature pequena) — aceito como task única de "gate final", não uma implementação nova | ✅ Granular (papel de verificação, não de feature) |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | (nenhuma seta de entrada) | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T1 | T1 → T3 (implícito na sequência linear da fase) | ✅ Match |
| T4 | T1 | T1 → T4 | ✅ Match |
| T5 | T1, T4 | T4 → T5 (T1 já coberto transitivamente na sequência) | ✅ Match |
| T6 | T1, T4 | T5 → T6 (sequência linear; T1/T4 já satisfeitos antes) | ✅ Match |
| T7 | T1, T2, T3, T4, T5, T6 | T6 → T7 (fecha a fase; todas as anteriores já executadas na sequência) | ✅ Match |

Nota: o diagrama da Execution Plan é linear (`T1→T2→...→T7`) porque a fase é única e sequencial — não há paralelismo dentro da fase, então a cadeia linear representa corretamente todas as dependências reais (mesmo quando uma task só depende de T1 e não da task imediatamente anterior, a ordem sequencial já garante que T1 rodou antes).

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1: `wave-progression.ts` | Engine domain logic | unit | unit | ✅ OK |
| T2: `spawn.ts` | Engine domain logic | unit | unit | ✅ OK |
| T3: `renderer/world.ts` | Renderer | none | none | ✅ OK |
| T4: `boss.test.ts` | Engine domain logic (teste puro) | unit | unit | ✅ OK |
| T5: `graph.test.ts` | Engine domain logic (teste puro) | unit | unit | ✅ OK |
| T6: teste de spawn | Engine domain logic (teste puro) | unit | unit | ✅ OK |
| T7: regressão | Engine domain logic + Renderer + E2E (verificação, não criação) | unit / none / e2e | unit + build + e2e (best-effort) | ✅ OK |

Nenhuma violação — nenhuma task usa `Tests: none` fora da layer "Renderer" (a única com `none` na matrix), e nenhuma task de código de produção fica sem teste correspondente no mesmo task (T2/T3 são só dados/config consumidos pelos testes já existentes de T4–T6, que exercitam o comportamento ponta a ponta).

---

## Tools

Nenhum MCP ou skill externo necessário — toda a feature é edição de arquivo (`Edit`/`Write`) + execução de `npm test`/`npm run build`/`npm run test:e2e` (`Bash`). Pré-aprovado pelo usuário para seguir sem pergunta adicional de tooling (instrução explícita de delegar sem confirmar).
