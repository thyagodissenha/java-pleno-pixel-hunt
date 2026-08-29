# Estabilidade e Qualidade — Fase 2 Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `_docs/specs/features/estabilidade-qualidade-fase2/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute. Guidelines found: `AGENTS.md` → `.agents/skills/testing-a11y/SKILL.md` (regras de teste: sempre `getByRole`/`getByLabelText`/`getByText`, MSW mocka rede não função, comportamento visível > implementação), `vitest.config.ts` (coverage v8), amostragem de `lib/__tests__/*.test.ts` e `app/__tests__/*.test.tsx` existentes.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Funções puras (`lib/*.ts`, helpers module-level de `app/page.tsx`) | unit | Todos os branches; 1:1 com as ACs da spec (escala, teto, colisão em borda); nenhum caso listado em Edge Cases fica sem teste | `lib/__tests__/*.test.ts`, `app/__tests__/obstacles.test.ts` | `npm test -- --run` |
| Teste de componente com mock de rede (`game-debug.test.tsx`) | integration (render + MSW) | Cobertura preservada 1:1 (nenhum `it` removido/enfraquecido); todo caminho de rede hoje mockado continua coberto pelos handlers MSW | `app/__tests__/*.test.tsx` | `npm test -- --run` |
| Tooling/documentação (`package.json` script, seção README) | none | Gate de build apenas — script sai com o código esperado, seção existe e é legível | `package.json`, `README.md` | `npm run build` + revisão manual |

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após tasks só com teste unitário (T1) | `npm test -- --run` |
| Full | Após tasks que tocam teste de componente ou import entre módulos (T2, T4) | `npm test -- --run && npm run build` |
| Build | Fim de fase / tasks só de tooling (T3) e fechamento geral | `npm run lint && npm run build && npm test -- --run` |

---

## Execution Plan

Phases are ordered and run sequentially — each phase completes before the next begins.

### Phase 1: Obstáculos (independente)

```
T1
```

### Phase 2: Migração MSW (independente)

```
T2
```

### Phase 3: Auditoria de vulnerabilidades (independente)

```
T3
```

### Phase 4: Extração de `lib/score-sync.ts` (maior risco, isolada por último)

```
T4
```

---

## Task Breakdown

### T1: Extrair helpers de obstáculo para `lib/obstacles.ts` e cobrir com teste

> **SPEC_DEVIATION (2026-08-29):** versão original desta task ("só adicionar `export` em `app/page.tsx`") quebrou `npm run build` — Next.js App Router restringe os exports nomeados de arquivos de rota. Corrigido movendo as funções para `lib/obstacles.ts`. Ver `design.md` Tech Decisions e `STATE.md` `AD-008`. Aprovado pelo usuário antes de retomar a execução.

**What**: Mover `obstacleCount`, `circleIntersectsRect`, `pointInRect` e a constante `MAX_OBSTACLES` de `app/page.tsx` para um novo módulo `lib/obstacles.ts`; atualizar `app/page.tsx` para importar de lá; criar `lib/__tests__/obstacles.test.ts` cobrindo escala por reset (incluindo teto em `MAX_OBSTACLES`) e colisão círculo-retângulo/ponto-retângulo (incluindo casos de borda: tangência, canto, dentro/fora).
**Where**: `lib/obstacles.ts` (novo), `app/page.tsx` (modificado — remove definições locais, adiciona import), `lib/__tests__/obstacles.test.ts` (novo, local corrigido — não mais `app/__tests__/`)
**Depends on**: None
**Reuses**: Nenhum padrão de teste específico — funções puras, sem canvas/MSW necessário
**Requirement**: EQ2-01, EQ2-02, EQ2-03

**Tools**:

- MCP: NONE
- Skill: `testing-a11y` (regras gerais de teste do projeto, mesmo não sendo teste de componente)

**Done when**:

- [ ] `obstacleCount`, `circleIntersectsRect`, `pointInRect`, `MAX_OBSTACLES` definidos e exportados em `lib/obstacles.ts`; nenhum permanece definido em `app/page.tsx`
- [ ] `app/page.tsx` importa de `@/lib/obstacles`
- [ ] Teste cobre `obstacleCount` para `resets` de 0 até acima do teto (AC EQ2-01: crescimento linear + limite em `MAX_OBSTACLES`)
- [ ] Teste cobre `circleIntersectsRect` com sobreposição, tangência, canto e não-sobreposição (AC EQ2-02)
- [ ] Teste cobre `pointInRect` com ponto dentro, na borda e fora (AC EQ2-03)
- [ ] Gate check passes: `npm test -- --run && npm run build` (build incluído propositalmente aqui, diferente da versão original da task, por causa do SPEC_DEVIATION)
- [ ] Test count: suíte total sobe de 131 para 131+N (N = testes novos deste arquivo), nenhum teste existente quebra

