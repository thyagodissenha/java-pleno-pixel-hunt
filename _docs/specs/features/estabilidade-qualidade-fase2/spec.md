# Estabilidade e Qualidade — Fase 2 Specification

## Problem Statement

O roadmap ("Prioridade 2: Estabilidade e qualidade") lista quatro pendências técnicas que se acumularam depois do ciclo anterior de hardening: obstáculos temáticos são a única mecânica de gameplay sem nenhuma cobertura de teste; `game-debug.test.tsx` ainda mocka `fetch` diretamente em vez de seguir o padrão MSW já adotado no resto da suíte; o componente `Home` (`app/page.tsx`, ~2400 linhas) mistura lógica de sincronização de score já pura com JSX e estado, dificultando manutenção; e não existe processo documentado para lidar com vulnerabilidades de dependências além de rodar `npm audit` manualmente. Nenhum desses itens bloqueia produção, mas todos aumentam o custo de mudanças futuras.

## Goals

- [ ] Cobrir com teste as funções puras de obstáculos já isoladas (escala por reset, colisão).
- [ ] Eliminar o mock manual de `fetch` em `game-debug.test.tsx`, alinhando com o padrão MSW do resto da suíte.
- [ ] Mover as funções puras de sincronização de score de `app/page.tsx` para um módulo dedicado em `lib/`.
- [ ] Documentar e ferramentar uma política segura de auditoria de dependências.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Extrair `obstacleTemplates`/`spawnObstacles`/`obstacleBlocksCircle` do closure do game loop | Decisão registrada em `context.md`: escopo desta fase é só o que já é puro; extrair a lógica de spawn é um refactor maior, mais próximo do que o item de extração do `Home` cobre, e fica para uma iteração futura se necessário |
| Criar `useScoreSync()` (hook custom) para `drainPendingScores`/`refreshHighScores` | Decisão registrada em `context.md`: só as funções puras migram para `lib/`; as duas funções que chamam `setState` continuam no componente |
| Corrigir vulnerabilidades específicas | `npm audit` está zerado no momento da spec; não há nada para corrigir — o item é só processo/ferramenta |
| Qualquer mudança de gameplay, UI ou monetização | Fora do escopo desta spec, que é puramente estabilidade/qualidade interna |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Escopo do teste de obstáculos | Só `obstacleCount`, `circleIntersectsRect`, `pointInRect` (já módulo-level, puras) | Usuário escolheu a opção "leve" — bate com a redação do roadmap ("teste leve") | y |
| Escopo da extração do `Home` | Só mover funções puras de sync para `lib/score-sync.ts`; `drainPendingScores`/`refreshHighScores` continuam no componente | Usuário escolheu a opção de menor risco; funções que tocam `setState`/`useRef` não são triviais de extrair sem redesenhar o fluxo | y |
| Escopo do item de vulnerabilidades | Script `npm run audit` + parágrafo de política no README | Usuário escolheu ferramentar, não só documentar | y |
| Nome do módulo novo de sync | `lib/score-sync.ts` | Segue a convenção existente (`lib/high-scores.ts`, `lib/score-idempotency.ts`, `lib/score-rate-limit.ts`, `lib/score-abuse-preflight.ts`) | n — a confirmar no Design se colidir com algo |
| Ordem de execução das fases | Extração do `Home` (P1a) por último entre as fases de código, já que é a que mais risco de regressão carrega; itens independentes (obstáculos, MSW, audit) podem rodar em qualquer ordem antes | Decisão já discutida com o usuário antes do Specify — evita que um refactor mais arriscado bloqueie os itens simples | y |

**Open questions:** none — todas resolvidas ou registradas acima.

---

## User Stories

### P1: Cobertura de teste para obstáculos temáticos ⭐ MVP

**User Story**: Como mantenedor do projeto, quero que a escala de obstáculos por reset e a detecção de colisão tenham teste automatizado, para que mudanças futuras nessas fórmulas não quebrem silenciosamente.

