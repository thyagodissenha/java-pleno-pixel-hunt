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

- **Resolvida — T2 / `ESTAB-02` (2026-08-27)**: aprovado incluir `lib/high-scores.ts` no escopo de T2 e exportar `cleanScores` para viabilizar o teste direto exigido pela task.
- **Resolvida — T6 / `ESTAB-03` (2026-08-27)**: aprovado incluir `app/__tests__/game-debug.test.tsx` para verificar o toggle por `F1` e as ações de Boss, Max Estamina e Vitória.
- **Resolvida — T9 / `ESTAB-04` (2026-08-27)**: aprovado throttle de 10 segundos por IP (`x-forwarded-for`, fallback `x-real-ip`), resposta HTTP `429` com `Retry-After` e `{ error, retryAfterMs }`, persistência na chave existente `java-pleno-pixel-hunt-high-scores` e retry no carregamento/evento `online`. Escopo ampliado para API, cliente e respectivos testes.
- **Resolvida — T9 / infraestrutura de testes (2026-08-27)**: aprovado incluir `package.json` e `package-lock.json` no escopo de T9 e instalar `msw` como dependência de desenvolvimento.
- **Resolvida — integridade de teste T6/T9 (2026-08-27)**: aprovado substituir a expectativa intermediária fixa de `81%` por uma verificação de que a estamina não está em `100%`, mantendo a expectativa final exata em `100%`. Correção rastreada em T6-F1.

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
**Status:** Approved para execução sequencial; nenhuma task nova concluída
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

#### C1-T2: Proteger o listener e excluir runs debug do ranking

**O que:** revalidar ambiente/payload no consumidor, marcar a origem da run e impedir POST/enqueue de score debug.
**Onde:** `app/page.tsx`, `app/__tests__/game-debug.test.tsx`, `app/__tests__/score-sync.test.tsx`
**Depende de:** C1-T1
**Reutiliza:** guardas de `lib/debug.ts`, fluxo existente de submit e handlers MSW
**Requisito:** `ESTAB-06`, `ESTAB-07`

**Done when:**
- [ ] Evento forjado em production e detail inválido não alteram estado/HUD/entidades.
- [ ] Qualquer ação debug marca a run até o próximo start/reset normal.
- [ ] Final de run debug não chama POST nem grava `pending-scores`; teste MSW prova zero requests.
- [ ] Mínimo 3 casos novos por comportamento visível/contrato e gate full passa com baseline preservado.

**Testes:** unit/integration RTL + MSW, co-localizados
**Gate:** full
**Tools/Skills:** `testing-a11y`
**Commit:** `fix(cycle-1): exclude debug scores from ranking`

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