**Tests**: unit
**Gate**: full (alterado de quick para full por causa do SPEC_DEVIATION — precisa do build pra pegar regressão de tipo de rota)

**Commit**: `refactor(obstacles): extract obstacle helpers to lib/obstacles.ts`

---

### T2: Migrar mock de `fetch` para MSW em `game-debug.test.tsx`

**What**: Substituir `vi.stubGlobal("fetch", vi.fn().mockResolvedValue(...))` por `setupServer` + handlers `http.get`/`http.post` para `/api/scores`, seguindo o padrão de `app/__tests__/score-sync.test.tsx`. Reescrever a contagem de POSTs em `snapshotGameState()` (hoje via `fetchMock.mock.calls.filter(...)`) usando um contador local incrementado no handler MSW.
**Where**: `app/__tests__/game-debug.test.tsx` (modificado)
**Depends on**: None
**Reuses**: `app/__tests__/score-sync.test.tsx` (padrão `setupServer`/`server.use`/`http.get`/`http.post`/contador local `postAttempts`)
**Requirement**: EQ2-08, EQ2-09, EQ2-10

**Tools**:

- MCP: NONE
- Skill: `testing-a11y` (regra 3: "MSW mocka a rede, não a função")

**Done when**:

- [ ] `vi.stubGlobal("fetch", ...)` removido de `game-debug.test.tsx`
- [ ] `setupServer`/`http.get`/`http.post` interceptam `/api/scores` (AC EQ2-08)
- [ ] Contagem de POST reescrita via contador local no handler, preservando a mesma asserção de cada teste existente (AC EQ2-09) — nenhum `it(...)` removido ou enfraquecido
- [ ] Todos os testes de `game-debug.test.tsx` continuam passando (AC EQ2-10) — mesma quantidade de `it(...)` de antes
- [ ] `onUnhandledRequest: "error"` habilitado (mesmo padrão de `score-sync.test.tsx`) — qualquer chamada de rede não prevista falha visivelmente em vez de ser engolida
- [ ] Gate check passes: `npm test -- --run && npm run build`
- [ ] Test count: mesma contagem de `it(...)` de `game-debug.test.tsx` antes da migração (nenhum teste a mais nem a menos)

**Tests**: integration
**Gate**: full

**Commit**: `test(game-debug): migrate fetch mock to MSW`

---

### T3: Script e política de auditoria de vulnerabilidades

**What**: Adicionar `"audit": "npm audit --audit-level=high"` a `scripts` em `package.json`; adicionar seção ao `README.md` explicando a política (nunca `npm audit fix --force` sem revisar advisory + changelog antes).
**Where**: `package.json` (modificado), `README.md` (modificado)
**Depends on**: None
**Reuses**: `npm audit` nativo, sem dependência nova
**Requirement**: EQ2-11, EQ2-12, EQ2-13

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `npm run audit` existe em `package.json` e roda `npm audit --audit-level=high` (AC EQ2-11)
- [ ] `npm run audit` sai com código 0 no estado atual do repo (zero vulnerabilidades) (AC EQ2-13)
- [ ] README (ou CLAUDE.md) tem seção explicando a política de nunca usar `--force` às cegas (AC EQ2-12)
- [ ] Gate check passes: `npm run lint && npm run build && npm test -- --run`

**Tests**: none
**Gate**: build

**Commit**: `chore(security): add audit script and dependency policy`

---

### T4: Extrair funções puras de sincronização de score para `lib/score-sync.ts`

**What**: Mover literalmente (copy, não reescrita) os tipos `HighScore`/`PendingScoreEntry`/`ScoreApiResponse`, as constantes `HIGH_SCORE_KEY`/`PENDING_SCORE_KEY` e as 14 funções puras (`loadHighScores` até `mergeHighScores`, ver design.md) de `app/page.tsx:66-328` para `lib/score-sync.ts`. Atualizar `app/page.tsx` para importar de `@/lib/score-sync` e remover as definições locais. Criar `lib/__tests__/score-sync.test.ts` cobrindo as 14 funções, seguindo a convenção de todo outro módulo em `lib/` ter teste colocado.
**Where**: `lib/score-sync.ts` (novo), `app/page.tsx` (modificado — remove definições, adiciona import), `lib/__tests__/score-sync.test.ts` (novo)
**Depends on**: None (mas fica por último por decisão de risco registrada em `context.md` — não é dependência técnica, é ordenação de risco)
**Reuses**: Corpo exato das funções/tipos já existentes em `app/page.tsx` (nenhuma lógica nova); casos de teste podem ser adaptados dos cenários já cobertos em `app/__tests__/score-sync.test.tsx`
**Requirement**: EQ2-04, EQ2-05, EQ2-06, EQ2-07

