# Validation — sistema-personagens

## Status atual
Veredito: PASS (CHAR-24 e CHAR-25 fechados no fix cycle 2; resta apenas 1 gap Cosmetic aceito — `player.fury` sem teste automatizado)
Spec vigente: spec.md (25 ACs, CHAR-01 a CHAR-25 — Emenda 3 de 2026-08-30 adicionou CHAR-24/CHAR-25)
HEAD: 2e2c54f
Gaps abertos: 1, não bloqueante.
1. **[Cosmetic, aceito]** Regressão de `player.fury` sobrepondo a cor do corpo mesmo com personagem diferente (T7, "Done when" não marcado `[x]`) — sem teste automatizado, justificativa do autor confirmada por inspeção de código (ver seção "Confirmação do SPEC_DEVIATION" abaixo — não há caminho de debug determinístico para forçar `player.fury > 0`).

Histórico do gap CHAR-24/CHAR-25 (fechado): o `/code-review high` na Emenda 2 encontrou que o poder haste sobrescrevia `player.haste` em vez de usar `Math.max` (como o shield), e que os cards do seletor não tinham CSS correspondente às classes `character-card`/`character-card-selected`/`character-portrait`. Formalizados como CHAR-24/CHAR-25 (`24e29b6`). Fechados pelo fix cycle 2 (`2e2c54f`): `app/page.tsx:1109` agora usa `Math.max`, e `app/globals.css` ganhou as 3 classes com destaque visual real. Re-verificado nesta rodada — mutação inversa (reatribuição direta) KILLED pelo teste novo. Ver seção "Execução ... 278a787..2e2c54f" abaixo.

Histórico do gap CHAR-19 (fechado): o sensor de discriminação da rodada `2b19cda..ff71371` havia encontrado um gap Minor de isolamento de evidência no teste de CHAR-19 (`captured[]` contaminado pelo retrato do seletor). Fechado pelo fix cycle 1 (`278a787`): `captured.length = 0` inserido em `character-power.test.tsx:362`, entre a seleção do personagem e o avanço do frame de jogo. Re-verificado nesta rodada — mutação re-aplicada em `app/page.tsx:1778` agora KILLED. Ver seção "Execução ... ff71371..278a787" abaixo.

Histórico anterior (Emenda 1, CHAR-01 a CHAR-12): todos `Verified`, sem regressão confirmada nesta rodada (ver "Escopo" abaixo — nenhum teste de T1-T3 mudou de contagem ou quebrou).

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

---

## Execução 2026-08-29 — sistema-personagens Emenda 2 — commit range 2b19cda..ff71371

**PASS** (com 1 gap Minor de isolamento de sensor — CHAR-19 — e 1 gap Cosmetic aceito, já registrado pelo autor)

### Evidência por AC (CHAR-13 a CHAR-23)

**CHAR-13** (Estagiário: maxHp menor, speed maior, size menor, poder `kind: "haste"`)
`lib/characters.ts:56-71` — entrada `estagiario`: `maxHp: 70, speed: 260, size: 20, bodyColor: "#2dd4bf"`, poder `{ kind: "haste", cooldownSeconds: 10, durationSeconds: 4, name: "Já Terminei!" }`. Teste: `lib/__tests__/characters.test.ts:58-64` — `expect(estagiario.maxHp).toBeLessThan(devPleno.maxHp)`, `.speed).toBeGreaterThan`, `.size).toBeLessThan`. Outcome da spec: perfil "rápido e frágil" com esses 3 comparativos + poder haste nomeado. ✅ PASS — comparação relativa (não só valor absoluto), exatamente o que a AC pede.

**CHAR-14** (SRE: maxHp maior, speed igual/menor, size maior, poder `kind: "shield"`)
`lib/characters.ts:72-87` — entrada `sre`: `maxHp: 130, speed: 190, size: 28, bodyColor: "#64748b"`, poder `{ kind: "shield", cooldownSeconds: 30, durationSeconds: 2.5, name: "Modo Incident Response" }`. Teste: `lib/__tests__/characters.test.ts:66-72` — `expect(sre.maxHp).toBeGreaterThan`, `.speed).toBeLessThanOrEqual`, `.size).toBeGreaterThan`. ✅ PASS.

