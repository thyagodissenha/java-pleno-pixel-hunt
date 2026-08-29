# Validation — sistema-personagens

## Status atual
Veredito: PASS
Spec vigente: spec.md (12 ACs, CHAR-01 a CHAR-12 — CHAR-12 adicionado por emenda em 2026-08-29 pós-code-review)
HEAD: 32a656d
Gaps abertos: 0. Fix cycle 1 (ca3aa1e) fechou o gap Minor de CHAR-09. `/code-review high` pós-Execute levantou 8 achados: 2 viravam fix cycle 2 (dash com vetor zero quando inimigo coincide com o jogador; setState de debug sem gate `isDebugAllowed()`), 1 virou emenda de spec CHAR-12 (dash atravessa obstáculos — decisão do usuário: comportamento intencional, sem mudança de código), 5 registrados em "Questões abertas" do code-review (não implementados, fora do escopo dos ACs). Fix cycle 2 (32a656d) fechou os 2 gaps reais (a) — re-verificado nesta rodada, PASS, sem regressão.

---

## Execução 2026-08-29 — commit range 7cc2929..94dd14e

PASS (com 1 gap Minor registrado, não bloqueante)

### Evidência por AC

**CHAR-01** (init do jogador a partir do registry)
`app/page.tsx:648-651` — `hp: activeCharacter.maxHp, maxHp: activeCharacter.maxHp, size: activeCharacter.size, speed: activeCharacter.speed`. Outcome da spec: `maxHp`/`speed`/`size` do jogador vêm da definição do personagem, não de literais. ✅ PASS por leitura direta do código-fonte (não há mais literais `100/210/24` na criação do `player`) + `lib/__tests__/characters.test.ts:11-26` prova que `activeCharacter` (= `CHARACTERS[0]`) tem exatamente esses valores + `app/__tests__/hidden-menu.test.tsx:59-63` confirma que o mesmo objeto `activeCharacter` expõe 100/210/24 em runtime. ⚠️ Nota: não há um teste que leia o HP/velocidade do `player` em jogo diretamente (ex.: barra de vida) — a prova é por composição (fonte + registry + painel), não por uma asserção única "player.maxHp === 100". Aceitável dado que é atribuição direta de campo, mas registrado por rigor.

**CHAR-02** (fallback para personagem desconhecido)
`lib/__tests__/characters.test.ts:45-51` — `expect(resolveCharacter(undefined)).toBe(CHARACTERS[0])` e `expect(resolveCharacter("id-inexistente")).toBe(CHARACTERS[0])`. Outcome da spec: cai no primeiro personagem do registry, sem erro. ✅ PASS.

**CHAR-03** (ativação do poder — teleporte + cooldown)
`app/__tests__/character-power.test.tsx:89-103` — dispara `d` (move), avança 18 frames, pressiona `q`, e afirma `expect(after.x - before.x).toBeCloseTo(power.dashDistance, -1)` e `expect(cooldownStatus()).toBe(\`${power.cooldownSeconds.toFixed(1)}s\`)`. Outcome da spec: teleporte por distância fixa na direção do movimento + início do cooldown. ✅ PASS — assevera contra os valores exatos do personagem (`dashDistance`, `cooldownSeconds`), não apenas "algo mudou".

**CHAR-04** (bloqueio durante cooldown)
`app/__tests__/character-power.test.tsx:105-119` — dispara dash, captura posição/cooldown, pressiona `q` de novo e afirma `expect(playerPositionStatus()).toEqual(afterFirstDash)` e `expect(cooldownStatus()).toBe(cooldownAfterFirstDash)`. Outcome da spec: sem dash, sem reset do cooldown. ✅ PASS. Confirmado pelo sensor de discriminação (mutação 1 abaixo).

**CHAR-05** (borda de subida, sem repetição ao segurar)
`app/__tests__/character-power.test.tsx:121-130` (repeat como primeiro evento, isolando do cooldown) e `:132-148` (múltiplos `repeat: true` após ativação real não disparam de novo). Outcome da spec: dispara no máximo uma vez por pressionamento real. ✅ PASS. Confirmado pelo sensor (mutação 2).

