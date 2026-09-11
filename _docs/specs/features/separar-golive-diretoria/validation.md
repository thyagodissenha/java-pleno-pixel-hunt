# Separar Go-Live/Diretoria — Validation

## Status atual

**Veredito**: PASS ✅ (Rodada 2 — os 5 gaps de cobertura de teste da Rodada 1 foram fechados pelo fix cycle 1; nenhuma regressão nas outras 6 ACs; nenhum gap novo encontrado)
**Spec vigente**: [`spec.md`](./spec.md)
**HEAD atual**: `5c20264` (topo do range de fix `63c4bc1..5c20264`)
**Gaps abertos**: nenhum.

Ver Rodada 2 abaixo para a evidência de fechamento por gap, gate check e sensor de discriminação. Rodada 1 (histórico, não editada) permanece abaixo para rastreabilidade.

---

## Rodada 1 — separar-golive-diretoria — 2026-09-10 — commits d0654ae..63c4bc1

### Escopo da validação

Diff real inspecionado: `git diff d0654ae..63c4bc1 -- lib/ e/ app/` — 5 arquivos de produção/teste tocados:

- `lib/pixel-hunt-engine/phases/normal-run/wave-progression.ts` (T1 — dados)
- `lib/pixel-hunt-engine/phases/normal-run/spawn.ts` (T2 — dados)
- `lib/pixel-hunt-engine/renderer/world.ts` (T3 — dados)
- `lib/pixel-hunt-engine/phases/normal-run/__tests__/boss.test.ts` (T4)
- `lib/pixel-hunt-engine/phases/normal-run/__tests__/graph.test.ts` (T5)
- `lib/pixel-hunt-engine/phases/normal-run/__tests__/spawn.test.ts` (T6)
- T7: nenhum diff de código — task de verificação/regressão pura (confirmado via `git show --stat 63c4bc1`, sem arquivos alterados).

Confirma o Design: nenhuma mudança em `graph.ts`, `boss.ts`, `physics.ts`, `waves.ts` — só crescimento de dados (`bossNames`, `biomeNames`, `obstacleTemplates`, 2×`BIOME_COUNT`).

---

### 1. Spec-Anchored Acceptance Criteria Check

#### P1: Onda 4 com chefe próprio e definitivo

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1 (GOLIVESPLIT-01): boss onda 4 nasce sem `bossPhase`, `hp:160+wave×28`, `speed:52+wavePressure×2`, `size:38` | `bossPhase === undefined`; `hp=160+4×28=272`; `speed=52+3×2=58`; `size=38` (wave=4→wavePressure=min(3,5)=3) | `lib/pixel-hunt-engine/phases/normal-run/spawn.ts:127-129` (fórmula); `lib/pixel-hunt-engine/phases/normal-run/__tests__/spawn.test.ts:86-93` — `expect(actor.hp).toBe(160+4*28)`, `expect(actor.speed).toBe(52+Math.min(4-1,5)*2)`, `expect(actor.size).toBe(38)`, `expect(actor.bossPhase).toBeUndefined()` | ✅ PASS |
| AC2 (GOLIVESPLIT-02): boss onda 4 a 0 HP morre de vez, `bossDefeated=true` na mesma morte, sem cura | Ao matar o boss de `bossIndex=3` (não-final), `events.bossDefeated===true` no mesmo `step()`, sem `bossPhaseAdvanced` | `lib/pixel-hunt-engine/phases/normal-run/__tests__/graph.test.ts:128-134` — loop genérico `for (n=1; n<bossNames.length; n+=1)`, para `n=4`: `killCurrentBoss(world)` (sem `bossPhase`), `expect(events.bossDefeated).toBe(true)` | ✅ PASS (via teste genérico pré-existente, não editado — confirma a expectativa do Design de que a suíte parametrizada já cobre isso automaticamente) |
| AC3 (GOLIVESPLIT-03): morte do boss onda 4 leva a `wave-5`, não a `final-choice` | `state.phase.id === "wave-5"` após a morte do boss de `bossIndex=3` | `lib/pixel-hunt-engine/phases/normal-run/__tests__/graph.test.ts:132` — `expect(state.phase.id).toBe(\`wave-${n+1}\`)` com `n=4` → `"wave-5"` | ✅ PASS |
| AC4 (GOLIVESPLIT-04): volley do boss onda 4 usa `pattern=bossIndex%4=3` (leque ±0.24rad, 5 "Incidente", cooldown `max(64,104-wave×4)`) | `computeBossVolleyPlan`/`spawnBossVolleyShot` com `pattern===3` produzem o leque estreito | **Nenhuma citação encontrada.** `computeBossVolleyPlan`/`spawnBossVolleyShot` (`lib/pixel-hunt-engine/physics.ts:358-406`) não são exportadas e não aparecem em nenhum arquivo `*.test.ts` do repo (`grep -rln "pattern" **/*.test.ts` → 0 resultados; `grep -rln "computeBossVolleyPlan\|spawnBossVolleyShot" **/*.test.ts` → 0 resultados). Nenhum teste de `stepWorld` usa `bossIndex:3`/`kind:"boss"` em cooldown para exercitar o volley. | ❌ GAP — evidence-or-zero. Nota: a spec.md Assumption A3 afirma "já... coberto por testes de unidade sobre a função pura" — essa afirmação **não se sustenta** na suíte atual; o comportamento existe e está correto por leitura de código, mas nunca foi testado, nem antes nem depois desta feature. |