**CHAR-15** (discriminador `kind` + despacho genérico sem `if`/`else` por personagem)
Tipo: `lib/characters.ts:3-27` — union discriminada `{ kind: "dash", dashDistance } | { kind: "haste", durationSeconds } | { kind: "shield", durationSeconds }`. Despacho: `app/page.tsx:1104-1112` — `if (power.kind === "dash") {...} else if (power.kind === "haste") {...} else if (power.kind === "shield") {...}` — ramifica por `power.kind`, nunca por `activeCharacter.id`/nome. ✅ PASS por leitura direta — confirmado que não existe nenhum `if (activeCharacter.id === ...)` em `triggerActivePower` (`grep -n "activeCharacter.id" app/page.tsx` não retorna nada dentro da função).

**Confirmação do SPEC_DEVIATION reportado (guarda de narrowing temporária em T5)**

`git show 3bf54f8 -- app/page.tsx` confirma que T5 introduziu `if (power.kind !== "dash") return;` logo após as guardas de cooldown, comentada explicitamente como `// SPEC_DEVIATION: guard added ahead of schedule (T5, not T6)...`. `git show 838aa54 -- app/page.tsx` confirma que T6 **removeu essa linha e o comentário por completo**, substituindo-os pelo `if/else if` de 3 ramos (dash/haste/shield) mostrado acima. Verificação direta do HEAD (`ff71371`): `grep -n "SPEC_DEVIATION\|power.kind !== \"dash\"" app/page.tsx` não retorna nenhuma ocorrência — nenhum resquício da guarda temporária, nenhum comportamento remanescente dela (o ramo `haste`/`shield` não passa mais por um `return` antecipado). **Confirmado: resolvido, sem gap.**

**CHAR-16** (ativação de poder `kind: "haste"` aplica `player.haste` + inicia cooldown)
`app/__tests__/character-power.test.tsx:233-243` — `selectCharacterAndStart("estagiario")`, pressiona `Q`, afirma `expect(playerEffectsStatus().haste).toBeCloseTo(hastePower.durationSeconds, 1)` (4) e `expect(cooldownStatus()).toBe(\`${hastePower.cooldownSeconds.toFixed(1)}s\`)` (10.0s). Código: `app/page.tsx:1108-1109` — `player.haste = power.durationSeconds`. ✅ PASS — valor exato, não apenas "mudou". Sensor: mutação 1 abaixo, killed.

**CHAR-17** (ativação de poder `kind: "shield"` aplica `player.invincible` + inicia cooldown)
`app/__tests__/character-power.test.tsx:245-255` — `selectCharacterAndStart("sre")`, pressiona `Q`, afirma `expect(playerEffectsStatus().invincible).toBeGreaterThanOrEqual(shieldPower.durationSeconds)` (2.5) e cooldown `30.0s`. Código: `app/page.tsx:1110-1111` — `player.invincible = Math.max(player.invincible, power.durationSeconds)`. ✅ PASS. Sensor: mutação 2 abaixo, killed.

**CHAR-18** (regras de cooldown/borda/reset/estado idênticas para haste/shield)
Cooldown durante bloqueio: `character-power.test.tsx:257-269` (`"blocks a repeated Q while a haste power is on cooldown... (CHAR-18, mirrors CHAR-04)"`) — dispara, captura efeitos/cooldown, dispara de novo, afirma `toEqual`/`toBe` (sem mudança). Fora de `"playing"`: `character-power.test.tsx:271-281` (`"has no effect for a shield power when Q is pressed outside gameState 'playing' (CHAR-18, mirrors CHAR-07)"`) — seleciona SRE, volta ao menu, pressiona `Q`, afirma `{haste:0, invincible:0}` e cooldown `"0.0s"`. Ambos os testes são duplicações reais (não apenas comentário) das regras de CHAR-04/CHAR-07, aplicadas a personagens não-dash — cumpre exatamente o que a task T6 exigia ("prova CHAR-18 na prática, não só por inspeção de código"). Reset de cooldown (CHAR-06) e borda de subida (CHAR-05) não têm uma cópia dedicada para haste/shield — o mecanismo de guarda (`abilityCooldownRemaining`) é o mesmo código compartilhado entre os 3 `kind`s, já provado por CHAR-06/05 com dash; não há um `file:line` que repita especificamente esses 2 sub-casos para haste/shield. ⚠️ **Spec-precision gap parcial**: CHAR-18 cobre cooldown-block e fora-de-playing com teste duplicado real; reset-on-new-match e edge-triggering ficam cobertos só pela inspeção de que o código é o mesmo (não específico por `kind`), consistente com a alegação do design ("essas regras são do sistema de ativação de poder, não específicas de dash") mas sem duplicação de teste explícita para os 2 sub-casos restantes.