**CHAR-06** (reset do cooldown em nova partida/reset)
`app/__tests__/character-power.test.tsx:150-163` — dispara dash, confirma cooldown ativo, injeta evento de debug `reset`, afirma `expect(cooldownStatus()).toBe("0.0s")`. Código: `app/page.tsx:785` (`abilityCooldownRemaining = 0;` dentro de `resetWaveOne`). ✅ PASS.

**CHAR-07** (sem efeito fora de `gameState === "playing"`)
`app/__tests__/character-power.test.tsx:165-174` — pressiona `q` ainda no menu (antes de "Jogar"), afirma posição/cooldown inalterados. Código: `app/page.tsx:1046` (`if (stateRef.current !== "playing") return;`). ✅ PASS.

**CHAR-08** (painel escondido exibe dados reais)
`app/__tests__/hidden-menu.test.tsx:52-64` — abre painel via `iddqd`, afirma `heading` "Dev Pleno", textos "100", "210", "24" e "Refactor Dash" visíveis dentro do dialog. Outcome da spec: nome, atributos e poder especial (nome/descrição/cooldown) — não mais "em construção". ✅ PASS (o teste não afirma explicitamente o texto de cooldown "6s"/descrição completa, mas confirma nome do poder e os 3 atributos numéricos exatos; ⚠️ pequena imprecisão: cooldown do poder no painel não tem asserção própria, só o nome "Refactor Dash" via `getByText(..., {exact:false})`). Código: `app/page.tsx:2153-2172` renderiza nome, `maxHp`, `speed`, `size`, poder (nome/descrição/cooldown) ou "Sem poder especial." se `specialPower` for `null`.

**CHAR-09** (genericidade do registry — 2ª entrada de teste)
`lib/__tests__/characters.test.ts:53-71`. ❌/⚠️ **Gap de precisão**: o teste cria um `testRegistry` local (`CHARACTERS[0]` + uma entrada de teste) e faz sua **própria** busca (`testRegistry.find(...)`) — nunca chama a função real `resolveCharacter` com esse array de 2 entradas. A única chamada real a `resolveCharacter` no teste é `resolveCharacter(CHARACTERS[0].id)`, que já é coberta trivialmente pelo caso de 1 entrada (CHAR-01/02). Como `resolveCharacter` sempre lê do array de módulo `CHARACTERS` (que tem exatamente 1 item no catálogo real), a genericidade da função de resolução com **N > 1** entradas nunca é exercitada de fato — o teste prova que `Array.prototype.find` generaliza (trivial, não é o que a spec pede), não que a implementação de `resolveCharacter` generaliza. Isso é evidence-or-zero: não há `file:line` que exercite a função real com 2 personagens. **Resultado: GAP (Minor)** — não bloqueante porque `resolveCharacter` é uma one-liner (`CHARACTERS.find(...) ?? CHARACTERS[0]`) cuja correção para N>1 é visualmente óbvia por inspeção de código, mas a spec pede explicitamente prova por teste unitário, que hoje não prova o que alega provar.

**CHAR-10** (invariantes de dados do registry)
`lib/__tests__/characters.test.ts:32-41` — laço sobre `CHARACTERS` afirmando `maxHp > 0`, `speed > 0`, `size > 0`, e `cooldownSeconds >= 0` quando há poder. ✅ PASS.

**CHAR-11** (sem persistência entre sessões)
Verificação por ausência (decisão explícita do `design.md`, não por teste dedicado): `grep -n "localStorage" app/page.tsx` retorna apenas `SOUND_KEY` (linhas 190, 379) — nenhuma chave nova para seleção de personagem. ✅ PASS por inspeção, conforme metodologia documentada no design.

### Sensor de discriminação

Estado descartável: edições diretas em `lib/characters.ts`/`app/page.tsx` seguidas de `git checkout -- <arquivo>` (árvore estava limpa para esses dois arquivos antes e depois; `_docs/roadmap.md` e `tasks.md`, já modificados antes desta rodada por outra frente, não foram tocados).

