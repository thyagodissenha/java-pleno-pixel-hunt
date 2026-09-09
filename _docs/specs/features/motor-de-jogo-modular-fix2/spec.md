# Motor de Jogo Modular — Fix2 Specification

## Problem Statement

`motor-de-jogo-modular` (feature-mãe) e `motor-de-jogo-modular-fix1` (2 ciclos de fix) fecharam sem gap aberto — ver `STATE.md` Handoff. `fix1` registrou, em "Questões Abertas", achados classificados (c) fora do escopo daquela rodada (dedupe parcial: `shotLanesForWeaponLevel`/`weaponLevelForWave` continuaram duplicados; `renderer.ts` manteve 35.7% de duplicação interna não relacionada a `ENGINE-20`; `emptyEvents()` triplicado). Paralelamente, uma auditoria dedicada usando as skills `modular-decomposition` (Patterns 1-5) e `modular-design-principles` sobre o estado atual do motor (`lib/pixel-hunt-engine/`, HEAD `15f8104`) encontrou um item novo não coberto por nenhuma spec anterior: a mesma regra de negócio "jogador leva dano" reimplementada em `physics.ts` e `phases/secret-mainframe/index.ts`, com uma divergência de comportamento real entre as duas cópias (`events.playerHit` nunca é sinalizado no caminho do chefe secreto). Esta spec formaliza os itens priorizados com o usuário para virarem trabalho rastreável, continuando a numeração `ENGINE-NN` (`ENGINE-24` em diante). A inversão de dependência `engine → app` (`types.ts`/`renderer.ts` importando `GameState`/`MenuPanel` de `app/_hud/hud-props`), também levantada pela auditoria, foi deliberadamente adiada pelo usuário — ver Out of Scope.

## Goals