**CHAR-19** (cor de corpo por personagem em `drawPlayer()`)
`app/__tests__/character-power.test.tsx:356-365` — técnica: `testCanvasContext.fillRect` é uma função não-arrow que lê `this.fillStyle` no momento da chamada (linhas 339-342), capturando `{color, args}` para cada `fillRect`; seleciona Estagiário, avança 1 frame, afirma `captured.find(fill => fill.color === "#2dd4bf" && fill.args[2] === 16 && fill.args[3] === 13)` está definido — a técnica de captura é genuína (não é um mock raso "foi chamado"), prova que ALGUMA chamada `fillRect` usou a cor `#2dd4bf` no shape exato da camisa (16×13). Código: `app/page.tsx:1777-1781` — `drawCharacterBody(ctx, x, y, { bodyColor: player.fury > 0 ? "#f97316" : activeCharacter.bodyColor, ... })`. ⚠️ **GAP real encontrado pelo sensor de discriminação** (ver abaixo): a evidência não isola exclusivamente o código de `drawPlayer()` — o mesmo `captured[]` também recebe os `fillRect` do retrato do seletor (`app/page.tsx:305`, mesmo shape porque `drawCharacterBody` é reutilizada), que já roda durante `selectCharacterAndStart()` (clique no radio, antes de "Jogar"). Mutar só a linha 1778 (jogo) para uma cor fixa não derruba o teste, porque o retrato (linha 305, não mutado) já produz a mesma combinação cor+shape. **Resultado: GAP (Minor)** — a AC está implementada corretamente (confirmado por leitura direta do código, que usa `activeCharacter.bodyColor` tanto no jogo quanto no retrato), mas o teste como está não prova unicamente que `drawPlayer()` (e não só o retrato) usa a cor do personagem.

**CHAR-20** (rótulo em jogo usa `activeCharacter.name`)
`app/__tests__/character-power.test.tsx:367-377` — seleciona Estagiário, avança 1 frame, `expect(testCanvasContext.fillText).toHaveBeenCalledWith("Estagiário", expect.any(Number), expect.any(Number))`. Código: `app/page.tsx:1789` (`ctx.fillText(activeCharacter.name, player.x, player.y - 20)`). ✅ PASS — valor exato do nome, não apenas presença da chamada.

**CHAR-21** (seletor real com 3 cards + retrato desenhado)
Cards: `app/__tests__/hidden-menu.test.tsx:125-138` (`"renders one selectable radio card per registry character, Dev Pleno checked by default (CHAR-21, CHAR-22)"`) — `expect(radios).toHaveLength(CHARACTERS.length)` (3) e cada `role="radio"` com `aria-checked` correto. Retrato: `hidden-menu.test.tsx:195-205` — abre painel, `dialog.querySelectorAll("canvas")` tem `CHARACTERS.length` (3) elementos e `canvasContext.fillRect.mock.calls.length` aumentou — prova desenho real, não só a tag presente. Edge case (reabrir sem duplicar/sem erro): `hidden-menu.test.tsx:207-216`. Código: `app/page.tsx:298-306` (`useEffect` dependente de `menuPanel`, desenha 1x por canvas via `drawCharacterBody`). ✅ PASS.