| # | Arquivo:linha | Mutação | Resultado |
| - | -- | -- | -- |
| 1 | `app/page.tsx:1049` | `if (abilityCooldownRemaining > 0) return;` → `if (false) return;` (remove a guarda de cooldown) | ✅ Killed — `character-power.test.tsx` CHAR-04 falhou (posição mudou quando não deveria) |
| 2 | `app/page.tsx:1067` | `if (event.key.toLowerCase() === "q" && !event.repeat)` → remove `&& !event.repeat` | ✅ Killed — `character-power.test.tsx` CHAR-05 (repeat isolado) falhou |
| 3 | `lib/characters.ts:65` | `if (d < nearestDistance)` → `if (d > nearestDistance)` (inverte seleção do inimigo mais próximo) | ✅ Killed — `characters.test.ts` "aims at the nearest enemy..." falhou |

Todas as 3 mutações revertidas e confirmadas (`git status` limpo para os arquivos afetados; `npm test -- --run` volta a 211/211 após reversão).

**Sensor depth**: lightweight (default). **Resultado**: 3/3 killed — PASS.

### Escopo

`git diff 7cc2929..94dd14e --stat`:
```
_docs/specs/features/sistema-personagens/design.md | 169 +++++++++++++++++
_docs/specs/features/sistema-personagens/spec.md   | 114 ++++++++++++
_docs/specs/features/sistema-personagens/tasks.md  | 204 +++++++++++++++++++++
app/__tests__/character-power.test.tsx             | 175 ++++++++++++++++++
app/__tests__/hidden-menu.test.tsx                 |  11 +-
app/page.tsx                                       |  68 ++++++-
lib/__tests__/characters.test.ts                   | 102 +++++++++++
lib/characters.ts                                  |  76 ++++++++
8 files changed, 911 insertions(+), 8 deletions(-)
```
Apenas arquivos esperados pelo `tasks.md` (T1: `lib/characters.ts` + teste; T2/T3: `app/page.tsx` + `hidden-menu.test.tsx` + `character-power.test.tsx`) mais os 3 artefatos de spec/design/tasks do próprio processo. Nenhum arquivo fora do escopo declarado foi tocado.

### Comandos executados (rodados diretamente, não confiando em relato anterior)

- `npm test -- --run` → **211 passed (211)**, 16 arquivos de teste, 0 falhas. Base pré-feature (antes de `8af984f`) era 195 testes → delta de **+16** (10 novos em `characters.test.ts` + 6 novos em `character-power.test.tsx`; `hidden-menu.test.tsx` manteve a mesma contagem, só trocou o conteúdo de uma asserção, conforme T2 previa).
- `npm run build` → sucesso, `Compiled successfully`, TypeScript e geração de páginas estáticas OK, sem erros.
- `npm run lint` → **0 erros**, 2 warnings pré-existentes e não relacionados a esta feature (`coverage/lcov-report/block-navigation.js` — arquivo gerado — e `lib/debug.ts:26` `_search` não usado, já existente antes desta feature).

### Gaps encontrados

1. **[Minor] CHAR-09 — teste não exercita a implementação real com 2 entradas.** `lib/__tests__/characters.test.ts:53-71` constrói um array de teste e valida sua própria lógica de busca (`.find`), mas nunca chama `resolveCharacter` contra um registry com 2 personagens — a chamada real ao `resolveCharacter` no teste (`resolveCharacter(CHARACTERS[0].id)`) só cobre o caso trivial de 1 entrada, já coberto por CHAR-01/02. **Sugestão de fix** (não aplicada, apenas registrada): dentro do teste, `(CHARACTERS as CharacterDefinition[]).push(testOnlyCharacter)` antes de chamar `resolveCharacter(testOnlyCharacter.id)` e `resolveCharacter(CHARACTERS[0].id)`, depois `pop()` no cleanup — ou extrair `resolveCharacter` para aceitar um `registry` opcional injetável para teste. Não bloqueante para esta rodada porque a implementação (`CHARACTERS.find(...) ?? CHARACTERS[0]`) é uma one-liner cuja correção para N>1 é verificável por inspeção direta, mas o teste hoje não prova o que a spec pede que ele prove.
2. **[Cosmetic] CHAR-08 — cooldown do poder no painel sem asserção de valor exato.** `hidden-menu.test.tsx:63` confirma o nome "Refactor Dash" mas não afirma o texto do cooldown ("cooldown: 6s") nem a descrição completa. Não compromete o outcome principal da AC (nome/atributos/poder aparecem), mas é uma cobertura ligeiramente mais fraca que o ideal.
3. **[Cosmetic] Edge case "personagem sem poder especial" (`Sem poder especial.`, `app/page.tsx:2171`) sem teste.** Implementado no código, mas não há teste que force `specialPower: null` no painel — inevitável no MVP (só 1 personagem real, que tem poder), consistente com o Out of Scope da spec (2º personagem real não faz parte desta entrega).