- [ ] Consolidar a regra de dano ao jogador ("player hit") numa única implementação, corrigindo a divergência de `events.playerHit` entre `physics.ts` e `phases/secret-mainframe/index.ts`.
- [ ] Eliminar a duplicação remanescente de `shotLanesForWeaponLevel`/`weaponLevelForWave` entre `physics.ts` e `phases/normal-run/wave-progression.ts`, registrada no fix1 e nunca implementada.
- [ ] Eliminar a triplicação de `emptyEvents()` (`physics.ts`, `phases/normal-run/index.ts`, `phases/secret-mainframe/index.ts`), registrada no fix1 (Questão Aberta #4).
- [ ] Substituir `EngineWorld.phaseState: unknown` por um tipo discriminado por Phase, removendo o duck-typing runtime (`"localGameState" in existing`) nos `readState()` de cada Phase.
- [ ] Dividir `renderer.ts` (671 LOC, 12 funções `draw*`) em submódulos coesos, resolvendo os 35.7% de duplicação interna já confirmados pelo SonarQube e registrados como fora de escopo no fix1.

## Out of Scope

Explicitamente excluído desta rodada de fix. Documentado para prevenir scope creep.

| Item | Razão |
| --- | --- |
| Inverter a dependência `engine → app` (mover `GameState`/`MenuPanel` de `app/_hud/hud-props.ts` para `lib/pixel-hunt-engine/types.ts` como fonte canônica) | Decisão explícita do usuário nesta rodada: maior superfície de regressão (contrato público do motor usado por `app/page.tsx` inteiro) que os outros itens, que são internos ao motor. Fica registrado para um fix3 ou feature própria. |
| Restringir/enforçar quais Phases podem escrever em quais campos de `RunCounters` (`world.run`) | Nenhum bug observado hoje — `effectMessage`/`effectBanner`/`bossKills` são deliberadamente campos compartilhados entre Phases (mecanismo de banner/progresso genérico). Esta rodada só tipa `phaseState` (item claramente privado por Phase); inventar um mecanismo de ownership para `RunCounters` sem um caso de bug real seria escopo não solicitado. |
| Generalizar as 3 coleções de power-up quase-idênticas (`updatePowerUps`, `resolveFinalChoicePickups`, `resolveFinalChoiceClickPowerUp`) | Já registrado como fora de escopo no fix1 (Questão Aberta #2); nenhum AC desta rodada o exige. |
| `updateEnemyMovement` com if/else de 8 vias | Já registrado como fora de escopo no fix1 (Questão Aberta #3); complexidade dentro do limite por função. |
| Mudar qualquer valor de gameplay observável (dano, HP, velocidade, timers) | Esta rodada é consolidação estrutural — toda extração/dedupe SHALL preservar exatamente o comportamento atual, exceto a correção explícita e nomeada de `events.playerHit` (ver P1). |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| `events.playerHit` deve ser `true` também quando o jogador leva dano de um tiro do chefe secreto (`stepSecretBossShots`) | **Sim, corrigir** | Hoje só `physics.ts`'s `resolveEnemyPlayerCollisions` seta `events.playerHit = true`; o caminho equivalente em `secret-mainframe/index.ts` nunca seta, apesar de aplicar o mesmo dano/flash/shake/som. `FrameEvents.playerHit` não é consumido por nenhum código hoje (`grep` confirma), então corrigir não observável via UI atual, mas é a única leitura consistente do contrato ao consolidar num helper único — deixar a divergência intencionalmente seria pior (helper compartilhado que às vezes reporta o evento e às vezes não, dependendo de quem chama). | y — assumido, sem impacto de UI hoje; sinalizado explicitamente como correção, não como "só refactor" |
| Direção do dedupe de `shotLanesForWeaponLevel`/`weaponLevelForWave` | A decidir em Design — `wave-progression.ts` já exporta essas funções; `physics.ts` tem cópia privada. Um import direto de `physics.ts` para `wave-progression.ts` criaria ciclo (`wave-progression.ts` já importa `scaledEnemyHp` de `physics.ts`). Design deve escolher entre: mover as duas para `wave-progression.ts` e ter `physics.ts` importar de lá, ou extrair um módulo neutro sem imports do motor (ex.: `progression-rules.ts`) que ambos importem. | Evita decidir estrutura de módulo na Specify — é decisão de Design, não de requisito. | y — resolução explícita adiada para `design.md`, comportamento (não estrutura) é o requisito aqui |
| Local canônico de `emptyEvents()` | `types.ts`, adjacente à definição de `FrameEvents`, exportada como função | Mantém o "shape vazio" ao lado do tipo que ele preenche; evita import cruzado entre `physics.ts` e as duas Phases (hoje nenhuma Phase importa de `physics.ts` para isso, e não deveria passar a importar só por causa deste helper). | y |
| Escopo do split de `renderer.ts` | Extrair por área de desenho (atores/jogador/inimigos, overlays de HUD no canvas, mundo/grid/datacenter), mantendo `drawFrame` como fachada pública única em `renderer.ts` (ou `renderer/index.ts`) — módulos internos não exportados fora do motor | Seguindo o mesmo padrão já aplicado a `physics.ts` (T14-T19, extração incremental sem mudar a API pública `stepWorld`); nenhum consumidor externo (`normal-run/index.ts`, `secret-mainframe/index.ts`) deve precisar mudar imports além do caminho de `drawFrame`. | y |
| `EngineWorld.phaseState` tipado como união discriminada | Substituir `unknown` por `NormalRunPhaseState \| SecretRunState` (união dos dois tipos já existentes, com um campo discriminante), removendo o cast `as X \| null` + checagem `"campo" in existing` em favor de um type guard central ou de um discriminante explícito | Os dois tipos já existem (`NormalRunPhaseState` em `normal-run/index.ts`, `SecretRunState` em `secret-mainframe/index.ts`); a união é a menor mudança que dá segurança de tipo sem inventar uma abstração nova. Exato mecanismo do discriminante (campo dedicado vs. `"cobolSnake" in state`) é decisão de Design. | y |

**Open questions:** 0 pendentes — todos os itens de escopo foram confirmados pelo usuário na rodada de perguntas desta spec; decisões de estrutura interna (não de comportamento) foram explicitamente adiadas para `design.md`, não deixadas em aberto sem dono.

---

## User Stories

### P1: Consolidar a regra de dano ao jogador ⭐ MVP

**User Story**: Como desenvolvedor mantendo o motor, quero uma única implementação da regra "jogador leva dano" (invencibilidade, flash, shake, som, partículas, evento), para que corrigir um valor ou um bug não exija editar 2 cópias que já divergiram silenciosamente.

**Why P1**: É o único item desta rodada que corrige uma divergência de comportamento real e confirmada (`events.playerHit`), não só duplicação de texto-fonte — achado novo, não coberto por nenhuma spec anterior.

**Acceptance Criteria**:

1. WHEN o jogador colide com um inimigo (`resolveEnemyPlayerCollisions`, `physics.ts`) ou é atingido por um tiro do chefe secreto (`stepSecretBossShots`, `phases/secret-mainframe/index.ts`) e `player.invincible <= 0` THEN o motor SHALL aplicar o dano através de uma única função compartilhada, que seta `player.invincible = 0.92`, `run.damageFlash = 16`, `run.shake = 14`, `events.playerHit = true`, toca o som `"hurt"` e gera o burst de partículas `"#ff5353"` na posição do jogador.
2. WHEN a quantidade de dano ou a contagem de partículas do burst difere entre os dois pontos de chamada (dano de toque usa `ENEMY_TOUCH_DAMAGE[enemy.kind]`/burst 16; dano de tiro secreto usa `10`/burst 12) THEN a função compartilhada SHALL aceitar esses valores como parâmetros, preservando exatamente os valores atuais de cada chamador (nenhuma mudança de balanceamento).
3. WHEN o jogador leva dano de um tiro do chefe secreto (caminho antes sem `events.playerHit`) THEN `events.playerHit` SHALL agora ser `true` nesse frame — única mudança de comportamento observável desta história, explicitamente assumida acima.
4. WHEN a suíte de testes existente rodar após a consolidação THEN todos os testes que hoje passam (421) SHALL continuar passando, e um novo teste SHALL cobrir especificamente `events.playerHit === true` após dano por tiro do chefe secreto (regressão do bug corrigido).

**Independent Test**: `grep -c "run.damageFlash = 16" lib/pixel-hunt-engine/physics.ts lib/pixel-hunt-engine/phases/secret-mainframe/index.ts` deve somar 1 ocorrência (não 2); teste dedicado de dano por tiro secreto confirma `events.playerHit === true`.

---

### P2: Eliminar duplicação de `shotLanesForWeaponLevel`/`weaponLevelForWave`

**User Story**: Como desenvolvedor mantendo o motor, quero uma única implementação de `shotLanesForWeaponLevel`/`weaponLevelForWave`, para que ajustar o padrão de tiro por nível de arma não exija editar 2 cópias (achado registrado no fix1, nunca implementado).

**Why P2**: Duplicação confirmada e já registrada (fix1, Questão Aberta #1); risco baixo, mas exige resolver um ciclo de import potencial (ver Assumptions) — por isso não é P1.

**Acceptance Criteria**:

1. WHEN qualquer módulo do motor precisar de `shotLanesForWeaponLevel` ou `weaponLevelForWave` THEN o motor SHALL importar de uma única fonte, sem redefinição local em `physics.ts` ou `phases/normal-run/wave-progression.ts`.
2. WHEN a fonte única for escolhida THEN nenhum ciclo de import SHALL ser introduzido entre `physics.ts` e `phases/normal-run/wave-progression.ts` (hoje `wave-progression.ts` já importa `scaledEnemyHp` de `physics.ts`).
3. WHEN a suíte de testes existente rodar após a deduplicação THEN todos os testes que hoje passam SHALL continuar passando com os mesmos valores exatos (padrão de tiro e nível de arma por onda inalterados).

**Independent Test**: `grep -rn "^function shotLanesForWeaponLevel\|^export function shotLanesForWeaponLevel\|^function weaponLevelForWave\|^export function weaponLevelForWave" lib/pixel-hunt-engine/` retorna exatamente 1 ocorrência de cada; `npm test` continua 100% verde.

---

### P2: Eliminar triplicação de `emptyEvents()`

**User Story**: Como desenvolvedor mantendo o motor, quero uma única fábrica de `FrameEvents` vazio, para que adicionar um novo campo a `FrameEvents` não exija lembrar de atualizar 3 cópias sincronizadas manualmente (achado registrado no fix1, Questão Aberta #4).

**Why P2**: Risco baixo, mas hoje é um ponto real de "esquecimento silencioso" — TypeScript só pega campo *omitido*, não teria como impedir 3 implementações que divergem sutilmente se alguém copia errado.

**Acceptance Criteria**:

1. WHEN qualquer módulo do motor precisar de um `FrameEvents` vazio (todos os campos `false`) THEN o motor SHALL importar uma única função compartilhada, sem redefinição local em `physics.ts`, `phases/normal-run/index.ts` ou `phases/secret-mainframe/index.ts`.
2. WHEN um novo campo for adicionado a `FrameEvents` no futuro THEN apenas 1 local de código SHALL precisar de atualização para que `emptyEvents()` continue completo (não é testável diretamente nesta rodada, mas a estrutura resultante SHALL tornar isso verdade por construção — função única, não 3 cópias).
3. WHEN a suíte de testes existente rodar após a deduplicação THEN todos os testes que hoje passam SHALL continuar passando.

**Independent Test**: `grep -c "^function emptyEvents" lib/pixel-hunt-engine/physics.ts lib/pixel-hunt-engine/phases/normal-run/index.ts lib/pixel-hunt-engine/phases/secret-mainframe/index.ts` soma 0 (nenhuma definição local remanescente, todas importam da fonte única); `npm test` continua 100% verde.

---

### P2: Tipar `EngineWorld.phaseState`

**User Story**: Como desenvolvedor mantendo o motor, quero que `world.phaseState` tenha um tipo conhecido em vez de `unknown`, para que o compilador (não um `"campo" in existing` em runtime) me avise se uma Phase ler o formato errado.

**Why P2**: Hoje é um escape hatch seguro na prática (cada Phase só lê o próprio `phaseState`), mas sem nenhuma garantia do compilador — achado da auditoria `modular-design-principles` (Princípio #3, Independência/estado implícito).

**Acceptance Criteria**:

1. WHEN `EngineWorld.phaseState` for tipado THEN seu tipo SHALL ser uma união discriminada dos estados já existentes de cada Phase (`NormalRunPhaseState` de `phases/normal-run/index.ts`, `SecretRunState` de `phases/secret-mainframe/index.ts`), substituindo `unknown`.
2. WHEN `readState()` de cada Phase for atualizado para o novo tipo THEN o cast manual (`existing as X | null`) e a checagem de campo em runtime (`"localGameState" in existing`, `"cobolSnake" in existing`) SHALL ser substituídos por um discriminante explícito (ou mantidos apenas como fallback defensivo documentado, se o discriminante sozinho não bastar para o caso de `phaseState` ainda não inicializado).
3. WHEN a mudança de tipo for aplicada THEN `npm run build` (`tsc`) SHALL passar sem novos erros de tipo em nenhum consumidor de `EngineWorld.phaseState` (`physics.ts`, `renderer.ts`, `orchestrator.ts`, ambas as Phases).
4. WHEN a suíte de testes existente rodar após a mudança THEN todos os testes que hoje passam SHALL continuar passando — mudança é só de tipo/estrutura interna, nenhum comportamento observável muda.

**Independent Test**: `npm run build` limpo; `grep -n "phaseState: unknown" lib/pixel-hunt-engine/types.ts` não retorna resultado (tipo substituído); `npm test` continua 100% verde.

---

### P3: Dividir `renderer.ts` em submódulos coesos

**User Story**: Como desenvolvedor mantendo o motor, quero que `renderer.ts` (671 LOC, 12 funções `draw*`) seja dividido por área de desenho, para que seja possível entender e modificar uma área visual sem reler o arquivo inteiro — e para fechar a duplicação interna de 35.7% já confirmada pelo SonarQube e registrada como fora de escopo no fix1.

**Why P3**: Maior esforço desta rodada, sem correção de bug associada (puro refactor estrutural) — feito por último, com a suíte de testes existente como rede de segurança, seguindo o mesmo padrão incremental já aplicado com sucesso a `physics.ts` (T14-T19).

**Acceptance Criteria**:

1. WHEN `renderer.ts` for dividido THEN o motor SHALL manter exatamente uma função pública de entrada (`drawFrame`, mesma assinatura atual) importável pelas duas Phases (`normal-run/index.ts`, `secret-mainframe/index.ts`) sem mudança no ponto de chamada.
2. WHEN as 12 funções `draw*` internas forem reorganizadas THEN cada submódulo resultante SHALL agrupar funções por área coesa de desenho (ex.: atores/jogador/inimigos; overlays de HUD desenhados no canvas; mundo/grid/datacenter) — nenhuma função SHALL ficar em mais de um submódulo.
3. WHEN o SonarQube local for rodado após a divisão THEN a duplicação interna hoje medida em 35.7% de `renderer.ts` SHALL cair de forma mensurável (meta: abaixo de 15%, consistente com o padrão já aceito em outros arquivos do motor).
4. WHEN a suíte de testes existente rodar após a divisão THEN todos os testes que hoje passam SHALL continuar passando com o mesmo output visual (nenhuma mudança de comportamento de desenho, só localização do código).

**Independent Test**: `npm run build && npm test` 100% verde; SonarQube local confirma queda de duplicação em `renderer.ts` (ou nos submódulos resultantes) abaixo de 15%; inspeção visual manual do jogo (menu, run normal, chefe, fase secreta, escolha final) sem regressão perceptível.

---

## Edge Cases

- WHEN o dano consolidado (`P1`) for aplicado e o inimigo/tiro que causou o dano remover o próprio ator do array (`enemies.splice`/`secretBossShots.splice`) no mesmo frame THEN a ordem de operações SHALL permanecer a mesma de hoje (splice acontece no chamador, não dentro da função de dano compartilhada, para não acoplar a função de dano à estrutura de array de quem chama).
- WHEN `world.phaseState` ainda não foi inicializado (`enter()` não chamado, cenário defensivo já coberto pelo fallback de `readState()`) THEN a união discriminada SHALL continuar permitindo esse fallback sem lançar exceção — mesma robustez de hoje, não uma restrição nova.
- WHEN o split de `renderer.ts` (P3) mover uma função que hoje depende de import local de outra função `draw*` no mesmo arquivo THEN a dependência SHALL ser resolvida via export/import explícito entre os novos submódulos, nunca duplicando a função nos dois lados.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| ENGINE-24 | P1: Consolidar regra de dano ao jogador (`applyPlayerDamage`) | Execute | Verified |
| ENGINE-25 | P1: Corrigir `events.playerHit` ausente no dano por tiro do chefe secreto | Execute | Verified |
| ENGINE-26 | P2: Dedupe de `shotLanesForWeaponLevel`/`weaponLevelForWave` | Execute | Verified |
| ENGINE-27 | P2: Dedupe de `emptyEvents()` | Execute | Verified |
| ENGINE-28 | P2: Tipar `EngineWorld.phaseState` como união discriminada | Execute | Verified |
| ENGINE-29 | P3: Dividir `renderer.ts` em submódulos coesos + resolver duplicação interna (35.7%) | Execute | Verified |

**ID format:** `ENGINE-NN`, continuando a numeração das specs anteriores (`motor-de-jogo-modular` ENGINE-01 a ENGINE-15; `motor-de-jogo-modular-fix1` ENGINE-16 a ENGINE-23).

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 6 total, 6 mapeados a tasks (T1-T13), 0 não mapeados ✅. Verifier PASS (validation.md) — 423/423 testes, sensor de discriminação 3/3 mortos, sem gap real (1 AC estrutural não-testável, ENGINE-27 AC2, corretamente sinalizada como tal, não como gap).

**Origem:** 4 itens confirmados pelo usuário nesta rodada (dedupe de regras duplicadas incluindo `shotLanes`/`weaponLevelForWave`; split de `renderer.ts`; `emptyEvents()`; tipagem de `phaseState`), a partir de uma auditoria combinada `modular-decomposition` (Patterns 1-5) + `modular-design-principles` sobre o estado atual do motor, cruzada com as Questões Abertas já registradas em `motor-de-jogo-modular-fix1/spec.md`. A inversão de dependência `engine → app` foi levantada pela mesma auditoria e explicitamente adiada — ver Out of Scope.

---

## Success Criteria

- [x] `events.playerHit` reporta `true` corretamente também para dano por tiro do chefe secreto, com teste de regressão dedicado (`phases/secret-mainframe/__tests__/index.test.ts`).
- [x] `grep` confirma zero duplicação de `applyPlayerDamage`-equivalente, `shotLanesForWeaponLevel`, `weaponLevelForWave` e `emptyEvents()` no motor.
- [x] `EngineWorld.phaseState` não é mais `unknown` — união discriminada tipada, sem novo erro de `tsc`.
- [x] Duplicação interna de `renderer.ts` cai de 35.7% para 0.0% (confirmado via SonarQube local, folgadamente abaixo da meta de <15%).
- [x] `npm run build && npm run lint && npm test` — 100% verde, 423 testes passando (421 atuais + 2 novos de regressão de `events.playerHit`).
- [x] Nenhuma mudança de comportamento observável em jogo, exceto a correção nomeada de `events.playerHit` (P1, AC3) — confirmado pelo Verifier (sensor de discriminação 3/3 mortos).
- [ ] `npm run test:e2e` — bloqueado por dev server de outra sessão neste diretório em ambas as tentativas (implementação e Verifier); pendência de ambiente, não de código — ver `validation.md`.