#### P1: Onda 5 com a Diretoria

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1 (GOLIVESPLIT-05): boss onda 5 nasce com `bossPhase:1`, `hp=finalBossHp(1,5)`, `size:62` | `bossPhase===1`; `hp=finalBossHp(1,5)=210+48+110=368` | `lib/pixel-hunt-engine/phases/normal-run/spawn.ts:127-128` (fórmula); `lib/pixel-hunt-engine/phases/normal-run/__tests__/spawn.test.ts:96-102` — `expect(actor.hp).toBe(finalBossHp(1,5))`, `expect(actor.hp).toBe(210+1*48+5*22)`, `expect(actor.bossPhase).toBe(1)`, `expect(actor.label).toBe("Diretoria")` | ✅ PASS |
| AC2 (GOLIVESPLIT-06): boss onda 5 a 0 HP com `bossPhase<3` cura e cresce (`size:62+bossPhase×6`), idêntico a hoje | Ao matar com `bossPhase=1` e `2`, `bossPhaseAdvanced===true`, `bossDefeated===false`, permanece no nó `wave-5` | `lib/pixel-hunt-engine/phases/normal-run/__tests__/graph.test.ts:208-218` — `killCurrentBoss(world,1)`→`expect(phase1Events.bossDefeated).toBe(false)`, `expect(phase1Events.bossPhaseAdvanced).toBe(true)`; idem para `killCurrentBoss(world,2)` | ⚠️ Spec-precision gap — o mecanismo de "não morre / avança fase" está coberto, mas os valores exatos pós-cura (`enemy.maxHp = finalBossHp(2,5)` / `finalBossHp(3,5)`, `enemy.size = 62+bossPhase×6`) NÃO são afirmados por nenhum teste (nem este novo, nem outro pré-existente — `grep` por `bossPhaseAdvanced` no repo só retorna este arquivo). O código (`physics.ts:572-581`) está correto por leitura, mas o "IDÊNTICO ao comportamento de hoje" da spec não é verificado numericamente. |
| AC3 (GOLIVESPLIT-07): boss onda 5 a 0 HP com `bossPhase===3` morre de vez, transição para `final-choice` | `bossDefeated===true`, `state.phase.id==="final-choice"` | `lib/pixel-hunt-engine/phases/normal-run/__tests__/graph.test.ts:220-223` — `killCurrentBoss(world,3)` → `expect(phase3Events.bossDefeated).toBe(true)`, `expect(state.phase.id).toBe("final-choice")` | ✅ PASS |
| AC4 (GOLIVESPLIT-08): HUD exibe `bossNames[4]` ("Comitê Executivo") enquanto onda 5 em andamento (antes de `finalChoicePending`) | `hudLabels(world).boss === "Comitê Executivo"` para `bossIndex===4` sem `finalChoicePending` | **Nenhuma citação encontrada.** `hudLabels()` (`lib/pixel-hunt-engine/phases/normal-run/waves.ts:196`) lê `bossNames[run.bossIndex]` dinamicamente (correto por leitura — `bossNames[4]="Comitê Executivo"` confirmado em `wave-progression.ts:28`), mas `waves.test.ts` só testa `hudLabels` com `bossIndex:1` (`waves.test.ts:203` — `expect(labels?.boss).toBe(bossNames[1])`), nunca com `bossIndex:4`. `grep -rn "Comitê Executivo" **/*.test.ts` → 0 resultados. | ❌ GAP — evidence-or-zero. Tasks.md atribui esta AC a T5 (`graph.test.ts`), mas o teste novo de T5 (linhas 199-224) testa só o mecanismo de sub-fases, não o HUD — a atribuição de cobertura em tasks.md não corresponde ao teste real escrito. |