## Execução 2026-08-29 — commit range 94dd14e..ca3aa1e (fix cycle 1 — re-verificação de CHAR-09)

PASS

### Evidência do fix

`git diff 94dd14e..ca3aa1e` toca exatamente 2 arquivos: `lib/characters.ts` e `lib/__tests__/characters.test.ts` — nenhum outro arquivo de produção ou teste foi alterado.

`lib/characters.ts:39-44` — `resolveCharacter` ganhou um segundo parâmetro opcional:
```ts
export function resolveCharacter(
  id: string | undefined,
  registry: readonly CharacterDefinition[] = CHARACTERS,
): CharacterDefinition {
  return registry.find((character) => character.id === id) ?? registry[0];
}
```
Default `= CHARACTERS` preserva o comportamento para todo call site existente que não passa o 2º argumento.

`lib/__tests__/characters.test.ts:73` — a asserção agora chama a função real, não uma reimplementação local:
```ts
const resolved = resolveCharacter(testOnlyCharacter.id, testRegistry);
```
onde `testRegistry` (linha 65: `const testRegistry: readonly CharacterDefinition[] = [CHARACTERS[0], testOnlyCharacter];`) é um array de 2 entradas passado como argumento real, não mais um `.find()` local sobre uma cópia. `lib/__tests__/characters.test.ts:76-77`:
```ts
expect(resolved).toBe(testOnlyCharacter);
expect(resolved).toEqual(testOnlyCharacter);
expect(resolveCharacter(CHARACTERS[0].id, testRegistry)).toBe(CHARACTERS[0]);
```
`resolved` bate exatamente com `testOnlyCharacter` (a 2ª entrada, injetada só neste teste) e a resolução da 1ª entrada dentro do mesmo registry de 2 itens também é confirmada por chamada real. Isso prova genericidade de `resolveCharacter` com N=2 via a implementação real, fechando o gap Minor da rodada anterior.

`grep -rn "resolveCharacter(" app lib` → único call site de produção é `app/page.tsx:33: const activeCharacter = resolveCharacter(DEFAULT_CHARACTER_ID);` — chamada com 1 argumento, coberta pelo default `= CHARACTERS`, sem quebra de contrato.

### Sensor de discriminação (mutação focada no fix)

Mutação em `lib/characters.ts:43`: `return registry.find((character) => character.id === id) ?? registry[0];` → `return CHARACTERS.find((character) => character.id === id) ?? CHARACTERS[0];` (ignora o parâmetro `registry` injetado e força a busca sempre no array de módulo, que só tem 1 item real).

Resultado: ✅ Killed — `npx vitest run lib/__tests__/characters.test.ts` reprovou exatamente o teste reescrito de CHAR-09 (`resolves generically by id against an injected registry with a second entry that exists only in this test`), com `resolved` retornando `{id: 'dev-pleno', ...}` em vez de `{id: 'test-only', ...}` na asserção `expect(resolved).toBe(testOnlyCharacter)` (`characters.test.ts:75`). As outras 9 asserções do arquivo continuaram passando (9 passed | 1 failed). Isso confirma que o teste reescrito depende de fato do parâmetro `registry` da função real, não de uma cópia local.

Mutação revertida com `git checkout -- lib/characters.ts`; `git status --porcelain` confirma árvore limpa para esse arquivo (únicas modificações remanescentes são `_docs/roadmap.md` e `_docs/specs/features/sistema-personagens/tasks.md`, pré-existentes de outra frente, não tocadas nesta rodada) e `npm test -- --run` volta a 211/211 após a reversão.

### Regressão nas outras 10 ACs

`git diff 94dd14e..ca3aa1e --stat` confirma que o fix cycle tocou somente `lib/characters.ts` e `lib/__tests__/characters.test.ts` — nenhum arquivo relacionado a CHAR-01 a CHAR-08, CHAR-10 ou CHAR-11 (`app/page.tsx`, `app/__tests__/character-power.test.tsx`, `app/__tests__/hidden-menu.test.tsx`) foi alterado. A suíte completa (211/211, mesma contagem) e o build/lint limpos confirmam ausência de regressão. Evidência detalhada por AC permanece a da rodada anterior (seção `## Execução 2026-08-29 — commit range 7cc2929..94dd14e` acima).

