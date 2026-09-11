# Separar Go-Live/Diretoria — Specification

## Problem Statement

Hoje o modo normal tem 4 ondas (`bossNames.length === 4`, `lib/pixel-hunt-engine/phases/normal-run/`). O chefe da onda 4, "Diretor do Go-Live", nunca é enfrentado como um chefe simples igual aos das ondas 1–3 — assim que spawna, ele já nasce marcado `bossPhase: 1` (por ser o último índice do roster, `isFinalBoss(bossIndex)`) e, ao "morrer", não morre de verdade: cura e escala 2 vezes, virando a "Diretoria" (3 sub-fases, documentado em `_docs/game-design/onda-4-diretor-do-golive.md`). Isso funde dois encontros conceitualmente diferentes — um chefe de onda comum e um chefe final de maratona — num só nó de grafo, achatando a curva de dificuldade (o jogador nunca tem um respiro de "só mais um chefe de onda normal" antes do encontro final).

**Contexto arquitetural favorável:** a feature anterior (`orquestracao-generica-de-fases`, ver `_docs/specs/STATE.md` § `AD-010`) generalizou o grafo (`graph.ts`) e a suíte de testes para derivar tudo de `bossNames.length` em vez de literais hardcoded — confirmado lendo `graph.ts`, `graph.test.ts`, `waves.test.ts` (todos iteram `for (n = 1; n <= bossNames.length; ...)` / `bossNames.length - 1`, nunca o literal `4`). Isso significa que **separar os dois chefes é, em grande parte, uma mudança de dados** (crescer o roster de 4 para 5 entradas), não uma mudança de lógica nova — a máquina de estados de 3 sub-fases (`bossPhase`, `finalBossHp`, `isFinalBoss`) já existe em `boss.ts`/`physics.ts`/`waves.ts` e passa a se aplicar automaticamente ao novo índice final (4) assim que o roster cresce.

## Goals

- [ ] Onda 4 passa a ter um chefe de onda comum e definitivo ("Diretor do Go-Live") — 1 barra de HP, sem escalar, mesma família de mecânica genérica das ondas 1–3 (volley por `bossIndex % 4`, sem `bossPhase`).
- [ ] Uma nova Onda 5 é introduzida, contendo a "Diretoria" com a mecânica de 3 sub-fases já existente (idêntica em comportamento à de hoje, só deslocada de onda 4 → onda 5).
- [ ] A transição `wave-4 → wave-5 → final-choice` funciona sem exigir mudança na lógica do grafo (`graph.ts`) nem da transição por onda (`waveTransition`) — só o crescimento do roster (`bossNames`) deve bastar, validando o investimento arquitetural de `AD-010`.
- [ ] Efeito colateral positivo (a confirmar no Design): o mob "Legado" (`spawn.ts`, liberado a partir de `wave >= 5`, hoje código morto por o modo normal nunca alcançar onda 5) passa a aparecer de fato em jogo.

## Out of Scope

Explicitamente excluído desta feature. Documentado para prevenir scope creep.

| Item | Motivo |
| --- | --- |
| Mudar o número de sub-fases da Diretoria (hoje 3) ou seus valores de HP/padrão de ataque por sub-fase | Fora do pedido do usuário — é a MESMA mecânica, só movida de onda. |
| Mudar `weaponLevelForWave` (nível de arma do jogador) para introduzir um nível 4 na onda 5 | Não pedido; onda 5 permanece no nível 3 (máximo atual), mesmo comportamento de "onda >= 4" hoje. |
| Novos tipos de mob | Fora de escopo — a onda 5 usa o elenco de mobs já existente (Usuário/QA/VIP/Incidente/Legado), sem introduzir um 6º tipo. |
| Novos assets visuais/sprites customizados para a Diretoria ou para o novo bioma da onda 5 | Reaproveita o sistema de desenho por retângulos/temas já existente (`obstacleTemplates`); só a paleta/nomes de tema são novos dados, não um sistema de arte novo. |
| Áudio novo | Reaproveita `AudioEngine` existente, sem trilha/efeitos dedicados. |
| Alterar as rotas de estudo `app/clude/hud-redesign/` e `app/qwen/hud-redesign/` (cópias monolíticas legadas do motor, pré-`AD-010`) | Fora da arquitetura atual (`lib/pixel-hunt-engine/`); decisão de aposentá-las ou não já está registrada como pendência separada em `STATE.md` (feature `sistema-de-temas-hud`). |
| Fase secreta "O Datacenter Esquecido" | Feature totalmente separada (`_docs/specs/features/fase-secreta-datacenter/spec.md`), sem relação de dependência com esta. |