#### P2: Identidade visual da onda 5

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1 (GOLIVESPLIT-09): HUD exibe `biomeNames[4]` ("Sala do Conselho") na onda 5 | `hudLabels(world).biome === "Sala do Conselho"` para `bossIndex===4` | **Nenhuma citação encontrada.** Dado adicionado corretamente (`wave-progression.ts:36`), lido dinamicamente por `hudLabels()` (`waves.ts:197`), mas nenhum teste exercita `bossIndex:4`/`biomeNames[4]`. `grep -rn "Sala do Conselho" **/*.test.ts` → 0 resultados. | ❌ GAP — evidence-or-zero. |
| AC2 (GOLIVESPLIT-10): obstáculos da onda 5 usam o 5º conjunto de `obstacleTemplates` (não reaproveita índice 3) | `obstacleTemplates(world_com_bossIndex_4)` retorna o array `[board "Pauta", chair "Cadeira de couro", rack "Servidor de backup"]` | **Nenhuma citação encontrada.** Dado/código corretos por leitura (`spawn.ts:70-74`, `BIOME_COUNT=5` em `spawn.ts:16`), mas `spawnObstacles`/`obstacleTemplates` só são exercitados em teste com `bossIndex:0` (default de `makeWorld()`, confirmado em `spawn.test.ts:114` — nenhuma chamada com `bossIndex:4`). | ❌ GAP — evidence-or-zero. Tasks.md T2 já previa isso ("nenhum teste de pixel/render exigido — ver matrix"), mas a matrix classifica `spawn.ts`/`obstacleTemplates` como "Engine domain logic" (unit exigido), não como a camada "Renderer" (`none`) — há uma inconsistência entre a Test Coverage Matrix (que exige unit 1:1 para GOLIVESPLIT-01 a 08, mas não menciona 09/10 explicitamente) e o texto de T2 que dispensa o teste. Risco baixo (comportamento correto e determinístico por leitura), mas sem rede de segurança automatizada contra regressão futura.

#### P3: Reaproveitamento do mob "Legado"

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1 (GOLIVESPLIT-11): mob "Legado" pode ser sorteado na onda 5 (34% de chance, sem mudança em `spawn.ts`) | `specialPool` inclui `"legacy"` quando `world.run.wave>=5` | `lib/pixel-hunt-engine/phases/normal-run/waves.ts:47` — `...(world.run.wave >= 5 ? (["legacy"] as const) : [])` (código pré-existente, ZERO diff nesta feature — confirmado: `waves.ts` não aparece no `git diff d0654ae..63c4bc1`). Alcançável agora porque `wave-5` passa a existir (T1). Nenhum teste automatizado dedicado (nenhum resultado em `grep -n "legacy" waves.test.ts`). | ⚠️ Verificado por leitura de código + é o desfecho esperado e documentado (T7 tratou como "verificação manual, sem novo teste dedicado" — decisão explícita em tasks.md, não um descuido). Não é uma regressão; é uma AC cuja natureza ("mob já existente torna-se alcançável") não exige código novo, então não há o que unit-testar além de "specialPool contém legacy quando wave>=5", o que já era verdade antes desta feature e não foi tocado. Classificado como GAP de teste-dedicado, não de comportamento. |

**Resumo do spec-anchored check**: 6/11 ACs com evidência direta e valor batendo o spec (✅ PASS); 1/11 com mecanismo coberto mas valores numéricos não afirmados (⚠️ spec-precision gap); 4/11 sem nenhuma citação de teste (❌ GAP, evidence-or-zero) — GOLIVESPLIT-04, 08, 09, 10 (mais GOLIVESPLIT-11 registrado como gap de baixo risco/documentado). Em todos os casos de GAP, o código de produção foi verificado correto por leitura direta (`file:line` citado acima); nenhum é uma regressão funcional confirmada.