**Why P1**: É a única mecânica de gameplay sem nenhuma cobertura hoje; risco de regressão silenciosa.

**Acceptance Criteria**:

1. WHEN `obstacleCount(resets)` for chamado com `resets` de 0 até um valor acima do teto THEN o resultado SHALL crescer linearmente com `resets` e SHALL ser limitado por `MAX_OBSTACLES` (nunca ultrapassar o teto).
2. WHEN `circleIntersectsRect` for chamado com um círculo que sobrepõe um retângulo (incluindo casos de borda: tangência e canto) THEN SHALL retornar `true`; WHEN não houver sobreposição THEN SHALL retornar `false`.
3. WHEN `pointInRect` for chamado com um ponto dentro, na borda e fora de um retângulo THEN SHALL retornar `true`, `true` e `false` respectivamente.

**Independent Test**: `npm test -- lib/__tests__/obstacles.test.ts` (ou local equivalente) passa isoladamente, sem depender de nenhum outro item desta spec.

---

### P1: Extrair funções puras de sincronização de score para `lib/`

**User Story**: Como mantenedor do projeto, quero que a lógica pura de fila offline/sincronização de score viva em um módulo próprio fora de `app/page.tsx`, para reduzir o tamanho do componente monolítico e permitir testar essa lógica sem renderizar o jogo inteiro.

**Why P1**: `app/page.tsx` tem ~2400 linhas; separar lógica já pura é o refactor de menor risco disponível e abre caminho para futuras extrações.

**Acceptance Criteria**:

1. WHEN o build de produção (`npm run build`) for executado após a extração THEN SHALL compilar sem erro e sem mudança de comportamento observável no fluxo de scores.
2. WHEN as funções `loadHighScores`, `saveHighScores`, `isHighScore`, `isPendingScoreEntry`, `loadPendingScores`, `savePendingScores`, `enqueuePendingScore`, `removePendingScore`, `updatePendingScoreAttempt`, `isPersistedScoreResponse`, `scoreIdentity`, `mergeHighScores`, `waitForNextScorePost` e `postPendingScore` forem localizadas THEN SHALL estar em `lib/score-sync.ts`, não mais em `app/page.tsx`.
3. WHEN `app/page.tsx` importar essas funções de `lib/score-sync.ts` THEN `drainPendingScores` e `refreshHighScores` (que chamam `setState`) SHALL continuar em `app/page.tsx`, apenas consumindo o módulo novo.
4. WHEN a suíte de testes existente (`app/__tests__/score-sync.test.tsx`, `app/__tests__/game-debug.test.tsx`, `lib/__tests__/high-scores.test.ts`) for executada após a extração THEN todos os testes SHALL continuar passando sem alteração de asserções (comportamento preservado).

**Independent Test**: `npm test` roda a suíte inteira e `npm run build` compila; nenhuma mudança de import quebra outro módulo.

---

### P2: Migrar mock de `fetch` para MSW em `game-debug.test.tsx`

**User Story**: Como desenvolvedor escrevendo testes, quero que `game-debug.test.tsx` siga o mesmo padrão de mock HTTP (MSW) usado em `score-sync.test.tsx`, para que a suíte tenha uma única convenção de mock de rede.

**Why P2**: Não bloqueia nada, mas gera inconsistência e duplicação de padrão de mock na suíte.

**Acceptance Criteria**:

1. WHEN `game-debug.test.tsx` for executado após a migração THEN SHALL usar `setupServer`/handlers MSW para `/api/scores` (GET e POST) em vez de `vi.stubGlobal("fetch", ...)`.
2. WHEN os testes que hoje inspecionam `fetchMock.mock.calls` (contagem de POSTs) forem migrados THEN a mesma asserção SHALL ser reescrita usando o request log do MSW (ou equivalente), preservando a cobertura original — nenhum `it(...)` SHALL ser removido ou enfraquecido.
3. WHEN a suíte completa (`npm test`) for executada após a migração THEN todos os testes de `game-debug.test.tsx` SHALL continuar passando com a mesma cobertura de linhas/branches de antes (não pode cair).