---

## Assumptions & Open Questions

Toda ambiguidade é resolvida ou registrada aqui — nada fica silenciosamente pouco claro.

| # | Assumption / decisão | Escolha adotada | Racional | Confirmado? |
| --- | --- | --- | --- | --- |
| A1 | Nome do 5º chefe (`bossNames[4]`), usado no HUD (`hudLabels()`) enquanto a onda 5 está em andamento e o boss NÃO está com `finalChoicePending` | **"Comitê Executivo"** | É literalmente o texto de fallback já hardcoded em 3+ lugares do código atual (`waves.ts:196`: `bossNames[run.bossIndex] ?? "Comitê Executivo"`, replicado nas páginas de estudo) — forte indício de que esse era o nome pensado para um eventual 5º chefe. Reaproveitar em vez de inventar um nome novo. | y — provisório, aprovado pelo usuário em 2026-09-10 para seguir com o Design; troca de nome é um ajuste de conteúdo de baixo risco se ele não gostar depois |
| A2 | Nome do 5º bioma (`biomeNames[4]`) e tema visual dos obstáculos da onda 5 (`obstacleTemplates`, hoje só 4 índices; `BIOME_COUNT` hardcoded em 2 lugares: `renderer/world.ts` e `spawn.ts`) | Nome proposto: **"Sala do Conselho"** (segue a progressão corporativa Escritório → Produção → Cloud → War Room → Sala do Conselho); objetos do tema a definir no Design (ex.: mesa de reunião grande, quadro de metas, tela de apresentação) | Nenhuma pista no código atual (diferente do A1) — é uma decisão nova de conteúdo. Nome escolhido para fechar a progressão narrativa (dos times técnicos até a diretoria) coerente com "Diretoria" ser o chefe da onda. | y — provisório, aprovado pelo usuário em 2026-09-10 para seguir com o Design; troca de nome/tema é um ajuste de conteúdo de baixo risco se ele não gostar depois |
| A3 | Mecânica do chefe "Diretor do Go-Live" isolado na onda 4 | **Nenhuma mecânica nova** — reaproveita o caminho genérico já existente em `spawn.ts`/`physics.ts` para chefes não-finais (`hp: 160 + wave×28`, volley por `bossIndex % 4`). Para `bossIndex = 3` (onda 4), esse padrão (`pattern === 3`: leque mirado estreito ±0,24 rad, 5 projéteis "Incidente") já existe no código (`computeBossVolleyPlan`) mas está **inatingível hoje** (onda 4 sempre toma o caminho "chefe final"/`bossPhase`) — passaria a ser usado pela primeira vez. | Verificado lendo `physics.ts` (`computeBossVolleyPlan`) — o branch `pattern === 3` já está implementado e coberto por testes de unidade sobre a função pura, só nunca é exercitado em jogo pelo caminho de chefe de onda hoje. Não inventa lógica nova. | y (comportamento) |
| A4 | Impacto da mudança de onda da Diretoria (onda 4 → onda 5) nos números dela (`finalBossHp(phase, wave)`, `bossKillTarget(wave, callLoops)`) | Os valores **mudam automaticamente** porque as fórmulas usam `wave` como parâmetro (ex.: `finalBossHp(1, 5) = 368` em vez de `finalBossHp(1, 4) = 346`; `bossKillTarget(5) = 30` em vez de `26`). Isso é aceito como consequência natural de ela agora ser a onda 5, não um bug — nenhuma fórmula precisa mudar. | As fórmulas já são genéricas por `wave`; documentar a mudança de valor absoluto evita que pareça uma regressão não intencional durante QA. | y |
| A5 | Testes existentes (`graph.test.ts`, `waves.test.ts`, `boss.test.ts`) | **Não devem precisar de mudança de asserts** — todos já parametrizam por `bossNames.length` (verificado lendo os 3 arquivos), não por literais `4`/`5`. Only a re-run é esperado, não edição. Qualquer teste que quebrar por valor hardcoded será tratado como achado do Design/Tasks, não uma mudança de escopo. | Verificado diretamente no código de teste (Knowledge Verification Chain passo 1). | y |
| A6 | Duplicação de `BIOME_COUNT = 4` entre `renderer/world.ts` e `spawn.ts` (mesma constante, 2 cópias) | Ambas sobem para `5` nesta feature (mudança aditiva mínima) — consolidar as duas cópias numa fonte única **não** é objetivo desta feature (seria refactor não relacionado ao pedido do usuário) | Bump mínimo necessário para o novo tema existir; eliminar a duplicação em si é uma limpeza à parte, fora do pedido. | y |