**CHAR-22** (seleção só vale na próxima partida)
`hidden-menu.test.tsx:140-157` (`aria-checked` move ao clicar) e `:159-172` (`"starts the next match with the selected character's maxHp instead of the default's"`) — seleciona Estagiário, clica "Jogar", `expect(screen.getByText(String(estagiario.maxHp))).toBeVisible()` (70). Código: `app/page.tsx:802-806` (`resetWaveOne`: `activeCharacter = resolveCharacter(selectedCharacterIdRef.current); player.maxHp = activeCharacter.maxHp; ...`). ✅ PASS — valor exato (70), não genérico.

**CHAR-23** (sem persistência entre sessões)
`hidden-menu.test.tsx:174-193` — seleciona Estagiário, `unmount()`, novo `render(<Home />)`, reabre painel, afirma `aria-checked="true"` de volta no `CHARACTERS[0]` (Dev Pleno). ✅ PASS — simula reload de forma real (unmount+remount, não apenas reset de estado interno).

### Confirmação de não-regressão (CHAR-01 a CHAR-12)

`git diff 2b19cda..ff71371 --stat` (ver "Escopo" abaixo) mostra que os arquivos de T1-T3 (`lib/characters.ts`, `app/page.tsx`) foram modificados, mas de forma aditiva sobre a mesma estrutura — nenhum teste de `characters.test.ts`/`character-power.test.tsx`/`hidden-menu.test.tsx` referente a CHAR-01 a CHAR-11 mudou de asserção ou foi removido (confirmado por leitura: as describes/its de "character active power (Refactor Dash)" e "resolveCharacter"/"resolveDashDirection" permanecem intactas, linha por linha, com os mesmos valores exatos: `dashDistance`, `cooldownSeconds: 6`, fallback `(0,-1)`). CHAR-12 (dash atravessa obstáculos) permanece válido por leitura direta: `triggerActivePower` não ganhou nenhuma chamada a `obstacleBlocksCircle` no ramo `dash` (`app/page.tsx:1105-1107`, idêntico ao comportamento pré-Emenda-2). `npm test -- --run` = 226/226 (nenhuma falha) confirma ausência de regressão end-to-end.

### Sensor de discriminação

Estado descartável: edições diretas em `app/page.tsx`, revertidas com `git checkout --`/reversão manual simétrica antes de terminar; `git status --short` confirmado limpo antes e depois de cada mutação.

| # | Arquivo:linha | Mutação | Resultado |
| - | -- | -- | -- |
| 1 | `app/page.tsx:1109` | `player.haste = power.durationSeconds;` → `player.haste = 0;` | ✅ Killed — `character-power.test.tsx` CHAR-16 falhou (`expected +0 to be close to 4`) |
| 2 | `app/page.tsx:1111` | `player.invincible = Math.max(player.invincible, power.durationSeconds);` → subtrai `power.durationSeconds` de volta (neutraliza o efeito) | ✅ Killed — `character-power.test.tsx` CHAR-17 falhou (`expected 0 to be greater than or equal to 2.5`) |
| 3 | `app/page.tsx:1778` | `bodyColor: player.fury > 0 ? "#f97316" : activeCharacter.bodyColor` → `bodyColor: player.fury > 0 ? "#f97316" : "#0ea5e9"` (cor fixa, ignora o personagem ativo em jogo) | ❌ **Survived** — `character-power.test.tsx` CHAR-19 continuou passando (13/13). Causa raiz: o `captured[]` do teste também recebe os `fillRect` do retrato do seletor (`app/page.tsx:305`, mesmo `bodyColor`/shape, não mutado), disparados por `selectCharacterAndStart()` antes de `advanceFrames(1)`. Confirmado isoladamente com `npx vitest run ... -t "CHAR-19"` (1/1 passou mesmo com a mutação ativa). Mutação revertida; `git diff app/page.tsx` limpo e suíte completa voltou a 226/226 após reversão. |

**Sensor depth**: lightweight (default, 3 mutações). **Resultado**: 2/3 killed, 1/3 survived — mutante sobrevivente vira o gap Minor de CHAR-19 registrado acima (fix task recomendada: limpar/isolar `captured[]` antes de `advanceFrames(1)` em `character-power.test.tsx:358`, ou restringir a asserção a um `fillRect` capturado estritamente após esse ponto).

### Escopo

