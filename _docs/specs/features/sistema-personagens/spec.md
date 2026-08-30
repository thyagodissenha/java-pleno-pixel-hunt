# Sistema de Personagens Specification

## Problem Statement

Hoje o jogador é um objeto literal fixo, recriado a cada partida dentro do próprio loop do jogo (`app/page.tsx:638-649`, `hp: 100`, `speed: 210`, `size: 24`), sem nenhuma noção de "personagem" nem de poder especial. O menu escondido "Personagens & Skins" (`iddqd`/`idkfa`, ver `_docs/roadmap.md`) hoje só mostra um placeholder "em construção". É preciso formalizar um catálogo de personagens com atributos e poder especial ativo, preparado para receber novos personagens no futuro sem tocar no loop de jogo — sem inflar o escopo desta entrega além de provar que a arquitetura generaliza.

## Goals

- [ ] Extrair os atributos do jogador (`maxHp`, `speed`, `size`) de literais hardcoded para um registry de personagens consultado na inicialização da partida.
- [ ] Introduzir um poder especial ativo com cooldown, genuinamente jogável, ligado ao personagem selecionado.
- [ ] Provar que adicionar um novo personagem no futuro exige apenas uma nova entrada no registry — nenhuma mudança no loop de jogo (`app/page.tsx`) além da leitura já genérica.
- [ ] Substituir o placeholder do menu "Personagens & Skins" pelos dados reais do personagem atual.

## Out of Scope

Explicitamente excluído nesta entrega. Documentado para evitar scope creep.

| Feature | Reason |
| --- | --- |
| ~~Segundo personagem "de verdade" jogável~~ | **Superado pela Emenda 2** — agora em escopo (CHAR-13, CHAR-14: Estagiário e SRE). |
| Persistência da escolha entre sessões (localStorage) | Reafirmado na Emenda 2 (CHAR-23): decisão explícita do usuário, mesmo com seletor real de 3 personagens — reseta a cada reload. |
| Promover o menu de personagens para uma entrada oficial/visível no menu principal | Ainda fora de escopo: decisão do usuário de manter atrás do cheat code `iddqd`/`idkfa` também na Emenda 2. |
| ~~Seletor de personagem multi-opção (picker/carrossel)~~ | **Superado pela Emenda 2** — agora em escopo (CHAR-21: seletor real com 3 cards). |
| Botão de toque para acionar o poder especial no mobile | Ainda fora de escopo — nenhum dos 2 novos poderes (haste/shield) muda essa decisão. |
| Registrar o personagem usado no ranking/high score | Ainda fora de escopo — não solicitado nesta emenda. |
| Balanceamento competitivo entre personagens | Ainda fora de escopo — não há disputa 1x1 nem ranking segmentado por personagem. |
| Arquivo de imagem real (PNG/SVG) por personagem | Decisão explícita do usuário na Emenda 2: retrato reaproveita a técnica de canvas já usada em `drawPlayer()`, não um asset novo. |
| Navegação do seletor por teclado (setas/Enter) | Não pedido; clique do mouse é suficiente, consistente com os outros botões do mesmo painel ("Jogar"/"Voltar ao início"), que também não têm nav por seta hoje. |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here — nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Tipo de poder especial | Habilidade ativa com cooldown (tecla própria), não bônus passivo | Decisão explícita do usuário nesta sessão | y |
| Nº de personagens no MVP | 1 (Dev Pleno formalizado) | Decisão explícita do usuário | y |
| Persistência da escolha | Nenhuma — sessão atual só | Decisão explícita do usuário | y |
| Menu escondido vs. oficial | Continua atrás do cheat code por ora; UI desacoplada do gate | Decisão explícita do usuário ("futuramente pode virar opção oficial") | y |
| Atributos cobertos pelo registry no MVP | `maxHp`, `speed`, `size` (os 3 campos hoje literais no `player`) | Paridade 1:1 com o comportamento atual; o tipo fica aberto a novos campos (ex: dano, cadência) sem quebrar os personagens existentes | y |
| Tecla de ativação do poder | `Q` | Livre hoje: WASD/setas = movimento, Espaço = rajada, Enter/Escape = menu, F1-F3 = debug | y |
| Nome e efeito do poder especial do "Dev Pleno" | **"Refactor Dash"**: teleporte curto e instantâneo (distância fixa) na direção atual de movimento, cooldown de 6s | Evita duplicar mecânicas já existentes (rajada de estamina = cadência de tiro; power-up "rollback" = invencibilidade temporária); tema consistente com a persona do personagem | y |
| Direção do dash quando o jogador está parado | Mira no inimigo mais próximo (mesma referência do auto-tiro já existente); sem inimigos em tela, direção fixa para cima `(0, -1)` | Evita criar um novo estado de "direção/facing" do jogador só para este caso raro | y |
| Personagem desconhecido/indefinido | Cai para o primeiro item do registry (fallback defensivo) | Protege contra estado futuro corrompido (quando a persistência for adicionada) sem quebrar a partida | y |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Registry de personagens + poder especial ativo ⭐ MVP

