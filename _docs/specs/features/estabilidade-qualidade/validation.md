# Validação: estabilidade-qualidade

## Status atual

- **Veredito**: RESOLVIDO (quick fix 2026-08-29) — ver seção "Quick Fix" abaixo
- **Spec vigente**: `_docs/specs/features/estabilidade-qualidade/spec.md`
- **HEAD**: `8c26ca03401b0739a4710a7d03571b3a859a8163` (sem novo commit de produção; correções em testes/spec)
- **Gaps fechados nesta rodada**:
  1. `ESTAB-19` AC4 / C3-T2: mutante `count < limit` → `count <= limit` agora é morto — o teste deriva a decisão do texto real do script Lua em vez de reimplementar a cota.
  2. `AD-004`: comportamento de replay pós-expiração do ledger + eviction do ranking documentado como aceito por design e coberto por teste de regressão.

---

## estabilidade-qualidade — 2026-08-27 — `06b02eff816b7b54fd28b8c0d7ea92b4800287d4..929a204c77aae4a1c3f4f865d7c75da915583dc2`

**Resultado**: FAIL  
**Verifier**: independente (autor != verifier)  
**Spec**: `_docs/specs/features/estabilidade-qualidade/spec.md`  
**HEAD validado**: `929a204c77aae4a1c3f4f865d7c75da915583dc2`

### Conclusão das tarefas

- T1-T10 e T6-F1 estão marcadas como concluídas em `tasks.md`; os 11 commits declarados existem no range.
- Nenhuma tarefa está marcada como parcial ou bloqueada.

### Evidência spec-anchored por AC