`git diff 2b19cda..ff71371 --stat`:
```
_docs/specs/features/sistema-personagens/tasks.md |  50 +++---
app/__tests__/character-power.test.tsx            | 207 +++++++++++++++++++++-
app/__tests__/hidden-menu.test.tsx                |  94 ++++++++++
app/page.tsx                                       | 143 +++++++++++----
lib/__tests__/characters.test.ts                  |  59 +++++-
lib/characters.ts                                 |  67 ++++++-
6 files changed, 550 insertions(+), 70 deletions(-)
```
Exatamente os arquivos esperados por T4 (`lib/characters.ts` + teste), T5/T6/T7 (`app/page.tsx` + os 2 arquivos de teste de componente), mais `tasks.md` (atualização de status das tasks, parte do próprio processo). Nenhum arquivo fora do escopo declarado em `design.md`/`tasks.md` foi tocado.

### Comandos executados

- `npm test -- --run` → **226 passed (226)**, 16 arquivos de teste, 0 falhas. Base antes da Emenda 2 (`2b19cda`) era 211 → delta de **+15** (novos casos em `characters.test.ts`, `character-power.test.tsx`, `hidden-menu.test.tsx`), batendo a contagem esperada pelo pedido de verificação.
- `npm run build` → sucesso, `Compiled successfully in 652ms`, TypeScript OK, 5 páginas estáticas geradas, sem erros.
- `npm run lint` → **0 erros**, 2 warnings pré-existentes e não relacionados a esta emenda (`coverage/lcov-report/block-navigation.js` — arquivo gerado — e `lib/debug.ts:26` `_search` não usado, mesmos das rodadas anteriores).

### Gaps encontrados

1. **[Minor] CHAR-19 — sensor de discriminação sobrevivente.** `app/__tests__/character-power.test.tsx:356-365` não isola a evidência à cor de corpo desenhada por `drawPlayer()` — o `captured[]` compartilhado também absorve os `fillRect` do retrato do seletor (`app/page.tsx:305`), que usa a mesma cor/shape e roda antes de `advanceFrames(1)`. Mutar só o código de jogo (`app/page.tsx:1778`) não derruba o teste. A AC está implementada corretamente por leitura direta do código (confirmado: `activeCharacter.bodyColor` é usado tanto no jogo quanto no retrato, exatamente como o design pede), mas o teste como está não prova exclusivamente esse ponto. **Sugestão de fix** (não aplicada, apenas registrada): limpar `captured.length = 0` (ou reatribuir `captured = []`) imediatamente antes de `advanceFrames(1)` em `character-power.test.tsx:359`, isolando a evidência aos `fillRect` do frame de jogo, não aos do painel de seleção que já rodou antes.
2. **[Cosmetic, aceito] `player.fury` sobrepondo a cor do corpo — sem teste automatizado.** Já registrado pelo próprio autor no "Done when" de T7 (`tasks.md`, item não marcado `[x]`) como não coberto por teste automatizado, com a justificativa de que não há caminho de debug determinístico para forçar `player.fury > 0` nesta suíte (só via coleta de power-up "refactor" com spawn randomizado). **Confirmado nesta rodada**: `grep -n "fury" app/page.tsx` não revela nenhum hook de debug para forçar `player.fury` diretamente (ao contrário de `debugPlayerEffects` para `haste`/`invincible`, que foi adicionado especificamente em T6 para tornar CHAR-16/17 testáveis). Por inspeção direta de `app/page.tsx:1778`, o ternário `player.fury > 0 ? "#f97316" : activeCharacter.bodyColor` preserva exatamente a condição e o branch verdadeiro do código anterior (`player.fury > 0 ? "#f97316" : "#0ea5e9"`) — só o branch falso mudou de literal fixo para campo do personagem ativo. Justificativa aceita como válida; gap classificado como Cosmetic e não bloqueante, consistente com a ausência de qualquer outro caminho de teste determinístico para `player.fury` já documentado em rodadas anteriores desta mesma feature.

Nenhum dos 2 gaps bloqueia o PASS: CHAR-19 está corretamente implementada (o gap é de isolamento do sensor de teste, não de comportamento), e o gap de `player.fury` é uma limitação de testabilidade já conhecida e aceita, não uma falha funcional.