**Independent Test**: `npm test -- app/__tests__/game-debug.test.tsx` passa isoladamente, sem `vi.stubGlobal("fetch", ...)` no arquivo.

---

### P2: Ferramenta e política de auditoria de vulnerabilidades

**User Story**: Como mantenedor do projeto, quero um comando padrão e uma política documentada para lidar com vulnerabilidades de dependências, para que a próxima vez que `npm audit` apontar algo, exista um processo claro em vez de rodar `--force` às cegas.

**Why P2**: Processo preventivo; não há vulnerabilidade a corrigir agora, mas o roadmap pede isso explicitamente.

**Acceptance Criteria**:

1. WHEN `npm run audit` for executado THEN SHALL rodar `npm audit` (ou equivalente) e retornar código de saída não-zero se houver vulnerabilidade de severidade alta ou crítica.
2. WHEN o README (ou CLAUDE.md) for lido THEN SHALL conter uma seção explicando a política: nunca `npm audit fix --force` sem revisar o advisory e o changelog da dependência antes.
3. WHEN `npm run audit` for executado no estado atual do repositório (zero vulnerabilidades) THEN SHALL sair com código 0.

**Independent Test**: `npm run audit` roda e retorna 0 no estado atual; a seção de política é legível no README.

---

## Edge Cases

- WHEN `obstacleCount` receber `resets` negativo (não deveria acontecer, mas é input possível) THEN o comportamento atual (sem clamp para baixo) SHALL ser preservado e documentado no teste como comportamento conhecido, não "corrigido" silenciosamente (fora de escopo mudar a fórmula).
- WHEN a migração para `lib/score-sync.ts` mudar a ordem de exports THEN nenhum import em outro arquivo (`app/api/scores/route.ts`, se aplicável) SHALL quebrar — verificar com `grep` antes de finalizar.
- WHEN o MSW handler de `/api/scores` não cobrir um caso hoje simulado via `vi.fn().mockResolvedValue(...)` (ex.: resposta de erro de rede) THEN o handler SHALL ser expandido para cobrir esse caso também, não simplificado.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| EQ2-01 | P1: Cobertura de teste para obstáculos | T1 | Verified |
| EQ2-02 | P1: Cobertura de teste para obstáculos | T1 | Verified |
| EQ2-03 | P1: Cobertura de teste para obstáculos | T1 | Verified |
| EQ2-04 | P1: Extrair funções puras de sync | T4 | Verified |
| EQ2-05 | P1: Extrair funções puras de sync | T4 | Verified |
| EQ2-06 | P1: Extrair funções puras de sync | T4 | Verified |
| EQ2-07 | P1: Extrair funções puras de sync | T4 | Verified |
| EQ2-08 | P2: Migrar MSW em game-debug | T2 | Verified |
| EQ2-09 | P2: Migrar MSW em game-debug | T2 | Verified |
| EQ2-10 | P2: Migrar MSW em game-debug | T2 | Verified |
| EQ2-11 | P2: Auditoria de vulnerabilidades | T3 | Verified |
| EQ2-12 | P2: Auditoria de vulnerabilidades | T3 | Verified |
| EQ2-13 | P2: Auditoria de vulnerabilidades | T3 | Verified |

**ID format:** `EQ2-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 13 total, 13 mapeados a tasks, 0 unmapped — validado em `validation.md` (PASS, HEAD `488012d`)

---

## Success Criteria

- [ ] `npm test` passa com testes novos para `obstacleCount`, `circleIntersectsRect`, `pointInRect`.
- [ ] `lib/score-sync.ts` existe, `app/page.tsx` importa dele, suíte inteira continua verde.
- [ ] `game-debug.test.tsx` não tem mais `vi.stubGlobal("fetch", ...)`.
- [ ] `npm run audit` existe e retorna 0; README tem a seção de política.
- [ ] `npm run build` e `npm run lint` continuam limpos no final de todas as fases.