**User Story**: Como jogador, quero que meus atributos e meu poder especial venham de uma definição de personagem (não de números fixos no código), e quero poder ativar esse poder numa tecla própria, para que o jogo já nasça pronto para ganhar novos personagens sem reescrever a lógica de partida.

**Why P1**: É a única entrega desta feature — prova a arquitetura extensível (o pedido original) e entrega uma mecânica jogável de verdade (o poder especial), sem depender de um segundo personagem existir de fato.

**Acceptance Criteria**:

1. WHEN uma nova partida inicia THEN o sistema SHALL inicializar `maxHp`, `speed` e `size` do jogador a partir da definição do personagem selecionado no registry — não mais de literais no loop de jogo.
2. WHEN o `selectedCharacterId` não corresponde a nenhum personagem do registry THEN o sistema SHALL usar o primeiro personagem do registry como fallback, sem lançar erro.
3. WHEN o jogador pressiona `Q` durante uma partida ativa (`gameState === "playing"`) E o poder especial do personagem está disponível (fora de cooldown) THEN o sistema SHALL disparar "Refactor Dash": teleportar o jogador instantaneamente por uma distância fixa na direção atual de movimento (ou na direção do inimigo mais próximo se parado; `(0,-1)` se não houver inimigos em tela), respeitando os limites do mundo, e iniciar o cooldown do poder.
4. WHEN o jogador pressiona `Q` enquanto o poder ainda está em cooldown THEN o sistema SHALL ignorar o input — sem dash, sem resetar o cooldown, sem erro.
5. WHEN o jogador mantém `Q` pressionado (mesma tecla, sem soltar) THEN o sistema SHALL disparar o poder no máximo uma vez por pressionamento (borda de subida), nunca repetidamente enquanto a tecla estiver segurada.
6. WHEN uma nova partida começa ou o "novo chamado" (reset) acontece THEN o cooldown do poder especial SHALL voltar a zero (disponível imediatamente).
7. WHEN `gameState` não é `"playing"` (menu, pausado, fim de jogo, vitória, promoção, escolha final) THEN pressionar `Q` SHALL não ter nenhum efeito.
8. WHEN o painel escondido "Personagens & Skins" está aberto THEN ele SHALL exibir o nome do personagem atual, seus atributos (`maxHp`, `speed`, `size`) e seu poder especial (nome, descrição, cooldown) — não mais o texto "em construção".
9. WHEN uma segunda definição de personagem é adicionada ao registry (verificado via teste unitário com uma entrada de teste, não um personagem real do catálogo) THEN a inicialização do jogador e o disparo do poder especial SHALL resolvê-la genericamente, sem exigir nenhuma mudança em `app/page.tsx` além da leitura já existente do registry.
10. WHEN qualquer personagem é definido no registry THEN seus atributos (`maxHp`, `speed`, `size` positivos; cooldown do poder não-negativo) SHALL ser validados por um teste unitário que varre todas as entradas do registry — protege personagens futuros contra dados inválidos.
11. WHEN a página é recarregada THEN o personagem selecionado SHALL voltar ao padrão (primeiro do registry) — sem persistência entre sessões, mesmo padrão do desbloqueio do menu escondido.