---

## Execução 2026-08-29 — sistema-personagens Emenda 2 — commit range ff71371..278a787 (fix cycle 1 — re-verificação de CHAR-19)

PASS

### Evidência do fix

`git show 278a787` toca exatamente 1 arquivo: `app/__tests__/character-power.test.tsx` (4 linhas adicionadas, 0 removidas).

O diff insere, dentro do teste de CHAR-19 (`it("draws the active character's shirt with their bodyColor instead of the fixed #0ea5e9 (CHAR-19)"`):

```diff
     render(<Home />);
     selectCharacterAndStart("estagiario");
+    // Discard any fillRect calls captured so far (e.g. the character selector's static
+    // portrait, drawn when the "skins" panel opens/selects) so the assertion below can
+    // only be satisfied by the in-game drawPlayer() draw that follows.
+    captured.length = 0;
     advanceFrames(1);
```

Lido no arquivo atual (`app/__tests__/character-power.test.tsx:356-369`): `captured.length = 0` está na linha 362 — depois de `selectCharacterAndStart("estagiario")` (linha 358, que dispara o desenho do retrato estático do seletor via `app/page.tsx:305`) e antes de `advanceFrames(1)` (linha 363, que dispara o frame de jogo real, incluindo `drawPlayer()`). A asserção subsequente (`captured.find(fill => fill.color === "#2dd4bf" && fill.args[2] === 16 && fill.args[3] === 13)`, linhas 365-368) só pode ser satisfeita por `fillRect`s ocorridos **depois** do zeramento — ou seja, exclusivamente pelo frame de jogo, não mais pelo retrato do seletor. A posição do `captured.length = 0` está correta: depois do desenho do retrato, antes do desenho do jogo, exatamente como o gap pedia.

### Sensor de discriminação (mutação re-aplicada)

Mutação idêntica à da rodada anterior: `app/page.tsx:1778` — `bodyColor: player.fury > 0 ? "#f97316" : activeCharacter.bodyColor,` → `bodyColor: player.fury > 0 ? "#f97316" : "#0ea5e9",` (cor fixa, ignora o personagem ativo em jogo).

Resultado: ✅ **Killed** (antes: Survived). `npx vitest run app/__tests__/character-power.test.tsx -t "CHAR-19"` reprovou com a mutação ativa:
```
AssertionError: expected undefined to be defined
 ❯ app/__tests__/character-power.test.tsx:368:19
```
(1 failed | 12 skipped). Isso confirma que, com `captured[]` isolado ao frame de jogo, a asserção agora depende exclusivamente da cor usada por `drawPlayer()` — a mesma mutação que sobrevivia na rodada anterior agora derruba o teste.

Mutação revertida com `git checkout -- app/page.tsx`; `git status --porcelain` confirma árvore limpa exceto `_docs/specs/features/sistema-personagens/validation.md` (a própria edição desta rodada de verificação). `npm test -- --run` volta a 226/226 após a reversão.

### Regressão nas outras ACs

`git diff ff71371..278a787 --stat` mostra que o fix tocou somente `app/__tests__/character-power.test.tsx` (+4/-0) — nenhum arquivo de produção (`app/page.tsx`, `lib/characters.ts`) nem outro arquivo de teste (`hidden-menu.test.tsx`, `characters.test.ts`) foi alterado. As demais 10 ACs da Emenda 2 (CHAR-13 a CHAR-18, CHAR-20 a CHAR-23) não tiveram seu código ou testes tocados por este fix cycle; a suíte completa (226/226, mesma contagem) e build/lint limpos confirmam ausência de regressão. Evidência detalhada por AC permanece a da rodada `2b19cda..ff71371` acima.

### Comandos executados

- `npm test -- --run` → **226 passed (226)**, 16 arquivos de teste, 0 falhas — mesma contagem da rodada anterior (o fix reforçou um teste existente com uma linha de isolamento, não adicionou/removeu casos).
- `npm run build` → sucesso, `Compiled successfully in 642ms`, TypeScript OK, 5 páginas geradas, sem erros.
- `npm run lint` → **0 erros**, 2 warnings pré-existentes e não relacionados (`coverage/lcov-report/block-navigation.js` e `lib/debug.ts:26` `_search` não usado — mesmos das rodadas anteriores).