**Open questions:** nenhuma sem marcação — A1 e A2 foram aprovadas provisoriamente pelo usuário (2026-09-10, "pode manter assim por enquanto, depois eu ajusto se não gostar"); as demais (A3–A6) já são comportamento verificado no código, y.

---

## User Stories

### P1: Onda 4 com chefe próprio e definitivo ⭐ MVP

**User Story**: Como jogador, quero que a onda 4 termine com um chefe de onda normal (que morre de vez, sem escalar), para que eu tenha um "respiro" estrutural antes do encontro final da onda 5, em vez do chefe de onda 4 já ser o início disfarçado do chefe final.

**Why P1**: É o núcleo do pedido do usuário — sem isso, a "separação" não existe.

**Acceptance Criteria**:

1. WHEN o boss da onda 4 é spawnado THEN ele SHALL nascer sem `bossPhase` definido (idêntico ao caminho dos chefes das ondas 1–3), usando a fórmula não-final de HP/velocidade/tamanho (`hp: 160 + wave×28`, `speed: 52 + wavePressure×2`, `size: 38`).
2. WHEN o boss da onda 4 chega a 0 HP THEN ele SHALL morrer de vez (`events.bossDefeated = true` na mesma morte, sem cura/avanço de sub-fase).
3. WHEN o boss da onda 4 morre THEN a transição do grafo SHALL levar para `wave-5` (não para `final-choice`).
4. WHEN o boss da onda 4 está vivo THEN seu padrão de volley SHALL usar `pattern = bossIndex % 4` (para `bossIndex = 3`: leque mirado estreito ±0,24 rad, 5 projéteis "Incidente P1", cooldown `max(64, 104 − wave×4)`).

**Independent Test**: Avançar até a onda 4, observar que o chefe tem 1 barra de HP (sem HUD de "sub-fase"/mensagem "DIRETORIA FASE N"), matá-lo e confirmar transição para `wave-5` (novo elenco/tema), não para a tela de escolha final.

---

### P1: Onda 5 com a Diretoria (mecânica de 3 sub-fases preservada) ⭐ MVP

**User Story**: Como jogador, quero que a "Diretoria" (chefe de 3 sub-fases que hoje é o final da onda 4) passe a ser o chefe da onda 5, mantendo exatamente o mesmo comportamento de hoje (cura + escala 2×, HUD "DIRETORIA FASE N"), para que o encontro final da maratona continue intacto, só reposicionado.

**Why P1**: Segunda metade do pedido do usuário — sem isso, a "Diretoria" desaparece em vez de só mudar de onda.

**Acceptance Criteria**:

1. WHEN a onda 5 inicia THEN o boss SHALL nascer com `bossPhase: 1`, usando a fórmula final existente (`finalBossHp(1, 5)`, tamanho 62), idêntica em estrutura à de hoje (só o `wave` usado na fórmula muda de 4 para 5).
2. WHEN o boss da onda 5 chega a 0 HP com `bossPhase < 3` THEN ele SHALL curar para o HP da sub-fase seguinte e crescer visualmente (`size: 62 + bossPhase×6`), IDÊNTICO ao comportamento de hoje.
3. WHEN o boss da onda 5 chega a 0 HP na `bossPhase === 3` THEN SHALL morrer de vez e a transição do grafo SHALL levar para `final-choice`.
4. WHEN a onda 5 está em andamento (antes de `finalChoicePending`) THEN o HUD SHALL exibir o nome do 5º chefe (`bossNames[4]`, ver Assumption A1) — não mais "Diretor do Go-Live".

