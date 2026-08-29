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
| Segundo personagem "de verdade" jogável | Decisão do usuário: MVP só formaliza o "Dev Pleno" atual como 1º item do catálogo; a extensibilidade é provada por teste unitário (CHAR-09), não por um 2º personagem balanceado. |
| Persistência da escolha entre sessões (localStorage) | Decisão explícita do usuário: reseta a cada reload, mesmo padrão já adotado para o desbloqueio do menu escondido (`_docs/roadmap.md`). |
| Promover o menu de personagens para uma entrada oficial/visível no menu principal | Decisão explícita do usuário: "futuramente pode virar uma opção oficial". Por ora continua atrás do cheat code `iddqd`/`idkfa`; a UI é construída de forma independente do gate para que essa promoção seja só uma mudança de entrada de menu, não um redesenho. |
| Seletor de personagem multi-opção (picker/carrossel) | Sem função prática com apenas 1 personagem no catálogo; entra quando houver 2+ personagens reais. |
| Botão de toque para acionar o poder especial no mobile | Fora do pedido original; a tecla `Q` é suficiente para provar a infraestrutura. Mobile hoje só tem arrastar (movimento) e tiro automático. |
| Registrar o personagem usado no ranking/high score | Não solicitado; adicionaria campo ao payload de score sem necessidade nesta entrega. |
| Balanceamento competitivo entre personagens | Não há disputa 1x1 nem ranking segmentado por personagem no jogo hoje. |

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

**ID format:** `CHAR-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 12 total, 12 mapeados a tasks, 0 unmapped — validado em `validation.md` (PASS)

---

## Success Criteria

- [ ] Um novo personagem pode ser adicionado editando apenas o arquivo de registry — comprovado por teste unitário com uma 2ª entrada (CHAR-09), sem tocar em `app/page.tsx` além da leitura genérica já existente.
- [ ] O jogador consegue ativar "Refactor Dash" numa partida real e observar o cooldown bloqueando reativação imediata.
- [ ] O painel escondido "Personagens & Skins" mostra dados reais do personagem, não mais o placeholder.
- [ ] Nenhum dos 195 testes existentes quebra; a suíte sobe com os novos testes desta feature.