### Gaps encontrados

Nenhum. O gap Minor de CHAR-19 (isolamento de evidência do sensor de discriminação) está fechado: `captured.length = 0` em `character-power.test.tsx:362` isola corretamente a evidência ao frame de jogo, confirmado por leitura de código (`file:line`) e por sensor de discriminação re-aplicado (mutação que antes sobrevivia agora mata o teste). O gap Cosmetic de `player.fury` (sem teste automatizado, justificativa aceita em rodada anterior) permanece registrado, sem mudança nesta rodada.

---

## Execução 2026-08-30 — sistema-personagens Emenda 3 — commit range 278a787..2e2c54f (fix cycle 2 — CHAR-24/CHAR-25)

PASS

### Evidência CHAR-24

`app/page.tsx:1109` — `player.haste = Math.max(player.haste, power.durationSeconds);` (antes: `player.haste = power.durationSeconds;`). Confirmado por `git show 2e2c54f`, único hunk de produção em `app/page.tsx`: substitui a atribuição direta pelo `Math.max`, no mesmo padrão já usado pelo shield (`app/page.tsx:1110-1111`, inalterado nesta rodada).

Teste novo: `app/__tests__/character-power.test.tsx:265-284` — `"does not shrink player.haste when a longer coffee buff is already active (CHAR-24)"`. Não é um teste genérico/vazio: seleciona o Estagiário, fixa a sequência de `Math.random()` (`vi.spyOn(Math, "random")`, fila `[0.5, 0.5, 0, 0]`) para forçar `spawnPowerUp()` a colocar um power-up do tipo `"coffee"` exatamente na posição de spawn do jogador (`x = 70 + 0.5*(960-140) = 480`, `y = 70 + 0.5*(540-140) = 270`, `kinds[Math.floor(0*6)] = "coffee"`), dispara a ação de debug `add_powerup` (`fireEvent(window, new CustomEvent(DEBUG_ACTION_EVENT, { detail: "add_powerup" }))`), avança 1 frame (a colisão de pickup a distância 0 aplica o power-up, que dá 6s de haste — `app/page.tsx:1003`, `player.haste = 6`), confirma `hasteAfterCoffee > hastePower.durationSeconds` (6 > 4), só então pressiona `Q` (ativa o poder do Estagiário, 4s), e afirma:
```ts
expect(playerEffectsStatus().haste).toBeGreaterThanOrEqual(hastePower.durationSeconds); // >= 4
expect(playerEffectsStatus().haste).toBeCloseTo(hasteAfterCoffee, 0); // ainda ~6, não caiu pra 4
```
Isso é uma reprodução end-to-end determinística do bug relatado (spawn real de power-up via `Math.random` fixado + debug action + ativação real do poder), não um teste matemático isolado.

**Mutação inversa aplicada e revertida por mim**: `app/page.tsx:1109` `player.haste = Math.max(player.haste, power.durationSeconds);` → `player.haste = power.durationSeconds;` (volta à atribuição direta pré-fix). Resultado:
```
FAIL app/__tests__/character-power.test.tsx > ... > does not shrink player.haste when a longer coffee buff is already active (CHAR-24)
AssertionError: expected 4 to be close to 6, received difference is 2, but expected 0.5
 ❯ app/__tests__/character-power.test.tsx:284:41
```
✅ **Killed** — exatamente o teste-alvo falha (1 failed | 13 skipped), confirmando que ele depende de fato do `Math.max`. Revertido com `git checkout -- app/page.tsx`; `git status --porcelain` confirmou árvore limpa (exceto esta própria edição de `validation.md`) antes de prosseguir.

### Evidência CHAR-25