**Independent Test**: Jogar uma partida real, pressionar `Q` e observar o teleporte + cooldown bloqueando reativação imediata; abrir o menu escondido e ver os dados reais do personagem; rodar a suíte de testes e confirmar que uma 2ª entrada de teste no registry funciona sem tocar em `app/page.tsx`.

---

## Edge Cases

- WHEN o jogador ativa "Refactor Dash" perto da borda do mundo THEN o destino do teleporte SHALL ser limitado (`clamp`) para dentro dos limites do mundo (`WORLD.width`/`WORLD.height`), nunca posicionando o jogador fora da arena.
- WHEN não há inimigos em tela e o jogador está parado ao pressionar `Q` THEN a direção do dash SHALL usar o fallback fixo `(0, -1)` (para cima) em vez de falhar ou não fazer nada.
- WHEN o jogador ativa `Q` no mesmo frame em que a partida termina (vitória/derrota) THEN o dash SHALL ser ignorado se `gameState` já não for `"playing"` no momento do evento (guarda de estado, não de frame).
- WHEN um personagem futuro do registry não define um poder especial (campo opcional) THEN o painel de personagem SHALL exibir isso de forma clara (ex: "Sem poder especial") em vez de quebrar a renderização.

---

## Emenda — 2026-08-29 (achado de `/code-review` pós-Execute)

**CHAR-12**: durante o code-review da implementação, foi identificado que `triggerActivePower` desloca o jogador só com `clamp` nos limites do mundo, sem checar colisão com obstáculos (`obstacleBlocksCircle`, já usado pelo movimento normal WASD) — ou seja, o "Refactor Dash" atravessa obstáculos (mesas, servidores, firewalls, boards). A spec original (`Edge Cases`) só previa o clamp de limite do mundo; nunca decidiu sobre obstáculos. **Decisão do usuário**: manter esse comportamento como intencional — o poder é uma habilidade de escape, atravessar obstáculos faz parte do design, não é um bug. Nenhuma mudança de código — só formalização da AC.

**Acceptance Criteria**:

12. WHEN o jogador ativa "Refactor Dash" e o destino calculado atravessaria um obstáculo (mesa, servidor, firewall, board) THEN o teleporte SHALL ocorrer normalmente, ignorando colisão com obstáculos — comportamento intencional (habilidade de escape), diferente do movimento normal (que respeita `obstacleBlocksCircle`).

**Independent Test**: Posicionar o jogador encostado em um obstáculo, pressionar `Q` na direção do obstáculo, confirmar que o jogador teleporta para o outro lado (ou para dentro/além do obstáculo), sem ser bloqueado.

---

## Emenda 2 — 2026-08-29: Dois novos personagens, mecânicas diferentes, seletor visual real

**Contexto**: `sistema-personagens` (P1) entregou só o "Dev Pleno" (1 personagem, poder tipo dash) — decisão explícita na época de manter a infraestrutura mínima. Agora o usuário quer 2 personagens novos com **mecânicas de poder diferentes** (não variações numéricas do mesmo dash), **diferença visual** (retrato no seletor + sprite em jogo) e um **seletor de verdade** no menu escondido (hoje é só leitura de 1 personagem).

**Scan do código antes de especificar**: o jogo não usa nenhum arquivo de imagem em lugar nenhum — o personagem em jogo é desenhado em canvas com blocos coloridos (`drawPlayer()`, `app/page.tsx:1711-1748`, via `pixelRect()` já extraída como função standalone em `app/page.tsx:181`) e a tela de título usa a mesma filosofia só que em CSS (`.pixel-dev` com `<div>`/`<span>`, sem imagem). Confirmado com o usuário: o retrato do seletor deve reaproveisar a MESMA técnica de `drawPlayer()` (pixel art em canvas), não um arquivo de imagem novo.

### Novos personagens

| Personagem | Atributos (perfil) | Poder | Tipo de poder |
| --- | --- | --- | --- |
| Estagiário | `maxHp` baixo, `speed` alto, `size` pequeno — rápido e frágil | "Já Terminei!" | **haste** (buff de velocidade temporário) |
| SRE / DevOps | `maxHp` alto, `speed` normal, `size` maior — tanque | "Modo Incident Response" | **shield** (invencibilidade temporária) |