| AC | Outcome exato da spec | Evidência `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| P1 Build AC1 | Build Next.js sem erros de TypeScript, ESLint ou panic de bundler. | `package.json:10-12` — `npm run build && npm run lint` retornou exit 0; compilação, TypeScript e ESLint concluíram sem erro. | PASS |
| P1 Testes AC2 | `npm run test` valida limite de 14 caracteres/saneamento e ordenação de `sanitizeScore`/`cleanScores`. | `lib/__tests__/high-scores.test.ts:22` — `expect(result.name).toBe("JAVA PLENO DEV")`; `lib/__tests__/high-scores.test.ts:63` — `expect(cleanScores(...)).toEqual([highestWave, earliest, latest, lowestScore])`; suíte 28/28. | PASS |
| P1 Testes AC3 | Payload inválido retorna `HighScore` válido com `DEV ANON` e valores saneados. | `lib/__tests__/high-scores.test.ts:29` — `expect(sanitizeScore(null)).toEqual({ name: "DEV ANON", score: 0, wave: 1, resets: 0, outcome: "over", createdAt: ... })`. | PASS |
| P1 Debug AC1 | Em development, F1/F2/F3 disparam respectivamente toggle, spawn boss e power-up. | `lib/__tests__/debug.test.ts:44-60` — `expect(actions).toEqual([expectedAction])` para F1/F2/F3; `app/__tests__/game-debug.test.tsx:54-61` — F1 abre e fecha o dialog de debug. | PASS |
| P1 Debug AC2 | O botão Spawn Boss Final transiciona imediatamente para boss com barra de vida completa. | `app/__tests__/game-debug.test.tsx:68-71` só exige heading `Em combate` e texto `Chefe em combate`; não há asserção sobre entidade boss nem `hp === maxHp`. O mutante em `app/page.tsx:963` removendo `spawnEnemy("boss")` manteve 4/4 testes verdes. | FAIL |
| P1 Debug AC3 | Testar Tela de Vitória encerra com status `won` e abre entrada de High Score. | `app/__tests__/game-debug.test.tsx:93-97` — exige dialog de ranking, `Missão completa` e textbox; `app/page.tsx:976-981` define `lastOutcome`/estado como `won`. | PASS |
| P2 API AC1 | Sem `BLOB_READ_WRITE_TOKEN`, POST responde amigavelmente sem exceção não tratada. | `app/api/__tests__/scores.test.ts:67-68` — `expect(response.status).toBe(200)` e `expect(body.storage).toBe("local")`. | PASS |
| P2 API AC2 | Envios consecutivos antes de 10 s são limitados; em 10 s são aceitos. | `app/api/__tests__/scores.test.ts:92-97` — status 429, `Retry-After: 10` e payload exato `{ error, retryAfterMs: 10000 }`; `app/api/__tests__/scores.test.ts:83` — segunda resposta após 10 s é 201. | PASS |
| P2 Cliente AC3 | Falha de rede preserva score no `localStorage` e há retry posterior no load/online. | `app/__tests__/score-sync.test.tsx:67-76` — payload local exato; `app/__tests__/score-sync.test.tsx:93-95` — retry no load; `app/__tests__/score-sync.test.tsx:114-117` — retry no evento `online`. | PASS |
| P3 Sonar AC1 | Executar SonarQube reduz o número de Code Smells em `app/page.tsx` pela extração de ternários aninhados. | `app/page.tsx:139-146` contém helpers extraídos, mas não há asserção/medição Sonar antes/depois; o servidor referenciado por `.scannerwork/report-task.txt` não respondeu. Evidence-or-zero. | FAIL |
| P3 CSS AC2 | `.legal-shell` usa `min-height: 100dvh` e evita corte mobile. | `app/globals.css:1268-1271` contém a declaração correta, porém `app/__tests__/legal-pages.test.tsx:10-24` só valida headings/links e não inspeciona CSS ou comportamento de viewport. Evidence-or-zero. | FAIL |

**Spec-anchored check**: 8/11 ACs confirmaram o outcome exato; 3 gaps, 0 spec-precision gaps.

### Payload / conjunction rule

- PASS: fallback de sanitização compara o objeto completo, incluindo `name`, números, `outcome` e `createdAt` (`lib/__tests__/high-scores.test.ts:29-36`).
- PASS: fallback Blob compara status e payload completo com `scores` e `storage` (`app/api/__tests__/scores.test.ts:53-57`).
- PASS: throttle compara em conjunto status 429, header `Retry-After`, mensagem e `retryAfterMs` (`app/api/__tests__/scores.test.ts:92-97`).
- PASS: fallback offline compara todos os campos persistidos no `localStorage` (`app/__tests__/score-sync.test.tsx:67-76`).
- FAIL: spawn de boss verifica apenas estado/texto derivado, não a entidade exigida nem `hp === maxHp` (`app/__tests__/game-debug.test.tsx:68-71`).

### Edge cases

- PASS: payload nulo, fallback `DEV ANON`, clamps inferiores/superiores e limite de nome.
- PASS: desempate de ranking por score, wave e data.
- PASS: token Blob ausente e exceção de configuração do Blob.
- PASS: fronteira exata de 10 s, bloqueio antes da fronteira e fallback `x-real-ip`.
- PASS: falha de rede, retry no carregamento e no evento `online`.
- GAP: boss indicado pelo HUD sem entidade correspondente não é detectado.
- GAP: renderização mobile real de `.legal-shell` não é exercitada.

### Gate e integridade dos testes

- **Gate Build**: `npm run build && npm run lint` — exit 0.
- **Suíte completa**: `npm run test` — 7 arquivos, 28 testes passados, 0 falhos, 0 skips.
- **Antes da feature**: 0 testes e nenhum script `test` no commit `06b02eff816b7b54fd28b8c0d7ea92b4800287d4`.
- **Depois da feature**: 28 testes; delta +28.
- **Integridade**: nenhum `.skip`, `.todo` ou `SPEC_DEVIATION`; `git diff --check` passou.

### Sensor de discriminação

| Mutação | Local | Falha injetada | Resultado |
| --- | --- | --- | --- |
| M1 | `lib/high-scores.ts:29` | Fallback `DEV ANON` alterado para `MUTANT`. | KILLED — `high-scores.test.ts:29` falhou (1/5). |
| M2 | `app/api/scores/route.ts:26` | Limite `< 10000` alterado para `<= 10000`. | KILLED — `scores.test.ts:83` falhou (1/5). |
| M3 | `app/page.tsx:963` | Removido o side effect `spawnEnemy("boss")`, mantendo estado/HUD. | SURVIVED — 4/4 testes de debug passaram. |

**Profundidade**: lightweight, 3 mutações comportamentais em cópias temporárias.  
**Resultado**: 2 killed, 1 survived — FAIL.

### Qualidade de código e testes

| Check | Resultado |
| --- | --- |
| Mudanças limitadas ao escopo declarado | PASS |
| Sem abstrações/flexibilidade desnecessárias | PASS |
| Padrões e estilo existentes preservados | PASS |
| Build, TypeScript, lint e diff whitespace | PASS |
| Testes de UI consultam por role/label/texto visível | PASS |
| Testes de rede usam MSW conforme `testing-a11y` | FAIL — `app/__tests__/game-debug.test.tsx:31` usa `vi.stubGlobal("fetch", ...)`. |
| Cobertura 1:1 dos ACs e outcomes | FAIL — P1 Debug AC2, P3 AC1 e P3 AC2. |
| Testes em escopo reivindicados por AC/edge/done-when | PASS — AdSense e páginas legais mapeiam aos done-when de T3/T10. |

### Gaps ranqueados

1. **Major — P1 Debug AC2 / sensor M3**: ausência de asserção discriminante para entidade boss e vida inicial completa; remover o spawn real não quebra a suíte (`app/__tests__/game-debug.test.tsx:64-72`).
2. **Major — P3 Sonar AC1**: não existe evidência quantitativa antes/depois de Code Smells em `app/page.tsx`; o outcome “número reduzido” não foi demonstrado.
3. **Major — P3 CSS AC2**: a declaração existe, mas não há teste que prove `min-height: 100dvh`/ausência de corte mobile (`app/__tests__/legal-pages.test.tsx:10-24`).
4. **Minor — guideline de testes**: mock direto de `fetch` em `app/__tests__/game-debug.test.tsx:31` viola a regra de MSW de `.agents/skills/testing-a11y/SKILL.md:11-18`.

### Veredito

**FAIL** — gate e suíte estão verdes, mas evidence-or-zero e o sensor impedem aprovação: 8/11 ACs têm outcome exato confirmado e 1/3 mutações sobreviveu.

---

## estabilidade-qualidade — 2026-08-27 — `929a204...b8217af`

**Resultado**: FAIL  
**Verifier**: substituto independente (autor != verifier; resultados parciais anteriores descartados)  
**Spec**: `_docs/specs/features/estabilidade-qualidade/spec.md`  
**Range validado**: `929a204c77aae4a1c3f4f865d7c75da915583dc2..b8217afad1bacbd7c0e2b4c3c769553461eaf384`

### Conclusão task a task

| Task | Commit | Conclusão e teste |
| --- | --- | --- |
| C1-T1 | `e219e28` | Guardas de autorização debug; suíte acumulada 42/42. |
| C1-T2 | `9dd52ff` | Run debug excluída do ranking/fila; gate da task passou. |
| C1-T3 | `270ab08` | Boss real e vida completa tornados observáveis; gate da task passou. |
| C1-T4 | `e0bb13f` | Efeito observável de F3; gate da task passou. |
| C1-T5 | `3f9a897` | Throttle distribuído; suíte acumulada 54/54. |
| C1-T6 | `ed09da2` | Idempotência compartilhada; suíte acumulada 60/60. |
| C1-T7 | `842b3a0` | Contratos GET/POST integrados; 65/65, build e lint. |
| C1-T8 | `93d4758` | Fila própria versionada/deduplicada; 67/67, build e lint. |
| C1-T9 | `58295dc` | Drain FIFO/mutex; 73/73, build e lint. |
| C1-T10 | `c22467d` | Painel debug migrado para `<dialog>`; 74/74, build e lint. |
| C1-T11 | `551027d` | Playwright mobile; 2/2 E2E, build e lint. |
| C1-T12 | `b8217af` | LCOV/Sonar; 74/74 com cobertura, build e lint. |

As 12 tasks possuem commits atômicos no range e marcadores de execução concluída em `tasks.md`; nenhuma ficou parcial ou bloqueada. Os três commits documentais da emenda (`b106bbb`, `ff4d6d1`, `eedb665`) também existem no range.

### Evidência spec-anchored por AC

| AC | Outcome exato da spec | Evidência `file:line` + asserção/outcome | Resultado |
| --- | --- | --- | --- |
| P1 Build AC1 | Build Next.js sem erro TypeScript, ESLint ou panic. | `package.json:11-12` + gate fresco `npm run build`/`npm run lint`, ambos exit 0; lint com 0 erros e 2 warnings. | PASS |
| P1 Testes AC2 | Vitest valida limite de nome e ordenação de `sanitizeScore`/`cleanScores`. | `lib/__tests__/high-scores.test.ts:22` — `toBe("JAVA PLENO DEV")`; `:63-68` — ordem exata esperada. | PASS |
| P1 Testes AC3 | Payload inválido vira `HighScore` completo com `DEV ANON` e saneamento. | `lib/__tests__/high-scores.test.ts:29-36` — `toEqual` do objeto completo. | PASS |
| P1 Debug AC1 | Dev mapeia F1/F2/F3 para menu/boss/power-up. | `lib/__tests__/debug.test.ts:79-95` — array exato por tecla; `app/__tests__/game-debug.test.tsx:52-65,78-103` — outcomes visíveis. | PASS |
| P1 Debug AC2 | Spawn Boss Final inicia boss real com vida completa. | `app/__tests__/game-debug.test.tsx:88-95` — status `Vida do boss debug` contém `188/188 HP`. | PASS |
| P1 Debug AC3 | Vitória debug encerra como `won` e abre entrada de score. | `app/__tests__/game-debug.test.tsx:121-129` — dialog, `Missão completa` e textbox visíveis. | PASS |
| P2 API AC1 | Blob sem persistência retorna resposta amigável, sem exceção não tratada. | `app/api/__tests__/scores.test.ts:170-182` — status 200, `storage === "local"`, claim liberado. | PASS |
| P2 API AC2 | Submissões próximas são limitadas pela janela mínima. | `app/api/__tests__/scores.test.ts:120-130` — status 429, header `10`, payload exato e zero persistência. | PASS |
| P2 Cliente AC3 | Falha de rede salva localmente e permite sincronização posterior. | `app/__tests__/score-sync.test.tsx:76-125` — ranking e pendência completos; `:153-195` — retries em load/online. | PASS |
| P3 Sonar AC1 / `ESTAB-05` | Extração de ternários reduz smells em `app/page.tsx`. | `_docs/specs/features/estabilidade-qualidade/spec.md:223-225` preserva 54→52; análise fresca mede 52 smells no arquivo. | PASS |
| P3 CSS AC2 | Legal shell usa `min-height: 100dvh` sem corte mobile. | `e2e/legal-pages-mobile.spec.ts:12-24` — CSS computado 844px, overflow, scroll e último link dentro da viewport nas duas rotas. | PASS |
| `ESTAB-06` AC1 | Fora de development, query alguma autoriza debug. | `lib/__tests__/debug.test.ts:23-27` — `isDebugAllowed("?debug=1") === false` em production. | PASS |
| `ESTAB-06` AC2 | Listener revalida ambiente e allowlist antes da ação. | `lib/__tests__/debug.test.ts:29-45` — allowlist positiva/negativa; `app/__tests__/game-debug.test.tsx:132-148` — eventos production/inválido ignorados. | PASS |
| `ESTAB-06` AC3 | Evento não autorizado não altera estado, entidades, HUD nem ranking. | `app/__tests__/game-debug.test.tsx:138-148` só prova heading/HUD/dialog; não há asserção de entidades, POST ou storage/ranking. Evidence-or-zero da conjunção. | FAIL |
| `ESTAB-07` AC1 | Primeira ação que altera a run marca origem debug até reinício. | `app/__tests__/score-sync.test.tsx:128-150` — boss e vitória na mesma run ainda bloqueiam save; `app/page.tsx:1071-1076,1091-1097` mostra reset normal e marcação debug. | PASS |
| `ESTAB-07` AC2 | Run debug não entra no ranking global nem na fila. | `app/__tests__/score-sync.test.tsx:146-150` — mensagem exata, zero POST e pending key ausente. | PASS |
| `ESTAB-07` AC3 | API rejeita payload debug sem Blob write. | `app/api/__tests__/scores.test.ts:98-107` — 400, payload exato, zero throttle/write. | PASS |
| `ESTAB-08` AC1 | Primeira submissão adquire chave compartilhada atomicamente por 10 s. | `lib/__tests__/score-rate-limit.test.ts:14-28` — chave SHA-256 e `set(...,{nx:true,ex:10})`; API happy path em `scores.test.ts:78-95`. | PASS |
| `ESTAB-08` AC2 | Mesma chave ativa retorna contrato 429 sem persistir/renovar TTL. | `lib/__tests__/score-rate-limit.test.ts:31-40` — uma operação; `scores.test.ts:120-130` — status/header/body exatos e zero claim/write. | PASS |
| `ESTAB-08` AC3 | Aos 10 s, nova janela pode ser adquirida. | `lib/__tests__/score-rate-limit.test.ts:43-56,59-71` — nova aquisição e fronteira local exata em 11.000 ms. | PASS |
| `ESTAB-08` AC4 | Redis indisponível em production retorna 503, sem Blob, e cliente mantém fila. | `app/api/__tests__/scores.test.ts:133-141` — 503/zero write; `app/__tests__/score-sync.test.tsx:261-285` — item mantido em 503. | PASS |
| `ESTAB-08` AC5 | Fora de production pode usar memória com TTL equivalente e observabilidade local. | `lib/__tests__/score-rate-limit.test.ts:59-71,100-108` — backend `local-memory`, fronteira e Redis factory não usada. | PASS |
| `ESTAB-09` AC1 | Falha própria por rede/429/503 cria pendência em chave separada. | `app/__tests__/score-sync.test.tsx:76-125` prova criação apenas para rede; `:261-285` parte de fila preexistente para 429/503. `app/page.tsx:682-688` ainda trata `storage:"local"` como sucesso sem pendência. | FAIL |
| `ESTAB-09` AC2 | Entrada versionada preserva ID e envia `Idempotency-Key` em retries. | `app/__tests__/score-sync.test.tsx:105-124,153-172` — modelo completo, corpo saneado e header igual ao ID estável. | PASS |
| `ESTAB-09` AC3 | Mesmo `submissionId` mantém uma entrada. | `app/__tests__/score-sync.test.tsx:325-344` — duplicata/malformados resultam em um único POST com o ID válido. | PASS |
| `ESTAB-09` AC4 | ID concluído por 24 h responde idempotente sem segunda escrita. | `lib/__tests__/score-idempotency.test.ts:49-63,65-74`; `app/api/__tests__/scores.test.ts:144-157` — TTL 86400, 200 idempotente e zero `add`. | PASS |
| `ESTAB-09` AC5 | GET global nunca cria pendência. | `app/__tests__/score-sync.test.tsx:312-323` — ranking salvo e pending key ausente. | PASS |
| `ESTAB-10` AC1 | Load/online inicia uma única drenagem sem sobreposição. | `app/__tests__/score-sync.test.tsx:224-259` — dois eventos durante bloqueio mantêm um POST e `maxInFlight === 1`. | PASS |
| `ESTAB-10` AC2 | FIFO e pelo menos 10 s entre inícios de POST. | `app/__tests__/score-sync.test.tsx:198-221` — nomes em ordem e delta `>= 10000`. | PASS |
| `ESTAB-10` AC3 | Sucesso remove somente o item correspondente e continua. | `app/__tests__/score-sync.test.tsx:198-221` — duas entradas são postadas em ordem e fila termina vazia; remover tudo após a primeira quebraria o outcome. | PASS |
| `ESTAB-10` AC4 | Falha atualiza tentativa, mantém item, para e um trigger futuro tenta novamente. | `app/__tests__/score-sync.test.tsx:261-285` prova attempts/lastAttempt/retenção/stop, mas não dispara load/online posterior nem prova o novo retry. | FAIL |
| `ESTAB-10` AC5 | Load+online concorrentes mantêm um POST e uma sequência de timers. | `app/__tests__/score-sync.test.tsx:224-259` prova `maxInFlight === 1`; nenhuma asserção conta/identifica a única sequência de timers. | FAIL |
| `ESTAB-11` AC1 | Teste falha sem entidade boss e exige `hp === maxHp`. | `app/__tests__/game-debug.test.tsx:88-95` — entidade observável com `188/188 HP`; sensor histórico do spawn foi fechado. | PASS |
| `ESTAB-11` AC2 | F3 prova criação/concessão observável de power-up. | `app/__tests__/game-debug.test.tsx:97-104` — após F3, status contém `1 power-up disponível`. | PASS |
| `ESTAB-12` AC1 | GET retorna somente scores saneados e ordenados. | `app/api/__tests__/scores.test.ts:60-75` — resposta completa HIGH antes de LOW. | PASS |
| `ESTAB-12` AC2 | GET malformado aplica fallbacks sem propagar inválidos. | `app/api/__tests__/scores.test.ts:61-75` — outcome inválido vira `over`, resets clampado e datas normalizadas. | PASS |
| `ESTAB-12` AC3 | POST malformado persiste somente `sanitizeScore(payload)`. | `app/api/__tests__/scores.test.ts:78-95` — `addHighScore` recebe objeto saneado completo. | PASS |
| `ESTAB-13` AC1 | `/privacidade` e `/sobre` em mobile têm 100dvh, scroll e último foco visível. | `e2e/legal-pages-mobile.spec.ts:3-24` — loop nas duas rotas com as três asserções; 2/2 E2E. | PASS |
| `ESTAB-14` AC1 | Painel é `<dialog open>`, nomeado, e close atualiza estado. | `app/__tests__/game-debug.test.tsx:52-75` — tag `DIALOG`, atributo `open`, nome acessível e remoção após `close`. | PASS |
| `ESTAB-14` AC2 | S6819 do diálogo debug fica resolvida. | `app/page.tsx:2242-2267` usa `<dialog>`; análise fresca não lista S6819 no painel debug (as seis S6819 remanescentes são overlays históricos distintos). | PASS |
| `ESTAB-15` AC1 | Coverage compatível gera LCOV consumível. | `package.json:14`, `vitest.config.ts:17-21`; `npm run test:coverage` passou 74/74 e gerou `coverage/lcov.info` com 39.344 bytes. | PASS |
| `ESTAB-15` AC2 | Sonar importa cobertura >0%. | Análise `9e28dd0c-5098-4fc2-8e5a-5d974d9be5e9` em `b8217af`: `SUCCESS`, total 64,7%, new 87,1%; JaCoCo N/A para TypeScript. | PASS |

**Spec-anchored check**: 38/42 ACs confirmaram o outcome exato; 4 AC gaps e 0 spec-precision gaps.

### Edge cases e integridade

- PASS: payload nulo/malformado, clamps, nome de 14 caracteres, ordenação e datas.
- PASS: debug production com `?debug=1`, teclado e evento forjado; allowlist negativa.
- PASS: TTL Redis exato, NX não adquirido, credenciais ausentes e erro externo sem IP em claro.
- PASS: claim concorrente, completed por 24 h, release somente in-flight e fail-closed.
- PASS: fila duplicada/parcialmente corrompida, FIFO, vazia, rede/429/503 e triggers sobrepostos.
- GAP: ausência de prova de ranking/entidades intactos para evento debug inválido; criação direta de pendência em 429/503; retry pós-falha; unicidade do timer.
- GAP comportamental: `storage: "local"` libera o claim no servidor, mas `submitScore`/drain remove ou não cria pendência no cliente (`app/page.tsx:552,682-688`), impedindo sincronização global futura.
- Baseline no commit `929a204`: 7 arquivos/28 testes Vitest. Atual: 9 arquivos/74 testes Vitest, delta +46; Playwright 2 testes novos. Nenhum arquivo de teste foi apagado no range.
- Integridade: nenhum `.skip`, `.todo`, `.only` ou `SPEC_DEVIATION`; `git diff --check` passou. Alterações alheias permaneceram intocadas.

### Gates completos

| Gate | Resultado |
| --- | --- |
| `npm run test` | PASS — 9 arquivos, 74 passados, 0 falhos, 0 skips. |
| `npm run test:coverage` | PASS — 74/74; statements 67,14%, branches 59,02%, functions 75,8%, lines 68,42%; LCOV 39.344 bytes. |
| `npm run build` | PASS — Next.js 16.3.3, TypeScript e geração das 5 páginas concluídos. |
| `npm run lint` | PASS — 0 erros, 2 warnings (`coverage/lcov-report/block-navigation.js:1`, `lib/debug.ts:26`). |
| `npm run test:e2e` | PASS — 2/2 em mobile Chromium. |
| SonarQube | Scanner/CE `SUCCESS`; Quality Gate `ERROR`: new coverage 87,1% OK, duplicação nova 2,04521% OK, 3 novas violações FAIL. |

### Sensor de discriminação

| Mutação | Local | Falha injetada | Resultado |
| --- | --- | --- | --- |
| M1 | `lib/debug.ts:26` | Autorização invertida para liberar production e bloquear development. | KILLED — 15 falhas focadas em debug. |
| M2 | `lib/score-rate-limit.ts:64` | TTL Redis de 10 para 11 segundos. | KILLED — 2/7 testes do adapter falharam. |
| M3 | `app/page.tsx:552` | Remoção da pendência após sucesso eliminada. | KILLED — 4/12 testes de sincronização falharam. |

**Profundidade**: lightweight, três mutações comportamentais em cópia `/tmp` descartada; árvore real preservada.  
**Resultado**: 3 killed, 0 survived — PASS.

### Sonar e qualidade

- Análise fresca: `SUCCESS`, revisão `b8217afad1bacbd7c0e2b4c3c769553461eaf384`.
- Quality Gate: `ERROR` por `typescript:S3776` em `app/page.tsx:526`, `typescript:S1871` em `app/page.tsx:1094` e `typescript:S7776` em `lib/debug.ts:11`.
- Métricas: cobertura total 64,7%, cobertura nova 87,1%, bugs 0, vulnerabilidades 22, code smells 54, duplicação 1,3%.
- `app/page.tsx`: 52 code smells e 62,1% de cobertura. O S6819 específico do painel debug foi removido; seis S6819 históricos permanecem em outros overlays.
- JaCoCo: N/A para TypeScript; LCOV é o formato correto e foi importado.
- Qualidade de testes ainda registra a questão fora de escopo já preservada em `spec.md:216-221`: `game-debug.test.tsx:32` usa mock direto de `fetch` em vez de MSW.

### Gaps ranqueados

1. **Major — `ESTAB-09` AC1 / contrato de resiliência**: submissões novas não têm evidência de enqueue para 429/503, e `storage: "local"` é tratado como sucesso sem pendência (`app/page.tsx:682-688`), perdendo a sincronização global posterior.
2. **Major — `ESTAB-10` AC4**: falta prova de que a mesma entrada retida após rede/429/503 é reenviada em um trigger posterior (`app/__tests__/score-sync.test.tsx:261-285`).
3. **Major — `ESTAB-06` AC3**: ausência de asserção conjunta de zero alteração em entidades e ranking para eventos não autorizados (`app/__tests__/game-debug.test.tsx:132-148`).
4. **Minor — `ESTAB-10` AC5**: o teste de concorrência mede POST em voo, não a unicidade da sequência de timers (`app/__tests__/score-sync.test.tsx:224-259`).
5. **Major — objetivo de qualidade P3**: Quality Gate continua `ERROR` por três novas violações; `ESTAB-15` passa porque cobertura foi importada e é >0%, mas a branch ainda não está pronta para aprovação de qualidade.

### Veredito

**FAIL** — 38/42 ACs têm outcome exato confirmado. Todos os gates passaram e 3/3 mutações foram mortas, mas quatro conjunções permanecem sem evidência completa e o fallback `storage: "local"` viola o fluxo de retry definido no design.

---

## estabilidade-qualidade — 2026-08-28 — `b8217af...7fc3c20`

**Resultado**: FAIL  
**Verifier**: substituto independente; avaliação parcial anterior descartada  
**Spec**: `_docs/specs/features/estabilidade-qualidade/spec.md`  
**Range validado**: `b8217afad1bacbd7c0e2b4c3c769553461eaf384..7fc3c20cd8511de387c4e7bb4eccf286ada9fa7e`

### Conclusão task a task

| Task | Commit | Resultado |
| --- | --- | --- |
| C2-T1 | `27d1840` | PARTIAL — implementação de token/CAS presente; falta prova Redis de `release` com owner antigo (`ESTAB-16` AC2-AC3). |
| C2-T2 | `ea698b7` | PASS — store local replica ownership e fronteiras de 60 s/24 h. |
| C2-T3 | `3798c48` | PASS — codec legado/v2, ledger e projeção pública. |
| C2-T4 | `02926d9` | PASS — ETag, merge, dedupe e limite de três conflitos. |
| C2-T5 | `5264429` | PASS da task — rota autoritativa, fast paths e falha parcial; gap de integridade do AC original P2 API AC1 registrado separadamente. |
| C2-T6 | `2237aa5` | PASS — rede/429/503/storage local criam ou preservam pendência. |
| C2-T7 | `8387056` | PASS — retry posterior, ID estável, mutex e timer único. |
| C2-T8 | `a7965e0` | PASS — isolamento debug e retorno à elegibilidade normal. |
| C2-T9 | `a52a00c` | PASS — branches `start()` consolidados com regressão de reset. |
| C2-T10 | `b5db3a7` | PASS — allowlist `ReadonlySet`/`.has()`. |
| C2-T11 | `7fc3c20` | PASS — E2E dinâmico, gates, LCOV e Quality Gate verde. |

Os 11 commits atômicos existem no range. Os commits documentais são `b05b0e5`, `8a5a545` e `886ef7c`. `tasks.md` foi preservado.

### Evidência spec-anchored por AC

| # / AC | Outcome da spec | Evidência `file:line` + assertion/outcome | Resultado |
| --- | --- | --- | --- |
| 1 P1 Build AC1 | Build sem TypeScript/ESLint/panic. | `package.json:11-12`; gates frescos `npm run build` e `npm run lint` exit 0, 0 erros. | PASS |
| 2 P1 Testes AC2 | Sanitização, limite de nome e ordenação. | `lib/__tests__/high-scores.test.ts:53-57` — nome exato; `:91-102` — ordem completa. | PASS |
| 3 P1 Testes AC3 | Payload inválido vira `DEV ANON` saneado. | `lib/__tests__/high-scores.test.ts:59-70` — `toEqual` do `HighScore` completo. | PASS |
| 4 P1 Debug AC1 | F1/F2/F3 mapeiam menu/boss/power-up em dev. | `lib/__tests__/debug.test.ts:79-95` — array exato de actions; `game-debug.test.tsx:67-80,103-118` — outcomes. | PASS |
| 5 P1 Debug AC2 | Boss real com vida completa. | `app/__tests__/game-debug.test.tsx:103-110` — status exato `188/188 HP`. | PASS |
| 6 P1 Debug AC3 | Vitória debug encerra `won` e abre entrada. | `app/__tests__/game-debug.test.tsx:149-158` — dialog, “Missão completa” e textbox. | PASS |
| 7 P2 API AC1 | Token Blob ausente produz resposta amigável, sem throw não tratado. | Não há teste atual que remova `BLOB_READ_WRITE_TOKEN`; `scores.test.ts:197-205` cobre erro Redis, não o WHEN específico. O teste Blob/local anterior foi removido. Evidence-or-zero. | FAIL |
| 8 P2 API AC2 | Envios próximos sofrem limite mínimo. | `app/api/__tests__/scores.test.ts:184-195` — 429, header `10`, payload e zero persistência. | PASS |
| 9 P2 Cliente AC3 | Rede salva localmente e sincroniza depois. | `app/__tests__/score-sync.test.tsx:76-140` — fila completa; `:202-245` — load/online removem após Blob. | PASS |
| 10 P3 Sonar AC1 | Smells em `app/page.tsx` reduzidos. | Sonar atual mede 51 smells contra histórico 54; `_docs/specs/features/estabilidade-qualidade/spec.md:229-231` registra baseline. | PASS |
| 11 P3 CSS AC2 | `100dvh` evita corte mobile. | `e2e/legal-pages-mobile.spec.ts:17-29` — 844/667 px, overflow, scroll e foco visível. | PASS |
| 12 `ESTAB-06` AC1 | Produção bloqueia qualquer query debug. | `lib/__tests__/debug.test.ts:23-27` — `?debug=1` retorna false. | PASS |
| 13 `ESTAB-06` AC2 | Listener revalida ambiente e allowlist. | `lib/__tests__/debug.test.ts:29-45,47-76`; `game-debug.test.tsx:160-183` — eventos ignorados. | PASS |
| 14 `ESTAB-06` AC3 | Evento inválido não altera estado, entidades, HUD ou ranking. | `game-debug.test.tsx:29-40,160-183` — snapshot conjunto de HUD, boss, power-up, POST e duas chaves permanece igual. | PASS |
| 15 `ESTAB-07` AC1 | Run fica debug até reinício. | `score-sync.test.tsx:144-199` — run debug bloqueada e nova run normal elegível. | PASS |
| 16 `ESTAB-07` AC2 | Run debug não entra no ranking/fila. | `score-sync.test.tsx:175-180` — zero POST e pending ausente. | PASS |
| 17 `ESTAB-07` AC3 | API rejeita debug sem persistir. | `app/api/__tests__/scores.test.ts:112-130` — ambos marcadores 400 e zero adapters/Blob. | PASS |
| 18 `ESTAB-08` AC1 | Redis adquire chave IP com NX/EX 10. | `lib/__tests__/score-rate-limit.test.ts:14-29` — chave hasheada e options exatas. | PASS |
| 19 `ESTAB-08` AC2 | Janela ativa retorna contrato 429 sem renovar/persistir. | `score-rate-limit.test.ts:31-41`; `scores.test.ts:184-195` — uma escrita e contrato exato. | PASS |
| 20 `ESTAB-08` AC3 | Expiração libera nova janela. | `score-rate-limit.test.ts:43-56,59-72` — nova aquisição e fronteira de 10 s. | PASS |
| 21 `ESTAB-08` AC4 | Redis indisponível em prod dá 503 e cliente conserva fila. | `scores.test.ts:197-205`; `score-sync.test.tsx:76-140,312-348` — 503 enfileira/retry. | PASS |
| 22 `ESTAB-08` AC5 | Fora de prod usa memória identificada como local. | `score-rate-limit.test.ts:59-72,100-109` — backend `local-memory`, TTL e factory não usada. | PASS |
| 23 `ESTAB-09` AC1 | Rede/429/503 cria pendência separada. | `score-sync.test.tsx:76-140` — `it.each` cria entrada para os três outcomes e storage local. | PASS |
| 24 `ESTAB-09` AC2 | Entrada v1 preserva ID/header em retries. | `score-sync.test.tsx:119-140,202-220,312-348` — modelo completo e mesmo header. | PASS |
| 25 `ESTAB-09` AC3 | Mesmo ID mantém uma entrada. | `score-sync.test.tsx:387-406` — duplicata/malformados produzem um POST. | PASS |
| 26 `ESTAB-09` AC4 | Completed por 24 h retorna idempotente sem segunda escrita. | `score-idempotency.test.ts:127-142`; `scores.test.ts:144-158` — TTL e fast path sem write. | PASS |
| 27 `ESTAB-09` AC5 | GET nunca cria pendência. | `score-sync.test.tsx:374-385` — ranking salvo, pending null. | PASS |
| 28 `ESTAB-10` AC1 | Load/online compartilham uma drenagem. | `score-sync.test.tsx:273-310` — triggers sobrepostos mantêm primeiro POST. | PASS |
| 29 `ESTAB-10` AC2 | FIFO e intervalo mínimo de 10 s. | `score-sync.test.tsx:247-270` — ordem e delta `>= 10000`. | PASS |
| 30 `ESTAB-10` AC3 | Sucesso remove só item correspondente e continua. | `score-sync.test.tsx:247-270` — dois IDs em ordem e fila vazia. | PASS |
| 31 `ESTAB-10` AC4 | Falha atualiza tentativa, para e trigger posterior reenvia. | `score-sync.test.tsx:312-348` — attempts/lastAttempt, online, mesmo ID e remoção seletiva. | PASS |
| 32 `ESTAB-10` AC5 | Um POST e uma sequência de timers. | `score-sync.test.tsx:273-310` — `maxInFlight === 1` e exatamente um timeout >1 s. | PASS |
| 33 `ESTAB-11` AC1 | Boss entity/hp discrimina remoção do spawn. | `game-debug.test.tsx:103-110` — `188/188 HP`. | PASS |
| 34 `ESTAB-11` AC2 | F3 tem efeito observável. | `game-debug.test.tsx:112-119` — `1 power-up disponível`. | PASS |
| 35 `ESTAB-12` AC1 | GET só expõe scores saneados/ordenados. | `scores.test.ts:71-87` — payload completo HIGH antes de LOW. | PASS |
| 36 `ESTAB-12` AC2 | GET malformado aplica fallbacks. | `scores.test.ts:71-87` — clamps/outcome/datas exatos. | PASS |
| 37 `ESTAB-12` AC3 | POST persiste somente `sanitizeScore`. | `scores.test.ts:89-110` — objeto saneado completo passado ao Blob. | PASS |
| 38 `ESTAB-13` AC1 | Legais mobile têm dvh/scroll/foco. | `e2e/legal-pages-mobile.spec.ts:9-31` — duas rotas e duas alturas. | PASS |
| 39 `ESTAB-14` AC1 | Painel é `<dialog open>` nomeado e fecha estado. | `game-debug.test.tsx:67-90` — tag, atributo, nome e remoção no close. | PASS |
| 40 `ESTAB-14` AC2 | S6819 do painel resolvida. | `app/page.tsx:2242-2267` usa `<dialog>`; Sonar atual tem zero issues novas. | PASS |
| 41 `ESTAB-15` AC1 | Coverage gera LCOV consumível. | `package.json:14`, `vitest.config.ts:17-21`; coverage 99/99 e `coverage/lcov.info` não vazio. | PASS |
| 42 `ESTAB-15` AC2 | Sonar importa cobertura >0. | Sonar HEAD `7fc3c20`: total 67,0%, new 89,3%; JaCoCo N/A para TypeScript. | PASS |
| 43 `ESTAB-16` AC1 | Claim cria token exclusivo, `in-flight`, TTL 60. | `score-idempotency.test.ts:41-63,65-91` — tokens distintos, valor e NX/EX 60. | PASS |
| 44 `ESTAB-16` AC2 | `complete` e `release` Redis usam CAS/delete pelo owner. | `score-idempotency.test.ts:200-210` prova Lua/args de `complete`; não existe assertion equivalente que execute `release` Redis com mismatch. | FAIL |
| 45 `ESTAB-16` AC3 | Owner antigo não completa nem libera claim Redis novo. | `score-idempotency.test.ts:212-232` prova apenas `complete` Redis; `:144-186` prova ambos somente no store local. Falta `release` Redis e claim intacto. | FAIL |
| 46 `ESTAB-16` AC4 | Owner conclui `completed` por 24 h. | `score-idempotency.test.ts:127-142,200-210` — completed até 86.399 s e EX 86400. | PASS |
| 47 `ESTAB-16` AC5 | Store local replica token/TTL/lost sem alegar distribuição. | `score-idempotency.test.ts:144-186` — 60 s, dois owners, lost, 24 h e warning `local-memory`. | PASS |
| 48 `ESTAB-17` AC1 | Blob v2 inclui ID; GET público não vaza metadata; legado funciona. | `high-scores.test.ts:114-151,209-226,236-266` — codec dual, projeção e payload com ID. | PASS |
| 49 `ESTAB-17` AC2 | ETag condiciona writers; conflito relê/merge com limite. | `high-scores.test.ts:236-283,303-335` — `ifMatch`, create sem overwrite, merge e três tentativas. | PASS |
| 50 `ESTAB-17` AC3 | Ledger com mesmo ID retorna idempotente sem duplicar. | `high-scores.test.ts:285-301`; `scores.test.ts:160-182` — idempotent true e zero write/throttle. | PASS |
| 51 `ESTAB-17` AC4 | Blob confirmado sobrevive a complete fail/lost e retry deduplica. | `scores.test.ts:219-260` — 201/200, um persist, zero release; lost mantém sucesso. | PASS |
| 52 `ESTAB-17` AC5 | `storage:local` permanece pendente no submit/drain. | `score-sync.test.tsx:76-140,312-348` — local cria fila, incrementa attempt, encerra e reenvia. | PASS |
| 53 `ESTAB-17` AC6 | Rede/429/503 cria e reenvia mesmo ID. | `score-sync.test.tsx:76-140,312-348` — casos parametrizados e IDs iguais. | PASS |
| 54 `ESTAB-17` AC7 | Completed/ledger precedem throttle e write. | `scores.test.ts:144-182`; `:107-109` — ordem e zero acquire/claim/persist. | PASS |
| 55 `ESTAB-18` AC1 | Debug inválido/produção tem zero side effects conjuntos. | `game-debug.test.tsx:29-40,160-183` — snapshot integral antes/depois. | PASS |
| 56 `ESTAB-18` AC2 | Ambos marcadores debug retornam 400 e zero adapters. | `scores.test.ts:112-130` — `it.each`, payload exato e todos mocks zerados. | PASS |
| 57 `ESTAB-18` AC3 | Restart normal volta a enviar exatamente um novo ID. | `score-sync.test.tsx:144-200` — debug zero POST; normal um POST, ID e outcome `over`. | PASS |
| 58 `ESTAB-18` AC4 | Triggers sobrepostos têm um POST/timer. | `score-sync.test.tsx:273-310` — `maxInFlight` 1 e uma espera longa. | PASS |
| 59 `ESTAB-18` AC5 | `100dvh` acompanha duas alturas e foco permanece visível. | `e2e/legal-pages-mobile.spec.ts:17-29` — minHeight igual a 844/667 e bounding box dentro da viewport. | PASS |
| 60 `ESTAB-18` AC6 | LCOV fresco, QG OK e S3776/S1871/S7776 ausentes. | Sonar revisão `7fc3c20`: QG `OK`, new coverage 89,3%, new duplication 0,0%, new issues 0. | PASS |

**Spec-anchored check**: 57/60 ACs confirmados; 3 gaps de evidência; 0 spec-precision gaps.

### Edge cases e integridade

- PASS: TTLs exatos 60 s/24 h, token novo após expiração e owner antigo rejeitado no store local.
- PASS: documento legado/v2, metadata malformada, ledger expirado, score fora do top 10, ETag ausente/conflitante e limite de três retries.
- PASS: complete Redis lança/retorna `ownership-lost` depois do Blob, com resposta persistida e retry deduplicado.
- PASS: rede/429/503/storage local no submit e drain, mesmo ID, FIFO, fila vazia, triggers sobrepostos e restart normal após debug.
- PASS: produção/action inválida preservam UI, entidades, POST, ranking e fila; mobile varia altura real.
- GAP: operação Redis `release` não possui prova de CAS com token antigo e preservação do novo owner.
- GAP: cenário exato `BLOB_READ_WRITE_TOKEN` ausente perdeu a asserção de rota existente no baseline.
- Integridade: 99 testes atuais contra 74 em `b8217af` (+25), mas `git diff --numstat` mostra deleções em testes e a asserção específica de fallback Blob foi removida. Nenhum `.skip`, `.todo`, `.only` ou marcador real `SPEC_DEVIATION`; `git diff --check` passou.

### Gates

| Gate | Resultado |
| --- | --- |
| `npm run test` | PASS — 9 arquivos, 99/99, 0 falhos/skips. |
| `npm run test:coverage` | PASS — 99/99; statements 69,00%, branches 61,22%, functions 79,16%, lines 70,33%; LCOV gerado. |
| `npm run build` | PASS — Next.js 16.3.3, TypeScript e 5 páginas. |
| `npm run lint` | PASS — 0 erros, 2 warnings (`coverage/lcov-report/block-navigation.js:1`, `lib/debug.ts:26`). |
| `npm run test:e2e` | PASS — 2/2 mobile Chromium. |

### Sensor de discriminação

| Mutação | Falha injetada | Resultado |
| --- | --- | --- |
| M1 `lib/score-idempotency.ts:187` | Owner antigo aceito pelo store local após novo claim. | KILLED — 1/12 falhou em `score-idempotency.test.ts:170`. |
| M2 `lib/high-scores.ts:148` | Ledger/dedupe autoritativa sempre ignorada. | KILLED — 3/29 falharam entre unit/API. |
| M3 `app/page.tsx:289` | `storage:"local"` tratado como persistido. | KILLED — 2/16 falharam no submit/drain local. |

**Profundidade**: lightweight, 3 mutações de alto risco em worktree descartável.  
**Resultado**: 3 killed, 0 survived — PASS.

### Sonar

- Análise mais recente: `2026-08-28T15:46:53Z`, revisão `7fc3c20cd8511de387c4e7bb4eccf286ada9fa7e`.
- Quality Gate `OK`: new coverage 89,3% (`>=80`), new duplication 0,0% (`<=3`), new violations 0.
- Métricas: coverage 67,0%, bugs 0, vulnerabilities históricas 22, code smells 51, duplicação 0,4%, zero issues no new-code period.
- JaCoCo: N/A para TypeScript; LCOV importado.

### Gaps ranqueados

1. **Major — `ESTAB-16` AC2-AC3 / C2-T1 parcial**: falta teste Redis de `release` com token antigo, retorno Lua `0`/`ownership-lost` e claim novo intacto (`lib/__tests__/score-idempotency.test.ts:200-232`).
2. **Major — P2 API AC1 / integridade de testes**: falta cenário com `BLOB_READ_WRITE_TOKEN` ausente; o teste correspondente do baseline foi removido, então o WHEN específico não tem evidência (`app/api/__tests__/scores.test.ts`).

### Veredito

**FAIL** — 57/60 ACs confirmados. Todos os gates, o Quality Gate e 3/3 mutações passaram, mas evidence-or-zero reprova duas conjunções Redis e o cenário original sem token Blob.

---

## estabilidade-qualidade — 2026-08-28 — `7fc3c20...8c26ca0`

**Resultado**: FAIL  
**Verifier**: independente (autor != verifier), sem subagentes  
**Spec**: `_docs/specs/features/estabilidade-qualidade/spec.md` (75 ACs)  
**Range validado**: `7fc3c20cd8511de387c4e7bb4eccf286ada9fa7e..8c26ca03401b0739a4710a7d03571b3a859a8163`

### Conclusao task a task

| Task | Commit | Resultado |
| --- | --- | --- |
| C3-T1 | `ac4e5de` | PASS — ownerToken obrigatorio e release Redis antigo preserva o novo claim. |
| C3-T2 | `f0ac72c` | PARTIAL/FAIL — implementacao atende 60/60, mas a prova Redis nao mata o off-by-one da 61a requisicao. |
| C3-T3 | `50fbccf` | PASS — modelo, SHA-256/top-6 bits, paths 00..63 e compatibilidade publica/legada. |
| C3-T4 | `89b0366` | PASS — CAS, ETag fresca, retencao exata, cleanup, concorrencia e recovery shard-first. |
| C3-T5 | `d3a50b8` | PASS — ordem preflight-first, fast paths, falhas parciais e token Blob ausente. |
| C3-T6 | `8c26ca0` | FAIL do fechamento — gates/Sonar verdes, mas o Verifier encontrou 1 mutante sobrevivente. |

Os seis hashes existem em cadeia, na ordem C3-T1 a C3-T6. Commits documentais do ciclo: `29fa033`, `19e2291`, `51e8796`. C3-T6 e commit vazio de evidencia.

### Evidencia spec-anchored por AC

| # / AC | Outcome exato da spec | Evidencia `file:line` + assertion/outcome | Resultado |
| --- | --- | --- | --- |
| 1 P1 Build AC1 | Build sem TypeScript/ESLint/panic. | `package.json:11-12`; `npm run build` e `npm run lint` frescos exit 0, 0 erros. | PASS |
| 2 P1 Testes AC2 | Sanitizacao, nome <=14 e ordenacao. | `lib/__tests__/high-scores.test.ts:60-64,98-110` — nome e array ordenado exatos. | PASS |
| 3 P1 Testes AC3 | Payload invalido vira `DEV ANON` saneado. | `lib/__tests__/high-scores.test.ts:66-77` — objeto `HighScore` completo por `toEqual`. | PASS |
| 4 P1 Debug AC1 | F1/F2/F3 mapeiam menu/boss/power-up em dev. | `lib/__tests__/debug.test.ts:79-95`; `app/__tests__/game-debug.test.tsx:67-80,103-118` — actions/outcomes exatos. | PASS |
| 5 P1 Debug AC2 | Boss real com vida completa. | `app/__tests__/game-debug.test.tsx:103-110` — `188/188 HP`. | PASS |
| 6 P1 Debug AC3 | Vitoria debug encerra `won` e abre entrada. | `app/__tests__/game-debug.test.tsx:149-158` — dialog, mensagem e textbox. | PASS |
| 7 P2 API AC1 | Token Blob ausente retorna resposta amigavel sem throw. | `app/api/__tests__/scores.test.ts:359-378` — remove/restaura env real; status 503 e payload exato. | PASS |
| 8 P2 API AC2 | Envios proximos sofrem limite minimo. | `app/api/__tests__/scores.test.ts:261-273`; `lib/__tests__/score-rate-limit.test.ts:31-56` — 429/header/body e TTL 10. | PASS |
| 9 P2 Cliente AC3 | Rede salva localmente e sincroniza depois. | `app/__tests__/score-sync.test.tsx:76-140,202-245,312-348` — fila completa, mesmo ID e retry. | PASS |
| 10 P3 Sonar AC1 | Smells em `app/page.tsx` reduzidos. | Sonar fresco: 51 smells contra baseline historico 54. | PASS |
| 11 P3 CSS AC2 | `100dvh` evita corte mobile. | `e2e/legal-pages-mobile.spec.ts:17-29` — 844/667, overflow, scroll e foco. | PASS |
| 12 `ESTAB-06` AC1 | Production bloqueia qualquer query debug. | `lib/__tests__/debug.test.ts:23-27` — `?debug=1` retorna false. | PASS |
| 13 `ESTAB-06` AC2 | Listener revalida ambiente e allowlist. | `lib/__tests__/debug.test.ts:29-76`; `game-debug.test.tsx:160-183` — eventos rejeitados. | PASS |
| 14 `ESTAB-06` AC3 | Evento invalido nao altera estado, entidades, HUD ou ranking. | `game-debug.test.tsx:29-40,160-183` — snapshot conjunto antes/depois. | PASS |
| 15 `ESTAB-07` AC1 | Run fica debug ate reinicio. | `score-sync.test.tsx:144-199` — debug bloqueado e nova run elegivel. | PASS |
| 16 `ESTAB-07` AC2 | Run debug nao entra no ranking/fila. | `score-sync.test.tsx:175-180` — zero POST e pending ausente. | PASS |
| 17 `ESTAB-07` AC3 | API rejeita debug sem persistir. | `scores.test.ts:148-165` — ambos marcadores, 400 e zero dependencias. | PASS |
| 18 `ESTAB-08` AC1 | Redis adquire chave IP NX/EX 10. | `score-rate-limit.test.ts:14-29` — chave hash e options exatas. | PASS |
| 19 `ESTAB-08` AC2 | Janela ativa da 429 sem renovar/persistir. | `score-rate-limit.test.ts:31-41`; `scores.test.ts:261-273`. | PASS |
| 20 `ESTAB-08` AC3 | Expiracao libera nova janela. | `score-rate-limit.test.ts:43-72` — nova aquisicao e fronteira exata local. | PASS |
| 21 `ESTAB-08` AC4 | Redis indisponivel em prod da 503 e cliente conserva fila. | `scores.test.ts:212-226`; `score-sync.test.tsx:312-348`. | PASS |
| 22 `ESTAB-08` AC5 | Fora de prod usa memoria identificada local. | `score-rate-limit.test.ts:59-72,100-109` — backend/TTL/factory. | PASS |
| 23 `ESTAB-09` AC1 | Rede/429/503 cria pendencia separada. | `score-sync.test.tsx:76-140` — casos parametrizados e storage local. | PASS |
| 24 `ESTAB-09` AC2 | Entrada v1 preserva ID/header em retries. | `score-sync.test.tsx:119-140,202-220,312-348`. | PASS |
| 25 `ESTAB-09` AC3 | Mesmo ID mantem uma entrada. | `score-sync.test.tsx:387-406` — uma submissao valida. | PASS |
| 26 `ESTAB-09` AC4 | Completed por 24 h retorna idempotente sem segunda escrita. | `score-idempotency.test.ts:127-142`; `scores.test.ts:244-259`. | PASS |
| 27 `ESTAB-09` AC5 | GET nunca cria pendencia. | `score-sync.test.tsx:374-385` — ranking salvo, pending null. | PASS |
| 28 `ESTAB-10` AC1 | Load/online compartilham uma drenagem. | `score-sync.test.tsx:273-310` — triggers sobrepostos. | PASS |
| 29 `ESTAB-10` AC2 | FIFO e intervalo >=10 s. | `score-sync.test.tsx:247-270` — ordem/delta exatos. | PASS |
| 30 `ESTAB-10` AC3 | Sucesso remove so item e continua. | `score-sync.test.tsx:247-270` — dois IDs e fila vazia. | PASS |
| 31 `ESTAB-10` AC4 | Falha atualiza, para e trigger posterior reenvia. | `score-sync.test.tsx:312-348` — attempts/time, online, mesmo ID. | PASS |
| 32 `ESTAB-10` AC5 | Um POST e uma sequencia de timers. | `score-sync.test.tsx:273-310` — maxInFlight 1 e um timeout longo. | PASS |
| 33 `ESTAB-11` AC1 | Boss/hp discrimina remocao do spawn. | `game-debug.test.tsx:103-110` — entidade `188/188 HP`. | PASS |
| 34 `ESTAB-11` AC2 | F3 tem efeito observavel. | `game-debug.test.tsx:112-119` — 1 power-up. | PASS |
| 35 `ESTAB-12` AC1 | GET so expoe scores saneados/ordenados. | `scores.test.ts:102-118` — payload completo HIGH/LOW. | PASS |
| 36 `ESTAB-12` AC2 | GET malformado aplica fallbacks. | `scores.test.ts:102-118` — clamps/outcome/data exatos. | PASS |
| 37 `ESTAB-12` AC3 | POST persiste somente sanitizeScore. | `scores.test.ts:120-146` — objeto saneado completo na intencao. | PASS |
| 38 `ESTAB-13` AC1 | Legais mobile tem dvh/scroll/foco. | `e2e/legal-pages-mobile.spec.ts:9-31` — duas rotas/alturas. | PASS |
| 39 `ESTAB-14` AC1 | Painel e `<dialog open>` nomeado e fecha estado. | `game-debug.test.tsx:67-90`. | PASS |
| 40 `ESTAB-14` AC2 | S6819 do painel resolvida. | `app/page.tsx` usa `<dialog>`; Sonar fresco tem 0 issues novas. | PASS |
| 41 `ESTAB-15` AC1 | Coverage gera LCOV consumivel. | `package.json:14`, `vitest.config.ts:17-21`; coverage 122/122 e LCOV 46.815 bytes. | PASS |
| 42 `ESTAB-15` AC2 | Sonar importa cobertura >0. | Sonar total 68,9%, new 91,6%; JaCoCo N/A. | PASS |
| 43 `ESTAB-16` AC1 | Claim cria token exclusivo, in-flight, TTL 60. | `score-idempotency.test.ts:41-91` — tokens/valor/NX EX 60. | PASS |
| 44 `ESTAB-16` AC2 | Complete/release usam CAS/delete pelo owner. | `score-idempotency.test.ts:200-210,234-250` — scripts, args e outcomes. | PASS |
| 45 `ESTAB-16` AC3 | Owner antigo nao conclui/libera claim novo. | `score-idempotency.test.ts:212-250` — ambos ownership-lost e valor novo intacto. | PASS |
| 46 `ESTAB-16` AC4 | Owner conclui completed por 24 h. | `score-idempotency.test.ts:127-142,200-210` — fronteira/EX 86400. | PASS |
| 47 `ESTAB-16` AC5 | Store local replica token/TTL/lost e backend. | `score-idempotency.test.ts:144-186`. | PASS |
| 48 `ESTAB-17` AC1 | ID interno; publico sem metadata; legado funciona. | `high-scores.test.ts:121-159,216-233,311-355`. | PASS |
| 49 `ESTAB-17` AC2 | ETag condiciona writers e conflito rele/merge. | `high-scores.test.ts:365-400,436-460,505-520`. | PASS |
| 50 `ESTAB-17` AC3 | Mesmo ID no Blob retorna idempotente sem duplicar. | `high-scores.test.ts:416-434,487-503`; `scores.test.ts:244-259`. | PASS |
| 51 `ESTAB-17` AC4 | Blob confirmado sobrevive complete fail/lost e retry deduplica. | `scores.test.ts:301-333`; `high-scores.test.ts:522-555`. | PASS |
| 52 `ESTAB-17` AC5 | storage local permanece pendente. | `score-sync.test.tsx:76-140,312-348`. | PASS |
| 53 `ESTAB-17` AC6 | Rede/429/503 reenvia mesmo ID. | `score-sync.test.tsx:76-140,312-348`. | PASS |
| 54 `ESTAB-17` AC7 | Fast path precede throttle/write. | `scores.test.ts:179-210,228-259` — preflight primeiro, shard antes do throttle. | PASS |
| 55 `ESTAB-18` AC1 | Debug invalido/prod tem zero side effects conjuntos. | `game-debug.test.tsx:29-40,160-183`. | PASS |
| 56 `ESTAB-18` AC2 | Ambos marcadores debug: 400 e zero adapters. | `scores.test.ts:148-165`. | PASS |
| 57 `ESTAB-18` AC3 | Restart normal envia exatamente um novo ID. | `score-sync.test.tsx:144-200`. | PASS |
| 58 `ESTAB-18` AC4 | Triggers sobrepostos tem um POST/timer. | `score-sync.test.tsx:273-310`. | PASS |
| 59 `ESTAB-18` AC5 | 100dvh acompanha duas alturas e foco visivel. | `legal-pages-mobile.spec.ts:17-29`. | PASS |
| 60 `ESTAB-18` AC6 | LCOV fresco, QG OK e issues-alvo ausentes. | Sonar analysis `cb5515ac-d52a-4704-85f5-d5687a428a23`: QG OK, 0 new issues/hotspots. | PASS |
| 61 `ESTAB-19` AC1 | Preflight apos validacoes e antes de Redis/Blob/throttle/claim. | `scores.test.ts:139-145,148-177,212-226` — ordem e zero downstream. | PASS |
| 62 `ESTAB-19` AC2 | Janela atomica 60 s; requests 1..60 seguem. | `score-abuse-preflight.test.ts:13-48,50-96`; `scores.test.ts:179-210` — 60 aprovadas. | PASS |
| 63 `ESTAB-19` AC3 | Duplicata/ID repetido consome preflight antes de fast path. | `scores.test.ts:179-210,228-259` — 60 duplicatas consumidas; completed/ledger apos preflight. | PASS |
| 64 `ESTAB-19` AC4 | 61a da 429 com TTL/header sem renovar/tocar downstream. | `scores.test.ts:179-210` e `score-abuse-preflight.test.ts:50-96` afirmam contrato via fakes, mas M6 `count <`→`count <=` no Lua passou 26/26. Evidence-or-zero discriminante. | FAIL |
| 65 `ESTAB-19` AC5 | Expiracao abre nova janela sem contagem anterior. | `score-abuse-preflight.test.ts:13-48` — fronteira local `now >= expiresAt`; script usa ausencia da chave. | PASS |
| 66 `ESTAB-19` AC6 | Fast paths aprovados antes do throttle; novo ID sujeito a 10 s. | `scores.test.ts:120-146,228-273` — ordem, zero throttle no shard e 429 funcional. | PASS |
| 67 `ESTAB-19` AC7 | Preflight Redis indisponivel em prod da 503/zero Blob; local injetavel equivalente. | `score-abuse-preflight.test.ts:98-177`; `scores.test.ts:212-226`; cliente `score-sync.test.tsx:312-348`. | PASS |
| 68 `ESTAB-20` AC1 | Um de 64 shards pelos top-6 bits SHA-256 UTF-8 apos trim. | `high-scores.test.ts:242-255` — vetores, caixa, Unicode e bounds 0/63. | PASS |
| 69 `ESTAB-20` AC2 | Fast path le somente shard selecionado; ausencia segue throttle. | `high-scores.test.ts:286-309`; `scores.test.ts:228-273`. | PASS |
| 70 `ESTAB-20` AC3 | Entrada ativa somente `now < persistedAt+24h`; igualdade expira. | `high-scores.test.ts:475-485` — +23:59:59.999 ativo, +24h vazio. | PASS |
| 71 `ESTAB-20` AC4 | Expirados saem da visao e proximo CAS os remove. | `high-scores.test.ts:436-460` — merge fisico contem apenas valido+novo. | PASS |
| 72 `ESTAB-20` AC5 | Shard usa ETag lida; conflito rele mesmo shard e ETag fresca. | `high-scores.test.ts:436-460` — etag-1/etag-2; tres tentativas em `:463-473`. | PASS |
| 73 `ESTAB-20` AC6 | Mesmo ID cria no maximo um; IDs distintos preservados ou falha retryable. | `high-scores.test.ts:436-473,487-503`. | PASS |
| 74 `ESTAB-20` AC7 | Falha parcial preserva shard-first, ownership e recovery sem duplicar. | `scores.test.ts:288-357`; `high-scores.test.ts:522-555` — 503 antes da confirmacao, success apos ranking, retry repara. | PASS |
| 75 `ESTAB-20` AC8 | Ranking publico continua HighScore[] limpo, sem metadata, legado compativel. | `high-scores.test.ts:121-159,216-233,311-355`; `scores.test.ts:102-118`. | PASS |

**Spec-anchored check**: 74/75 ACs com outcome exato confirmado; 1 gap discriminante; 0 spec-precision gaps.

### Payload, conjunction e integridade

- PASS: payloads de sanitizacao, 429 funcional/preflight, 400 debug, 503 e respostas idempotentes comparam status, headers e objetos completos.
- PASS: conjuncoes de zero side effects verificam status/claim/throttle/shard/ranking; debug verifica HUD, entidades, POST e duas chaves locais.
- FAIL: a conjuncao Redis real da 61a requisicao nao e discriminada; o mock calcula a cota fora do Lua.
- Baseline `7fc3c20`: 99 Vitest; atual: 122 (+23), 10 arquivos, 0 falhas/skips. Nenhum arquivo de teste removido; testes renomeados/substituidos preservam os contratos antigos, salvo o gap discriminante acima.
- Nenhum `.skip`, `.todo`, `.only` ou `SPEC_DEVIATION`; `git diff --check` passou. Alteracoes alheias foram preservadas.

### Gates e Sonar

| Gate | Resultado |
| --- | --- |
| `npm run test` | PASS — 10 arquivos, 122/122, 0 falhos/skips. |
| `npm run test:coverage` | PASS — 122/122; statements 70,88%, branches 63,79%, functions 80,99%, lines 72,36%; LCOV 46.815 bytes. |
| `npm run build` | PASS — Next.js 16.3.3, TypeScript e 5 paginas. |
| `npm run lint` | PASS — 0 erros, 2 warnings historicos (`coverage/.../block-navigation.js:1`, `lib/debug.ts:26`). |
| `npm run test:e2e` | PASS — 2/2 mobile Chromium. |
| Sonar | PASS — CE SUCCESS, QG OK; new coverage 91,6%, new duplication 1,05909%, 0 new issues, 0 hotspots. |

Sonar analysis `cb5515ac-d52a-4704-85f5-d5687a428a23`, CE task `8ec1a464-3c10-4c9d-82cc-03cbb8622476`, revision exata `8c26ca03401b0739a4710a7d03571b3a859a8163`. Metricas totais: coverage 68,9%, bugs 0, vulnerabilities historicas 22, code smells 51, duplicacao 1,1%. JaCoCo N/A para TypeScript; LCOV importado.

### Sensor discriminante

| Mutacao | Resultado |
| --- | --- |
| M1 release Redis de owner antigo retorna `applied` | KILLED — 1/13 falhou em `score-idempotency.test.ts:247`. |
| M2 leitura Blob/shard antes do preflight | KILLED — 8/17 falharam na rota, inclusive zero downstream. |
| M3 reutilizar ETag antiga apos conflito | KILLED — 1/25 falhou em `high-scores.test.ts:459`. |
| M4 trocar shard top-6 por low-6 bits | KILLED — 7/25 falharam, incluindo vetores `:243`. |
| M5 aceitar entrada exatamente em +24 h | KILLED — 1/25 falhou em `high-scores.test.ts:484`. |
| M6 Lua permitir `count <= limit` | SURVIVED — 26/26 focados passaram; permitiria a 61a requisicao no Redis real. |

**Resultado do sensor**: 6 injetadas, 5 killed, 1 survived — FAIL. Todas as mutacoes ocorreram em worktrees `/tmp` restaurados e removidos; arvore real permaneceu no HEAD.

### Pendencias e veredito final

1. **Major — `ESTAB-19` AC4 / C3-T2**: falta teste que execute ou discrimine semanticamente o Lua Redis; alterar `< 60` para `<= 60` sobrevive. Motivo: `evalMock` reimplementa a regra e nao deriva seu resultado do script recebido.

Nao houve `SPEC_DEVIATION` nem novo gap de spec; trata-se de gap de teste/validacao categoria (a). Como este e o terceiro e ultimo ciclo, nao se propoe execucao automatica adicional.

**Veredito**: FAIL — 74/75 ACs, C3-T2 parcial e C3-T6 reprovada pelo sensor; todos os gates e Sonar passaram.

---

## estabilidade-qualidade — 2026-08-29 — revisão adicional pós-ciclo-3 em `8c26ca0` (sem novo diff)

**Resultado**: FAIL preservado + 1 achado novo, escalado sem fix (orçamento de 3 ciclos já esgotado)
**Verifier**: independente (autor != verifier), continuação de sessão anterior interrompida
**Spec**: `_docs/specs/features/estabilidade-qualidade/spec.md`
**HEAD analisado**: `8c26ca03401b0739a4710a7d03571b3a859a8163` (nenhum commit novo — revisão sobre código já existente)

### Achado: janela de dedupe assimétrica entre ledger (24h) e ranking (top 10)

**Onde**: `lib/high-scores.ts:312-357` (`rankingWithEffect`, `ensureRankingEffect`) e `lib/high-scores.ts:148-176` (`activeLedgerEntry`, `PROCESSED_SUBMISSION_TTL_MS`).

**Mecanismo observado**:
- `ensureRankingEffect` (linha 326) dedupra por `submissionId` contra `document.scores` — array que retém o `submissionId` enquanto o score permanecer no top 10 (`cleanScores` corta em 10 em `lib/high-scores.ts:66`), independente do TTL do ledger. Para um score ainda visível no ranking, um replay do mesmo `submissionId` é bloqueado mesmo com a entrada do ledger expirada.
- Quando o ledger expira (`ESTAB-20` AC3, `now >= persistedAt + 24h`) **e** o score já foi evictado do top 10, `persistLedgerIntent` trata o replay como submissão nova (cria entrada fresca no shard) e `ensureRankingEffect` não encontra o `submissionId` em `document.scores` — logo `rankingWithEffect` reinsere o score, disputando vaga no top 10 como se fosse novo.
- Escopo do risco: só se materializa para scores **fora do top 10** (a maioria dos envios) após as 24h do ledger. Não produz duplicata visível para scores ainda listados — apenas para os evictados.

**Classificação**: ambiguidade de design entre `ESTAB-20` (ledger autoritativo por 24h) e `ESTAB-17` (ranking como backstop de dedupe) — nenhum AC define o comportamento esperado quando as duas janelas divergem (ledger expirado + score fora do ranking). Não é uma regressão de código introduzida nesta feature; é uma lacuna de especificação não coberta por nenhum dos 75 ACs vigentes.

### Sweep de frentes

| Frente | Resultado |
| --- | --- |
| Regressão | Sem cobertura de teste para "ledger expirado + score evictado do top 10 + replay do mesmo `submissionId`" (confirmado por grep em `lib/__tests__/high-scores.test.ts`); nenhuma suíte existente quebra. |
| Performance | Sem amplificação — cada replay é leitura/escrita O(1) por shard, sem varredura adicional. |
| Sonar/LCOV | Sem código novo neste achado (análise sobre HEAD já commitado do ciclo 3); não afeta o Quality Gate já registrado como `OK` (linha 499 acima). |

### Decisão

Como o limite de três ciclos de fix→re-verify já foi atingido (ver "Pendências e veredito final" do ciclo 3, acima), **nenhum fix automático foi proposto**. O achado é registrado como pendência aberta para decisão do usuário: (a) tratar como limitação conhecida documentada em `spec.md` (categoria c), ou (b) abrir um ciclo interno 4 com um novo requisito (`ESTAB-21`) definindo o comportamento de dedupe para scores evictados do ranking após a expiração do ledger.

**Veredito**: FAIL (herdado do ciclo 3, `ESTAB-19` AC4) + achado adicional aberto, sem impacto nos gates/Sonar já registrados.

---

## estabilidade-qualidade — 2026-08-29 — Quick Fix (QF-1, QF-2) sobre `8c26ca0`

**Resultado**: PASS para os dois gaps visados
**Modo**: `tlc-spec-driven` quick fix (Small scope — sem novo ciclo formal, sem código de produção alterado)
**HEAD**: `8c26ca03401b0739a4710a7d03571b3a859a8163` + commits de quick fix em testes/spec

### QF-1 — `ESTAB-19` AC4

- **Arquivo**: `lib/__tests__/score-abuse-preflight.test.ts`
- **Mudança**: substituída a reimplementação JS da cota por um interpretador do texto real do script Lua (`runConsumeScript` + `FakeRedisKeyStore`), que extrai o operador de comparação (`<`, `<=`, etc.) diretamente da string do script recebido por `eval`.
- **Sensor**: mutação manual `count < tonumber(ARGV[2])` → `count <= tonumber(ARGV[2])` em cópia restaurada de `lib/score-abuse-preflight.ts` — teste falhou (KILLED). Script original — 9/9 testes passam.
- **Resultado**: `ESTAB-19` AC4 passa de FAIL (evidence-or-zero discriminante) para PASS.

### QF-2 — `AD-004`

- **Arquivo**: `lib/__tests__/high-scores.test.ts`
- **Mudança**: novo teste "treats a replay as a new submission once its ledger entry expires and the score has left the ranking (AD-004)" fixando o comportamento aceito: ledger expirado + score fora do top 10 → replay tratado como nova submissão, sem duplicar o ranking enquanto o score original ainda estiver listado.
- **Decisão registrada em `spec.md`** (seção "Quick Fix — 2026-08-29"): comportamento por design, não é bug — escopo de dedupe de `ESTAB-17`/`ESTAB-20` é "enquanto o score permanecer no ranking autoritativo".
- **Resultado**: gap de regressão fechado; nenhum código de produção alterado.

### Gate

| Gate | Resultado |
| --- | --- |
| `npm run test` | 123/123 nos arquivos alterados; 1 falha pré-existente e não relacionada em `high-scores.test.ts` ("returns snapshot ETags...", apodrecimento de teste por `Date.now()` real vs fixture fixa — ver nota em `spec.md`). |
| `npm run build` | PASS — Next.js 16.3.3, TypeScript e 5 páginas. |
| `npm run lint` | PASS — 0 erros, 2 warnings históricos inalterados. |

**Veredito**: QF-1 e QF-2 concluídos. Pendência residual fora de escopo: teste de `readRankingSnapshot` datado (não solicitado nesta rodada).