**Independent Test**: Avançar da onda 4 até a onda 5, derrotar as 3 sub-fases da Diretoria e confirmar a transição para a tela de Escolha Final, com os banners "DIRETORIA FASE N: benefício removido" aparecendo exatamente como hoje.

---

### P2: Identidade visual da onda 5 (bioma + tema de obstáculos)

**User Story**: Como jogador, quero que a onda 5 tenha um tema visual próprio (não repita o da onda 4/War Room), para que a progressão de biomas continue coerente até o encontro final.

**Why P2**: Suporte de imersão — a onda 5 já é jogável sem isso (reaproveitando o tema da onda 4 via `Math.min(bossIndex, BIOME_COUNT - 1)`), mas ficaria com uma repetição visual perceptível.

**Acceptance Criteria**:

1. WHEN a onda 5 inicia THEN o bioma exibido no HUD SHALL ser o novo nome definido em `biomeNames[4]` (Assumption A2), não mais "War Room".
2. WHEN obstáculos são spawnados na onda 5 THEN SHALL usar um 5º conjunto de `obstacleTemplates` dedicado (não reaproveitar o índice 3 da onda 4).

**Independent Test**: Avançar até a onda 5 e comparar visualmente o tema de obstáculos e o rótulo de bioma no HUD contra o da onda 4.

---

### P3: Reaproveitamento do mob "Legado"

**User Story**: Como jogador, quero que o mob "Legado" (já implementado, hoje nunca alcançado) apareça na onda 5, para que o elenco de mobs completo do jogo seja de fato jogável.

**Why P3**: Efeito colateral positivo, não um requisito funcional novo — o mob já existe e é liberado por `wave >= 5` em `spawn.ts`; esta story só confirma que nada bloqueia esse caminho.

**Acceptance Criteria**:

1. WHEN a onda 5 está em andamento THEN o mob "Legado" SHALL poder ser sorteado no pool de especiais (mesma regra de 34% de chance existente), sem necessidade de mudança em `spawn.ts`.

**Independent Test**: Jogar a onda 5 por tempo suficiente e observar o mob "Legado" (HP alto, movimento sinuoso lento) aparecer em campo.

---

## Edge Cases

- WHEN o jogador está em "Novo Chamado" (loop, `callLoops > 0`) THEN a onda 5 SHALL escalar pelas MESMAS fórmulas genéricas que qualquer outra onda (`scaledEnemyHp`, `bossKillTarget(wave, callLoops)`) — nenhuma regra especial de loop para a onda 5.
- WHEN `bossNames.length` passa de 4 para 5 THEN `isFinalBoss(bossIndex)` (hoje `bossIndex === bossNames.length - 1`) SHALL automaticamente considerar a onda 5 (índice 4) como final e a onda 4 (índice 3) como não-final, sem exigir mudança na função em si.
- WHEN o grafo é reconstruído (`buildNormalRunGraph`, que já itera `for (n = 1; n <= bossNames.length; n++)`) THEN os nós `wave-1`..`wave-5` e as arestas `waveTransition(n)` SHALL ser gerados automaticamente, sem exigir mudança em `graph.ts`.
- WHEN um teste existente referencia um valor numérico específico do chefe final (ex.: HP calculado) em vez de chamar a fórmula (`finalBossHp`) THEN esse teste SHALL ser tratado como achado a corrigir no Design/Tasks, não como sinal de que o escopo desta feature mudou.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| GOLIVESPLIT-01 a 04 | P1: Onda 4 com chefe próprio e definitivo | Tasks (T1, T4, T5, T6) + fix-cycle-1 (GOLIVESPLIT-04) | Verified |
| GOLIVESPLIT-05 a 08 | P1: Onda 5 com a Diretoria | Tasks (T1, T4, T5, T6) + fix-cycle-1 (GOLIVESPLIT-06, 08) | Verified |
| GOLIVESPLIT-09 a 10 | P2: Identidade visual da onda 5 | Tasks (T2, T3) + fix-cycle-1 (GOLIVESPLIT-09, 10) | Verified |
| GOLIVESPLIT-11 | P3: Reaproveitamento do mob "Legado" | Tasks (T7, verificação) | Verified |