**Tools**:

- MCP: NONE
- Skill: `testing-a11y` (regra: comportamento visível > implementação — aqui adaptada para "comportamento observável da função" já que é teste unitário puro, não de componente)

**Done when**:

- [ ] `lib/score-sync.ts` existe com os 3 tipos, 2 constantes e 14 funções (AC EQ2-05)
- [ ] `app/page.tsx` importa de `@/lib/score-sync`; nenhuma das 14 funções/3 tipos permanece definida localmente (AC EQ2-05)
- [ ] `drainPendingScores` e `refreshHighScores` continuam em `app/page.tsx`, agora consumindo o módulo novo (AC EQ2-06)
- [ ] `lib/__tests__/score-sync.test.ts` cobre as 14 funções (decisão de design — não é AC formal, mas é Done when desta task)
- [ ] Suíte existente (`app/__tests__/score-sync.test.tsx`, `app/__tests__/game-debug.test.tsx`, `lib/__tests__/high-scores.test.ts`) continua passando sem alteração de asserções (AC EQ2-07)
- [ ] `npm run build` compila sem erro (AC EQ2-04)
- [ ] Gate check passes: `npm test -- --run && npm run build`
- [ ] Test count: suíte total sobe pela adição de `lib/__tests__/score-sync.test.ts`; nenhum teste existente muda de contagem ou asserção

**Tests**: unit
**Gate**: full

**Commit**: `refactor(score-sync): extract pure sync functions to lib/score-sync.ts`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:  T1
Phase 2:  T2
Phase 3:  T3
Phase 4:  T4
```

Execução estritamente sequencial. Nenhuma dependência técnica entre as 4 tasks (cada uma é um arquivo/módulo isolado) — a ordem é por risco (extração do `Home` por último), não por bloqueio de compilação. 4 tasks totais ≤ ~8 → **execução inline, sem sub-agent** (abaixo do limiar de delegação).

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Exportar helpers de obstáculo + teste | 1 arquivo modificado (3 exports) + 1 arquivo de teste novo | ✅ Granular (mudança trivial + teste co-localizado, um deliverable coeso) |
| T2: Migrar MSW em game-debug.test.tsx | 1 arquivo | ✅ Granular |
| T3: Script + política de auditoria | 2 arquivos (`package.json`, `README.md`) | ✅ Granular (2 arquivos, um deliverable coeso — "política de auditoria") |
| T4: Extrair score-sync para lib/ | 1 módulo novo + 1 arquivo modificado + 1 teste novo | ✅ Granular (cadeia única indivisível — página e módulo não podem coexistir com definições duplicadas; teste co-localizado é obrigatório pela regra de Test Co-location) |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Nenhuma seta de entrada | ✅ Match |
| T2 | None | Nenhuma seta de entrada | ✅ Match |
| T3 | None | Nenhuma seta de entrada | ✅ Match |
| T4 | None (ordenação por risco, não por dependência técnica) | Nenhuma seta de entrada | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1: Exportar helpers de obstáculo + teste | Funções puras (`app/page.tsx`) | unit | unit | ✅ OK |
| T2: Migrar MSW em game-debug.test.tsx | Teste de componente + rede | integration | integration | ✅ OK |
| T3: Script + política de auditoria | Tooling/docs | none | none | ✅ OK |
| T4: Extrair score-sync para lib/ | Funções puras (`lib/score-sync.ts`) | unit | unit | ✅ OK |

Nenhuma violação — todas as tasks que criam camada com teste obrigatório incluem o teste na mesma task.

---

## Ferramentas por task (confirmar antes do Execute)

**Skills disponíveis usadas**: `testing-a11y` (T1, T2, T4 — regras de teste do projeto).
**MCPs**: nenhum necessário — não há biblioteca externa nova nem API desconhecida nesta feature (MSW e `npm audit` já são conhecidos/usados no projeto).

Confirma essa atribuição de ferramentas antes de eu seguir pro Execute?