### Comandos executados

- `npm test -- --run` → **211 passed (211)**, 16 arquivos de teste, 0 falhas — mesma contagem da rodada anterior (o fix reescreveu um teste existente, não adicionou/removeu casos).
- `npm run build` → sucesso, `Compiled successfully`, TypeScript OK, 5 páginas geradas, sem erros.
- `npm run lint` → **0 erros**, 2 warnings pré-existentes e não relacionados (mesmos da rodada anterior: `coverage/lcov-report/block-navigation.js` e `lib/debug.ts:26`).

### Gaps encontrados

Nenhum. O gap Minor de CHAR-09 registrado na rodada anterior foi fechado pelo fix cycle 1: o teste agora exercita a implementação real de `resolveCharacter` com um registry de 2 entradas, confirmado por leitura de código (`file:line`) e por sensor de discriminação dedicado (mutação killed). Os gaps Cosmetic (CHAR-08 cooldown sem asserção exata; edge case "sem poder especial" sem teste) permanecem registrados como não bloqueantes, sem mudança nesta rodada.

---

## Code review 2026-08-29 — /code-review high 7cc2929..ca3aa1e

Achados classificados conforme protocolo do usuário (a/b/c/d):

**(a) Viola AC existente → fix cycle 2 (a disparar em seguida):**
1. `lib/characters.ts:63` — `resolveDashDirection` retorna vetor zero quando o inimigo mais próximo coincide com a posição do jogador; viola CHAR-03 (dash sempre desloca por `dashDistance`). Cooldown é consumido sem deslocamento.
2. `app/page.tsx:680` (`syncHud`) — `setDebugAbilityCooldown`/`setDebugPlayerPosition` rodam sem o guard `isDebugAllowed()`, ao contrário do padrão existente (`setDebugBossHealth`/`setDebugPowerUpCount`, gated dentro do handler de debug) e do que o próprio `design.md` prometia ("mesmo gate `isDebugAllowed()`").

**(b) Gap de spec → apresentado ao usuário, decisão registrada:**
3. `app/page.tsx:1051` — dash não chama `obstacleBlocksCircle`, atravessa obstáculos. Spec original só previa clamp de limite do mundo. **Decisão do usuário**: comportamento intencional (habilidade de escape) — formalizado como CHAR-12 em `spec.md`, sem mudança de código.

**(c) Melhoria fora dos ACs → registrado, não implementado:**
4. Falta `context.md` na pasta da feature (convenção do `AGENTS.md`) — decisões já estão na tabela de Assumptions de `spec.md`.
5. `triggerActivePower` só generaliza para poderes do tipo "dash" (sem discriminador de tipo de poder); um personagem futuro com mecânica diferente exigiria mudar `app/page.tsx`.
6. HUD de debug atualiza a cada 18 frames (throttle do `syncHud`) — leitura pode ficar até ~0.3s desatualizada.
7. Sem feedback visual dedicado se um personagem futuro tiver `specialPower: null` (edge case já tratado no código, só sem teste — inevitável com 1 personagem só).

**Já resolvido, sem ação nova:** duplicação de `distance()`/`normalize()` entre `lib/characters.ts` e `app/page.tsx` — já é o Risco R1 do `design.md`, conscientemente aceito.

### Gaps encontrados

2 gaps (a) roteados para fix cycle 2. 1 gap (b) resolvido via emenda de spec (CHAR-12). 4 itens (c) registrados em "Questões abertas" — sem ação nesta feature.

---

## Execução 2026-08-29 — commit range cc37ce4..32a656d (fix cycle 2 — re-verificação)

PASS

### Evidência dos fixes

**Gap 1 (vetor zero de dash quando inimigo coincide com o jogador)** — fechado.

`lib/characters.ts:74` — a condição de fallback mudou de `if (nearest) {` para:
```ts
if (nearest && Number.isFinite(nearestDistance) && nearestDistance > 0) {
```
e `lib/characters.ts:78` retorna `{ x: 0, y: -1 }` (fallback fixo, conforme Edge Case de `spec.md:79`) quando `nearestDistance` é `0` (inimigo exatamente sobre o jogador) — antes disso caía no `if (nearest)` e chamava `normalize(0, 0)`, que é o vetor zero.