---

### 2. Edge Cases (spec.md)

| Edge Case | Status | Evidência |
| --- | --- | --- |
| Onda 5 em "Novo Chamado" (`callLoops>0`) escala pelas mesmas fórmulas genéricas, sem regra especial | ✅ PASS | `lib/pixel-hunt-engine/phases/normal-run/__tests__/graph.test.ts:156-196` ("novo chamado" loop test, pré-existente, generaliza por `bossNames.length`) — não editado nesta feature, continua verde |
| `bossNames.length` 4→5: `isFinalBoss` passa a considerar onda 5 final e onda 4 não-final automaticamente | ✅ PASS | `lib/pixel-hunt-engine/phases/normal-run/__tests__/boss.test.ts:71-76` |
| Grafo reconstruído gera `wave-1..5` + arestas automaticamente, sem mudar `graph.ts` | ✅ PASS | `lib/pixel-hunt-engine/phases/normal-run/__tests__/graph.test.ts:100-107` ("has exactly bossNames.length + 1 nodes", pré-existente, parametrizado) + confirmado por leitura: zero diff em `graph.ts` no range `d0654ae..63c4bc1` |
| Teste com valor hardcoded do chefe final deve ser tratado como achado a corrigir, não scope creep | ✅ PASS | Exatamente o que aconteceu: `boss.test.ts` (`isFinalBoss(3)`) e `spawn.test.ts` (stats do "chefe final" hardcoded em `bossIndex:3`) quebraram após T1 e foram corrigidos em T4/T6 — documentado nos commits `4edd58d` e `838a4fe` |

---

### 3. Gate Check (rodado do zero nesta sessão, não herdado do relato do author)

```
npm test        → Test Files 43 passed (43) | Tests 445 passed (445), 0 failed
npm run build   → ✓ Compiled successfully, TypeScript ok, 9 rotas geradas sem erro
npm run test:e2e → bloqueado: "Another next dev server is already running" (PID 10516,
                    lock de .next/dev de outra sessão) — AMBIENTE, não falha de código,
                    confirmado reproduzindo o mesmo erro reportado por T7
```

Contagem bate exatamente o relatado em `tasks.md` (445 passed, 0 failed). Nenhuma divergência.

---

### 4. Discrimination Sensor (3 mutações, estado descartável, árvore restaurada após cada uma)

| # | Mutação | `file:line` | Descrição | Morta? |
| --- | --- | --- | --- | --- |
| 1 | `bossIndex === bossNames.length - 1` → `- 2` | `lib/pixel-hunt-engine/phases/normal-run/boss.ts:24` (`isFinalBoss`) | Inverte artificialmente qual onda é "final" (onda 4 passaria a ser tratada como final, não a onda 5) | ✅ Morta — 5 testes falharam: `boss.test.ts` (1), `graph.test.ts` (3, incluindo o novo teste GOLIVESPLIT-06/07/08 que virou `TypeError: normalRunGraph.nodes[nextId] is not a function`), `spawn.test.ts` (via `finalBossHp`/labels indiretamente pelo mesmo import — confirmado no output bruto) |
| 2 | `bossIndex === bossNames.length - 1` → `- 2` | `lib/pixel-hunt-engine/phases/normal-run/spawn.ts:38` (`isFinalBossIndex`, cópia local intencional) | Faz `spawnEnemy` tratar o boss da onda 4 como o final (ganha `bossPhase`) e o da onda 5 como comum | ✅ Morta — 2 testes falharam em `spawn.test.ts` (HP 272 esperado vs 346 recebido na onda 4; HP 368 esperado vs 300 recebido na onda 5) |
| 3 | `currentBossPhase < 3` → `< 2` | `lib/pixel-hunt-engine/physics.ts:572` (limite de sub-fases antes de morrer de vez) | Faz o boss morrer de vez 1 sub-fase antes do previsto (na fase 2 em vez da 3) | ✅ Morta — 1 teste falhou em `graph.test.ts`: o novo teste GOLIVESPLIT-06/07/08 (`phase2Events.bossDefeated` esperado `false`, recebido `true`) — confirma que o teste ESCRITO NESTA FEATURE de fato discrimina o comportamento central (3 sub-fases) que ela existe para proteger |