`app/globals.css:979-1021` (bloco inserido por `2e2c54f`) — 3 classes novas:
- `.character-card` (linhas 979-994): `border: 3px solid #475569`, fundo em gradiente escuro (`rgba(15,23,42,.96)` → `rgba(2,6,23,.96)`), consistente com a paleta escura do resto do jogo (mesmos tons de slate usados em `.menu-panel`/`.frame-panel`); `:hover`/`:focus-visible` mudam a borda para `#7dd3fc` (azul claro).
- `.character-card-selected` (linhas 996-1004): sobrescreve a borda para `#facc15` (amarelo/dourado), fundo com tingimento âmbar (`rgba(63,47,4,.55)`) e adiciona um anel externo (`box-shadow: 0 0 0 3px rgba(250,204,21,.45)`) — visualmente bem distinto do card não selecionado (cinza-azulado vs. dourado com glow), coerente com o uso de amarelo/dourado como cor de destaque/seleção já visto em outros elementos de UI do jogo (ex. HUD de power-up).
- `.character-portrait` (linhas 1006-1012): `width/height: 56px`, `image-rendering: pixelated` (mantém a estética pixel art), borda escura própria.

Aplicação real confirmada em `app/page.tsx:2217-2219`: `className={character.id === selectedCharacterId ? "character-card character-card-selected" : "character-card"}` — a classe de destaque é aplicada condicionalmente ao mesmo card cujo `aria-checked` (linha 2216) já refletia a seleção, satisfazendo CHAR-25 (destaque visual, não só a nível de acessibilidade). `app/page.tsx:2230` aplica `className="character-portrait"` ao `<canvas>` do retrato.

Confirmado por leitura direta do CSS (não é obrigatório testar via Vitest/jsdom, que não renderiza layout) — a diferença visual entre estado normal (borda `#475569`, cinza-azulado) e selecionado (borda `#facc15` + glow dourado + fundo âmbar) é clara e não trivial (não é uma diferença de 1px ou de uma cor quase idêntica).

### Regressão nas outras ACs

`git show 2e2c54f --stat`:
```
app/__tests__/character-power.test.tsx | 42 +++++++++++++++++++++++++++++++
app/globals.css                        | 42 +++++++++++++++++++++++++++++++
app/page.tsx                           |  2 +-
3 files changed, 84 insertions(+), 2 deletions(-)
```
Único hunk de produção fora do CSS é a linha 1109 (`player.haste`). Nenhum outro arquivo de produção ou teste foi tocado — `lib/characters.ts`, `hidden-menu.test.tsx`, `characters.test.ts` permanecem intactos. CHAR-12 (dash atravessa obstáculos) e o guard `isDebugAllowed()` do fix cycle 2 anterior (`cc37ce4..32a656d`) não foram tocados por este commit. Suíte completa (227/227, delta de +1 sobre os 226 anteriores, exatamente o novo teste de CHAR-24) e build/lint limpos confirmam ausência de regressão.

### Comandos executados

- `npm test -- --run` → **227 passed (227)**, 16 arquivos de teste, 0 falhas. Delta de **+1** sobre a rodada anterior (226), exatamente o novo teste de CHAR-24 (nenhum outro caso foi adicionado/removido — CHAR-25 é CSS puro, sem teste Vitest, conforme a própria tarefa previa).
- `npm run build` → sucesso, `Compiled successfully in 960ms`, TypeScript OK, 5 páginas geradas, sem erros.
- `npm run lint` → **0 erros**, 2 warnings pré-existentes e não relacionados (`coverage/lcov-report/block-navigation.js` e `lib/debug.ts:26` `_search` não usado — mesmos das rodadas anteriores).

### Gaps encontrados

Nenhum. CHAR-24 está fechado com evidência `file:line` (`app/page.tsx:1109`), teste end-to-end determinístico não-genérico, e mutação inversa confirmada KILLED (revertida em seguida). CHAR-25 está fechado com evidência `file:line` do CSS (`app/globals.css:979-1021`) e confirmação de que a classe condicional é aplicada ao card certo (`app/page.tsx:2217-2219`), com destaque visual claramente distinto e coerente com a paleta do jogo. Gate completo (lint/build/test) limpo, 227/227 testes, sem regressão nas demais ACs. O gap Cosmetic de `player.fury` (sem teste automatizado, justificativa aceita em rodadas anteriores) permanece registrado, fora do escopo desta Emenda.