Ambos reaproveitam campos que **já existem** em `player` e já são usados por power-ups de arena: `player.haste` (multiplicador de velocidade 1.34x, já lido em `update()`) e `player.invincible` (já usado pelo power-up "rollback" e já desenhado com efeito de "piscar" em `drawPlayer()`). Isso reduz o risco da mecânica nova — o EFEITO já existe e já é testado via power-up; o que é novo é só o disparo por tecla/cooldown, no lugar de um pickup de arena.

### Acceptance Criteria

13. WHEN o registry é consultado THEN SHALL existir uma definição "Estagiário" com `maxHp` menor, `speed` maior e `size` menor que o "Dev Pleno", e poder `kind: "haste"` chamado "Já Terminei!".
14. WHEN o registry é consultado THEN SHALL existir uma definição "SRE" (ou "DevOps") com `maxHp` maior, `speed` igual ou levemente menor e `size` maior que o "Dev Pleno", e poder `kind: "shield"` chamado "Modo Incident Response".
15. WHEN `CharacterSpecialPower` é definido THEN SHALL ter um campo discriminador `kind` (`"dash" | "haste" | "shield"`); `triggerActivePower` SHALL despachar o efeito genericamente por `kind`, sem `if`/`else` hardcoded por personagem — CHAR-09 (genericidade) se estende a poderes de tipos diferentes, não só a variações do mesmo tipo.
16. WHEN um poder `kind: "haste"` é ativado (tecla `Q`, fora de cooldown, `gameState === "playing"`) THEN o sistema SHALL aplicar `player.haste` pela duração configurada no poder, e então iniciar o cooldown — reaproveitando o multiplicador de velocidade já existente, sem nova lógica de movimento.
17. WHEN um poder `kind: "shield"` é ativado (mesmas guardas) THEN o sistema SHALL aplicar `player.invincible` pela duração configurada no poder, e então iniciar o cooldown — reaproveitando a invencibilidade e o efeito visual de "piscar" já existentes.
18. WHEN as regras já estabelecidas para o poder tipo dash (bloqueio durante cooldown — CHAR-04; ativação por borda de subida, sem repetição ao segurar — CHAR-05; reset do cooldown em nova partida — CHAR-06; sem efeito fora de `gameState === "playing"` — CHAR-07) são aplicadas a um poder `kind: "haste"` ou `kind: "shield"` THEN o comportamento SHALL ser idêntico — essas regras são do sistema de ativação de poder, não específicas de dash.
19. WHEN o jogador ativo tem uma cor de corpo (`bodyColor`) definida no registry THEN `drawPlayer()` SHALL desenhar o corpo do personagem com essa cor, em vez da cor fixa `#0ea5e9` usada hoje só para o "Dev Pleno".
20. WHEN uma partida está em andamento THEN o rótulo de texto acima do jogador SHALL exibir o nome do personagem ativo (`activeCharacter.name`), não mais o texto fixo "Java Pleno".
21. WHEN o painel escondido "Personagens & Skins" é aberto THEN SHALL exibir as 3 definições do registry como cards selecionáveis, cada um com nome, atributos, poder (nome/descrição/cooldown) e um retrato estático desenhado com a mesma técnica de sprite de `drawPlayer()` (mesma paleta de cores do personagem, sem animação — pose fixa).
22. WHEN o jogador clica num card de personagem no seletor THEN aquele personagem SHALL ficar marcado como selecionado (destaque visual no card ativo) e a seleção SHALL valer a partir da PRÓXIMA nova partida ou "novo chamado" (reset) — nunca retroativamente numa partida já em andamento.
23. WHEN a página é recarregada THEN a seleção SHALL voltar ao personagem padrão (primeiro do registry, "Dev Pleno") — sem persistência entre sessões, mesmo padrão já decidido para o desbloqueio do menu.

### Edge Cases