**3/3 mutações mortas, 0 sobreviventes.** Árvore restaurada e verificada limpa (`git status --porcelain lib/` vazio) após cada mutação; `npm test` re-confirmado 445/445 verde ao final.

---

### 5. Code Quality Check (spot-check: T1 + T5, representativos de "dados" e "teste novo")

| Check | T1 (`wave-progression.ts`) | T5 (`graph.test.ts` novo bloco) |
| --- | --- | --- |
| No features beyond what was asked | ✅ só 2 linhas de array | ✅ só o teste descrito na task |
| No abstractions for single-use code | ✅ | ✅ reusa `killCurrentBoss`/`step`/`emptyWorld` já existentes |
| No unnecessary "flexibility" added | ✅ | ✅ |
| Only touched files required for task | ✅ 1 arquivo | ✅ 1 arquivo |
| Didn't "improve" unrelated code | ✅ | ✅ (não tocou o teste "plays through" pré-existente mesmo ele tendo um nome de descrição desatualizado — ver nota abaixo) |
| Matches existing patterns/style | ✅ mesmo estilo de array literal | ✅ mesmo padrão `describe`/`it`, mesmos helpers |
| Would senior engineer approve? | ✅ | ✅ |
| Tests map to ACs, non-shallow | N/A (não é teste) | ✅ mapeia diretamente a GOLIVESPLIT-06/07/08, comprovado pelo sensor de mutação #3 |
| Spec-anchored outcome check | ✅ valores batem A1/A2 do spec | ✅ (mecanismo), ⚠️ (ver AC2 acima — valores numéricos pós-cura não afirmados) |
| Coverage Expectation por camada atendida | ✅ | ⚠️ ver gaps GOLIVESPLIT-08 (HUD não coberto por este teste apesar de tasks.md atribuí-lo aqui) |
| Todo teste no escopo mapeia a uma AC/edge case/Done-when | ✅ | ✅ |
| Guideline de projeto seguida | `AGENTS.md` §6 (atualizar/criar testes quando aplicável) — seguida | idem |

**Nota observada (não é achado desta feature, pré-existente):** o teste `graph.test.ts:121` ainda se chama `"plays through wave-1 -> wave-4 -> final-choice..."` mas seu loop (`for n=1; n<bossNames.length`) agora percorre até `wave-5` de fato (generalização correta, só o texto do título ficou desatualizado). Não editado por nenhum commit desta feature (T5 só adicionou um bloco novo ao final do arquivo) — título cosmético, sem risco funcional. Não abro gap para isso; registro para não confundir revisão futura.

---

### Ranked gaps (para eventual fix→re-verify)

1. **GOLIVESPLIT-04** — volley pattern da onda 4 (`bossIndex%4===3`) sem nenhum teste automatizado (nem antes, nem depois desta feature). Fix sugerido: exportar `computeBossVolleyPlan` (ou testar via `stepWorld` com boss em cooldown) e afirmar `pattern===3`/`volleySize===5`/ângulo `aimed±(i-2)×0.24`.
2. **GOLIVESPLIT-08** — HUD não testado para `bossIndex:4` (nome "Comitê Executivo"). Fix sugerido: estender `waves.test.ts:195-204` com um segundo caso `bossIndex:4`.
3. **GOLIVESPLIT-09** — HUD de bioma não testado para `bossIndex:4` (nome "Sala do Conselho"). Mesmo fix do #2, mesmo teste.
4. **GOLIVESPLIT-10** — `obstacleTemplates`/`spawnObstacles` nunca exercitados com `bossIndex:4`. Fix sugerido: um teste em `spawn.test.ts` chamando `obstacleTemplates(world_com_bossIndex_4)` e afirmando os 3 kinds/labels do tema "Sala do Conselho".
5. **GOLIVESPLIT-06** (spec-precision gap, severidade menor) — afirmar os valores exatos pós-cura (`maxHp`/`size`) no teste já existente de T5, em vez de só o evento `bossPhaseAdvanced`.

Nenhum destes é uma regressão de comportamento — todos os 5 pontos de código correspondentes foram lidos e confirmados corretos nesta rodada. São gaps de **cobertura de teste automatizado** (evidence-or-zero), não de funcionalidade.

---