**ID format:** `GOLIVESPLIT-NN` (numeração sequencial, atribuída no Design/Tasks — ver `design.md` e `tasks.md`).

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 11 ACs totais, 11 mapeados a tasks (T1–T7), 0 não mapeados.

---

## Success Criteria

- [ ] Onda 4 tem um chefe de 1 barra de HP que morre de vez e leva à onda 5 (não à escolha final).
- [ ] Onda 5 tem a Diretoria com as mesmas 3 sub-fases de hoje, levando à escolha final ao ser derrotada na sub-fase 3.
- [ ] `graph.ts` e as transições de onda não precisam de nenhuma mudança de lógica — só o crescimento de `bossNames`/`biomeNames`/`obstacleTemplates`/`BIOME_COUNT`.
- [ ] Suíte de testes existente (`graph.test.ts`, `waves.test.ts`, `boss.test.ts`, `wave-progression.test.ts`) continua passando sem edição de asserts (só nova cobertura para os 2 nós extras, se necessário).
- [ ] Mob "Legado" aparece em jogo pela primeira vez (onda 5).
- [ ] Nenhuma regressão nas ondas 1–3 nem na fase secreta.

---

## Questões abertas (code-review, 2026-09-10)

Achados classificados como **(c) melhoria/refactor fora dos ACs** pelo `/code-review` (nível medium, 8 finder agents + verify) sobre `a96799d..7e49c0f` — registrados aqui para rastreabilidade, **não implementados** por decisão do protocolo de execução (nenhum viola um AC existente; ambos são PLAUSIBLE, não bugs confirmados no diff atual):

1. **`computeBossVolleyPlan`'s padrão de chefe não-final hardcoda `bossIndex % 4`**, sem vínculo com o tamanho do roster (`bossNames.length`) — hoje (5 ondas) as ondas não-finais são exatamente 0-3, então o `% 4` mapeia 1:1 sem colisão. Se uma 6ª onda for adicionada no futuro, `bossIndex 4 % 4 === 0` reaproveitaria silenciosamente o padrão da onda 1 para a nova onda 5 (não-final), sem crash nem teste que capture isso — diferente da duplicação `BIOME_COUNT` (Assumption A6), esse acoplamento a "exatamente 4" não está documentado em nenhuma constante/assumption. `lib/pixel-hunt-engine/physics.ts:366`. Sugestão futura: derivar o número de padrões distintos de `bossNames.length - 1` em vez do literal `4`.
2. **`computeBossVolleyPlan` foi exportada (para testabilidade, GOLIVESPLIT-04) mas mantém um efeito colateral** (muta `enemy.cooldown` como parte do cálculo do plano) sem sinalização no nome/contrato — um chamador futuro que a trate como consulta pura e a chame 2× no mesmo Actor receberia o plano real na 1ª chamada e `null` na 2ª. Não é acionado por nada no diff atual (o novo teste e o único call site de produção a chamam 1× cada). `lib/pixel-hunt-engine/physics.ts:358`. Sugestão futura: renomear para deixar o efeito colateral explícito (ex. `advanceBossVolley`) ou separar leitura de mutação caso ganhe um segundo chamador.

Nenhum destes itens bloqueia o veredito PASS do Verifier (Rodada 2) nem os ACs `GOLIVESPLIT-01` a `11`.

**JaCoCo/SonarQube (item d do protocolo do usuário):** JaCoCo não se aplica (projeto TypeScript/Next.js, sem config Java — mesma nota já registrada em `AD-002`/handoffs anteriores). SonarQube: o MCP configurado para esta sessão falhou ao conectar (`CONNECT_TIMEOUT`) e não há `sonar-scanner` instalado localmente (tentativa via `npx sonar-scanner` recusada sem instalação); o servidor local em `http://localhost:9000` está no ar, mas rodar a análise exigiria instalar o scanner, o que não foi feito sem confirmação do usuário. Mesma limitação já registrada em `STATE.md` (SonarQube só analisa `main`, não branches de feature).