- WHEN o jogador troca de personagem no seletor enquanto uma partida está em andamento (painel aberto via pausa, se possível) THEN a partida atual SHALL continuar com o personagem com que ela começou; só a próxima partida usa o novo selecionado.
- WHEN um personagem do registry não define `specialPower` (`null`) THEN o seletor SHALL continuar mostrando "Sem poder especial" (comportamento já implementado em CHAR-08, reafirmado aqui pro caso de um 4º personagem futuro sem poder).
- WHEN o retrato estático é desenhado no seletor THEN SHALL ser uma única chamada de desenho (sem loop de animação, sem "correr"/"piscar") — evita duplicar o motor de animação do jogo fora do loop principal.

### Assumptions & Open Questions (desta emenda)

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Duração/cooldown do "Já Terminei!" (haste) | 4s de duração, 10s de cooldown | Simétrico ao "Refactor Dash" (poder forte, cooldown maior que a duração); ajustável sem mudar arquitetura | y |
| Duração/cooldown do "Modo Incident Response" (shield) | 2.5s de duração, **30s de cooldown** | Usuário ajustou o cooldown recomendado (12s → 30s): invencibilidade é o efeito mais forte do jogo, cooldown bem mais longo que os outros dois poderes acentua o perfil "tanque defensivo raro" do SRE | y |
| Cor de corpo por personagem | Estagiário: verde-água (`#2dd4bf`); SRE: cinza-ardósia (`#64748b`); Dev Pleno mantém o azul atual (`#0ea5e9`) | Cores distintas entre si e das cores já usadas com significado no HUD (vermelho=dano, laranja=fúria, roxo=foco, dourado=UI) | y |
| Retrato do seletor é canvas por card ou canvas único reaproveitado | 3 elementos `<canvas>` pequenos, um por card, cada um desenhado 1x quando o painel abre | Mais simples que gerenciar troca de personagem num canvas único; custo é desprezível (3 desenhos estáticos, sem loop) | y (decisão técnica de baixo risco, não é uma escolha de produto) |
| Seleção some do estado ao recarregar | Confirmado nesta emenda — mesmo padrão da entrega anterior | Decisão explícita do usuário nesta sessão | y |

**Open questions**: nenhuma — todas as linhas acima confirmadas pelo usuário (cooldown do shield ajustado de 12s para 30s).

---

## Emenda 3 — 2026-08-30 (achados de `/code-review` pós-Execute da Emenda 2)

**CHAR-24**: código-review encontrou que `player.haste = power.durationSeconds` (poder "Já Terminei!") sobrescreve direto, ao contrário de `player.invincible = Math.max(player.invincible, power.durationSeconds)` (poder "Modo Incident Response"). Isso permite que ativar o poder do Estagiário **encolha** um buff de `haste` mais longo já ativo (ex: vindo do power-up de café, que dá 6s). A spec original (CHAR-16) não definia esse caso. **Decisão do usuário**: trocar para `Math.max`, igual ao shield — o poder nunca deve piorar um buff já ativo.

**Acceptance Criteria**:

24. WHEN o poder `kind: "haste"` é ativado e `player.haste` já tem um valor restante maior que `power.durationSeconds` (ex: buff de power-up ainda ativo) THEN o sistema SHALL manter o maior dos dois (`player.haste = Math.max(player.haste, power.durationSeconds)`), nunca encolher um buff já ativo — mesma regra já usada pelo poder `kind: "shield"`.

**CHAR-25**: código-review encontrou que os cards do seletor de personagem (`role="radio"`, classes `character-card`/`character-card-selected`/`character-portrait`) não têm nenhuma regra correspondente em `app/globals.css` — renderizam sem estilo, e o card selecionado não tem nenhum destaque visual pra quem usa mouse (só `aria-checked`, invisível). Isso viola CHAR-22 ("destaque visual no card ativo"), que ficou satisfeito só a nível de acessibilidade, não visualmente. **Correção**: adicionar CSS pras 3 classes, com destaque visual claro (ex: borda/cor diferente) no card com `aria-checked="true"`.

**Acceptance Criteria**:

