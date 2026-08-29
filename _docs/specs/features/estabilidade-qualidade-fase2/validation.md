# Validation — estabilidade-qualidade-fase2

## Status atual
Veredito: PASS
Spec vigente: spec.md (13 ACs, EQ2-01 a EQ2-13)
HEAD: 488012d
Gaps abertos: nenhum

---

## Execução 2026-08-29 — commit range 0c6e9cd..488012d

PASS

### Evidência por AC

**EQ2-01** (`obstacleCount` cresce linearmente e é limitado por `MAX_OBSTACLES`)
`lib/obstacles.ts:1-4`: `export const MAX_OBSTACLES = 5; export function obstacleCount(resets) { return Math.min(MAX_OBSTACLES, 1 + resets); }`.
`lib/__tests__/obstacles.test.ts:5-22` cobre crescimento linear (0→4 resets), teto em `MAX_OBSTACLES` para 4/5/100 resets, e nunca ultrapassa o teto para 4/5/10/1000. Outcome bate literalmente.

**EQ2-02** (`circleIntersectsRect`: sobreposição incl. tangência/canto → true; sem sobreposição → false)
`lib/obstacles.ts:11-18`. `lib/__tests__/obstacles.test.ts:31-55` cobre overlap simples (true), overlap de canto (true), tangência exata (`< circle.radius` estrito → false, documentado corretamente como "just outside" pela implementação `<`), ponto logo dentro da tangência (true), e não-overlap (false). Outcome bate.

**EQ2-03** (`pointInRect`: dentro/borda/fora → true/true/false)
`lib/obstacles.ts:20-22`. `lib/__tests__/obstacles.test.ts:57-73` cobre ponto dentro (true), ponto exatamente na borda em dois cantos (true), ponto fora em dois eixos (false). Outcome bate.

**EQ2-04** (`npm run build` compila sem erro após extração, sem mudança de comportamento observável)
Rodei `npm run build` no HEAD: compilou limpo (`✓ Compiled successfully`, `Finished TypeScript`), sem warnings de tipo. Rotas geradas normalmente (`/`, `/api/scores`, etc.).

**EQ2-05** (as 14 funções + 3 tipos + 2 consts saem de `app/page.tsx` e vivem em `lib/score-sync.ts`)
`lib/score-sync.ts:1-143` contém `HighScore`, `PendingScoreEntry`, `ScoreApiResponse`, `HIGH_SCORE_KEY`, `PENDING_SCORE_KEY`, e as 14 funções (`loadHighScores` até `mergeHighScores`). `grep` em `app/page.tsx` confirma zero ocorrências de definição local — apenas o import em `app/page.tsx:15-27` e usos de `HighScore`/`PendingScoreEntry` como tipo. Outcome bate.

**EQ2-06** (`drainPendingScores`/`refreshHighScores` continuam em `app/page.tsx`, consumindo o módulo novo)
`app/page.tsx:393` (`refreshHighScores`) e `app/page.tsx:414` (`drainPendingScores`) permanecem no componente, chamando `loadHighScores`, `saveHighScores`, `mergeHighScores`, `loadPendingScores`, `waitForNextScorePost`, `postPendingScore`, `isPersistedScoreResponse`, `removePendingScore`, `updatePendingScoreAttempt` importados de `@/lib/score-sync`. Outcome bate.

**EQ2-07** (suíte antiga sem alteração de asserções)
`git diff 0c6e9cd..488012d -- app/__tests__/score-sync.test.tsx lib/__tests__/high-scores.test.ts` retornou vazio — nenhuma linha alterada em nenhum dos dois arquivos. `app/__tests__/game-debug.test.tsx` teve scaffold de setup/teardown alterado (migração MSW, EQ2-08/09/10) mas os 10 blocos `it(...)` são byte-idênticos ao `git show 0c6e9cd:app/__tests__/game-debug.test.tsx` (confirmado por diff linha a linha — só o bloco `beforeAll/beforeEach/afterEach` mudou). Outcome bate.

**EQ2-08** (`game-debug.test.tsx` usa `setupServer`/handlers MSW para GET e POST de `/api/scores`)
`app/__tests__/game-debug.test.tsx:3-4,18,55-61` usa `setupServer()`, `http.get(".../api/scores", ...)`, `http.post(".../api/scores", ...)`. Nuance: uma linha `vi.stubGlobal("fetch", ...)` ainda existe (linha 63), mas seu corpo agora só normaliza URL relativa→absoluta e delega para o `fetch` real (que o MSW intercepta na camada de rede) — não mais um mock de resposta (`vi.fn().mockResolvedValue(...)` como era antes). Esse é exatamente o padrão pré-existente já usado em `app/__tests__/score-sync.test.tsx:56` (citado em design.md como referência a copiar), não uma criação nova desta migração. Interpreto como satisfazendo a intenção da AC (rede mockada via MSW, não mais resposta hardcoded); registrado aqui para transparência, não como gap, dado que replica convenção já aprovada do projeto.

