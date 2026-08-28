# Arquitetura e Design: Fase 2 — Estabilidade e Qualidade (ESTAB)

**Spec**: [`_docs/specs/features/estabilidade-qualidade/spec.md`](file:///Volumes/SSD_Externo/repo_personal/java-pleno-pixel-hunt/_docs/specs/features/estabilidade-qualidade/spec.md)
**Status**: Draft

---

## Visão Geral de Arquitetura

O design técnico da Fase 2 visa estabilizar o build, introduzir uma suíte de testes unitários com **Vitest + React Testing Library**, implementar um mecanismo de **Debug/DevTools** em desenvolvimento e proteger os endpoints da API contra estouro de exceção ou spam.

```mermaid
graph TD
    A[Client / UI / Game Arena] -->|Submete High Score| B[API /api/scores]
    B -->|Sanitização & Validation| C[lib/high-scores.ts]
    C -->|Persistência Privada| D[Vercel Blob / Storage Local]

    E[Desenvolvedor em Dev] -->|Teclas F1, F2, F3| F[lib/debug.ts / Debug HUD]
    F -->|Força Spawn / Estado| A

    G[Suíte de Testes Vitest] -->|Testa Regras| C
    G -->|Testa Componentes| H[Pages & Layouts]
```

---

## Análise de Reuso de Código

### Componentes e Módulos Existentes

| Módulo / Arquivo | Localização | Como Utilizar |
| --- | --- | --- |
| `lib/high-scores.ts` | [`lib/high-scores.ts`](file:///Volumes/SSD_Externo/repo_personal/java-pleno-pixel-hunt/lib/high-scores.ts) | Estender com tratamento gracioso quando `BLOB_READ_WRITE_TOKEN` não estiver definido. |
| `lib/adsense.ts` | [`lib/adsense.ts`](file:///Volumes/SSD_Externo/repo_personal/java-pleno-pixel-hunt/lib/adsense.ts) | Ajustar fallback hardcoded para não carregar publisher desnecessariamente. |
| `app/page.tsx` | [`app/page.tsx`](file:///Volumes/SSD_Externo/repo_personal/java-pleno-pixel-hunt/app/page.tsx) | Interceptar eventos de teclado (`F1`/`F2`/`F3`) para acionar o modo Debug em ambiente dev. |
| `app/globals.css` | [`app/globals.css`](file:///Volumes/SSD_Externo/repo_personal/java-pleno-pixel-hunt/app/globals.css) | Refatorar `.legal-shell` de `height: 100dvh` para `min-height: 100dvh`. |

---

## Componentes e Interfaces

### 1. Suíte de Testes Unitários (`vitest.config.ts`)

- **Propósito**: Executar testes de componentes React e funções utilitárias puras.
- **Localização**: `vitest.config.ts`, `lib/__tests__/high-scores.test.ts`, `app/__tests__/pages.test.tsx`
- **Dependências**: `@testing-library/react`, `vitest`, `jsdom`

### 2. Módulo de Debug do Jogo (`lib/debug.ts`)

- **Propósito**: Fornecer atalhos de depuração em desenvolvimento para acionar boss, zerar estamina, conceder power-ups ou ir direto para a vitória.
- **Localização**: [`lib/debug.ts`](file:///Volumes/SSD_Externo/repo_personal/java-pleno-pixel-hunt/lib/debug.ts)
- **Interface**:
  - `isDebugAllowed(): boolean`
  - `triggerDebugAction(action: 'spawn_boss' | 'add_powerup' | 'win_game' | 'reset'): void`

### 3. Proteção e Throttling na API (`app/api/scores/route.ts`)

- **Propósito**: Sanitizar a entrada e aplicar limitação simples de taxa de submissão por IP ou token.
- **Localização**: [`app/api/scores/route.ts`](file:///Volumes/SSD_Externo/repo_personal/java-pleno-pixel-hunt/app/api/scores/route.ts)
- **Estratégia de Erro**: Se `BLOB_READ_WRITE_TOKEN` estiver ausente na Vercel, a API responde `{ scores: [], storage: 'local' }` ao invés de lançar `Error 503`.

---

## Estratégia de Tratamento de Erros

| Cenário de Erro | Tratamento Técnico | Impacto no Usuário |
| --- | --- | --- |
| Vercel Blob indisponível/sem token | API degrada suavemente retornando status 200 com array local ou fallback. | Jogo guarda a pontuação no `localStorage` sem travar a interface. |
| Erro de compilação Turbopack no build | Configuração explicita de fallback para SWC/Vite em `next.config.ts`. | Build contínuo e sem falhas em ambientes CI/CD. |
| Envio massivo de scores via POST | Header de cache + filtro de timestamp simples. | Evita spam no ranking e uso excessivo de cota no Vercel Blob. |

---

## Riscos e Preocupações (Risks & Concerns)

| Preocupação | Localização | Impacto | Mitigação |
| --- | --- | --- | --- |
| Componente monolítico grande | [`app/page.tsx:1-1800`](file:///Volumes/SSD_Externo/repo_personal/java-pleno-pixel-hunt/app/page.tsx#L1-L1800) | Dificuldade para isolar estados e testar partes da UI. | Extrair atalhos de teclado e estado de debug em módulo desacoplado (`lib/debug.ts`). |
| Incompatibilidade de tipos Vitest + Next.js | `tsconfig.json` | Conflito de definições globais entre Jest/Vitest. | Configurar `tsconfig.json` com `types: ["node", "vitest/globals"]`. |

---

## Decisões Técnicas

| Decisão | Escolha | Justificativa |
| --- | --- | --- |
| Framework de Testes | Vitest | Execução ultra-rápida nativa com ESM e TypeScript no Next.js. |
| Ativação do Modo Debug | Apenas `NODE_ENV === 'development'` ou `?debug=1` | Impede uso indevido de cheats por jogadores em ambiente de produção. |

---

## Emenda de Design — Ciclo Interno 1

**Contexto:** `_docs/specs/features/estabilidade-qualidade/context.md`
**Status:** Approved para decomposição em tasks

Esta emenda substitui, apenas para o ciclo interno 1, as decisões anteriores de ativação por query flag, throttle em `Map` e mistura entre ranking local e pendências. O histórico acima permanece como registro do design original.

### Knowledge Verification Chain

| Etapa | Evidência consultada | Conclusão |
| --- | --- | --- |
| Codebase | `app/api/scores/route.ts`, `app/page.tsx`, `lib/debug.ts`, testes atuais e `package.json` | O throttle usa `Map` por processo; ranking e pendências compartilham `java-pleno-pixel-hunt-high-scores`; não existe Playwright nem provider LCOV instalado. |
| Docs do projeto | `README.md`, `AGENTS.md`, `sonar-project.properties`, Next.js 16 local `route-handlers.md` e `STATE.md` | A rota usa Web `Request`/`Response`, o deploy é Vercel, Blob persiste ranking e Sonar já aponta `coverage/lcov.info`. Nenhuma AD ativa impõe tecnologia de rate limit. |
| Context7 | Upstash Redis docs, integração Vercel e SDK TypeScript | `@upstash/redis` é REST-based e adequado a serverless; `Redis.fromEnv()` usa `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`; `redis.set(key, value, { nx: true, ex: 10 })` fornece aquisição atômica com expiração. |

### Decisão tecnológica pesquisada

| Item | Escolha | Contrato verificado |
| --- | --- | --- |
| Dependência | `@upstash/redis` | SDK REST para funções serverless/edge; adicionar como dependency de runtime. |
| Inicialização | `Redis.fromEnv()` | Documentado pelo SDK para carregar credenciais do ambiente. |
| Variáveis obrigatórias | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Configuradas server-side na integração Upstash/Vercel; nunca expostas com prefixo `NEXT_PUBLIC_`. |
| Aquisição do throttle | `redis.set(rateKey, "1", { nx: true, ex: 10 })` | Uma única operação Redis: valor truthy permite; retorno falsy indica janela já adquirida. A tentativa bloqueada não regrava nem renova a chave. |
| Fallback produção | Fail-closed | Credencial ausente, erro ou timeout Redis retorna `503`; `addHighScore` não é chamado e o cliente conserva a fila. |
| Fallback development/test | Store em memória injetável | Mantém o contrato de 10 segundos para execução local, mas deve ser identificado como `local-memory` e nunca usado em produção. |

Não foi encontrada documentação Context7 que defina um comportamento automático de fallback do SDK em falha. Por isso o fallback é responsabilidade explícita da aplicação, sem atribuir ao SDK uma API ou garantia não documentada.

### Arquitetura

```mermaid
flowchart LR
    A[Run normal] --> B[Submit próprio]
    D[Ação debug dev] --> E[Run marcada debug]
    E --> F[Não submeter]
    B --> G[Fila pending-scores]
    G --> H[Drain único FIFO load/online]
    H -->|Idempotency-Key| I[POST /api/scores]
    I --> J[RateLimitStore Redis SET NX EX 10]
    J --> K[IdempotencyStore 24h]
    K --> L[Sanitize + Vercel Blob]
    L -->|sucesso| M[Remover item da fila]
    I -->|429/503/rede| N[Manter item e parar drain]
```

O endpoint continua sendo um Route Handler Node/Next.js e preserva `addHighScore`, `readHighScores`, `sanitizeScore` e `cleanScores`. O Redis coordena somente throttle e idempotência; Vercel Blob continua sendo a fonte do ranking global.

### Componentes e interfaces

#### Guardas de debug

- **Localização:** `lib/debug.ts`, integração em `app/page.tsx`.
- **Interfaces:**
  - `isDebugAllowed(): boolean` — `true` somente em development.
  - `isDebugAction(value: unknown): value is DebugAction` — valida payload pela allowlist canônica.
  - `triggerDebugAction(action: DebugAction): void` — não despacha fora de development.
- **Listener:** reexecuta as duas guardas antes de alterar estado. A primeira ação aplicada marca `runOriginRef` como `debug`; `start()`/reset de nova run restaura `normal`.
- **Ranking:** o fluxo de salvar encerra antes de POST/enqueue quando `runOriginRef === "debug"`; a rota rejeita payload com marcador debug como defesa contratual adicional.

#### RateLimitStore

- **Localização proposta:** `lib/score-rate-limit.ts`.
- **Interfaces:**
  - `acquire(ip: string): Promise<{ allowed: boolean; retryAfterMs: number; backend: "redis" | "local-memory" }>`.
  - `hashRateLimitIdentifier(ip: string): string` — deriva chave estável sem persistir IP em claro.
- **Implementação produção:** instancia `Redis.fromEnv()` somente no servidor e usa `SET NX EX 10` na chave `score:rate:<sha256-ip>`.
- **Implementação local:** store injetável por teste; relógio controlável e TTL equivalente.
- **Observabilidade:** registra backend e classe do erro, sem IP/chave completa/payload.

#### IdempotencyStore

- **Localização proposta:** `lib/score-idempotency.ts` ou co-localizado ao rate store se permanecer um único adaptador Redis.
- **Interfaces:**
  - `claim(submissionId: string): Promise<"claimed" | "completed" | "in-flight">`.
  - `complete(submissionId: string): Promise<void>` — mantém marcador concluído por 24 horas.
  - `release(submissionId: string): Promise<void>` — libera claim não concluído após falha de persistência.
- **Ordenação:** throttle → claim idempotente → sanitização/persistência → complete. Duplicata `completed` retorna sucesso sem novo Blob write; `in-flight` retorna resposta transitória sem duplicar.
- **Pesquisa adicional de implementação:** antes de codificar `claim/complete/release`, confirmar no Context7 os comandos condicionais exatos do SDK; este design não inventa chamada para o contrato abstrato.

#### PendingScoreQueue

- **Localização:** helpers co-localizados em `app/page.tsx`; não extrair toda a sincronização de `Home` neste ciclo, preservando a questão categoria (c).
- **Storage key:** `java-pleno-pixel-hunt-pending-scores`.
- **Interfaces:**
  - `loadPendingScores(): PendingScoreEntry[]` — valida versão e campos; descarta somente entradas estruturalmente inválidas.
  - `enqueuePendingScore(entry): void` — dedupe por `submissionId`.
  - `updatePendingScoreAttempt(submissionId, attemptedAt): void`.
  - `removePendingScore(submissionId): void` — somente após sucesso persistido/idempotente.
  - `drainPendingScores(trigger: "load" | "online"): Promise<void>` — mutex lógico, FIFO e um POST em voo.
- **Timer:** calcula o início do próximo POST a partir do início anterior e aguarda o restante de 10 segundos; nenhuma espera ocorre depois que a fila esvazia.

#### Contrato da API e qualidade

- `GET /api/scores` passa cada entrada por `sanitizeScore` e o conjunto por `cleanScores` antes de responder.
- `POST /api/scores` mantém sanitização antes da persistência, recebe `Idempotency-Key` e rejeita payload debug.
- O painel usa `<dialog open>` com nome acessível e `onClose`; o componente continua condicional para não deixar diálogo invisível montado.
- Playwright adiciona configuração mobile e um spec para `/privacidade` e `/sobre`, verificando estilo computado, scroll e último elemento focável.
- LCOV usa provider Vitest compatível e de mesma versão da instalação (`@vitest/coverage-v8`), reporter `lcov` e script `test:coverage`; `sonar-project.properties` já aponta para `coverage/lcov.info`.

### Modelos de dados

```typescript
type RunOrigin = "normal" | "debug";

interface PendingScoreEntry {
  version: 1;
  submissionId: string;
  score: HighScore;
  enqueuedAt: string;
  attempts: number;
  lastAttemptAt: string | null;
}

interface RateLimitDecision {
  allowed: boolean;
  retryAfterMs: 10_000;
  backend: "redis" | "local-memory";
}

type IdempotencyClaim = "claimed" | "completed" | "in-flight";
```

`submissionId` é criado uma única vez no ato da submissão própria e permanece estável. A fila é FIFO por `enqueuedAt`; empate preserva a ordem do array armazenado. O header `Idempotency-Key` deve ser idêntico ao `submissionId`.

### Tratamento de erros

| Cenário | Resposta/estado | Continuação |
| --- | --- | --- |
| Debug em produção, query ou evento forjado | Ignorar sem side effect | Run/ranking permanecem normais. |
| Payload debug no POST | `400` ou `403` contratual, sem persistência | Não entra em fila como score elegível. |
| Redis ausente/indisponível em produção | `503`, sem Blob write | Cliente mantém item e encerra drain. |
| Janela Redis já adquirida | `429`, `Retry-After: 10`, payload exato da spec | Cliente mantém item e encerra drain. |
| Idempotência concluída | Sucesso idempotente, sem novo Blob write | Cliente remove item correspondente. |
| Claim em voo | Resposta transitória, sem persistência duplicada | Cliente mantém item. |
| Blob falha depois do claim | Release do claim; resposta não persistida | Cliente mantém item para retry. |
| Fila local corrompida parcialmente | Manter entradas válidas; ignorar inválidas | Registrar quantidade, nunca payload. |
| Novo `online` durante drain | Reusar promise/mutex existente | Nenhum POST/timer adicional. |

### Riscos e preocupações

| Preocupação | Localização | Impacto | Mitigação |
| --- | --- | --- | --- |
| Listener aceita `CustomEvent` sem revalidar ambiente/payload | `app/page.tsx` / `lib/debug.ts` | Cheats e estado inválido | Guardas no dispatcher e no consumidor; testes de produção e payload inválido. |
| Entidade boss não é observável pelos testes | `app/page.tsx` / `game-debug.test.tsx` | Mutante de spawn sobrevive | Expor estado derivado da entidade no HUD debug e exigir `hp === maxHp`. |
| `Map` por processo não coordena Vercel | `app/api/scores/route.ts` | Rate limit contornável | Redis compartilhado com aquisição atômica e TTL. |
| Redis vira dependência crítica do POST | `app/api/scores/route.ts` | Indisponibilidade temporária bloqueia ranking | Fail-closed + fila cliente; logs sem dados sensíveis. |
| Claim idempotente e Blob não formam transação única | adapter Redis + `lib/high-scores.ts` | Janela curta de estado inconsistente | Estados claimed/completed, release em erro e TTL curto de claim; testes de falha entre etapas. |
| Ranking local mistura dados globais e próprios | `app/page.tsx` | Reenvio de scores de terceiros | Chave e modelo separados; GET nunca enfileira. |
| Timers load/online podem competir | `app/page.tsx` | Rajada e duplicação | Mutex/promise ref e um POST em voo. |
| Playwright não está configurado | raiz / `e2e` | Gap mobile sem evidência | Dependência/config/spec mobile co-localizados em task própria. |
| Sonar espera LCOV inexistente | `sonar-project.properties` | Quality Gate em 0% | Provider Vitest compatível e reporter LCOV; bloquear task se compatibilidade não se confirmar. |

### Rastreabilidade do design

| Requirement | Componentes |
| --- | --- |
| `ESTAB-06`, `ESTAB-07` | Guardas de debug, listener, `RunOrigin`, fluxo de ranking |
| `ESTAB-08` | `RateLimitStore`, rota POST, Redis |
| `ESTAB-09`, `ESTAB-10` | `PendingScoreQueue`, `IdempotencyStore`, drain load/online |
| `ESTAB-11` | HUD debug observável e testes da arena |
| `ESTAB-12` | GET/POST, `sanitizeScore`, `cleanScores` |
| `ESTAB-13` | Playwright mobile |
| `ESTAB-14` | `<dialog>` e Sonar S6819 |
| `ESTAB-15` | Vitest coverage-v8, LCOV e Sonar |

### Decisões técnicas do ciclo 1

| Decisão | Escolha | Justificativa |
| --- | --- | --- |
| Backend compartilhado | Upstash Redis via `@upstash/redis` | Compatível com Vercel serverless e operação `SET NX EX` documentada. |
| Falha de rate limit | Fail-closed em produção | A garantia distribuída não pode degradar silenciosamente para best-effort. |
| Fila | Chave própria + `submissionId` estável | Separa ownership e permite retry idempotente. |
| Orquestração | FIFO, mutex e 10 segundos entre inícios | Respeita rate limit sem concorrência entre load/online. |

Essas escolhas são locais à feature de ranking/estabilidade. Nenhuma nova AD projeto-level é necessária; `STATE.md` e seu Handoff permanecem inalterados.

---

## Emenda de Design — Ciclo Interno 2

**Spec:** `_docs/specs/features/estabilidade-qualidade/spec.md` (`ESTAB-16` a `ESTAB-18`)
**Status:** Approved para decomposição em tasks
**Decisões do usuário:** ownership token, dedupe autoritativa por `submissionId` e Quality Gate verde para código novo, aprovadas em 2026-08-28.

Esta emenda substitui somente os contratos de idempotência/persistência e as provas incompletas do ciclo 1. O restante do design e todo o histórico permanecem válidos.

### Knowledge Verification Chain

| Etapa | Evidência consultada | Conclusão |
| --- | --- | --- |
| Codebase | `package.json`, `package-lock.json`, `lib/score-idempotency.ts`, `lib/high-scores.ts`, `app/api/scores/route.ts`, `app/page.tsx` e testes C1 | A stack instalada é `@upstash/redis` 1.38.3 e `@vercel/blob` 2.8.0. O claim atual usa o marcador compartilhado `in-flight`; Blob grava um array top-10 sem ID e qualquer 2xx remove a pendência. |
| Docs do projeto | `AGENTS.md`, `README.md`, `STATE.md`, spec/design/tasks/validation e Sonar local | Blob é a fonte global; Redis é coordenação fail-closed; LCOV é o formato de cobertura; nenhuma AD ativa conflita com a solução. Não há lessons confirmadas; L-005 a L-008 permanecem candidatas e foram usadas apenas como evidência dos gaps, não como regra. |
| Context7 | Upstash Redis `SET`/`EVAL`; Vercel Storage `get`/`head`/`put` e conditional writes | `redis.set(key, value, { nx: true, ex })` e `redis.eval(script, keys, args)` existem. `put(..., { ifMatch: etag })` fornece concorrência otimista e lança `BlobPreconditionFailedError`; `get(..., { useCache: false })` permite ler a versão atual. |
| Web oficial | Vercel Blob conditional writes; Upstash TypeScript `SET` e `EVAL` | As docs oficiais confirmam ETag/`ifMatch`, `BlobPreconditionFailedError`, `SET NX EX` e Lua server-side. A versão instalada expõe esses tipos/APIs, portanto não há `SPEC_DEVIATION`. |

Fontes externas: `https://vercel.com/docs/vercel-blob`, `https://vercel.com/docs/vercel-blob/using-blob-sdk`, `https://upstash.com/docs/redis/sdks/ts/commands/string/set` e `https://upstash.com/docs/redis/sdks/ts/commands/scripts/eval`.

### Arquitetura escolhida

```mermaid
flowchart TD
    A[POST validado] --> B{Redis status completed?}
    B -->|sim| C[200 idempotent]
    B -->|não| D{Ledger Blob contém submissionId?}
    D -->|sim| C
    D -->|não| E[Throttle por IP]
    E --> F[Claim Redis com owner token]
    F -->|in-flight| G[409 transitório]
    F -->|claimed token| H[Persistência Blob CAS por ETag]
    H -->|conflito| I[Reler, deduplicar e tentar novamente]
    I --> H
    H -->|confirmado| J[Complete Redis compare-and-set]
    J -->|ok, ownership-lost ou erro Redis| K[201 storage blob]
    H -->|não confirmado| L[Release compare-and-delete]
    L --> M[503; cliente mantém fila]
```

O Vercel Blob permanece a fonte autoritativa do ranking e passa a manter, no mesmo documento, um ledger de submissões processadas por 24 horas. O Redis continua sendo a coordenação rápida, mas não é a única prova de dedupe. Essa combinação fecha a janela “Blob gravado → complete Redis falha” sem exigir transação distribuída.

### Documento autoritativo e compatibilidade

```typescript
interface StoredHighScore extends HighScore {
  submissionId?: string;
}

interface ProcessedSubmission {
  submissionId: string;
  persistedAt: string;
}

interface RankingDocumentV2 {
  version: 2;
  scores: StoredHighScore[];
  processedSubmissions: ProcessedSubmission[];
}

interface RankingSnapshot {
  document: RankingDocumentV2;
  etag: string | null;
}
```

- `readRankingSnapshot()` usa `get(SCORE_PATH, { access: "private", useCache: false })` e recebe o ETag retornado pelo Blob.
- Um array legado é interpretado como `version: 2`, com scores saneados e ledger vazio; não há migração destrutiva separada.
- `scores` permanece limitado/ordenado por `cleanScores`; `processedSubmissions` conserva IDs por 24 horas mesmo quando o score não entra no top 10.
- `readHighScores()` projeta somente `HighScore[]`; `submissionId`, ledger e versão nunca entram no contrato GET.
- O primeiro write, quando o Blob não existe, usa criação sem overwrite (`allowOverwrite: false`). Um conflito de criação é tratado como conflito otimista e provoca releitura.
- Writes subsequentes usam `put(..., { access: "private", ifMatch: snapshot.etag, contentType: "application/json", cacheControlMaxAge: 0 })`.
- `persistHighScore(score, submissionId)` tenta no máximo três ciclos read/merge/conditional-write. Em conflito, relê; se encontrar o ID no ledger, retorna idempotente. Após três conflitos sem confirmação, falha como retryable sem afirmar persistência.

### Ownership token no Redis

```typescript
type ClaimResult =
  | { state: "claimed"; ownerToken: string }
  | { state: "completed" }
  | { state: "in-flight" };

type OwnershipResult = "applied" | "ownership-lost";

interface IdempotencyStore {
  status(submissionId: string): Promise<"completed" | "other">;
  claim(submissionId: string): Promise<ClaimResult>;
  complete(submissionId: string, ownerToken: string): Promise<OwnershipResult>;
  release(submissionId: string, ownerToken: string): Promise<OwnershipResult>;
}
```

- Cada `claim` gera token com `crypto.randomUUID()` e grava um valor distinguível, por exemplo `in-flight:<token>`, com `SET NX EX 60`.
- `complete` executa Lua via `redis.eval`: compara o valor completo esperado, grava `completed` com `EX 86400` e retorna `applied`; retorno `0` vira `ownership-lost`.
- `release` compara o mesmo valor e remove somente a chave própria; retorno `0` vira `ownership-lost`.
- Nenhum log inclui token, `submissionId`, chave completa, IP ou score.
- O store local usa o mesmo contrato e relógio injetável. Ele continua explicitamente não distribuído.

### Ordenação da rota POST

1. Validar os marcadores debug e `Idempotency-Key` conforme contratos existentes.
2. Consultar `idempotencyStore.status`; `completed` retorna `200 { storage: "blob", idempotent: true }` sem throttle.
3. Consultar o ledger Blob pelo `submissionId`; presença retorna o mesmo sucesso idempotente, cobrindo Redis ausente, expirado ou falha de complete.
4. Adquirir throttle somente para ID ainda não concluído.
5. Adquirir claim. `in-flight` retorna `409`; `completed` retorna sucesso; `claimed` carrega o token até a saída.
6. Sanear e persistir com CAS/ledger. Resultado `persisted` ou `already-present` é sucesso Blob.
7. Tentar `complete(submissionId, token)`. `ownership-lost` ou indisponibilidade Redis depois de Blob confirmado é observado sem liberar e não converte a resposta em `503`.
8. Somente falha antes de confirmação Blob tenta `release(submissionId, token)` e retorna `503`; perda de ownership no release não toca o claim atual.

O fast path autoritativo antes do throttle é deliberado para garantir retry idempotente. A otimização de round trips além deste contrato permanece categoria (c).

### Contrato cliente e drenagem

- `isPersistedResponse(body)` é verdadeiro somente para `storage === "blob"` ou `idempotent === true`.
- Envio inicial por rede/429/503 ou `storage: "local"` chama `enqueuePendingScore` com o ID já criado; não gera segundo ID.
- Drain remove a entrada somente quando `isPersistedResponse` for verdadeiro. `storage: "local"`, rede, 429 e 503 atualizam a tentativa, preservam a entrada e encerram a rodada.
- Novo `load`/`online` reutiliza a mesma entrada e header. O mutex existente continua responsável por uma promise; a espera de 10 segundos será isolada em helper único para tornar contável uma única sequência de timers e fechar S3776 sem extrair toda a feature.

### Debug, mobile e Quality Gate

- Testes de evento debug inválido capturam snapshots antes/depois de heading/HUD, status observável de boss/power-up, POSTs e ambas as chaves de storage.
- O teste de rota é parametrizado para `origin: "debug"` e `debug: true`, exigindo zero throttle/claim/persistência.
- O teste de restart encerra uma run debug, inicia nova run normal pelo fluxo real e prova exatamente um POST com novo ID.
- O E2E executa cada página legal em duas alturas distintas e compara `getComputedStyle(main).minHeight` com `window.innerHeight` após cada `setViewportSize`.
- S3776 é fechado extraindo apenas interpretação/envio de uma entrada e espera do throttle; S1871 consolida ações debug que chamam `start()`; S7776 troca a allowlist por `ReadonlySet`/`.has()`.
- A validação final gera LCOV fresco, executa Sonar no HEAD e exige Quality Gate `OK` para new code. Issues históricas fora do diff são registradas, não corrigidas.

### Tratamento de erros e transições

| Cenário | Outcome | Estado seguinte |
| --- | --- | --- |
| Token proprietário completa | `applied` | Redis `completed` por 24 h. |
| Worker antigo completa/libera após novo claim | `ownership-lost` | Claim novo permanece byte a byte. |
| ETag conflita e outro writer gravou o mesmo ID | Sucesso idempotente | Nenhuma segunda ocorrência. |
| ETag conflita com outro ID | Reler/merge/retry, até 3 tentativas | Ambos os scores preservados quando uma tentativa vence. |
| Blob confirma e complete Redis falha | HTTP 201/200 persistido | Não liberar; retry encontra ID no ledger. |
| Blob não confirma após retries | HTTP 503 | Release apenas com token proprietário; cliente conserva fila. |
| API retorna storage local | Resposta não autoritativa | Cliente cria/mantém pendência e para drain. |
| Redis completed ou ledger contém ID | HTTP 200 idempotente antes do throttle | Sem novo Blob write e sem consumo de janela. |

### Riscos e preocupações

| Preocupação | Localização | Impacto | Mitigação |
| --- | --- | --- | --- |
| Overwrite concorrente do array Blob | `lib/high-scores.ts` | Lost update e dedupe não confiável | ETag/`ifMatch`, `useCache: false`, merge em snapshot fresco e retry limitado. |
| Ledger cresce sem limite | documento Blob | Custo e payload crescentes | Remover IDs com `persistedAt` anterior a 24 h em cada merge; scores continuam top 10. |
| Complete Redis falha após Blob | rota + adapters | Retry pode duplicar ou receber erro falso | Blob ledger é autoridade; responder sucesso e nunca liberar após write confirmado. |
| Worker perde claim | `lib/score-idempotency.ts` | Worker antigo altera posse nova | Token único e scripts compare-and-set/delete com resultado obrigatório. |
| Leitura extra antes do throttle | rota/Blob | Latência e custo | Necessária ao AC de dedupe após falha parcial; otimização fica categoria (c). |
| `Home` continua monolítico | `app/page.tsx` | Complexidade de manutenção | Extrair somente helpers mínimos exigidos por S3776; extração estrutural permanece fora de escopo. |
| Testes antigos provam apenas parte das conjunções | testes C1 | Falso PASS | Casos discriminantes para cada marcador, storage local, retry posterior, timer, restart e viewport variável. |

### Rastreabilidade do design do ciclo 2

| Requirement | Componentes / decisões |
| --- | --- |
| `ESTAB-16` | `IdempotencyStore`, owner token, Lua CAS/delete, TTLs e store local equivalente |
| `ESTAB-17` | `RankingDocumentV2`, ETag/`ifMatch`, ledger 24 h, ordenação POST e contrato cliente |
| `ESTAB-18` | testes debug/restart/timer/mobile, helpers mínimos Sonar e validação LCOV/Sonar |

### Decisões técnicas do ciclo 2

| Decisão | Escolha | Justificativa |
| --- | --- | --- |
| Ownership Redis | `in-flight:<uuid>` + Lua compare-and-set/delete | API confirmada, atomicidade server-side e rejeição observável de owner antigo. |
| Autoridade de dedupe | Ledger 24 h no mesmo documento Blob v2 | Cobre falha entre Blob e Redis sem novo serviço nem transação inventada. |
| Concorrência Blob | ETag + `ifMatch`, três tentativas | Capacidade confirmada em `@vercel/blob` 2.8.0; evita lost update com limite determinístico. |
| Compatibilidade | Leitura dual de array legado e documento v2; GET projeta `HighScore[]` | Sem migração obrigatória nem mudança do consumidor público. |
| Quality Gate | `OK` para new code no HEAD | Decisão aprovada; dívida histórica permanece registrada e fora do fix. |

As decisões são específicas ao ranking desta feature e não estabelecem padrão obrigatório para outros domínios; `STATE.md` permanece inalterado.

---

## Emenda de Design — Ciclo Interno 3

**Spec:** `_docs/specs/features/estabilidade-qualidade/spec.md` (`ESTAB-19` e `ESTAB-20`)
**Baseline:** Specify `29fa03370e617417b19a00fea006ebcf2948c1c4`
**Status:** Approved para decomposição em tasks

Esta emenda preserva o histórico dos ciclos 1 e 2 e substitui somente a ordem do POST e o ledger monolítico de `RankingDocumentV2`. O ranking público continua em um único Blob; a dedupe autoritativa passa para 64 Blobs independentes. Os quatro achados categoria (a) do fechamento do ciclo 2 entram no plano de correção sem ampliar o comportamento aprovado.

### Knowledge Verification Chain

| Etapa | Evidência consultada | Conclusão |
| --- | --- | --- |
| Codebase | `app/api/scores/route.ts`, `lib/high-scores.ts`, `lib/score-idempotency.ts`, `lib/score-rate-limit.ts`, testes e lockfile | A rota hoje consulta Redis/ledger antes do throttle; o ledger ainda divide o Blob do ranking; os adapters já permitem Redis injetável, relógio local e `eval`; writes Blob já usam snapshot sem cache, ETag e até três tentativas. |
| Docs do projeto | `AGENTS.md`, spec/design/tasks/validation vigentes e `STATE.md` | Nenhuma AD ativa conflita. O Verifier exige corrigir ownership obrigatório, release Redis antigo, ETag fresco e ausência real do token Blob. |
| Stack instalada | `@upstash/redis` 1.38.3 e tipos de `@vercel/blob` 2.8.0 em `node_modules` | `eval(script, keys, args)`, `get(..., { useCache:false })`, ETag, `put(..., { ifMatch })` e `BlobPreconditionFailedError` estão confirmados localmente. Context7 não foi necessário. |

Não há `SPEC_DEVIATION`: os contratos instalados permitem preflight atômico e CAS por shard. Não há transação multi-Blob; a consistência é obtida por uma intenção durável e recuperável no shard antes de qualquer alteração do ranking.

### Alternativas avaliadas

| Abordagem | Resultado | Motivo |
| --- | --- | --- |
| Manter ledger junto do ranking | Rejeitada | Preserva atomicidade de um Blob, mas não atende aos 64 shards nem reduz contenção/cardinalidade. |
| Gravar ranking e depois shard | Rejeitada | Cria uma janela em que o score existe sem dedupe Blob recuperável, violando `ESTAB-17`/`ESTAB-20`. |
| Gravar intenção recuperável no shard e depois ranking | Escolhida | Usa somente `get`/`put`/ETag atuais, permite retry determinístico e nunca grava score antes da prova de dedupe. |

### Arquitetura e ordem do POST

```mermaid
flowchart TD
    A[Payload debug e Idempotency-Key válidos] --> B[Preflight Redis 60 por 60 s]
    B -->|bloqueado| C[429 com TTL restante]
    B -->|indisponível em produção| D[503 sem Blob ou outros stores]
    B -->|aprovado| E[Status Redis como hint]
    E --> F[Ler somente o shard do submissionId]
    F -->|entrada ativa| G[Garantir efeito no ranking por CAS]
    G --> H[200 idempotente sem throttle de 10 s]
    F -->|ausente ou expirada| I[Throttle funcional 10 s]
    I --> J[Claim Redis com ownerToken]
    J --> K[Reler o mesmo shard]
    K -->|corrida encontrou entrada| G
    K -->|continua ausente| L[CAS cria intenção recuperável no shard]
    L --> M[CAS insere score no ranking]
    M --> N[Complete Redis com ownerToken]
    N --> O[201 Blob confirmado]
```

Ordem normativa:

1. Fazer o parse já vigente e rejeitar `origin:"debug"`/`debug:true` e `Idempotency-Key` inválido. Body size e antecipação do parse continuam categoria (c).
2. Consumir o preflight por IP. Rejeição ou indisponibilidade encerra a rota antes de status/claim Redis, throttle funcional ou qualquer Blob.
3. Consultar `status` Redis apenas como hint e ler exatamente o shard derivado do ID. Somente uma entrada ativa do shard autoriza sucesso idempotente.
4. Entrada ativa chama `ensureRankingEffect(entry)`: se o ranking já contiver o ID, não escreve; se estiver ausente, reaplica o score guardado na entrada por CAS. Esse recovery ocorre antes e sem consumo do throttle funcional.
5. ID ausente/expirado adquire o throttle funcional de 10 segundos e depois o claim Redis. `ownerToken` acompanha todas as saídas proprietárias.
6. Após o claim, reler o mesmo shard. Isso fecha a corrida entre IPs/claims distintos antes de criar uma intenção.
7. Criar por CAS a entrada recuperável no shard e somente então inserir o score no ranking por CAS. Cada boundary tem no máximo três tentativas e relê sua própria ETag após conflito.
8. Ranking confirmado permite tentar `complete`. Erro ou `ownership-lost` não libera claim e não converte sucesso em falha; retry usa o shard. Falha do ranking mantém a intenção, libera somente o claim ainda proprietário e retorna `503`; retry repara o efeito pelo mesmo shard.

Um `completed` Redis sem entrada ativa no shard nunca produz sucesso. Isso mantém o TTL Blob como autoridade exata; após o throttle, se `claim` ainda observar um marcador Redis residual, a rota responde outcome transitório sem Blob write e sem declarar idempotência.

### PreflightAbuseStore (`ESTAB-19`)

- **Localização proposta:** `lib/score-abuse-preflight.ts`, integrado em `app/api/scores/route.ts`.
- **Reuso:** factory/env/logger/injeção de Redis e `hashRateLimitIdentifier` do adapter de rate limit; cliente Redis expõe o `eval` já usado por idempotência.
- **Chave:** `score:abuse:<sha256-ip>`; IP, hash completo e payload não aparecem em logs.
- **Interface:**

```typescript
interface AbusePreflightDecision {
  allowed: boolean;
  retryAfterMs: number;
  backend: "redis" | "local-memory";
}

interface AbusePreflightStore {
  consume(ip: string): Promise<AbusePreflightDecision>;
}
```

Produção executa um único script Lua. Dentro da mesma operação atômica, ele abre a chave com contador `1` e expiração de 60.000 ms quando ausente; permite e incrementa somente enquanto o contador é menor que 60; e, a partir da 61ª tentativa, devolve bloqueio e o `PTTL` vigente sem escrever nem renovar a chave. A decisão devolve o TTL lido no instante do script. A rota usa esse inteiro em `retryAfterMs` e `Math.ceil(retryAfterMs / 1000)` no `Retry-After`. TTL ausente/inválido em uma chave existente é erro do store, não permissão silenciosa.

O store local injetável mantém `{ count, expiresAt }` por identificador e relógio injetado. `now >= expiresAt` abre nova janela; tentativas 1–60 passam e as posteriores retornam `expiresAt - now`. Ele existe somente fora de production e registra backend `local-memory`. Credencial ausente, factory inválida, erro Redis ou resultado Lua malformado falham fechado em production com o `503` amigável vigente e zero acesso posterior.

### Ledger Blob em 64 shards (`ESTAB-20`)

#### Seleção e paths

```typescript
function ledgerShardIndex(submissionId: string): number {
  const digest = createHash("sha256").update(submissionId.trim(), "utf8").digest();
  return digest[0] >>> 2;
}
```

O valor validado preserva caixa e caracteres; apenas o `trim` vigente é aplicado. Os paths são estáveis, de `java-pleno-pixel-hunt/score-ledger/00.json` a `.../63.json`, com índice decimal de dois dígitos. Uma consulta lê o shard selecionado e nunca varre os outros 63.

#### Modelo de dados

```typescript
interface LedgerEntryV1 {
  submissionId: string;
  persistedAt: string;
  score?: StoredHighScore;
  source: "cycle-3" | "legacy-v2";
}

interface LedgerShardV1 {
  version: 1;
  shard: number;
  legacyImported: boolean;
  entries: LedgerEntryV1[];
}

interface LedgerShardSnapshot {
  document: LedgerShardV1;
  etag: string | null;
}
```

Entradas novas sempre guardam o score saneado com o mesmo `submissionId`; isso transforma o ledger em intenção de persistência recuperável, não em mero marcador. `persistedAt` é fixado na criação da intenção e nunca renovado por retry. A entrada é ativa somente quando `now < Date.parse(persistedAt) + 86_400_000`; na igualdade ou depois, decode/lookup a exclui da visão autoritativa.

O ranking mantém `submissionId` internamente para que `ensureRankingEffect` seja idempotente, mas deixa de adicionar itens a `processedSubmissions`. A projeção pública continua sendo `cleanScores` e remove ID, shard, timestamp e ETag.

#### Compatibilidade e cleanup lazy

- Array legado e `RankingDocumentV2` continuam decodificáveis. Scores legados sem ID continuam apenas como ranking, conforme `ESTAB-17`.
- Na primeira abertura de cada shard com `legacyImported:false`, o adapter lê o documento v2 vigente, filtra somente `processedSubmissions` ativos cujo hash pertence àquele índice e os incorpora por CAS como `source:"legacy-v2"`. Nenhum outro shard é lido. Entradas legacy sem score são confirmações de efeitos já concluídos; não são usadas para criar novo score.
- O documento de ranking conserva o ledger v2 somente durante a janela de compatibilidade de 24 horas e não recebe IDs novos. Depois desse horizonte, o campo pode permanecer vazio sem migração destrutiva separada.
- Toda leitura cria uma visão lógica sem expirados. Toda escrita serializa essa visão antes do merge, realizando cleanup físico apenas no shard tocado. Não existe cron nem varredura global.

#### CAS e retries

`readLedgerShard(index)` usa `get(path, { access:"private", useCache:false })` e captura `blob.etag`. Criação usa `allowOverwrite:false`; update usa `ifMatch` exatamente igual à ETag daquela leitura. `BlobPreconditionFailedError` provoca releitura do mesmo shard, nova expiração lógica e novo merge. O limite permanece em três tentativas por operação; esgotamento retorna falha retryable sem afirmar persistência.

O ranking reutiliza o mesmo protocolo atual. O teste discriminante de conflito deve observar que a segunda chamada usa a ETag da segunda leitura, por exemplo `ifMatch:"etag-2"`, e falhar se repetir `etag-1`.

### Contrato de falha parcial

| Última confirmação durável | Outcome | Recuperação |
| --- | --- | --- |
| Nenhuma; preflight/throttle/claim falhou | `429`, `409` ou `503` conforme etapa | Zero Blob write; cliente mantém a submissão quando retryable. |
| Intenção do shard não confirmou | `503` | Ranking não é tocado; release somente com `ownerToken` proprietário. |
| Shard confirmou, ranking não confirmou | `503` | Entrada permanece com score; release proprietário permite retry, que encontra o shard e executa `ensureRankingEffect`. |
| Ranking confirmou, resposta se perdeu | Sucesso pode não chegar ao cliente | Shard já existia antes do ranking; retry encontra a entrada e não duplica o score. |
| Ranking confirmou, `complete` falhou/perdeu ownership | `201`/`200` Blob | Não liberar; shard resolve retry durante as 24 horas exatas. |
| Entrada expirou | Não é idempotente | Lookup a ignora; novo processamento volta ao throttle/claim e cleanup ocorre no próximo CAS do shard. |

Invariante: **nenhuma chamada de escrita do ranking é permitida antes de a entrada recuperável do mesmo `submissionId` estar confirmada no shard selecionado**. Portanto não existe janela de score persistido sem dedupe Blob recuperável.

### Correções categoria (a) incorporadas

1. `IdempotencyStore.complete` e `release` recebem `ownerToken: string` obrigatório; remover os unions string legados de `IdempotencyClaim` e os parâmetros opcionais. A rota não aceita claim `"claimed"` sem token.
2. O teste Redis executa o script real/fake observável de `release` com owner antigo, exige retorno Lua `0` mapeado para `ownership-lost` e prova que o valor integral do claim novo permanece.
3. O teste de retry CAS exige `ifMatch` fresco em cada tentativa, tanto no shard quanto no ranking.
4. O teste real da rota remove/restaura `BLOB_READ_WRITE_TOKEN`, não mocka o outcome Blob e exige resposta amigável sem exceção não tratada nem sucesso autoritativo falso.

### Riscos e mitigações

| Risco | Localização | Impacto | Mitigação |
| --- | --- | --- | --- |
| Script de preflight renova janela por engano | novo adapter Redis | IP pode ficar bloqueado além de 60 s | Um `eval`, TTL criado uma vez, rejeição sem write e testes de 1ª/60ª/61ª/fronteira com TTL decrescente. |
| Store local diverge do Redis | novo adapter local | Testes passam com semântica diferente | Mesmo contrato, relógio injetável e testes parametrizados de cota/TTL/backend. |
| Hash/shard diverge entre instâncias | ledger adapter | Dedupe pode procurar o Blob errado | SHA-256 UTF-8 do ID trimado e `digest[0] >>> 2`, com vetores determinísticos e limites 0/63. |
| Lost update dentro de um shard | ledger adapter | IDs válidos desaparecem | ETag fresco, merge após expiração lógica e três retries limitados. |
| Shard confirmado sem ranking | rota + ranking | Efeito elegível pode faltar temporariamente | Entrada guarda score e todo fast path executa recovery antes de responder sucesso. |
| Ranking confirmado sem dedupe | rota | Duplicação após falha parcial | Invariante shard-first; não há chamada de ranking antes do CAS do ledger. |
| Cutover perde IDs do documento v2 | codec/migração lazy | Retry dentro de 24 h duplica | Importação por shard, filtrada pelo mesmo hash, antes de marcar `legacyImported`. |
| Metadados vazam no contrato público | GET/POST | Exposição interna e quebra cliente | Única projeção `publicHighScores`/`cleanScores`; testes negam IDs, timestamps, shard e ETag. |
| Redis completed sobrevive ao ledger | rota/idempotência | Sucesso depois do TTL exato | Redis é hint; sucesso exige entrada ativa no shard. Marcador residual produz outcome transitório, nunca idempotente. |

### Rastreabilidade do ciclo 3

| Requirement | Componentes / decisões |
| --- | --- |
| `ESTAB-16` | `ownerToken` obrigatório, scripts CAS/delete e teste Redis de release antigo preservando claim novo |
| `ESTAB-17` | shard-first, score interno com `submissionId`, `ensureRankingEffect`, ETag fresco e resposta somente após confirmação recuperável |
| `ESTAB-19` | `AbusePreflightStore`, Lua 60/60 s, TTL preciso, fail-closed e store local injetável; fast paths antes do throttle funcional |
| `ESTAB-20` | SHA-256 top 6 bits, 64 paths, uma leitura de shard, TTL lógico exato, cleanup lazy, CAS e três retries |

### Decisões técnicas do ciclo 3

| Decisão | Escolha | Justificativa |
| --- | --- | --- |
| Antiabuso | Script Redis único por IP, janela fixa 60/60 s | Atomicidade e TTL restante preciso sem renovar bloqueios. |
| Autoridade de dedupe | Shard Blob selecionado pelo ID | Limita contenção e cardinalidade mantendo dedupe cross-instance. |
| Protocolo de persistência | Intenção shard-first com score recuperável | Fecha a falha parcial sem transação multi-Blob ou API externa nova. |
| Retenção | Validade lógica `[persistedAt, persistedAt + 24h)` | Implementa a fronteira exata da spec; cleanup físico fica lazy. |
| Concorrência | ETag fresca e três tentativas por Blob | Reutiliza o adapter vigente, preserva merges e limita trabalho. |

Estas decisões continuam locais ao ranking. Nenhuma AD projeto-level é criada e `STATE.md` permanece inalterado.
