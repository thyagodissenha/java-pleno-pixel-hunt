# Tarefas: Fase 2 — Estabilidade e Qualidade (ESTAB)

## Protocolo de Execução

Implementar estas tarefas com a skill `tlc-spec-driven`: ative-a pelo nome e siga o fluxo de execução e regras críticas. Uma tarefa = uma alteração atômica + testes + commit individual.

---

**Especificação**: [`_docs/specs/features/estabilidade-qualidade/spec.md`](file:///Volumes/SSD_Externo/repo_personal/java-pleno-pixel-hunt/_docs/specs/features/estabilidade-qualidade/spec.md)
**Design**: [`_docs/specs/features/estabilidade-qualidade/design.md`](file:///Volumes/SSD_Externo/repo_personal/java-pleno-pixel-hunt/_docs/specs/features/estabilidade-qualidade/design.md)
**Status**: Approved

---

## Matriz de Cobertura de Testes (Test Coverage Matrix)

> Gerada a partir das diretrizes do projeto (`package.json`, `AGENTS.md`) e especificações do SonarQube.

| Camada de Código | Tipo de Teste Exigido | Expectativa de Cobertura | Padrão de Localização | Comando de Execução |
| --- | --- | --- | --- | --- |
| Lógica de Negócio (`lib/`) | unit | 1:1 com os ACs do spec (saneamento, ranking, fallback) | `lib/__tests__/*.test.ts` | `npm run test` |
| Componentes React / Páginas (`app/`) | unit | Renderização de rotas estáticas (`/privacidade`, `/sobre`) | `app/__tests__/*.test.tsx` | `npm run test` |
| API Routes (`app/api/`) | integration | Chamadas GET/POST com sanitização e fallbacks | `app/api/__tests__/*.test.ts` | `npm run test` |
| Build & Lint | build | Compilação estrita TypeScript/Next.js sem erros | Projeto raiz | `npm run build && npm run lint` |

## Comandos de Validação (Gate Check Commands)

| Nível de Gate | Quando Usar | Comando |
| --- | --- | --- |
| Quick | Após tarefas com testes unitários | `npm run test` |
| Full | Após tarefas de integração / API / UI | `npm run test` |
| Build | Após conclusão de cada fase ou alterações globais | `npm run build && npm run lint` |

---

## Plano de Execução

### Fase 1: Infraestrutura de Testes e Estabilidade do Build

```
T1 ──→ T2 ──→ T3 ──→ T4
```

### Fase 2: DevTools de Debug e Refatoração de UI

```
T5 ──→ T6 ──→ T7 ──→ T8
```

### Fase 3: Resiliência da API de Scores e Testes de Rotas

```
T9 ──→ T10
```

---

## Detalhamento das Tarefas (Task Breakdown)

### T1: Configurar infraestrutura do Vitest e React Testing Library

**O que**: Adicionar dependências dev e script `test` em `package.json` + criar `vitest.config.ts`.
**Onde**: `package.json`, `vitest.config.ts`
**Depende de**: Nenhum
**Reutiliza**: Scripts existentes do `package.json`
**Requisito**: `ESTAB-01`, `ESTAB-02`

**Ferramentas**:
- MCP: `filesystem`
- Skill: NONE

**Critérios de Aceite (Done when)**:
- [x] `vitest`, `@testing-library/react`, `@testing-library/jest-dom` e `jsdom` instalados.
- [x] Script `"test": "vitest run"` adicionado em `package.json`.
- [x] `vitest.config.ts` criado apontando aliases (`@/`) para a raiz.
- [x] Gate check de build executado com sucesso.

**Testes**: none (configuração de infraestrutura)
**Gate**: build
**Commit**: `chore: setup vitest testing infrastructure`

**Execução**: Concluída em `a994548`.

---

### T2: Criar testes unitários para a lógica do Ranking (`lib/high-scores.ts`)

**O que**: Implementar suíte de testes unitários para `sanitizeScore` e `cleanScores`.
**Onde**: `lib/high-scores.ts`, `lib/__tests__/high-scores.test.ts`
**Depende de**: T1
**Reutiliza**: Funções exported em `lib/high-scores.ts`
**Requisito**: `ESTAB-02`

**Ferramentas**:
- MCP: `filesystem`
- Skill: NONE

**Critérios de Aceite (Done when)**:
- [x] Testes validam sanitização de nomes (trunca em 14 chars, remove espaços duplos, converte para UPPERCASE).
- [x] Testes validam limites numéricos de score, onda e resets (clamps).
- [x] Testes validam ordenação decrescente por score, onda e data.
- [x] Gate check passa: `npm run test`.

**Testes**: unit
**Gate**: quick
**Commit**: `test(lib): add unit tests for high scores logic`

**Execução**: Concluída em `747bc39`.

---

### T3: Criar testes unitários para utilitários do AdSense (`lib/adsense.ts`)

**O que**: Testar funções `getAdsensePublisherId` e `getAdsenseClientId` sob variações de env vars.
**Onde**: `lib/__tests__/adsense.test.ts`
**Depende de**: T1
**Reutiliza**: [`lib/adsense.ts`](file:///Volumes/SSD_Externo/repo_personal/java-pleno-pixel-hunt/lib/adsense.ts)
**Requisito**: `ESTAB-02`

**Ferramentas**:
- MCP: `filesystem`
- Skill: NONE

**Critérios de Aceite (Done when)**:
- [x] Testes cobrem o comportamento quando `GOOGLE_ADSENSE_PUBLISHER_ID` tem prefixo `ca-` ou `pub-`.
- [x] Testes cobrem retorno sem quebras quando a variável estiver ausente.
- [x] Gate check passa: `npm run test`.

**Testes**: unit
**Gate**: quick
**Commit**: `test(lib): add unit tests for adsense utility`

**Execução**: Concluída em `7cf3663`.

---

### T4: Garantir compilação limpa no Build e Lint

**O que**: Verificar e ajustar arquivos TypeScript/Next.js que gerem alertas no `npm run build`.
**Onde**: `package.json`, `tsconfig.json`, `next.config.ts`
**Depende de**: T1, T2, T3
**Reutiliza**: Padrão do repositório
**Requisito**: `ESTAB-01`

**Ferramentas**:
- MCP: `filesystem`
- Skill: NONE

**Critérios de Aceite (Done when)**:
- [x] `npm run build` compila sem erros ou falhas de bundler.
- [x] `npm run lint` passa com 0 erros de linter.

**Testes**: none
**Gate**: build
**Commit**: `fix(build): ensure clean build compilation and lint checks`

**Execução**: Concluída em `9a02d0b` (commit de evidência; nenhuma alteração adicional foi necessária após o gate).

---

### T5: Criar módulo desacoplado de Debug (`lib/debug.ts`)

**O que**: Criar utilitário de ações de depuração para testes rápidos durante o desenvolvimento.
**Onde**: `lib/debug.ts`, `lib/__tests__/debug.test.ts`
**Depende de**: T1
**Reutiliza**: Padrões de lib
**Requisito**: `ESTAB-03`

**Ferramentas**:
- MCP: `filesystem`
- Skill: NONE

**Critérios de Aceite (Done when)**:
- [x] `isDebugAllowed()` verifica se o ambiente é dev (`process.env.NODE_ENV !== 'production'`) ou flag `?debug=1`.
- [x] Módulo disponibiliza manipuladores de eventos/atalhos (`F1`, `F2`, `F3`).
- [x] Testes unitários validam a proteção contra execução em ambiente de produção.
- [x] Gate check passa: `npm run test`.

**Testes**: unit
**Gate**: quick
**Commit**: `feat(debug): create standalone debug utilities and environmental protection`

**Execução**: Concluída em `42c2d0e`.

---

### T6: Integrar atalhos DevTools/Debug na arena do jogo (`app/page.tsx`)

**O que**: Conectar o ouvinte do módulo `lib/debug.ts` ao ciclo de vida do jogo no cliente.
**Onde**: `app/page.tsx`, `app/__tests__/game-debug.test.tsx`
**Depende de**: T5
**Reutiliza**: `lib/debug.ts`
**Requisito**: `ESTAB-03`

**Ferramentas**:
- MCP: `filesystem`
- Skill: NONE

**Critérios de Aceite (Done when)**:
- [x] Pressionar `F1` em ambiente de desenvolvimento alterna a visibilidade do painel HUD de Debug.
- [x] Opções do menu debug (Invocação de Boss, Max Estamina, Vitória) alteram o estado da partida.
- [x] Gate check de build passa limpo.

**Testes**: unit
**Gate**: quick
**Commit**: `feat(game): integrate dev debug tools into game arena`

**Execução**: Concluída em `3dc2b6a`.

---

### T6-F1: Estabilizar asserção de consumo de estamina

**O que**: Remover a dependência do valor intermediário exato de estamina, preservando a prova de consumo e restauração completa.
**Onde**: `app/__tests__/game-debug.test.tsx`
**Depende de**: T6
**Requisito**: `ESTAB-03`

**Critérios de Aceite (Done when)**:
- [x] Antes de “Max Estamina”, o teste confirma que a estamina foi consumida sem fixar o valor temporal em `81%`.
- [x] Depois de “Max Estamina”, o teste continua exigindo exatamente `100%`.
- [x] Gate check passa: `npm run test`.

**Testes**: unit
**Gate**: quick
**Commit**: `test(game): stabilize stamina restoration assertion`

**Execução**: Concluída em `fb42699`.

---

### T7: Refatorar ternários aninhados no componente da página principal (`app/page.tsx`)

**O que**: Extrair condicionais aninhadas complexas reportadas no Code Review para declarações claras.
**Onde**: `app/page.tsx`
**Depende de**: T6
**Reutiliza**: Funções utilitárias locais
**Requisito**: `ESTAB-05`

**Ferramentas**:
- MCP: `filesystem`
- Skill: NONE

**Critérios de Aceite (Done when)**:
- [x] Ternários aninhados (linhas ~967 e ~997) substituídos por funções auxiliares descritivas.
- [x] `npm run build` e `npm run test` passam sem regressões de UI.

**Testes**: unit
**Gate**: quick
**Commit**: `refactor(game): simplify nested ternary expressions in main page`

**Execução**: Concluída em `b70ae1e`.

---

### T8: Ajustar altura de viewport responsiva no CSS (`app/globals.css`)

**O que**: Refatorar classe `.legal-shell` de `height: 100dvh` para `min-height: 100dvh`.
**Onde**: `app/globals.css`
**Depende de**: Nenhum
**Reutiliza**: Classes existentes
**Requisito**: `ESTAB-05`

**Ferramentas**:
- MCP: `filesystem`
- Skill: NONE

**Critérios de Aceite (Done when)**:
- [x] `.legal-shell` ajustado para `min-height: 100dvh` e `overflow-y: auto`.
- [x] Páginas `/privacidade` e `/sobre` rolam adequadamente em telas de dispositivos móveis sem corte.

**Testes**: none
**Gate**: build
**Commit**: `fix(css): use min-height for responsive legal page shell`

**Execução**: Concluída em `8b41213`.

---

### T9: Tornar a API de Scores resiliente com fallback gracioso (`app/api/scores/route.ts`)

**O que**: Evitar lançar exceção não tratada na Vercel sem Vercel Blob token e adicionar suporte a resposta segura.
**Onde**: `app/api/scores/route.ts`, `lib/high-scores.ts`, `app/page.tsx`, `app/api/__tests__/scores.test.ts`, `app/__tests__/score-sync.test.tsx`, `package.json`, `package-lock.json`
**Depende de**: T2
**Reutiliza**: `lib/high-scores.ts`
**Requisito**: `ESTAB-04`

**Ferramentas**:
- MCP: `filesystem`
- Skill: NONE

**Critérios de Aceite (Done when)**:
- [x] `msw` instalado como dependência de desenvolvimento para os testes de rede.
- [x] `POST /api/scores` responde de forma graciosa mesmo se o Vercel Blob lançar exceção de configuração.
- [x] Submissões consecutivas do mesmo IP em menos de 10 segundos recebem HTTP `429`, header `Retry-After` e payload `{ error, retryAfterMs }`.
- [x] O IP é resolvido por `x-forwarded-for`, com fallback para `x-real-ip`.
- [x] Em falha de rede no cliente, o score é preservado na chave `java-pleno-pixel-hunt-high-scores`.
- [x] Scores locais pendentes tentam sincronizar no próximo carregamento e quando o navegador dispara o evento `online`.
- [x] Adicionada suíte de testes de integração/API em `app/api/__tests__/scores.test.ts`.
- [x] Adicionado teste do fallback e retry do cliente em `app/__tests__/score-sync.test.tsx`.
- [x] Gate check passa: `npm run test`.

**Testes**: integration + unit
**Gate**: full
**Commit**: `fix(api): implement graceful fallback and error handling for high scores`

**Execução**: Concluída em `c8d7199`.

---

### T10: Criar testes de renderização das páginas estáticas (`/privacidade` e `/sobre`)

**O que**: Garantir que as rotas estáticas renderizem sem erros e exibam os metadados esperados.
**Onde**: `app/__tests__/legal-pages.test.tsx`
**Depende de**: T1, T8
**Reutiliza**: `app/privacidade/page.tsx`, `app/sobre/page.tsx`
**Requisito**: `ESTAB-02`

**Ferramentas**:
- MCP: `filesystem`
- Skill: NONE

**Critérios de Aceite (Done when)**:
- [x] Testes do `@testing-library/react` verificam títulos e links principais das páginas jurídicas.
- [x] Gate check passa: `npm run test && npm run build`.

**Testes**: unit
**Gate**: full
**Commit**: `test(app): add render tests for privacy and about pages`

**Execução**: Concluída em `929a204`.

---

## Mapeamento da Execução por Fases

```
Fase 1: T1 ──→ T2 ──→ T3 ──→ T4
Fase 2: T5 ──→ T6 ──→ T7 ──→ T8
Fase 3: T9 ──→ T10
```

---

## Validação de Granularidade das Tarefas (Task Granularity Check)

| Tarefa | Escopo | Status |
| --- | --- | --- |
| T1: Setup Vitest | 1 arquivo de config + package.json | ✅ Granular |
| T2: Testes High Scores | 1 arquivo de teste | ✅ Granular |
| T3: Testes AdSense | 1 arquivo de teste | ✅ Granular |
| T4: Validação de Build | Scripts de build/lint | ✅ Granular |
| T5: Módulo lib/debug.ts | 1 módulo + 1 teste | ✅ Granular |
| T6: Integração DevTools na Arena | 1 componente (`app/page.tsx`) | ✅ Granular |
| T7: Refatoração Ternários | 1 componente (`app/page.tsx`) | ✅ Granular |
| T8: Ajuste CSS Viewport | 1 arquivo CSS | ✅ Granular |
| T9: Resiliência API Scores | 1 rota API + 1 teste | ✅ Granular |
| T10: Testes Páginas Estáticas | 1 arquivo de teste | ✅ Granular |

---

## Cruzamento Diagrama-Definição (Diagram-Definition Cross-Check)

| Tarefa | Depende de (Corpo) | Exibido no Diagrama | Status |
| --- | --- | --- | --- |
| T1 | Nenhum | Raiz da Fase 1 | ✅ Match |
| T2 | T1 | T1 ──→ T2 | ✅ Match |
| T3 | T1 | T1 ──→ T3 | ✅ Match |
| T4 | T1, T2, T3 | T3 ──→ T4 | ✅ Match |
| T5 | T1 | Raiz da Fase 2 | ✅ Match |
| T6 | T5 | T5 ──→ T6 | ✅ Match |
| T7 | T6 | T6 ──→ T7 | ✅ Match |
| T8 | Nenhum | Independente na Fase 2 | ✅ Match |
| T9 | T2 | Raiz da Fase 3 | ✅ Match |
| T10 | T1, T8 | T9 ──→ T10 | ✅ Match |

---

## Validação de Co-localização de Testes (Test Co-location Validation)

| Tarefa | Camada Criada/Modificada | Exigência da Matriz | Definido na Tarefa | Status |
| --- | --- | --- | --- | --- |
| T1 | Configuração / Infra | build gate | none | ✅ OK |
| T2 | Lógica de Negócio (`lib/`) | unit | unit | ✅ OK |
| T3 | Utilitário (`lib/`) | unit | unit | ✅ OK |
| T4 | Compilação Geral | build | none | ✅ OK |
| T5 | Módulo de Debug (`lib/`) | unit | unit | ✅ OK |
| T6 | Componente de UI (`app/`) | unit | unit | ✅ OK |
| T7 | Componente de UI (`app/`) | unit | unit | ✅ OK |
| T8 | Estilo CSS | build | none | ✅ OK |
| T9 | Rota de API (`app/api/`) | integration | integration | ✅ OK |
| T10 | Páginas Estáticas (`app/`) | unit | unit | ✅ OK |

---

## Questões abertas

### Verifier e code review — ciclo interno 1

- **Status (2026-08-27):** Verifier `FAIL` em `b8217af` com 38/42 ACs, 74/74 Vitest, 74/74 coverage, build PASS, lint PASS com 2 warnings, 2/2 E2E e sensor 3/3 killed. Code review read-only concluído por 7 dimensões; Sonar `SUCCESS`, cobertura total 64,7%, nova 87,1% e Quality Gate `ERROR`.

#### (a) Viola AC/design existente — fix tasks do ciclo atual após decisão dos gaps (b)

- `ESTAB-09` AC1 / `ESTAB-10` AC3: preservar ou criar pendência quando a API responder `storage: "local"`; remover somente após Blob ou sucesso idempotente confirmado.
- `ESTAB-09` AC1: provar enqueue de uma nova submissão em rede, HTTP 429 e HTTP 503.
- `ESTAB-10` AC4: provar retry posterior da mesma entrada e `submissionId` após novo `load`/`online`.
- `ESTAB-06` AC3: provar conjuntamente zero alteração em estado, entidades, HUD, POST, ranking e storage para eventos não autorizados/fora da allowlist.
- `ESTAB-10` AC5: provar uma única sequência de timers sob `load`/`online` sobrepostos.
- `ESTAB-09` AC4: fast path de chave já concluída antes do throttle, sem novo Blob write nem resposta 429.
- `ESTAB-07` AC1: provar que uma nova run normal após restart volta a ser elegível para POST.
- `ESTAB-13` AC1: tornar o E2E discriminante para `100dvh` variando a altura do viewport, sem aceitar valor fixo equivalente ao viewport configurado.
- `ESTAB-07` AC3: cobrir os dois marcadores de payload debug aceitos pela rota, com zero throttle/claim/persistência.

#### (b) Gap de spec/design — resolvido documentalmente no ciclo interno 2

- **Ownership do claim após TTL:** a interface vigente retorna apenas `claimed | completed | in-flight` e usa marcador compartilhado. A spec não define token de posse, compare-and-set de `complete/release`, renovação ou comportamento quando um claim expira durante persistência. O review demonstrou que um worker antigo pode completar/apagar o claim novo.
- **Falha parcial Blob → idempotência:** a spec/design não define estado durável nem resposta quando o Blob grava com sucesso e `complete()` falha. Responder 503 e liberar o claim permite retry e duplicação; corrigir exige decidir dedupe por `submissionId` no armazenamento autoritativo, outbox/protocolo equivalente ou outra semântica explícita.
- **Critério do Quality Gate:** `ESTAB-15` exige somente importação de cobertura maior que 0%, mas o objetivo P3 é qualidade e o gate permanece `ERROR` por `S3776`, `S1871` e `S7776`. Definir se aprovação exige Quality Gate verde/zero violações novas ou se esses smells permanecem fora dos ACs.

**Decisão (2026-08-28):** o usuário aprovou token exclusivo de ownership com compare-and-set/delete; dedupe autoritativa por `submissionId` cobrindo Blob confirmado seguido de falha Redis; e Quality Gate verde para código novo. As decisões foram incorporadas como `ESTAB-16` a `ESTAB-18` na spec e no design do ciclo 2.

#### (c) Melhoria/refactor fora dos ACs — registrar e não implementar

- Aplicar throttle/limite de tamanho antes de `request.json()` para payload inválido/custoso.
- Reduzir os 2–3 round trips Redis do claim com script atômico, além do necessário para a decisão de ownership.
- Otimizar a drenagem de `localStorage` de O(N²) para estado em memória durante o drain.
- Cobrir caminhos LCOV adicionais de factory/credenciais/release já representados por contratos de integração, salvo os que entrarem nos fixes (a)/(b).
- Preservar as questões categoria (c) anteriores, inclusive extração da sincronização de `Home`, mock direto de fetch e foco do diálogo.

- **Resolvida — T2 / `ESTAB-02` (2026-08-27)**: aprovado incluir `lib/high-scores.ts` no escopo de T2 e exportar `cleanScores` para viabilizar o teste direto exigido pela task.
- **Resolvida — T6 / `ESTAB-03` (2026-08-27)**: aprovado incluir `app/__tests__/game-debug.test.tsx` para verificar o toggle por `F1` e as ações de Boss, Max Estamina e Vitória.
- **Resolvida — T9 / `ESTAB-04` (2026-08-27)**: aprovado throttle de 10 segundos por IP (`x-forwarded-for`, fallback `x-real-ip`), resposta HTTP `429` com `Retry-After` e `{ error, retryAfterMs }`, persistência na chave existente `java-pleno-pixel-hunt-high-scores` e retry no carregamento/evento `online`. Escopo ampliado para API, cliente e respectivos testes.
- **Resolvida — T9 / infraestrutura de testes (2026-08-27)**: aprovado incluir `package.json` e `package-lock.json` no escopo de T9 e instalar `msw` como dependência de desenvolvimento.
- **Resolvida — integridade de teste T6/T9 (2026-08-27)**: aprovado substituir a expectativa intermediária fixa de `81%` por uma verificação de que a estamina não está em `100%`, mantendo a expectativa final exata em `100%`. Correção rastreada em T6-F1.
- **Resolvida — C1-T2 / integridade de teste existente (2026-08-27)**: o usuário autorizou substituir o setup debug por uma run normal elegível e determinística, ajustar exclusivamente a expectativa de `outcome` de `won` para `over`, preservar as demais asserções de fallback e adicionar prova separada de zero POST/zero enqueue para vitória debug. Nenhum hook/cheat de teste foi criado.

### Code review pós-Verifier — classificação

#### (a) Viola AC existente — fix tasks pendentes

- **CR-F1 / ESTAB-03**: revalidar `isDebugAllowed()` e o payload no listener de `CustomEvent` antes de executar qualquer ação de debug.
- **CR-F2 / ESTAB-03**: tornar o teste do boss discriminante, provando entidade real e vida inicial completa.
- **CR-F3 / ESTAB-03**: testar o efeito de F3 na arena, não somente o mapeamento da tecla.
- **CR-F4 / ESTAB-05 — evidência concluída**: SonarQube registrou redução de 54 para 52 Code Smells entre `2026-08-27T10:41:07Z` e `2026-08-27T15:11:39Z`.
- **CR-F5 / ESTAB-05**: adicionar validação mobile de `min-height: 100dvh` e rolagem das páginas legais.
- **CR-F6 / ESTAB-04**: cobrir `GET /api/scores` e sanitização do payload no contrato da rota.
- **CR-F7 / ESTAB-05**: corrigir a nova issue Sonar `typescript:S6819` em `app/page.tsx:2093`, usando elemento `<dialog>` e tratamento adequado de fechamento.

#### (b) Gap de spec — decisão obrigatória antes dos fixes

- **Debug em produção**: a spec aprova `?debug=1` em produção, mas a flag pública permite cheats e scores de sessões debug. Definir se o debug será exclusivo de development ou se haverá autorização server-side e bloqueio de ranking.
- **Throttle distribuído**: o `Map` local não garante o intervalo mínimo entre múltiplas instâncias Vercel. Definir armazenamento compartilhado/TTL ou declarar explicitamente proteção best-effort por instância.
- **Fila offline**: a chave aprovada mistura ranking exibido e submissões próprias pendentes, podendo reenviar scores de terceiros. Definir uma fila local separada e seu formato.
- **Drenagem de pendências**: a spec não define se cada gatilho sincroniza uma ou todas as pendências, nem como coordenar múltiplos envios com o throttle de 10 segundos.

#### (c) Fora dos ACs — não implementar nesta rodada

- Limpar/limitar o `Map` local para evitar crescimento `O(IPs)` caso ele seja mantido.
- Migrar o mock direto de `fetch` em `game-debug.test.tsx` para MSW.
- Conter e restaurar foco do diálogo de debug.
- Extrair a ordenação duplicada de scores para módulo puro compartilhado.
- Extrair a sincronização offline do componente monolítico `Home`.
- Usar ou remover o tipo exportado `HighScoreStorage`.

**SonarQube/JaCoCo**: análise SonarQube 26.7 processada em `2026-08-27T15:11:39Z`. Quality Gate `ERROR`: cobertura nova `0%` e 1 nova violação. Métricas atuais: 0 bugs, 22 vulnerabilidades, 52 Code Smells, cobertura `0%`, duplicação `0,5%`. Code Smells reduziram de 54 para 52. Nova issue diff-scoped: `typescript:S6819` MAJOR em `app/page.tsx:2093`. JaCoCo não se aplica ao projeto TypeScript; LCOV ausente.

---

## Plano de Fix Tasks — Ciclo Interno 1

**Spec emendada:** `_docs/specs/features/estabilidade-qualidade/spec.md`
**Design emendado:** `_docs/specs/features/estabilidade-qualidade/design.md`
**Status:** Ciclo 1 em `FAIL`; Verifier e code review concluídos, execução bloqueada aguardando decisão dos gaps categoria (b)
**Escopo:** somente categoria (a) e decisões categoria (b); categoria (c) permanece em Questões abertas
**Execução:** agente único, sem subagentes, conforme autorização do usuário

### Matriz de Cobertura Atualizada

> Proveniência: `AGENTS.md`, `.agents/skills/testing-a11y/SKILL.md`, `package.json`, `vitest.config.ts`, `sonar-project.properties`, testes existentes e spec emendada. Baseline preservado: 7 arquivos / 28 testes Vitest; zero Playwright. Scripts `test:e2e` e `test:coverage` são criados nas respectivas tasks antes de serem usados.

| Camada | Tipo exigido | Expectativa | Co-localização | Comando |
| --- | --- | --- | --- | --- |
| Guardas e adapters em `lib/` | unit | Todos os branches; 1:1 com `ESTAB-06`, `ESTAB-08`, `ESTAB-09`; relógio/TTL e falhas externas | `lib/__tests__/*.test.ts` | `npm run test` |
| Arena/debug/fila em `app/page.tsx` | unit/integration RTL | Outcomes visíveis e side effects discriminantes de `ESTAB-06`, `07`, `10`, `11`, `14`; rede via MSW | `app/__tests__/*.test.tsx` | `npm run test` |
| Route Handler `/api/scores` | integration | GET/POST happy, sanitização, 429, 503, idempotência e nenhuma persistência indevida | `app/api/__tests__/*.test.ts` | `npm run test` |
| Páginas legais mobile | e2e Playwright | `/privacidade` e `/sobre` em browser real: `100dvh`, scroll e último foco visível | `e2e/legal-pages-mobile.spec.ts` | `npm run test:e2e` |
| Configuração LCOV/Sonar | coverage/build | `coverage/lcov.info` válido e importado pelo Sonar; sem JaCoCo | `vitest.config.ts`, `sonar-project.properties` | `npm run test:coverage` e `sonar-scanner` |
| Build/lint global | build | Next.js/TypeScript/ESLint sem regressão | raiz | `npm run build && npm run lint` |

### Gates Atualizados

| Gate | Quando | Comando |
| --- | --- | --- |
| Quick | Unitários puros/adapters | `npm run test` |
| Full | UI/API/integrations e fim de fase | `npm run test && npm run build && npm run lint` |
| E2E | Após infraestrutura/spec mobile | `npm run test:e2e && npm run build && npm run lint` |
| Coverage | Após configuração LCOV | `npm run test:coverage` seguido de `sonar-scanner` no ambiente Sonar já configurado |

### Plano de execução

As fases e tasks são estritamente sequenciais.

```text
Fase 1 — Debug e gameplay:       C1-T1 → C1-T2 → C1-T3 → C1-T4
Fase 2 — API distribuída:        C1-T5 → C1-T6 → C1-T7
Fase 3 — Fila offline:           C1-T8 → C1-T9
Fase 4 — UI e mobile:            C1-T10 → C1-T11
Fase 5 — Cobertura e Quality:    C1-T12
```

### Fase 1 — Debug e gameplay

#### C1-T1: Endurecer autorização e payload do módulo debug

**O que:** tornar a autorização exclusiva de development e adicionar type guard da allowlist.
**Onde:** `lib/debug.ts`, `lib/__tests__/debug.test.ts`
**Depende de:** Nenhum
**Reutiliza:** `DEBUG_KEYS`, `DebugAction`, `createDebugKeyHandler`
**Requisito:** `ESTAB-06`

**Done when:**
- [ ] `?debug=1` não autoriza production e `triggerDebugAction` não despacha fora de development.
- [ ] `isDebugAction(unknown)` aceita somente todos os valores canônicos de `DebugAction`.
- [ ] Testes cobrem development, production com query e payloads válidos/inválidos; mínimo 3 casos novos e baseline 28 preservado.
- [ ] Gate quick passa sem remoção/silenciamento de testes.

**Testes:** unit, co-localizados
**Gate:** quick
**Tools/Skills:** Context7 somente se a API de ambiente do Next.js exigir confirmação; `testing-a11y` para outcomes
**Commit:** `fix(cycle-1): harden debug authorization`

**Execução:** Concluída em `e219e28`; 42 testes passaram, 0 falharam e 0 foram ignorados.

#### C1-T2: Proteger o listener e excluir runs debug do ranking

**O que:** revalidar ambiente/payload no consumidor, marcar a origem da run e impedir POST/enqueue de score debug.
**Onde:** `app/page.tsx`, `app/__tests__/game-debug.test.tsx`, `app/__tests__/score-sync.test.tsx`
**Depende de:** C1-T1
**Reutiliza:** guardas de `lib/debug.ts`, fluxo existente de submit e handlers MSW
**Requisito:** `ESTAB-06`, `ESTAB-07`

**Done when:**
- [x] Evento forjado em production e detail inválido não alteram estado/HUD/entidades.
- [x] Qualquer ação debug marca a run até o próximo start/reset normal.
- [x] Final de run debug não chama POST nem grava `pending-scores`; teste MSW prova zero requests.
- [x] Mínimo 3 casos novos por comportamento visível/contrato e gate full passa com baseline preservado.

**Testes:** unit/integration RTL + MSW, co-localizados
**Gate:** full
**Tools/Skills:** `testing-a11y`
**Commit:** `fix(cycle-1): exclude debug scores from ranking`

**Execução:** Concluída em `9dd52ff`; setup/expectativa do teste existente corrigidos com autorização explícita. A resposta compacta do worker foi perdida por limite de uso antes de informar a contagem do gate; o commit e a sequência foram preservados para revalidação independente.

#### C1-T3: Tornar o teste de boss discriminante

**O que:** expor no HUD debug o estado derivado da entidade boss e exigir vida inicial completa.
**Onde:** `app/page.tsx`, `app/__tests__/game-debug.test.tsx`
**Depende de:** C1-T2
**Reutiliza:** entidade criada por `spawnEnemy("boss")`, painel debug e queries acessíveis
**Requisito:** `ESTAB-11` / `CR-F2`

**Done when:**
- [ ] Após “Invocar Boss”, UI debug acessível mostra entidade boss e valores exatos `hp/maxHp` iguais.
- [ ] Teste falha se `spawnEnemy("boss")` ou a inicialização de vida completa for removida.
- [ ] Um caso discriminante novo é adicionado; baseline e gate full passam.

**Testes:** unit/integration RTL, co-localizados
**Gate:** full
**Tools/Skills:** `testing-a11y`
**Commit:** `fix(cycle-1): prove full-health boss spawn`

**Execução:** Concluída em `270ab08`; contagem do gate pendente de revalidação independente após interrupção do worker por limite de uso.

#### C1-T4: Provar o efeito de F3 na arena

**O que:** verificar o side effect observável de power-up disparado por F3, além do mapeamento da tecla.
**Onde:** `app/page.tsx`, `app/__tests__/game-debug.test.tsx`
**Depende de:** C1-T3
**Reutiliza:** `spawnPowerUp`, anúncio acessível existente e handler F3
**Requisito:** `ESTAB-11` / `CR-F3`

**Done when:**
- [ ] F3 em development produz indicador acessível de power-up na arena.
- [ ] Teste falha se o side effect `spawnPowerUp()` for removido e não passa apenas pelo mapeamento da tecla.
- [ ] Um caso discriminante novo é adicionado; baseline e gate full passam.

**Testes:** unit/integration RTL, co-localizados
**Gate:** full
**Tools/Skills:** `testing-a11y`
**Commit:** `fix(cycle-1): prove f3 power-up effect`

**Execução:** Concluída em `e0bb13f`; contagem do gate pendente de revalidação independente após interrupção do worker por limite de uso.

### Fase 2 — API distribuída

#### C1-T5: Criar o adapter de throttle Redis distribuído

**O que:** adicionar `@upstash/redis` e implementar `RateLimitStore` com Redis em produção e store injetável local.
**Onde:** `package.json`, `package-lock.json`, `lib/score-rate-limit.ts`, `lib/__tests__/score-rate-limit.test.ts`
**Depende de:** C1-T4
**Reutiliza:** resolução atual de IP e relógio fake do Vitest
**Requisito:** `ESTAB-08`

**Done when:**
- [ ] Produção usa `Redis.fromEnv()` e `redis.set(key, "1", { nx: true, ex: 10 })` sobre identificador IP hasheado.
- [ ] Primeira aquisição permite; aquisição concorrente/bloqueada nega sem renovar TTL; nova aquisição após 10 s permite.
- [ ] Credenciais/erro Redis em produção resultam em decisão de indisponibilidade fail-closed; fallback `local-memory` só existe fora de produção.
- [ ] Logs não contêm IP em claro nem payload.
- [ ] Mínimo 4 casos unitários novos e gate quick passam com baseline preservado.

**Testes:** unit, co-localizados
**Gate:** quick
**Tools/Skills:** Context7 `@upstash/redis`; nenhuma API vendor deve ser assumida sem consulta
**Commit:** `fix(cycle-1): add distributed score throttle`

**Execução:** Concluída em `3f9a897`; 54/54 testes passaram.

#### C1-T6: Criar contrato idempotente compartilhado

**O que:** implementar claim/complete/release por `submissionId` no adapter compartilhado, com marcador concluído por 24 horas.
**Onde:** `lib/score-idempotency.ts`, `lib/__tests__/score-idempotency.test.ts`
**Depende de:** C1-T5
**Reutiliza:** cliente Redis/config/fallback do adapter anterior
**Requisito:** `ESTAB-09`

**Done when:**
- [ ] Context7 confirma as chamadas exatas de claim, complete e release antes da implementação.
- [ ] Concorrência para o mesmo ID produz um `claimed` e demais `in-flight`; `completed` nunca reivindica novamente.
- [ ] Complete usa TTL de 24 horas; falha de persistência libera apenas claim não concluído.
- [ ] Erro Redis em produção não degrada para memória.
- [ ] Mínimo 4 casos unitários novos e gate quick passam com baseline preservado.

**Testes:** unit, co-localizados
**Gate:** quick
**Tools/Skills:** Context7 `@upstash/redis`
**Commit:** `fix(cycle-1): add score idempotency store`

**Execução:** Concluída em `ed09da2`; 60/60 testes passaram.

#### C1-T7: Integrar throttle, idempotência e sanitização na rota scores

**O que:** substituir o `Map`, aplicar adapters no POST e fechar contratos GET/POST/debug.
**Onde:** `app/api/scores/route.ts`, `app/api/__tests__/scores.test.ts`
**Depende de:** C1-T6
**Reutiliza:** `sanitizeScore`, `cleanScores`, `readHighScores`, `addHighScore`, adapters C1-T5/C1-T6
**Requisito:** `ESTAB-07`, `ESTAB-08`, `ESTAB-09`, `ESTAB-12` / `CR-F6`

**Done when:**
- [ ] GET retorna somente scores saneados e ordenados, inclusive diante de registros malformados.
- [ ] POST saneia antes de persistir, rejeita payload debug e exige `Idempotency-Key` válido.
- [ ] 429 retorna header/payload exatos; erro Redis retorna 503 e `addHighScore` não é chamado.
- [ ] Sucesso idempotente não produz segundo Blob write; falha Blob libera claim e não marca complete.
- [ ] Mínimo 6 casos de integração novos/ajustados e gate full passam com baseline preservado.

**Testes:** integration, co-localizados
**Gate:** full
**Tools/Skills:** Context7 para SDK; mocks no boundary do adapter, sem rede real
**Commit:** `fix(cycle-1): enforce score api contracts`

**Execução:** Concluída em `842b3a0`; 65/65 testes, build e lint passaram. Warning preexistente em `lib/debug.ts:26`.

### Fase 3 — Fila offline

#### C1-T8: Separar e deduplicar a fila de submissões próprias

**O que:** introduzir `java-pleno-pixel-hunt-pending-scores` e o modelo versionado com `submissionId` estável.
**Onde:** `app/page.tsx`, `app/__tests__/score-sync.test.tsx`
**Depende de:** C1-T7
**Reutiliza:** `HighScore`, sanitização cliente, `scoreIdentity`, MSW existente
**Requisito:** `ESTAB-09`

**Done when:**
- [ ] Falha de submissão própria enfileira exatamente uma entrada versionada na nova chave.
- [ ] Ranking global/local continua na chave antiga e GET nunca cria pendência.
- [ ] Retry preserva `submissionId` e envia `Idempotency-Key`; enqueue duplicado pelo mesmo ID mantém uma entrada.
- [ ] Parser mantém entradas válidas e ignora entradas estruturalmente inválidas sem reenviar dados de terceiros.
- [ ] Mínimo 4 casos RTL/MSW novos ou ajustados e gate full passam com baseline preservado.

**Testes:** unit/integration RTL + MSW, co-localizados
**Gate:** full
**Tools/Skills:** `testing-a11y`
**Commit:** `fix(cycle-1): separate pending score queue`

**Execução:** Concluída em `93d4758`; 67/67 testes, build e lint passaram.

#### C1-T9: Drenar a fila sequencialmente no load e online

**O que:** implementar mutex lógico, FIFO, um POST em voo e intervalo mínimo de 10 segundos entre envios.
**Onde:** `app/page.tsx`, `app/__tests__/score-sync.test.tsx`
**Depende de:** C1-T8
**Reutiliza:** refs do componente, fila C1-T8, fake timers e handlers MSW
**Requisito:** `ESTAB-10`

**Done when:**
- [ ] Load e online drenam todos os itens em FIFO até vazia, com pelo menos 10 s entre inícios de POST.
- [ ] Gatilhos sobrepostos compartilham uma drenagem e mantêm no máximo um POST em voo/timer ativo.
- [ ] Sucesso/idempotência remove só o item correspondente; rede/429/503 atualiza attempt, mantém item e encerra a rodada.
- [ ] Fila vazia não agenda timers nem chama POST.
- [ ] Mínimo 5 casos RTL/MSW com fake timers e gate full passam com baseline preservado.

**Testes:** unit/integration RTL + MSW, co-localizados
**Gate:** full
**Tools/Skills:** `testing-a11y`
**Commit:** `fix(cycle-1): drain pending scores sequentially`

**Execução:** Concluída em `58295dc`; 73/73 testes, build e lint passaram.

### Fase 4 — UI e mobile

#### C1-T10: Migrar o painel debug para dialog nativo

**O que:** substituir o `div role="dialog"` por `<dialog>` e sincronizar fechamento com `debugOpen`.
**Onde:** `app/page.tsx`, `app/__tests__/game-debug.test.tsx`
**Depende de:** C1-T9
**Reutiliza:** nome acessível, ações e estado existentes do painel
**Requisito:** `ESTAB-14` / `CR-F7`

**Done when:**
- [ ] Painel aberto é `<dialog open>` nomeado “Ferramentas de debug”; close atualiza estado e remove/fecha o painel.
- [ ] Testes usam `getByRole("dialog")` e ação visível, sem `data-testid`.
- [ ] Sonar não reporta `typescript:S6819` no local do painel.
- [ ] Mínimo 2 casos RTL ajustados/novos e gate full passam com baseline preservado.

**Testes:** unit/integration RTL, co-localizados
**Gate:** full
**Tools/Skills:** `component-architecture`, `testing-a11y`
**Commit:** `fix(cycle-1): use native debug dialog`

**Execução:** Concluída em `c22467d`; 74/74 testes, build e lint passaram. Sonar deixou de reportar `typescript:S6819` para o painel.

#### C1-T11: Adicionar validação Playwright mobile das páginas legais

**O que:** configurar Playwright e validar viewport/rolagem real de `/privacidade` e `/sobre`.
**Onde:** `package.json`, `package-lock.json`, `playwright.config.ts`, `e2e/legal-pages-mobile.spec.ts`
**Depende de:** C1-T10
**Reutiliza:** script `dev`, `.legal-shell` e conteúdo focável das duas páginas
**Requisito:** `ESTAB-13` / `CR-F5`

**Done when:**
- [ ] `@playwright/test` e script `test:e2e` são configurados com webServer do projeto e viewport mobile estável.
- [ ] Cada rota prova `min-height: 100dvh` por estilo computado, scroll quando necessário e último elemento focável visível após rolagem.
- [ ] Queries usam role/label/texto; nenhum seletor `data-testid`.
- [ ] Dois fluxos de rota passam no gate E2E e o build/lint permanecem verdes.

**Testes:** e2e Playwright, co-localizados à infraestrutura criada
**Gate:** e2e
**Tools/Skills:** Context7 para Playwright atual; `testing-a11y`
**Commit:** `fix(cycle-1): verify legal pages on mobile`

**Execução:** Concluída em `551027d`; 2/2 fluxos E2E mobile, build e lint passaram.

### Fase 5 — Cobertura e Quality Gate

#### C1-T12: Gerar LCOV compatível e alimentar o Sonar

**O que:** configurar provider Vitest de versão compatível, reporter LCOV e script de cobertura; comprovar importação no Quality Gate.
**Onde:** `package.json`, `package-lock.json`, `vitest.config.ts`, `sonar-project.properties` somente se o path existente precisar ajuste
**Depende de:** C1-T11
**Reutiliza:** suíte Vitest, `coverage/lcov.info` já declarado e scanner Sonar existente
**Requisito:** `ESTAB-15`

**Done when:**
- [ ] Context7/package metadata confirmam provider suportado e mesma versão do Vitest antes da instalação de `@vitest/coverage-v8`.
- [ ] `npm run test:coverage` preserva todos os testes e gera `coverage/lcov.info` não vazio.
- [ ] `sonar-scanner` importa o LCOV e cobertura nova deixa de ser `0%`; métricas/evidência são registradas sem JaCoCo.
- [ ] Se a compatibilidade não puder ser confirmada, a task fica bloqueada com evidência; não se inventa provider, formato ou resultado.
- [ ] Gate coverage e depois build/lint passam sem redução silenciosa de testes.

**Testes:** coverage/config; suíte existente é o sensor
**Gate:** coverage + build
**Tools/Skills:** Context7 Vitest coverage; scanner Sonar existente
**Commit:** `fix(cycle-1): publish lcov to sonar`

**Execução:** Concluída em `b8217af`; 74/74 testes com cobertura, LCOV válido de 39.334 bytes, build e lint passaram. Sonar processou a análise com sucesso e importou LCOV: cobertura total 64,5%, nova 87,1%. Quality Gate `ERROR` por três novas violações (`S3776`, `S1871`, `S7776`); JaCoCo N/A para TypeScript.

### Mapa completo de dependências

```text
C1-T1 → C1-T2 → C1-T3 → C1-T4 → C1-T5 → C1-T6
      → C1-T7 → C1-T8 → C1-T9 → C1-T10 → C1-T11 → C1-T12
```

### Validação de granularidade

| Task | Unidade de entrega | Status |
| --- | --- | --- |
| C1-T1 | 1 módulo de guardas | OK — granular |
| C1-T2 | 1 fluxo do componente: autorização/origem | OK — coeso |
| C1-T3 | 1 outcome boss | OK — granular |
| C1-T4 | 1 outcome F3 | OK — granular |
| C1-T5 | 1 adapter rate limit | OK — coeso com dependência/config |
| C1-T6 | 1 adapter idempotência | OK — granular |
| C1-T7 | 1 endpoint/contrato de rota | OK — coeso |
| C1-T8 | 1 modelo/storage de fila | OK — coeso |
| C1-T9 | 1 orquestrador de drenagem | OK — granular |
| C1-T10 | 1 componente dialog | OK — granular |
| C1-T11 | 1 fixture E2E mobile | OK — coeso com config |
| C1-T12 | 1 pipeline LCOV | OK — coeso com config |

### Cross-check diagrama-definição

| Task | Depende de no corpo | Seta no mapa | Status |
| --- | --- | --- | --- |
| C1-T1 | Nenhum | raiz | Match |
| C1-T2 | C1-T1 | T1 → T2 | Match |
| C1-T3 | C1-T2 | T2 → T3 | Match |
| C1-T4 | C1-T3 | T3 → T4 | Match |
| C1-T5 | C1-T4 | T4 → T5 | Match |
| C1-T6 | C1-T5 | T5 → T6 | Match |
| C1-T7 | C1-T6 | T6 → T7 | Match |
| C1-T8 | C1-T7 | T7 → T8 | Match |
| C1-T9 | C1-T8 | T8 → T9 | Match |
| C1-T10 | C1-T9 | T9 → T10 | Match |
| C1-T11 | C1-T10 | T10 → T11 | Match |
| C1-T12 | C1-T11 | T11 → T12 | Match |

### Validação de co-localização

| Task | Camada | Matriz exige | Task inclui | Status |
| --- | --- | --- | --- | --- |
| C1-T1 | lib/debug | unit | `debug.test.ts` | OK |
| C1-T2 | UI + rede | RTL/MSW | `game-debug` + `score-sync` | OK |
| C1-T3 | gameplay UI | RTL discriminante | `game-debug` | OK |
| C1-T4 | gameplay UI | RTL discriminante | `game-debug` | OK |
| C1-T5 | adapter rate | unit | `score-rate-limit.test.ts` | OK |
| C1-T6 | adapter idempotência | unit | `score-idempotency.test.ts` | OK |
| C1-T7 | API route | integration | `scores.test.ts` | OK |
| C1-T8 | fila UI | RTL/MSW | `score-sync.test.tsx` | OK |
| C1-T9 | drain UI | RTL/MSW/fake timers | `score-sync.test.tsx` | OK |
| C1-T10 | dialog UI | RTL acessível | `game-debug.test.tsx` | OK |
| C1-T11 | mobile browser | Playwright | `legal-pages-mobile.spec.ts` | OK |
| C1-T12 | config coverage | coverage/build | suíte completa + LCOV/Sonar | OK |

### Rastreabilidade requirement → tasks

| Requirement | Tasks |
| --- | --- |
| `ESTAB-06` | C1-T1, C1-T2 |
| `ESTAB-07` | C1-T2, C1-T7 |
| `ESTAB-08` | C1-T5, C1-T7 |
| `ESTAB-09` | C1-T6, C1-T7, C1-T8 |
| `ESTAB-10` | C1-T9 |
| `ESTAB-11` | C1-T3, C1-T4 |
| `ESTAB-12` | C1-T7 |
| `ESTAB-13` | C1-T11 |
| `ESTAB-14` | C1-T10 |
| `ESTAB-15` | C1-T12 |

**Coverage:** 10/10 requisitos novos mapeados; 0 não mapeados.

### Classificação preservada após planejamento

- **Categoria (a):** CR-F1→C1-T1/C1-T2; CR-F2→C1-T3; CR-F3→C1-T4; CR-F5→C1-T11; CR-F6→C1-T7; CR-F7→C1-T10.
- **CR-F4 / ESTAB-05 — evidência concluída, sem fix task:** SonarQube reduziu Code Smells de **54 para 52** no intervalo já registrado.
- **Categoria (b), agora decidida:** debug production→C1-T1/C1-T2; throttle distribuído→C1-T5/C1-T7; fila separada→C1-T8; drenagem→C1-T9; idempotência→C1-T6/C1-T7/C1-T8.
- **Categoria (c):** permanece integralmente em Questões abertas e não aparece no breakdown de implementação.

**Contagem final do ciclo 1:** 12 fix tasks pendentes em 5 fases inteiras (4 + 3 + 2 + 2 + 1), execução estritamente sequencial.

---

## Plano de Fixes — Ciclo Interno 2

**Spec emendada:** `_docs/specs/features/estabilidade-qualidade/spec.md` (`ESTAB-16` a `ESTAB-18`)
**Design emendado:** `_docs/specs/features/estabilidade-qualidade/design.md` — seção “Emenda de Design — Ciclo Interno 2”
**Status:** Implementação do ciclo 2 concluída; C2-T1–C2-T11 executadas, Verifier independente pendente
**Escopo:** fixes categoria (a) + decisões categoria (b) aprovadas; categoria (c) permanece somente em Questões abertas

### Baseline e política de testes

- Baseline de implementação: `b8217af`; baseline documental do ciclo 2: commit de Tasks desta rodada.
- Suíte vigente: 74 testes Vitest, 2 fluxos Playwright mobile, LCOV importado; build e lint verdes no último Verifier.
- Cada task altera o teste discriminante junto do comportamento; nenhum teste é apagado, enfraquecido ou marcado skip.
- Gate `quick` executa o arquivo focado e `npm run test`; gate `full` acrescenta build/lint; E2E e Sonar ficam nos pontos indicados.
- APIs externas permanecem limitadas às confirmadas: `@upstash/redis` 1.38.3 (`SET NX EX`, `EVAL`) e `@vercel/blob` 2.8.0 (`get` sem cache, ETag, `put ifMatch`, `BlobPreconditionFailedError`).

### Matriz de cobertura do ciclo 2

| Requirement / AC | Behavior under test | Test type | Arquivo | Discrimination strategy |
| --- | --- | --- | --- | --- |
| `ESTAB-16` AC1-AC4 | Token único, TTL 60, CAS complete/release, owner antigo rejeitado e completed 24 h | unit | `lib/__tests__/score-idempotency.test.ts` | Simular expiração + segundo owner; mutar token antigo para igual ao novo deve falhar o teste. |
| `ESTAB-16` AC5 | Store local reproduz ownership/TTL sem alegar distribuição | unit | `lib/__tests__/score-idempotency.test.ts` | Relógio fake e dois tokens; remover comparação deve alterar outcome. |
| `ESTAB-17` AC1-AC3 | Documento v2, array legado, ledger 24 h, ETag concorrente e dedupe por ID | unit | `lib/__tests__/high-scores.test.ts` | Dois snapshots com mesma ETag; writer perdedor relê e preserva ambos/identifica duplicata. |
| `ESTAB-17` AC4, AC7 | Blob confirmado + complete falha continua sucesso; completed/ledger ocorre antes do throttle | integration | `app/api/__tests__/scores.test.ts` | Fazer `complete` lançar e depois retry; exigir um write e zero throttle no retry idempotente. |
| `ESTAB-17` AC5-AC6 | Storage local/rede/429/503 cria ou mantém fila e novo trigger reenvia mesmo ID | RTL + MSW | `app/__tests__/score-sync.test.tsx` | Começar sem fila, comparar ID/header antes/depois e exigir item retido/removido apenas após Blob. |
| `ESTAB-18` AC1 | Evento inválido/production não altera UI, entidades, POST ou storage | RTL + MSW | `app/__tests__/game-debug.test.tsx` | Snapshots conjuntos antes/depois; qualquer side effect isolado quebra o caso. |
| `ESTAB-18` AC2 | `origin:debug` e `debug:true` rejeitados antes dos adapters | integration | `app/api/__tests__/scores.test.ts` | `it.each` com dois payloads e zero throttle/claim/write. |
| `ESTAB-18` AC3 | Restart normal após debug volta a enviar uma vez com novo ID | RTL + MSW | `app/__tests__/score-sync.test.tsx` | Run debug exige zero POST; nova run normal exige exatamente um POST e ID diferente. |
| `ESTAB-18` AC4 | Load/online compartilham POST e uma sequência de timers | RTL + fake timers | `app/__tests__/score-sync.test.tsx` | Contar waits de 10 s e in-flight; segundo timer ou POST concorrente falha. |
| `ESTAB-18` AC5 | `100dvh` acompanha duas alturas e mantém foco visível | E2E | `e2e/legal-pages-mobile.spec.ts` | Alterar viewport; valor fixo 844 px falha na segunda altura. |
| `ESTAB-18` AC6 | S3776/S1871/S7776 ausentes e Quality Gate new code `OK` | static + coverage | Sonar/LCOV | Scanner fresco no HEAD; issue nova ou gate `ERROR` reprova. |

### Gate por fase

| Fase | Gate mínimo após cada task | Gate de fechamento da fase |
| --- | --- | --- |
| 1 — Ownership Redis | arquivo unitário + `npm run test` | `npm run build` e `npm run lint` |
| 2 — Blob e rota | arquivo unitário/integration + `npm run test` | `npm run build` e `npm run lint` |
| 3 — Cliente e debug | RTL/MSW focado + `npm run test` | `npm run build` e `npm run lint` |
| 4 — Sonar e mobile | teste focado + `npm run test` quando aplicável | `npm run test:coverage`, build, lint, E2E e análise Sonar fresca |

### Plano de fases

```text
Fase 1 — Ownership Redis:           C2-T1 → C2-T2
Fase 2 — Blob e contrato da API:   C2-T3 → C2-T4 → C2-T5
Fase 3 — Cliente e debug:           C2-T6 → C2-T7 → C2-T8
Fase 4 — Sonar e mobile:            C2-T9 → C2-T10 → C2-T11
Validação independente:             Verifier → Sonar/JaCoCo N/A → code-review
```

### Fase 1 — Ownership Redis

#### C2-T1: Introduzir owner token no adapter Redis

**O que:** substituir o marcador compartilhado por token exclusivo e fazer complete/release condicionais retornarem outcome de ownership.
**Onde:** `lib/score-idempotency.ts`, `lib/__tests__/score-idempotency.test.ts`
**Depende de:** nenhuma
**Reutiliza:** chave SHA-256, TTLs e cliente `eval` existentes
**Requisito:** `ESTAB-16` AC1-AC4

**Done when:**
- [ ] Dois claims adquiridos em momentos distintos recebem tokens diferentes e não expõem o token em logs.
- [ ] Redis recebe `in-flight:<token>` com `NX` e `EX 60`; complete proprietário grava `completed` com `EX 86400`.
- [ ] Complete/release com token antigo retornam `ownership-lost`; testes afirmam retorno Lua `0` e claim novo intacto.
- [ ] Corrida `SET NX=false` seguida de leitura `completed`/`in-flight` mantém outcomes existentes.
- [ ] Teste focado e `npm run test` passam sem reduzir o baseline.

**Testes:** unit, cliente Redis fake com scripts/outcomes observáveis
**Gate:** quick
**Commit:** `fix(cycle-2): enforce redis claim ownership`

**Execução:** Concluída em `27d1840`; revalidada pelo gate acumulado 94/94 de C2-T5.

#### C2-T2: Alinhar o store local ao contrato de ownership

**O que:** aplicar token, TTL e perda de posse equivalentes ao fallback exclusivo de development/test.
**Onde:** `lib/score-idempotency.ts`, `lib/__tests__/score-idempotency.test.ts`
**Depende de:** C2-T1
**Reutiliza:** relógio injetável e `Map` local existentes
**Requisito:** `ESTAB-16` AC3-AC5

**Done when:**
- [ ] Expiração em 60 s permite novo owner e o owner anterior não completa nem remove a entrada nova.
- [ ] Owner atual conclui por 24 h; fronteiras exatas de ambos os TTLs são verificadas com relógio fake.
- [ ] Backend continua identificado como `local-memory` e somente fora de production.
- [ ] Teste focado, suíte completa, build e lint passam.

**Testes:** unit com fake clock
**Gate:** full
**Commit:** `fix(cycle-2): mirror claim ownership locally`

**Execução:** Concluída em `ea698b7`; revalidada pelo gate acumulado 94/94 de C2-T5.

### Fase 2 — Blob e contrato da API

#### C2-T3: Versionar o documento autoritativo de ranking

**O que:** introduzir codec dual para array legado/documento v2, ledger 24 h e projeção pública sem metadados internos.
**Onde:** `lib/high-scores.ts`, `lib/__tests__/high-scores.test.ts`
**Depende de:** C2-T2
**Reutiliza:** `HighScore`, `sanitizeScore`, `cleanScores` e `SCORE_PATH`
**Requisito:** `ESTAB-17` AC1, AC3

**Done when:**
- [ ] Array legado continua produzindo o mesmo `HighScore[]` saneado/ordenado.
- [ ] Documento v2 preserva `submissionId` e ledger internamente, mas GET/read público não vaza `version`, token ou ledger.
- [ ] Ledger remove IDs anteriores a 24 h e conserva IDs válidos mesmo quando o score não entra no top 10.
- [ ] Casos nulo/malformado não inventam ID nem quebram compatibilidade.
- [ ] Teste focado e `npm run test` passam.

**Testes:** unit de codec/modelo
**Gate:** quick
**Commit:** `fix(cycle-2): version authoritative ranking data`

**Execução:** Concluída em `3798c48`; revalidada pelo gate acumulado 94/94 de C2-T5.

#### C2-T4: Persistir ranking com ETag e dedupe autoritativa

**O que:** implementar read/merge/conditional-write com no máximo três tentativas e dedupe pelo ledger.
**Onde:** `lib/high-scores.ts`, `lib/__tests__/high-scores.test.ts`
**Depende de:** C2-T3
**Reutiliza:** `get`, `put`, ETag e `BlobPreconditionFailedError` confirmados na versão instalada
**Requisito:** `ESTAB-17` AC2-AC4

**Done when:**
- [ ] Blob existente é lido com `useCache:false` e atualizado com `ifMatch` igual à ETag lida.
- [ ] Blob ausente usa criação sem overwrite; conflito de criação ou ETag relê a versão atual.
- [ ] Concorrência com IDs distintos preserva os dois merges; mesmo ID produz uma ocorrência e outcome idempotente.
- [ ] Após três conflitos sem confirmação, a função falha sem declarar persistência; nenhum retry é ilimitado.
- [ ] Teste focado e `npm run test` passam.

**Testes:** unit do boundary Blob, incluindo conflito e criação concorrente
**Gate:** quick
**Tools/Skills:** APIs já confirmadas por codebase, Context7 e docs oficiais
**Commit:** `fix(cycle-2): deduplicate scores in blob`

**Execução:** Concluída em `02926d9`; revalidada pelo gate acumulado 94/94 de C2-T5.

#### C2-T5: Reordenar idempotência, throttle e falha parcial na rota

**O que:** integrar status/ledger antes do throttle, propagar owner token e responder sucesso após Blob confirmado mesmo se complete falhar.
**Onde:** `app/api/scores/route.ts`, `app/api/__tests__/scores.test.ts`
**Depende de:** C2-T1, C2-T4
**Reutiliza:** adapters e sanitização existentes
**Requisito:** `ESTAB-17` AC3-AC4, AC7; `ESTAB-18` AC2

**Done when:**
- [ ] Redis `completed` e ledger Blob já contendo ID retornam `200`, `storage:"blob"`, `idempotent:true`, zero throttle e zero write.
- [ ] ID novo passa por throttle e claim; token acompanha complete/release.
- [ ] Blob confirmado + complete throw/`ownership-lost` retorna sucesso, não libera claim e retry não duplica.
- [ ] Falha antes de confirmação Blob libera somente com token proprietário e retorna 503.
- [ ] `it.each` cobre `origin:"debug"` e `debug:true` com 400 e zero throttle/claim/Blob.
- [ ] Teste focado, suíte completa, build e lint passam.

**Testes:** integration da Route Handler com adapters mockados
**Gate:** full
**Commit:** `fix(cycle-2): make score post authoritatively idempotent`

**Execução:** Concluída em `5264429`; teste focado 13/13, suíte completa 94/94, build e lint passaram com 2 warnings preexistentes.

### Fase 3 — Cliente e debug

#### C2-T6: Preservar pendência em storage local e falhas diretas

**O que:** classificar resposta persistida e enfileirar submissão própria nova em rede/429/503/storage local.
**Onde:** `app/page.tsx`, `app/__tests__/score-sync.test.tsx`
**Depende de:** C2-T5
**Reutiliza:** `PendingScoreEntry`, enqueue/dedupe e MSW existentes
**Requisito:** `ESTAB-17` AC5-AC6

**Done when:**
- [ ] Envio inicial sem fila cria uma entrada para cada outcome rede, 429, 503 e `200 storage:"local"`.
- [ ] O mesmo `submissionId` aparece no header, na entrada e em tentativas posteriores; nenhum segundo item é criado.
- [ ] Somente `storage:"blob"` ou `idempotent:true` remove/dispensa a pendência.
- [ ] Mensagem de UI permanece coerente com sincronização pendente.
- [ ] Teste focado e `npm run test` passam.

**Testes:** RTL + MSW parametrizado
**Gate:** quick
**Commit:** `fix(cycle-2): retain unpersisted score submissions`

**Execução:** Concluída em `2237aa5`; teste focado 15/15 e suíte completa 97/97 passaram.

#### C2-T7: Provar retry posterior e uma única sequência de timers

**O que:** fechar os gaps de recuperação load/online e isolar o fluxo mínimo de espera/envio que reduz S3776.
**Onde:** `app/page.tsx`, `app/__tests__/score-sync.test.tsx`
**Depende de:** C2-T6
**Reutiliza:** mutex/promise ref, fake timers e fila FIFO
**Requisito:** `ESTAB-10` AC4-AC5; `ESTAB-17` AC6; `ESTAB-18` AC4, AC6/S3776

**Done when:**
- [ ] Após rede/429/503/storage local, novo `online` reenvia a mesma primeira entrada e ID; sucesso posterior a remove.
- [ ] Load + múltiplos online mantêm `maxInFlight === 1` e exatamente uma espera de 10 s entre duas entradas.
- [ ] Fila vazia não agenda espera; falha encerra a sequência corrente.
- [ ] A extração permanece limitada a helpers do drain e Sonar não reporta S3776 no local apontado.
- [ ] Teste focado e `npm run test` passam.

**Testes:** RTL/MSW + fake timers
**Gate:** quick; confirmação Sonar na fase 4
**Commit:** `fix(cycle-2): prove deterministic score retries`

**Execução:** Concluída em `8387056`; teste focado 16/16 e suíte completa 98/98 passaram.

#### C2-T8: Fechar evidências de isolamento e restart do debug

**O que:** ampliar somente as provas faltantes de side effects e retorno de elegibilidade após nova run normal.
**Onde:** `app/__tests__/game-debug.test.tsx`, `app/__tests__/score-sync.test.tsx`; `app/page.tsx` somente se a prova revelar violação do AC
**Depende de:** C2-T7
**Reutiliza:** status observável de entidades, ações acessíveis, MSW e fluxo normal aprovado no ciclo 1
**Requisito:** `ESTAB-06` AC3; `ESTAB-07` AC1-AC2; `ESTAB-18` AC1, AC3

**Done when:**
- [ ] Evento production e action inválida preservam conjuntamente heading/HUD, boss/power-up, zero POST e ambas as chaves de storage.
- [ ] Run debug encerrada produz zero POST/fila; nova run normal produz exatamente um POST elegível com novo ID e outcome normal determinístico `over`.
- [ ] Nenhum hook/cheat de teste é criado e as asserções existentes não são enfraquecidas.
- [ ] Testes focados, suíte completa, build e lint passam.

**Testes:** RTL + MSW, queries por role/texto
**Gate:** full
**Commit:** `fix(cycle-2): prove debug run isolation`

**Execução:** Concluída em `a7965e0`; testes focados 25/25, suíte completa 98/98, build e lint passaram com 2 warnings preexistentes.

### Fase 4 — Sonar e mobile

#### C2-T9: Consolidar branches equivalentes do dispatcher debug

**O que:** eliminar somente a duplicação de branches que chamam `start()` sem mudar actions ou transições.
**Onde:** `app/page.tsx`, `app/__tests__/game-debug.test.tsx`
**Depende de:** C2-T8
**Reutiliza:** testes discriminantes de boss, power-up, reset e vitória
**Requisito:** `ESTAB-18` AC6/S1871

**Done when:**
- [ ] `spawn_boss`, `add_powerup` e `reset` preservam exatamente seus outcomes anteriores.
- [ ] Branches com corpo `start()` equivalente são consolidados e S1871 deixa de existir no local novo.
- [ ] Teste focado e `npm run test` passam.

**Testes:** RTL regressão debug
**Gate:** quick; confirmação Sonar no fechamento
**Commit:** `fix(cycle-2): consolidate debug start branches`

**Execução:** Concluída em `a52a00c`; teste focado 10/10 e suíte completa 99/99 passaram.

#### C2-T10: Tornar a allowlist debug um ReadonlySet

**O que:** substituir lookup por array/includes por `ReadonlySet<DebugAction>`/`has` sem alterar valores aceitos.
**Onde:** `lib/debug.ts`, `lib/__tests__/debug.test.ts`
**Depende de:** C2-T9
**Reutiliza:** type guard e casos positivos/negativos existentes
**Requisito:** `ESTAB-18` AC6/S7776

**Done when:**
- [ ] A allowlist contém exatamente as actions vigentes e usa `.has()`.
- [ ] Valores válidos/ inválidos e bloqueio em production preservam outcomes.
- [ ] S7776 deixa de existir no local novo; teste focado e `npm run test` passam.

**Testes:** unit
**Gate:** quick; confirmação Sonar no fechamento
**Commit:** `fix(cycle-2): use set for debug actions`

**Execução:** Concluída em `b5db3a7`; teste focado 20/20 e suíte completa 99/99 passaram.

#### C2-T11: Tornar o E2E 100dvh discriminante e fechar Quality Gate

**O que:** variar a altura do viewport nas duas páginas legais e executar os gates finais com LCOV/Sonar fresco.
**Onde:** `e2e/legal-pages-mobile.spec.ts`; nenhum arquivo de produção salvo se o comportamento já estiver correto
**Depende de:** C2-T10
**Reutiliza:** configuração Playwright, `.legal-shell`, coverage e scanner existentes
**Requisito:** `ESTAB-13` AC1; `ESTAB-18` AC5-AC6

**Done when:**
- [ ] Cada rota é validada em duas alturas distintas e `min-height` acompanha `window.innerHeight` após resize.
- [ ] Em ambas as alturas, overflow/scroll e último link focável permanecem visíveis; valor fixo 844 px faria o teste falhar.
- [ ] `npm run test`, `npm run test:coverage`, build, lint e E2E passam sem redução da contagem de testes.
- [ ] Sonar fresco no HEAD importa LCOV, não encontra S3776/S1871/S7776 nas linhas novas e retorna Quality Gate `OK` para new code.
- [ ] JaCoCo é registrado como N/A para TypeScript; dívida histórica fora do diff é reportada sem fix.

**Testes:** Playwright E2E + gates completos + análise estática
**Gate:** full + coverage + E2E + Sonar
**Commit:** `fix(cycle-2): verify dynamic viewport quality gate`

**Execução:** Concluída em `7fc3c20`; suíte e coverage 99/99, build, lint e E2E 2/2 passaram. Sonar no HEAD retornou Quality Gate `OK`, cobertura nova 89,3%, total 67,0%, duplicação 0,4% e zero issues novas; `S3776`, `S1871` e `S7776` resolvidas. JaCoCo N/A para TypeScript; 22 vulnerabilidades históricas permanecem fora do diff.

### Dependências e batching sugerido

```text
C2-T1 → C2-T2 → C2-T3 → C2-T4 → C2-T5
      → C2-T6 → C2-T7 → C2-T8 → C2-T9 → C2-T10 → C2-T11
```

- **Batch 1:** fases 1-2 inteiras, C2-T1 a C2-T5 — 5 tasks.
- **Batch 2:** fases 3-4 inteiras, C2-T6 a C2-T11 — 6 tasks.
- Lotes estritamente sequenciais; nenhuma fase é partida e não existe lote-cauda de 1-2 tasks.
- Cada worker executa tasks na ordem, roda o gate definido e cria um commit atômico por task; workers não abrem subagentes.

### Rastreabilidade requirement → tasks

| Requirement | Tasks |
| --- | --- |
| `ESTAB-06` | C2-T8 |
| `ESTAB-07` | C2-T5, C2-T8 |
| `ESTAB-09` | C2-T5, C2-T6 |
| `ESTAB-10` | C2-T6, C2-T7 |
| `ESTAB-13` | C2-T11 |
| `ESTAB-16` | C2-T1, C2-T2 |
| `ESTAB-17` | C2-T3, C2-T4, C2-T5, C2-T6, C2-T7 |
| `ESTAB-18` | C2-T5, C2-T7, C2-T8, C2-T9, C2-T10, C2-T11 |

**Coverage:** 3/3 requisitos novos e 5/5 requisitos anteriores reabertos estão mapeados; 0 não mapeados.

### Validação independente pós-Execute

Após C2-T11, um Verifier autor diferente SHALL rederivar evidência por AC, executar gates e sensor de discriminação em scratch, preservar o histórico append-only de `validation.md` e registrar a seção do ciclo 2. Em seguida, `/code-review` roda read-only na mesma branch, incluindo o revisor Sonar; JaCoCo permanece N/A para TypeScript. Gaps categoria (a) entram no próximo fix cycle dentro do limite de três; gap categoria (b) ou `SPEC_DEVIATION` interrompe a execução para decisão do usuário; categoria (c) volta apenas para Questões abertas.

### Categoria (c) preservada, sem tasks

- Parse/limite de body antes do throttle; otimização O(N²) da fila; redução extra de round trips Redis.
- Cobertura adicional não exigida pelos ACs; extração de `Home`/sync; foco do diálogo; migração de mock fetch; ordenação compartilhada.
- Limpeza do `Map` local, uso/remoção de `HighScoreStorage` e qualquer refactor histórico fora das linhas necessárias ao Quality Gate de new code.

**Contagem final do ciclo 2:** 11 fix tasks pendentes em 4 fases inteiras (2 + 3 + 3 + 3), sugeridas em 2 batches sequenciais (5 + 6).

## Fechamento do ciclo 2 — Verifier e code review

- **HEAD validado:** `7fc3c20cd8511de387c4e7bb4eccf286ada9fa7e`.
- **Verifier:** FAIL, 57/60 ACs; Vitest 99/99, E2E 2/2, sensor 3/3.
- **Sonar/LCOV:** Quality Gate `OK`, cobertura nova 89,3%, cobertura total 67,0%, zero issues/hotspots novos, duplicação nova 0%; JaCoCo N/A para TypeScript.

### Achados categoria (a) — fix tasks após decisão dos gaps

1. Tornar `ownerToken` obrigatório no contrato de `complete`/`release` de `score-idempotency` e ajustar consumidores/testes (`ESTAB-16`).
2. Provar em Redis que `release` do owner antigo retorna `ownership-lost` e preserva integralmente o claim do owner novo (`ESTAB-16` AC2-AC3).
3. Tornar discriminante o teste de retry CAS, afirmando o ETag renovado em `ifMatch` (`ESTAB-17`).
4. Restaurar teste real da rota sem `BLOB_READ_WRITE_TOKEN`, com resposta amigável e sem exceção não tratada (P2 API AC1).

### Questões abertas — categoria (b), execução interrompida

1. A spec não define política de preflight antiabuso antes da leitura autoritativa do Blob. IDs rotativos podem causar leituras privadas antes do throttle; é necessário decidir ordem, limite e eventual reutilização do snapshot.
2. A spec exige ledger autoritativo com TTL de 24 h, mas não define limite de cardinalidade ou particionamento de `processedSubmissions`; é necessário decidir capacidade máxima e estratégia quando o limite for atingido.

### Questões abertas — categoria (c), sem implementação

- Separar leitura pública cacheável da leitura consistente do Blob.
- Remover estados legados do contrato de idempotência além do estritamente necessário para tornar `ownerToken` obrigatório.

**Decisão de execução:** STOP antes do ciclo 3 por existência de achados categoria (b). Nenhuma correção, teste ou gate do ciclo 3 foi iniciado.

## Ciclo Interno 3 — Remediação Final de Estabilidade

**Spec vigente:** `_docs/specs/features/estabilidade-qualidade/spec.md` (`ESTAB-19` e `ESTAB-20`), Specify `29fa03370e617417b19a00fea006ebcf2948c1c4`
**Design vigente:** `_docs/specs/features/estabilidade-qualidade/design.md` — “Emenda de Design — Ciclo Interno 3”, Design `19e2291`
**Baseline de execução:** `7fc3c20cd8511de387c4e7bb4eccf286ada9fa7e`, 99/99 Vitest e 2/2 Playwright
**Status:** pronto para Execute sequencial; nenhuma task C3 implementada
**Escopo:** achados categoria (a) do Verifier do ciclo 2 + `ESTAB-19`/`ESTAB-20`; nenhum refactor categoria (c)

### Protocolo e batching

- Executar com a skill `tlc-spec-driven`, uma task por vez, na ordem abaixo; teste e implementação permanecem no mesmo commit.
- Preservar e fortalecer todos os testes existentes. Antes/depois de cada task, registrar a contagem; a contagem final SHALL ser maior que a anterior e nunca menor que o baseline acumulado.
- A feature é **PEQUENA**: as três fases inteiras e consecutivas formam **um único batch de 6 tasks**, executado por um único worker. Nunca distribuir um worker por task e não abrir subagentes dentro do batch.
- Cada task gera exatamente um commit `fix(cycle-3): ...`. O Verifier autor diferente roda somente depois do commit de C3-T6 e não integra o batch de implementação.
- Qualquer `SPEC_DEVIATION`, contrato externo incompatível ou necessidade de refactor categoria (c) interrompe o batch antes de commit da task afetada.

### Matriz de cobertura do ciclo 3

> Diretrizes: `AGENTS.md`, `.agents/skills/testing-a11y/SKILL.md`, `package.json`, `vitest.config.ts`, `playwright.config.ts`, `sonar-project.properties` e `_docs/sonarqube-local.md`. Testes amostrados em `lib/__tests__`, `app/api/__tests__`, `app/__tests__` e `e2e`.

| Camada | Tipo exigido | Expectativa de cobertura | Localização | Comando |
| --- | --- | --- | --- | --- |
| Ownership/preflight Redis e local | unit | Todos os branches e fronteiras; 1:1 com `ESTAB-16`/`ESTAB-19`, incluindo Lua observável, TTL e fail-closed | `lib/__tests__/*.test.ts` | `npm run test` |
| Codec, seleção e persistência dos shards/ranking | unit do boundary Blob | `ESTAB-17`/`ESTAB-20` completos: compatibilidade, 64 shards, TTL exato, CAS, concorrência, retries e falha parcial | `lib/__tests__/high-scores.test.ts` | `npm run test` |
| Route Handler `/api/scores` | integration | Ordem completa do POST, happy/edge/error paths, zero side effects em rejeição e ausência real do token Blob | `app/api/__tests__/scores.test.ts` | `npm run test` |
| Regressão de UI/mobile | unit + E2E existentes | Nenhuma regressão ou redução dos testes dos ciclos anteriores | `app/**/*.test.{ts,tsx}`, `e2e/*.spec.ts` | `npm run test && npm run test:e2e` |
| Qualidade estática/cobertura | coverage + build + static | LCOV fresco, build/lint verdes, Quality Gate `OK` e zero issue nova | projeto + Sonar | `npm run test:coverage && npm run build && npm run lint` + análise Sonar fresca |

### Gates do ciclo 3

| Gate | Quando | Comando / evidência obrigatória |
| --- | --- | --- |
| quick | Após C3-T1 a C3-T4 | teste focado da camada + `npm run test`; contagem registrada e monotônica |
| full | Após C3-T5 | `npm run test && npm run build && npm run lint`; sem enfraquecer/remover testes |
| final | C3-T6 | `npm run test`, `npm run test:coverage`, `npm run build`, `npm run lint`, `npm run test:e2e`, LCOV não vazio e análise Sonar fresca no HEAD |
| verifier | Depois de C3-T6, autor diferente | check spec-anchored dos 75 ACs + sensor em scratch; Quality Gate `OK`; nenhuma mutação persistida |

### Plano de fases

```text
Fase 1 — Ownership e preflight:    C3-T1 → C3-T2
Fase 2 — Ledger particionado:      C3-T3 → C3-T4
Fase 3 — Rota e fechamento:        C3-T5 → C3-T6
Validação independente posterior:  Verifier → sensor discriminante → validation.md
```

### Fase 1 — Ownership e preflight

#### C3-T1: Tornar ownerToken obrigatório e fechar release Redis

**O que:** remover os contratos legados/opcionais de ownership e tornar `complete`/`release` obrigatoriamente condicionais ao token, com prova Redis do owner antigo.
**Onde:** `lib/score-idempotency.ts`, `lib/__tests__/score-idempotency.test.ts`; consumidores somente para corrigir a assinatura obrigatória
**Depende de:** nenhuma
**Reutiliza:** `OwnershipResult`, scripts Lua CAS/delete, TTLs `60`/`86400`, Redis fake e relógio local existentes
**Requisito:** `ESTAB-16` AC1-AC5

**Done when:**
- [ ] `IdempotencyStore.complete` e `release` exigem `ownerToken: string`; `IdempotencyClaim` não aceita o union legado `"claimed"` sem token.
- [ ] Todos os consumidores passam o token obtido no claim; nenhum fallback cria token implícito ou libera sem ownership.
- [ ] O teste Redis executa o caminho de `release` com owner antigo, exige retorno Lua `0` mapeado para `ownership-lost` e prova que o valor integral `in-flight:<new-owner>` permanece intacto.
- [ ] Complete/release do owner atual continuam `applied`, com TTL 60 s do claim e 24 h de completed preservados.
- [ ] Teste focado e `npm run test` passam; contagem cresce sobre o baseline anterior sem remoção, skip ou enfraquecimento.

**Testes:** unit do adapter Redis/local, incluindo script/outcome e preservação byte a byte do claim novo
**Gate:** quick
**Commit:** `fix(cycle-3): require idempotency owner token`

#### C3-T2: Implementar preflight antiabuso atômico 60/60

**O que:** criar o `AbusePreflightStore` Redis/local com janela fixa atômica de 60 requisições em 60 segundos, TTL restante e falha fechada em produção.
**Onde:** `lib/score-abuse-preflight.ts`, `lib/__tests__/score-abuse-preflight.test.ts`
**Depende de:** C3-T1
**Reutiliza:** factory/env/logger/injeção Redis e `hashRateLimitIdentifier` de `lib/score-rate-limit.ts`; padrão de `eval` de `lib/score-idempotency.ts`
**Requisito:** `ESTAB-19` AC2-AC5, AC7

**Done when:**
- [ ] Um único Lua abre a chave `score:abuse:<sha256-ip>` com contador 1 e TTL 60.000 ms, permite/incrementa 1–60 e bloqueia 61+ sem escrever nem renovar a janela.
- [ ] A decisão bloqueada devolve `retryAfterMs` do `PTTL` lido atomicamente; TTL ausente/inválido ou resultado Lua malformado é erro, nunca permissão silenciosa.
- [ ] Store local injetável replica 1ª/60ª/61ª, TTL decrescente, fronteira `now >= expiresAt` e backend `local-memory`, com relógio controlável.
- [ ] Credenciais/factory/Redis indisponíveis em production lançam outcome fail-closed; logs não contêm IP, hash completo, payload, token ou conteúdo de store.
- [ ] Testes parametrizados discriminam Redis/local e provam janela nova após 60 s; teste focado e `npm run test` passam com contagem monotônica.

**Testes:** unit dos stores Redis/local, Lua observável, fake clock, TTL e erros de configuração/serviço
**Gate:** quick
**Commit:** `fix(cycle-3): add atomic abuse preflight`

### Fase 2 — Ledger particionado

#### C3-T3: Introduzir modelo e seleção determinística dos 64 shards

**O que:** separar o ledger do ranking em `LedgerShardV1`, selecionar um único shard pelos seis bits superiores do SHA-256 e preservar os contratos legado e público.
**Onde:** `lib/high-scores.ts`, `lib/__tests__/high-scores.test.ts`
**Depende de:** C3-T2
**Reutiliza:** `StoredHighScore`, codec de array legado/`RankingDocumentV2`, `sanitizeScore`, `cleanScores`, `publicHighScores` e path Blob vigente
**Requisito:** `ESTAB-17` AC1, AC3; `ESTAB-20` AC1-AC2, AC8

**Done when:**
- [ ] `ledgerShardIndex` usa SHA-256 dos bytes UTF-8 do `submissionId.trim()`, preserva caixa/caracteres e retorna sempre `0..63`; vetores fixos provam determinismo e limites.
- [ ] Paths estáveis usam índice decimal `00..63`; lookup de um ID lê exatamente o shard selecionado e nunca varre os demais.
- [ ] `LedgerEntryV1` guarda `submissionId`, `persistedAt`, `score?` e source; `LedgerShardV1` guarda `version`, `shard`, `legacyImported` e entries.
- [ ] Array legado e `RankingDocumentV2` continuam decodificáveis; importação lazy filtra somente IDs ativos pertencentes ao shard e não inventa score para entrada legacy sem score.
- [ ] Ranking interno conserva `submissionId` necessário ao recovery, mas GET/POST público seguem `HighScore[]` saneado/ordenado/limitado sem ID, shard, timestamp, ETag ou ledger.
- [ ] Teste focado e `npm run test` passam com contagem monotônica e sem remover as provas de compatibilidade existentes.

**Testes:** unit de hashing/path/modelo, codec dual, importação por shard e projeção pública
**Gate:** quick
**Commit:** `fix(cycle-3): partition authoritative score ledger`

#### C3-T4: Implementar CAS, retenção exata e recovery por shard

**O que:** implementar leitura/escrita CAS independente por shard, TTL lógico exato, cleanup lazy e intenção shard-first recuperável antes do ranking.
**Onde:** `lib/high-scores.ts`, `lib/__tests__/high-scores.test.ts`
**Depende de:** C3-T3
**Reutiliza:** `get(..., { useCache:false })`, ETag, `put`, `BlobPreconditionFailedError`, merge e limite de três tentativas do ranking
**Requisito:** `ESTAB-17` AC2-AC4; `ESTAB-20` AC3-AC7

**Done when:**
- [ ] Entrada é ativa somente em `now < persistedAt + 86_400_000`; na igualdade/depois, lookup a ignora sem renovar `persistedAt`.
- [ ] Leitura exclui expirados da visão autoritativa e a próxima escrita CAS bem-sucedida do shard tocado os remove fisicamente, sem varredura global nem alteração de scores válidos.
- [ ] Criação usa `allowOverwrite:false`; update usa `ifMatch` da leitura sem cache. Conflito relê o mesmo shard, reaplica expiração/merge e limita cada operação a três tentativas.
- [ ] Teste discriminante exige `ifMatch:"etag-2"` após releitura e falha se shard ou ranking reutilizar `etag-1`.
- [ ] Writers do mesmo ID produzem uma entrada; IDs diferentes no mesmo shard são preservados ou retornam falha retryable após o limite, sem declarar persistência.
- [ ] Intenção com score confirma no shard antes de qualquer write do ranking; falha do ranking mantém a intenção e retry executa `ensureRankingEffect` sem duplicar, enquanto falha do shard toca zero ranking.
- [ ] Teste focado e `npm run test` passam com contagem monotônica, cobrindo concorrência, partial failure e recovery.

**Testes:** unit do boundary Blob com fake clock, conflitos CAS, ETag fresca, TTL/cleanup, concorrência e falhas parciais
**Gate:** quick
**Commit:** `fix(cycle-3): enforce shard cas retention`

### Fase 3 — Rota e fechamento

#### C3-T5: Integrar preflight e shard-first na rota de scores

**O que:** reordenar `POST /api/scores` para consumir preflight antes de qualquer store/Blob e integrar status-hint, shard, throttle, claim, intenção, ranking e complete conforme o design.
**Onde:** `app/api/scores/route.ts`, `app/api/__tests__/scores.test.ts`
**Depende de:** C3-T4
**Reutiliza:** validações debug/Idempotency-Key, resolução de IP, contratos 429/503, throttle funcional, adapters e sanitização existentes
**Requisito:** P2 API AC1; `ESTAB-16` AC2-AC4; `ESTAB-17` AC3-AC4, AC7; `ESTAB-19` AC1, AC3-AC7; `ESTAB-20` AC2, AC6-AC8

**Done when:**
- [ ] Após validações vigentes, preflight é a primeira dependência: bloqueio 61+ retorna 429 com mensagem exata, `retryAfterMs` do TTL e `Retry-After` arredondado para cima; erro production retorna 503 amigável.
- [ ] Em 429/503 do preflight há zero status/claim Redis, zero throttle funcional e zero leitura/escrita de shard ou ranking; duplicata/ID rotativo consome preflight antes de fast path.
- [ ] Após aprovação, somente shard ativo autoriza idempotência; Redis completed é hint. Shard ausente/expirado segue throttle 10 s, claim obrigatório, releitura do shard e intenção shard-first.
- [ ] Fast path de shard executa `ensureRankingEffect` antes de 200 e não consome throttle funcional; ID novo só escreve ranking depois da confirmação do shard.
- [ ] Falha do ranking mantém intenção e libera apenas com owner atual; ranking confirmado + complete throw/`ownership-lost` responde 201/200 sem release, e retry pelo shard não duplica.
- [ ] Teste real remove e restaura `BLOB_READ_WRITE_TOKEN`, não mocka outcome Blob e prova resposta amigável sem exceção não tratada, sem sucesso autoritativo falso e com pendência retryable preservável pelo contrato.
- [ ] Testes de integração cobrem ordem, 1ª/60ª/61ª, TTL/header, duplicate-before-throttle, produção fail-closed, concorrência e partial failure; `npm run test`, build e lint passam com contagem monotônica.

**Testes:** integration da Route Handler; adapters observáveis para ordem/zero side effects e cenário real de env Blob ausente
**Gate:** full
**Commit:** `fix(cycle-3): order score post preflight`

#### C3-T6: Fechar gates e Quality Gate do ciclo 3

**O que:** executar o gate completo fresco no HEAD, registrar evidência reproduzível e bloquear o fechamento se houver regressão, cobertura ausente ou Quality Gate não verde.
**Onde:** `_docs/specs/features/estabilidade-qualidade/tasks.md` somente para registrar execução/evidências; qualquer correção de código/testes exige replanejamento e não integra este commit
**Depende de:** C3-T5
**Reutiliza:** scripts de `package.json`, `vitest.config.ts`, `playwright.config.ts`, `sonar-project.properties` e procedimento `_docs/sonarqube-local.md`
**Requisito:** `ESTAB-17` AC1-AC7; `ESTAB-19` AC1-AC7; `ESTAB-20` AC1-AC8; preservação de `ESTAB-18` AC5-AC6 e P2 API AC1

**Done when:**
- [ ] `npm run test` e `npm run test:coverage` passam sem skips/deleções; contagem final é maior que 99 e `coverage/lcov.info` é fresco e não vazio.
- [ ] As regressões de `ESTAB-17` AC5-AC6 continuam provando que `storage:"local"`, rede, 429 e 503 preservam/reenviam a mesma pendência e o mesmo `submissionId`.
- [ ] `npm run build`, `npm run lint` e `npm run test:e2e` passam; qualquer warning preexistente é identificado sem ser mascarado.
- [ ] Análise Sonar fresca aponta para o commit C3-T6, importa LCOV, retorna Quality Gate `OK`, cobertura nova `>=80%`, duplicação nova `<=3%` e zero issues/hotspots novos.
- [ ] Evidência registra comandos, contagens, revisão Sonar, métricas e JaCoCo como N/A para TypeScript; dívida histórica fora do diff não gera refactor categoria (c).
- [ ] `git diff --check` passa e o commit contém somente a evidência/ajuste estritamente necessário desta task; falha de gate interrompe o fechamento.

**Testes:** suíte Vitest completa + coverage + Playwright existente + análise estática; nenhum teste separado ou enfraquecido
**Gate:** final
**Commit:** `fix(cycle-3): verify final stability quality`

### Dependências e batch único

```text
C3-T1 → C3-T2 → C3-T3 → C3-T4 → C3-T5 → C3-T6
```

- **Batch único:** fases 1–3 inteiras, C3-T1 a C3-T6 — 6 tasks.
- Execução estritamente sequencial pelo mesmo worker, com um commit por task e sem workers/subagentes por task.
- O batch termina no commit C3-T6; só então o coordenador aciona um Verifier independente.

### Rastreabilidade requirement → tasks

| Requirement | Tasks |
| --- | --- |
| P2 API AC1 | C3-T5, C3-T6 |
| `ESTAB-16` | C3-T1, C3-T5 |
| `ESTAB-17` | C3-T3, C3-T4, C3-T5, C3-T6 |
| `ESTAB-19` | C3-T2, C3-T5, C3-T6 |
| `ESTAB-20` | C3-T3, C3-T4, C3-T5, C3-T6 |

**Coverage:** `ESTAB-16`, `ESTAB-17`, `ESTAB-19`, `ESTAB-20` e P2 API AC1 estão mapeados; 0 requisitos do ciclo sem task.

### Validação de granularidade

| Task | Entrega atômica | Status |
| --- | --- | --- |
| C3-T1 | contrato de ownership + prova do mesmo adapter | OK |
| C3-T2 | um novo store preflight + testes co-localizados | OK |
| C3-T3 | modelo/seleção/compatibilidade do ledger | OK |
| C3-T4 | boundary de persistência CAS/recovery do ledger | OK |
| C3-T5 | uma Route Handler integrada + testes da rota | OK |
| C3-T6 | evidência única de fechamento dos gates | OK |

### Cruzamento diagrama-definição

| Task | Depende de no corpo | Diagrama mostra | Status |
| --- | --- | --- | --- |
| C3-T1 | nenhuma | raiz | Match |
| C3-T2 | C3-T1 | C3-T1 → C3-T2 | Match |
| C3-T3 | C3-T2 | C3-T2 → C3-T3 | Match |
| C3-T4 | C3-T3 | C3-T3 → C3-T4 | Match |
| C3-T5 | C3-T4 | C3-T4 → C3-T5 | Match |
| C3-T6 | C3-T5 | C3-T5 → C3-T6 | Match |

### Validação de co-localização de testes

| Task | Camada | Matriz exige | Task define | Status |
| --- | --- | --- | --- | --- |
| C3-T1 | ownership Redis/local | unit | unit no mesmo commit | OK |
| C3-T2 | preflight Redis/local | unit | unit no mesmo commit | OK |
| C3-T3 | codec/modelo/sharding | unit | unit no mesmo commit | OK |
| C3-T4 | boundary Blob | unit boundary | unit no mesmo commit | OK |
| C3-T5 | Route Handler | integration | integration no mesmo commit | OK |
| C3-T6 | gates transversais | full/static/E2E | suíte completa e análise fresca | OK |

### Verifier independente pós-batch

Depois de C3-T6, um Verifier autor diferente SHALL:

1. Rederivar evidence-or-zero para os 75 ACs vigentes, com foco explícito em `ESTAB-16`, `ESTAB-17`, `ESTAB-19`, `ESTAB-20` e P2 API AC1.
2. Reexecutar Vitest, coverage, build, lint, E2E e Sonar no range do ciclo 3; Quality Gate diferente de `OK` é FAIL.
3. Executar sensor discriminante em scratch, no mínimo para: aceitar release Redis do owner antigo; permitir Blob antes do preflight; reutilizar `etag-1` após releitura; alterar seleção SHA-256/64 shards ou aceitar entrada exatamente em `+24 h`. Cada mutação SHALL ser morta pelos testes correspondentes.
4. Descartar integralmente as mutações, preservar o histórico append-only e registrar PASS/FAIL, evidências, contagens, revisão Sonar e gaps em `_docs/specs/features/estabilidade-qualidade/validation.md`.
5. Classificar qualquer gap como (a), (b) ou (c). `SPEC_DEVIATION` ou gap (b) interrompe sem commit de correção; o loop fix→reverify permanece limitado pela skill.

### Categoria (c) preservada, sem tasks

- Parse/limite de body antes de `request.json()`, separação de leitura pública cacheável e redução adicional de round trips Redis.
- Extração estrutural de `Home`/sincronização, otimização O(N²) da fila, migração geral de mocks fetch, foco do diálogo e ordenação compartilhada.
- Limpeza do `Map` local, remoção de estados/tipos legados além do necessário ao contrato obrigatório e qualquer refactor histórico fora do new code.

**Contagem final do ciclo 3:** 6 fix tasks pendentes em 3 fases inteiras (2 + 2 + 2), empacotadas em 1 batch sequencial (6); Verifier separado após o batch.