25. WHEN o painel "skins" é renderizado THEN os cards de personagem SHALL ter estilo visual consistente com o resto do jogo (mesmo padrão de borda/fundo pixel art já usado em `.menu-panel`/`.frame-panel`), e o card selecionado (`aria-checked="true"`) SHALL ter um destaque visualmente distinto dos outros (não só `aria-checked`).

**Independent Test**: Abrir o painel "skins", ver visualmente qual personagem está selecionado sem precisar inspecionar o DOM; clicar em outro personagem e ver o destaque mudar de card.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| CHAR-01 | P1: Registry-driven init (`maxHp`/`speed`/`size`) | Verified | Verified |
| CHAR-02 | P1: Fallback para personagem desconhecido | Verified | Verified |
| CHAR-03 | P1: Ativação do poder especial (`Q` + cooldown) | Verified | Verified |
| CHAR-04 | P1: Poder bloqueado durante cooldown | Verified | Verified |
| CHAR-05 | P1: Ativação por borda de subida (sem repetição ao segurar) | Verified | Verified |
| CHAR-06 | P1: Reset do cooldown em nova partida/reset | Verified | Verified |
| CHAR-07 | P1: Sem efeito fora de `gameState === "playing"` | Verified | Verified |
| CHAR-08 | P1: Painel escondido exibe dados reais do personagem | Verified | Verified |
| CHAR-09 | P1: Genericidade do registry (2ª entrada de teste) | Verified | Verified (fix cycle 1 — `ca3aa1e`) |
| CHAR-10 | P1: Invariantes de dados do registry (valores válidos) | Verified | Verified |
| CHAR-11 | P1: Sem persistência entre sessões | Verified | Verified |
| CHAR-12 | Emenda: Dash atravessa obstáculos (intencional) | Verified | Verified — comportamento já existente, sem código novo |
| CHAR-13 | Emenda 2: Personagem "Estagiário" (haste) | Verified | Verified |
| CHAR-14 | Emenda 2: Personagem "SRE" (shield) | Verified | Verified |
| CHAR-15 | Emenda 2: Discriminador `kind` + despacho genérico | Verified | Verified |
| CHAR-16 | Emenda 2: Ativação de poder `kind: "haste"` | Verified | Verified |
| CHAR-17 | Emenda 2: Ativação de poder `kind: "shield"` | Verified | Verified |
| CHAR-18 | Emenda 2: Regras de cooldown/borda/reset/estado genéricas por kind | Verified | Verified |
| CHAR-19 | Emenda 2: Cor de corpo por personagem em `drawPlayer()` | Verified | Verified (fix cycle 1 — `278a787`) |
| CHAR-20 | Emenda 2: Rótulo em jogo usa nome do personagem ativo | Verified | Verified |
| CHAR-21 | Emenda 2: Seletor real com retrato no menu escondido | Verified | Verified |
| CHAR-22 | Emenda 2: Seleção só vale na próxima partida | Verified | Verified |
| CHAR-23 | Emenda 2: Sem persistência entre sessões | Verified | Verified |
| CHAR-24 | Emenda 3: Haste usa `Math.max` (não sobrescreve buff maior) | Design | Pending |
| CHAR-25 | Emenda 3: Destaque visual do card selecionado no seletor | Design | Pending |

**ID format:** `CHAR-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 25 total, 23 Verified (Emenda 1 + Emenda 2), 2 novos da Emenda 3 (fix cycle a caminho)

---

## Success Criteria

- [x] Um novo personagem pode ser adicionado editando apenas o arquivo de registry — comprovado por teste unitário com uma 2ª entrada (CHAR-09), sem tocar em `app/page.tsx` além da leitura genérica já existente.
- [x] O jogador consegue ativar "Refactor Dash" numa partida real e observar o cooldown bloqueando reativação imediata.
- [ ] O painel escondido "Personagens & Skins" mostra um seletor real com 3 personagens, cada um com retrato visual distinto, atributos e poder de mecânica diferente (dash/haste/shield).
- [ ] O personagem selecionado aparece diferente em jogo (cor do corpo, nome no rótulo) na próxima partida após a seleção.
- [ ] Nenhum teste existente quebra; a suíte sobe com os novos testes desta emenda.