## Rodada 2 — separar-golive-diretoria — 2026-09-10 — commits 63c4bc1..5c20264

**Verifier**: agente novo, independente da Rodada 1 e do fix cycle 1 (author ≠ verifier) — nenhum contexto herdado, tudo re-derivado a partir do diff, do spec.md e da Rodada 1 (lida por completo antes de escrever qualquer coisa).

### Escopo do fix cycle 1

`git log --oneline 63c4bc1..5c20264`:

```
c08946f fix(cycle-1): add test coverage for wave-4 boss volley pattern (GOLIVESPLIT-04)
092070d fix(cycle-1): add wave-5 HUD label coverage (GOLIVESPLIT-08, GOLIVESPLIT-09)
24d726a fix(cycle-1): add test coverage for wave-5 obstacle theme (GOLIVESPLIT-10)
5c20264 fix(cycle-1): assert exact post-heal HP/size values for final boss phases (GOLIVESPLIT-06)
```

`git diff 63c4bc1..5c20264 -- lib/` — 4 arquivos de teste + 1 mudança de produção (só visibilidade, sem mudança de comportamento):

- `lib/pixel-hunt-engine/__tests__/physics.test.ts` (+2 testes, GOLIVESPLIT-04)
- `lib/pixel-hunt-engine/phases/normal-run/__tests__/graph.test.ts` (+4 asserções no bloco existente, GOLIVESPLIT-06)
- `lib/pixel-hunt-engine/phases/normal-run/__tests__/spawn.test.ts` (+1 teste, GOLIVESPLIT-10)
- `lib/pixel-hunt-engine/phases/normal-run/__tests__/waves.test.ts` (+1 teste, GOLIVESPLIT-08/09)
- `lib/pixel-hunt-engine/physics.ts:358` — `function computeBossVolleyPlan` → `export function computeBossVolleyPlan` (só torna a função pura já existente testável por import direto; zero mudança de lógica, confirmado por diff de 1 linha)

Nenhum outro arquivo de produção tocado. Confirma o esperado: fix cycle puramente de cobertura de teste, sem risco de regressão funcional nova.

---

### 1. Re-verificação spec-anchored dos 5 gaps da Rodada 1