Teste fortalecido em `lib/__tests__/characters.test.ts:102-108` — renomeado de "does not produce NaN..." para "falls back to (0, -1) instead of a zero vector when the nearest enemy is exactly at the player's position", e ganhou a asserção do vetor exato (linha 106):
```ts
const result = resolveDashDirection({ x: 0, y: 0 }, player, [{ x: 50, y: 50 }]);
expect(result).toEqual({ x: 0, y: -1 });
expect(Number.isNaN(result.x)).toBe(false);
expect(Number.isNaN(result.y)).toBe(false);
```
Não é mais só ausência de NaN — afirma o vetor `(0, -1)` exato exigido por CHAR-03 (dash sempre desloca por `dashDistance`, mesmo nesse caso de borda).

**Gap 2 (debug HUD sem guard `isDebugAllowed()`)** — fechado.

`app/page.tsx:680-683` (dentro de `syncHud`):
```ts
if (isDebugAllowed()) {
  setDebugAbilityCooldown(Math.max(0, abilityCooldownRemaining));
  setDebugPlayerPosition({ x: Math.round(player.x), y: Math.round(player.y) });
}
```
Antes, as duas chamadas rodavam incondicionalmente logo após `setBossProgress`. Agora seguem o mesmo padrão do restante do arquivo (`app/page.tsx:1004`, `1942`, `1947` também usam `isDebugAllowed()` como guard), conforme `design.md` prometia.

### CHAR-12 (intencional) permanece intacto

`triggerActivePower` (`app/page.tsx:1047-1058`) não foi tocado pelo fix cycle 2 (fora do `git diff cc37ce4..32a656d --stat`, que só lista `app/page.tsx` — a única mudança nesse arquivo é o guard do Gap 2 em `syncHud`, linha 680). Leitura direta do corpo da função confirma: o deslocamento usa apenas `clamp(player.x + direction.x * power.dashDistance, 28, WORLD.width - 28)` (e equivalente em `y`), sem qualquer chamada a `obstacleBlocksCircle`. `grep -n "obstacleBlocksCircle" app/page.tsx` retorna só as linhas 732 (definição), 909 (power-ups) e 1216-1217 (movimento WASD normal) — nenhuma dentro de `triggerActivePower`. CHAR-12 (dash atravessa obstáculos) permanece válido, sem regressão acidental.

### Sensor de discriminação

Estado descartável: edições diretas em `lib/characters.ts` e `app/page.tsx`, revertidas com `git checkout --` antes de terminar (árvore limpa depois, só `_docs/roadmap.md` seguiu modificado por outra frente, não tocado nesta rodada).

| # | Arquivo:linha | Mutação | Resultado |
| - | -- | -- | -- |
| 1 | `lib/characters.ts:74` | `if (nearest && Number.isFinite(nearestDistance) && nearestDistance > 0) {` → `if (nearest) {` (remove a checagem de distância > 0 do fix) | ✅ Killed — `npx vitest run lib/__tests__/characters.test.ts` reprovou o teste fortalecido: `expected { x: +0, y: +0 } to deeply equal { x: +0, y: -1 }` (9 passed \| 1 failed) |
| 2 | `app/page.tsx:680-683` | Remove `if (isDebugAllowed()) { ... }` ao redor de `setDebugAbilityCooldown`/`setDebugPlayerPosition`, deixando as duas chamadas incondicionais de novo | ⚠️ Survived — `npm test -- --run` continuou 211/211 sem falhas |

Mutação 2 sobreviveu como esperado: é uma **limitação conhecida do sensor** para este gap específico, não uma falha do fix. `character-power.test.tsx` e os demais testes de UI rodam com `NODE_ENV=development` (via Vitest/jsdom), o mesmo ambiente em que `isDebugAllowed()` já retorna `true` por padrão (`lib/debug.ts:26`, confirmado por `lib/__tests__/debug.test.ts:20`) — logo, gatear ou não essas duas chamadas não muda o resultado observável em nenhum teste existente. O gap era sobre consistência de padrão e postura de segurança/desempenho em produção (não vazar dados de debug fora de `isDebugAllowed()`), não sobre um comportamento capturável pela suíte atual. Fechar esse gap corretamente por leitura de código (confirmado acima) é a evidência válida aqui — o teste automatizado não é (e não pretende ser) o sensor certo para esta AC.