**EQ2-09** (contagem de POST reescrita via request log MSW, cobertura preservada, nenhum `it` removido/enfraquecido)
`app/__tests__/game-debug.test.tsx:22,44,54,57-60` — contador local `postAttempts` incrementado dentro do handler `http.post`, substituindo `fetchMock.mock.calls.filter(...)`. Confirmado via diff que os 10 `it(...)` (mesmos títulos, mesmo corpo) permanecem intactos. Outcome bate.

**EQ2-10** (suíte completa passa, mesma cobertura/quantidade de testes de antes)
`git show 0c6e9cd:app/__tests__/game-debug.test.tsx | grep -c '  it('` = 10; `grep -c '  it(' app/__tests__/game-debug.test.tsx` (HEAD) = 10. `npm test -- --run` roda 177 testes em 12 arquivos, todos verdes. Outcome bate.

**EQ2-11** (`npm run audit` existe e roda `npm audit`, sai não-zero se houver alta/crítica)
`package.json:16`: `"audit": "npm audit --audit-level=high"`. Comportamento nativo do npm garante exit code não-zero em achado alto/crítico. Outcome bate.

**EQ2-12** (README com seção de política, nunca `--force` sem revisar advisory/changelog)
`README.md:139-156`, seção "Segurança e dependências": explica `npm run audit`, e a política ("nunca rodar `npm audit fix --force` às cegas" + passos: ler advisory, ler changelog, decidir). Outcome bate.

**EQ2-13** (`npm run audit` sai com código 0 no estado atual)
Rodei `npm run audit`: `found 0 vulnerabilities`, exit code 0. Outcome bate.

### Sensor de discriminação

1. Mutação em `lib/obstacles.ts:4` — troquei `Math.min(MAX_OBSTACLES, 1 + resets)` por `Math.min(MAX_OBSTACLES, resets)`. Rodando `npm test -- --run lib/__tests__/obstacles.test.ts`: 3 testes falharam (linear growth 0→3, e o teste de "negative resets" que documenta o comportamento conhecido). Confirma que o teste realmente exercita a fórmula. Revertido com `git checkout -- lib/obstacles.ts`; `git status --short` limpo depois.

2. Mutação em `lib/score-sync.ts:141` — troquei `b.score - a.score` por `a.score - b.score` no comparator de `mergeHighScores` (inverte ordenação por score). Rodando `npm test -- --run lib/__tests__/score-sync.test.ts`: 1 teste falhou (`sorts by score desc, then wave desc...`), diff mostrando ordem trocada (LOW/50 no lugar de HIGH/200 na primeira posição). Confirma que o teste exercita o comparator. Revertido com `git checkout -- lib/score-sync.ts`; `git status --short` limpo depois.

Ambas as mutações foram desfeitas antes do fim da verificação; árvore de trabalho confirmada limpa em ambos os casos.

### Escopo

`git diff 0c6e9cd..488012d --stat` retornou exatamente: `README.md`, `_docs/specs/STATE.md`, `_docs/specs/features/estabilidade-qualidade-fase2/{context,design,spec,tasks}.md`, `app/__tests__/game-debug.test.tsx`, `app/page.tsx`, `lib/__tests__/obstacles.test.ts`, `lib/__tests__/score-sync.test.ts`, `lib/obstacles.ts`, `lib/score-sync.ts`, `package.json`. Bate exatamente com o esperado pelas 13 ACs — nenhum arquivo fora do escopo tocado. `ab95d6d` (versão substituída do teste de obstáculos) não está mais refletido no diff final — o `git show` do commit foi supersedido corretamente por `49bea6b`/`fcd4c60`; o estado de HEAD só reflete a versão corrigida.

### Comandos executados (rodados diretamente, não confiando em relato anterior)

- `npm test -- --run` → 177 passed (177), 12 test files passed (12)
- `npm run build` → compilou limpo, TypeScript sem erro
- `npm run lint` → 0 errors, 2 warnings pré-existentes e não relacionados (`coverage/lcov-report/block-navigation.js`, `lib/debug.ts:26` `_search` não usado — nenhum dos dois tocado por esta feature)
- `npm run audit` → `found 0 vulnerabilities`, exit 0

### Gaps encontrados

nenhum