| Gap (Rodada 1) | Spec-defined outcome | `file:line` + assertion (fix cycle 1) | Result |
| --- | --- | --- | --- |
| GOLIVESPLIT-04 (P1 story1 AC4) — volley onda 4 usa `pattern=bossIndex%4=3`, leque estreito, 5 "Incidente P1" | `computeBossVolleyPlan(bossIndex:3).pattern===3`, `.volleySize===5`; shots spawnados `kind:"incident"`, `label:"P1"` | `lib/pixel-hunt-engine/__tests__/physics.test.ts:355-374` — `expect(plan!.pattern).toBe(3)` (l.361), `expect(plan!.volleySize).toBe(5)` (l.362); segundo teste roda `stepWorld` e afirma `expect(spawnedIncidents.length).toBeGreaterThan(0)` + `expect(spawnedIncidents.every((e) => e.label === "P1")).toBe(true)` (l.372-373). Implementação confirmada em `physics.ts:366-369,402-403`: `pattern = run.bossIndex % 4` (→3), `volleySize = pattern===3 ? 5 : ...` (→5), `kind: pattern===3 ? "incident" : ...`, `label: pattern===3 ? "P1" : ...` | ✅ PASS |
| GOLIVESPLIT-06 (P1 story2 AC2) — cura com `maxHp=finalBossHp(phase,5)`, `size=62+bossPhase×6` | Pós-cura fase 1→2: `maxHp=finalBossHp(2,5)=210+96+110=416`... (calculado via fórmula, não hardcoded); `size=62+2*6=74`. Fase 2→3: `maxHp=finalBossHp(3,5)`, `size=62+3*6=80` | `lib/pixel-hunt-engine/phases/normal-run/__tests__/graph.test.ts:214-218` — `expect(bossAfterPhase1.maxHp).toBe(finalBossHp(2, 5))`, `expect(bossAfterPhase1.size).toBe(62 + 2 * 6)`; `:225-228` — `expect(bossAfterPhase2.maxHp).toBe(finalBossHp(3, 5))`, `expect(bossAfterPhase2.size).toBe(62 + 3 * 6)`. Implementação em `physics.ts:576-578`: `enemy.maxHp = scaledEnemyHp(finalBossHp(enemy.bossPhase, run.wave), run.callLoops)`, `enemy.size = 62 + enemy.bossPhase * 6` — valores batem exatamente (o teste usa a mesma fórmula pública `finalBossHp`, não um número mágico, o que é aceitável porque o spec define o outcome via fórmula, não um literal fixo) | ✅ PASS |
| GOLIVESPLIT-08 (P1 story2 AC4) — HUD exibe `bossNames[4]` ("Comitê Executivo") na onda 5 | `hudLabels(world).boss === "Comitê Executivo"` para `bossIndex===4` | `lib/pixel-hunt-engine/phases/normal-run/__tests__/waves.test.ts:207-218` — `expect(labels?.boss).toBe(bossNames[4])` (l.214) E `expect(labels?.boss).toBe("Comitê Executivo")` (l.215, valor literal explícito, não só a referência à constante) | ✅ PASS |
| GOLIVESPLIT-09 (P2 AC1) — HUD exibe `biomeNames[4]` ("Sala do Conselho") na onda 5 | `hudLabels(world).biome === "Sala do Conselho"` para `bossIndex===4` | mesmo teste, `lib/pixel-hunt-engine/phases/normal-run/__tests__/waves.test.ts:216-217` — `expect(labels?.biome).toBe(biomeNames[4])` E `expect(labels?.biome).toBe("Sala do Conselho")` (valor literal explícito) | ✅ PASS |
| GOLIVESPLIT-10 (P2 AC2) — obstáculos da onda 5 usam o 5º conjunto (`board`/`chair`/`rack`), não reaproveita o índice 3 | `obstacleTemplates({bossIndex:4})` retorna `[{kind:"board",label:"Pauta",...},{kind:"chair",label:"Cadeira de couro",...},{kind:"rack",label:"Servidor de backup",...}]` | `lib/pixel-hunt-engine/phases/normal-run/__tests__/spawn.test.ts:133-144` — `expect(templates).toEqual([{kind:"board",label:"Pauta",width:80,height:46},{kind:"chair",label:"Cadeira de couro",width:40,height:44},{kind:"rack",label:"Servidor de backup",width:58,height:70}])`. Confirmado batendo exatamente o array `templates[4]` em `spawn.ts:69-74` | ✅ PASS |

**Resultado: 5/5 gaps agora fechados**, todos com `file:line` e valor exato batendo o spec (não apenas "existe uma asserção"). Nenhum spec-precision gap remanescente — GOLIVESPLIT-06 usa a fórmula pública `finalBossHp`/`62+bossPhase×6` (a mesma que a spec define como outcome), o que é o padrão correto e não um enfraquecimento da asserção.

---

### 2. Confirmação das outras 6 ACs (já PASS na Rodada 1)

Nenhum arquivo além dos 4 testes + 1 export foi tocado pelo fix cycle 1 (confirmado no diff acima). As ACs GOLIVESPLIT-01, 02, 03, 05, 07, 11 dependem de `spawn.ts`, `graph.ts`, `boss.ts`, `waves.ts` (produção) e dos blocos de teste pré-existentes em `graph.test.ts`/`spawn.test.ts`/`boss.test.ts` — nenhum desses foi alterado nesta rodada de fix (só o bloco GOLIVESPLIT-06 em `graph.test.ts` ganhou linhas extras, sem tocar as asserções pré-existentes de `bossDefeated`/`bossPhaseAdvanced`/`state.phase.id`). Suíte completa passando (449/449, ver Gate abaixo) confirma que nada quebrou.

**Status**: ✅ Continuam PASS, sem re-derivação completa (checagem rápida, conforme instrução desta rodada).

---

### 3. Gate Check (rodado do zero nesta sessão)

```
npm test        → Test Files 43 passed (43) | Tests 449 passed (449), 0 failed
npm run build   → ✓ Compiled successfully, TypeScript ok, 9 rotas/handlers gerados sem erro
```

449 = 445 (Rodada 1) + 4 testes novos (2 em `physics.test.ts` GOLIVESPLIT-04, 1 em `spawn.test.ts` GOLIVESPLIT-10, 1 em `waves.test.ts` GOLIVESPLIT-08/09; GOLIVESPLIT-06 só adicionou asserções a um teste já existente, não um teste novo). Nenhuma flakiness observada — rodado uma única vez, verde de primeira, sem necessidade de retry.