Ambas as mutações revertidas com `git checkout -- lib/characters.ts app/page.tsx`; `git status --porcelain` confirma árvore limpa para os dois arquivos (só `_docs/roadmap.md` seguiu com modificação pré-existente de outra frente); `npm test -- --run` volta a 211/211 após a reversão.

### Comandos executados

- `npm test -- --run` → **211 passed (211)**, 16 arquivos de teste, 0 falhas — mesma contagem das rodadas anteriores (fix cycle 2 fortaleceu um teste existente, não adicionou/removeu casos).
- `npm run build` → sucesso, `Compiled successfully in 640ms`, TypeScript OK, 5 páginas geradas, sem erros.
- `npm run lint` → **0 erros**, 2 warnings pré-existentes e não relacionados (`coverage/lcov-report/block-navigation.js` e `lib/debug.ts:26` `_search` não usado — mesmos das rodadas anteriores).

### Gaps encontrados

Nenhum. Os 2 gaps reais (a) do code-review (`7cc2929..ca3aa1e`) estão fechados com evidência `file:line` + assertão de vetor exato (Gap 1) e leitura de código do guard (Gap 2). CHAR-12 permanece intacto por leitura direta de `triggerActivePower`. Suíte, build e lint limpos, sem regressão. Os itens (c) do code-review seguem registrados como "Questões abertas", fora do escopo deste fix cycle.

---

## SonarQube 2026-08-29 — scan local (http://localhost:9000, projectKey java-pleno-pixel-hunt)

Rodado via `sonar-scanner@3.1.0` (baixado via `npx`, Community Edition — sem suporte a `sonar.branch.name`, análise feita sobre o estado do working tree em `32a656d`) + `npm run test:coverage` (LCOV do Vitest v8, `lib/characters.ts` com 100% statements/funcs/lines).

**Quality Gate: ERROR** (`new_violations: 3 > 0`; `new_coverage: 92.3%` OK; `new_duplicated_lines_density: 0.76%` OK).

Investigadas as 3 violações "novas" (`inNewCodePeriod=true`) — **nenhuma pertence a `sistema-personagens`**:

| Arquivo:linha | Regra | Severidade | Origem |
| --- | --- | --- | --- |
| `app/page.tsx:2118` | `S6819` (usar `<dialog>` em vez de `role="dialog"`) | MAJOR | Feature anterior (cheat-code hidden menu, commit `15f7f55`/`7cc2929`) — confirmado fora do diff `7cc2929..32a656d` |
| `app/page.tsx:2122` | `S3358` (ternário aninhado no `aria-label`) | MAJOR | Mesma origem — o `aria-label` com 3 opções (`scores`/`skins`/`help`) já existia antes desta feature |
| `lib/__tests__/cheat-codes.test.ts:36` | `S5906` (assertion genérica) | MINOR | Arquivo inteiro pertence à feature anterior — nem aparece no `git diff 7cc2929..32a656d --stat` |

O "novo código" do Sonar é medido a partir de um baseline (`PREVIOUS_VERSION`, 2026-08-27) anterior a essas duas features desta sessão — a análise mistura o diff de `sistema-personagens` com o da feature de cheat-code que a precedeu na mesma sessão, ambas depois do baseline.

**Nenhuma ação tomada nesta feature** — as 3 violações são de código já mergeado na `main` antes desta branch existir, fora do escopo de `sistema-personagens` (regra "Nada fora da spec"). Registrado aqui para o usuário decidir se abre uma tarefa de limpeza separada para a feature de cheat-code.

**75 issues pré-existentes adicionais** (`sinceLeakPeriod=true`, período mais amplo) não investigadas uma a uma — a maioria concentrada em `app/page.tsx` (complexidade cognitiva alta em funções do motor do jogo, ternários aninhados, `Math.random` sinalizado como PRNG "inseguro" em contexto de gameplay, não de segurança) — débito técnico anterior a toda esta sessão, fora do escopo desta validação.