---

### 4. Discrimination Sensor (3 mutações, estado descartável, árvore restaurada após cada uma e verificada limpa)

| # | Mutação | `file:line` | Descrição | Morta? |
| --- | --- | --- | --- | --- |
| 1 | `pattern === 3 ? 5 : ...` → `pattern === 4 ? 5 : ...` | `lib/pixel-hunt-engine/physics.ts:369` (`computeBossVolleyPlan`) | Quebra a condição que o novo teste GOLIVESPLIT-04 afirma (`volleySize` deixaria de ser 5 para `bossIndex%4===3`) | ✅ Morta — `physics.test.ts`: `AssertionError: expected 3 to be 5` no teste `"returns pattern=3 ... volleySize=5"` |
| 2 | `enemy.size = 62 + enemy.bossPhase * 6` → `* 5` | `lib/pixel-hunt-engine/physics.ts:578` (cura/avanço de sub-fase) | Altera o valor pós-cura que o novo teste GOLIVESPLIT-06 afirma | ✅ Morta — `graph.test.ts`: `AssertionError: expected 72 to be 74` no teste do bloco GOLIVESPLIT-06/07/08 |
| 3 | `bossNames[4] = "Comitê Executivo"` → `"Comite Executivo Alterado"` | `lib/pixel-hunt-engine/phases/normal-run/wave-progression.ts:28` (`bossNames`) | Altera o nome que os novos testes GOLIVESPLIT-08 afirmam via literal explícito | ✅ Morta — `waves.test.ts`: `AssertionError: expected 'Comite Executivo Alterado' to be 'Comitê Executivo'` no teste `"reflects boss/biome for wave 5"` |

**3/3 mutações mortas, 0 sobreviventes.** Cada mutação foi aplicada isoladamente, o(s) teste(s) relevante(s) rodado(s), a falha confirmada e a árvore restaurada via `git checkout --` antes da próxima mutação; `git status --porcelain lib/` verificado vazio após cada restauração. `npm test` re-confirmado 449/449 verde ao final de todas as mutações.

Isso prova que os 4 testes/blocos novos do fix cycle 1 (GOLIVESPLIT-04, 06, 08/09, 10) de fato discriminam o comportamento que fecham — não são tautológicos.

---

### 5. Code Quality Check (spot-check do fix cycle 1)

| Check | Avaliação |
| --- | --- |
| No features beyond what was asked | ✅ — só testes novos/asserções extras, nenhum código de produção novo (exceto o `export` de visibilidade) |
| No abstractions for single-use code | ✅ |
| No unnecessary "flexibility" added | ✅ |
| Only touched files required for task | ✅ — 4 arquivos de teste + 1 linha de export |
| Didn't "improve" unrelated code | ✅ — nenhuma asserção pré-existente foi alterada, só extensão |
| Matches existing patterns/style | ✅ — mesmo estilo `describe`/`it`, mesmos helpers (`makeWorld`, `makeEnemy`, `killCurrentBoss`) |
| Would senior engineer approve? | ✅ |
| Spec-anchored outcome check | ✅ — todos os 5 fecham com valor exato, não vago |
| Todo teste no escopo mapeia a uma AC | ✅ — cada novo teste cita o `GOLIVESPLIT-NN` correspondente no próprio nome do `describe`/comentário |
| Guideline de projeto seguida | `AGENTS.md` §6 (atualizar/criar testes quando aplicável) — seguida |

---

### Resumo da Rodada 2

**Veredito: PASS ✅** — os 5 gaps de cobertura da Rodada 1 (GOLIVESPLIT-04, 06, 08, 09, 10) foram fechados com asserções que batem exatamente o outcome definido no spec, com `file:line` verificável. As outras 6 ACs continuam PASS (nenhum arquivo de produção relevante foi tocado pelo fix cycle 1, além do único `export` de visibilidade em `physics.ts`, sem mudança de comportamento). Gate check limpo (449 passed, 0 failed; build ok). Sensor de discriminação: 3/3 mutações mortas, 0 sobreviventes — os testes novos discriminam de verdade o comportamento que protegem.

**Nenhum gap remanescente. Feature `separar-golive-diretoria` verificada e pronta.**
