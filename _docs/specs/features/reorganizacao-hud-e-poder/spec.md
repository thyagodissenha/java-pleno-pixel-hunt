# Reorganização do HUD e Feedback do Poder Especial Specification

## Problem Statement

O HUD do jogo (`topbar`) tem um card de patrocínio ("Apoie o jogo") ocupando espaço fixo durante toda a partida, enquanto os controles de som dividem espaço com a barra de Rajada. Ao mesmo tempo, o poder especial dos personagens (dash/haste/shield) não tem nenhum feedback visível pro jogador — o único indicador de cooldown hoje é `role="status"` de debug (`isDebugAllowed()`, nunca visível em produção), e ativar o poder não gera nenhum aviso na tela, diferente dos power-ups de arena (que mostram um banner central). Investigação confirmou que o poder do SRE (escudo) já funciona corretamente (`player.invincible` é aplicado, coberto por teste CHAR-17) — o que "parece não acionar" é a ausência total de feedback visual, não um bug de lógica.

## Goals

- [ ] Tirar o card de patrocínio do HUD de jogo, sem perder o acesso à seção "Apoie o jogo".
- [ ] Reaproveitar o espaço liberado pros controles de som (mute + volume).
- [ ] Dar ao poder especial um medidor de cooldown visível em produção, do mesmo tamanho/estilo da barra de Rajada.
- [ ] Anunciar a ativação do poder especial com o mesmo mecanismo de banner já usado pelos power-ups.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Redesign visual do header além do reposicionamento pedido (cores, ícones, grid novo) | Não solicitado — só mover/trocar o conteúdo dos slots existentes |
| Mudar o conteúdo do painel "Apoie o jogo" em si | Só o ponto de entrada muda (de card no HUD para item de menu); a tela de apoio já existente não é tocada |
| Persistir preferências de layout do HUD | Não solicitado |
| Navegação por teclado no seletor de personagens (`role="radiogroup"`) | Já decidido como fora de escopo em `sistema-personagens/spec.md`; não relacionado a esta feature |
| Corrigir "bug" do poder do SRE | Investigado — não há bug; o poder já funciona (coberto por CHAR-17). O que faltava é exatamente o que esta spec entrega (medidor + aviso) |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Destino do "Apoie o jogo" | 4ª opção no menu de título (`Jogar / High Scores / Como Jogar / Apoie o jogo`) | Decisão explícita do usuário — continua acessível, só sai do HUD de jogo | y |
| Estilo do medidor de cooldown | Barra de progresso + porcentagem, mesmo visual da Rajada | Decisão explícita do usuário | y |
| Texto do aviso de ativação | `"${NOME DO PODER EM MAIÚSCULAS}: ativado"` (ex: "REFACTOR DASH: ativado") | Decisão explícita do usuário — mesmo padrão "NOME: efeito" já usado pelos power-ups | y |
| Controles de som (mute + volume) se movem juntos pro slot liberado | Não separar o botão de mute do slider de volume | Decisão técnica de baixo risco — já são renderizados como um bloco único (`.sound-controls`); separar não foi pedido e complicaria a UI sem motivo | y |
| Navegação por teclado do menu de título passa de `% 3` para `% 4` | Sim, generalizado para o novo total de opções | Consequência direta de adicionar a 4ª opção — sem isso, a seta não alcançaria "Apoie o jogo" ou quebraria o wrap-around das outras 3 | y |

**Open questions:** nenhuma — todas resolvidas acima.

---

## User Stories

### P1: HUD sem patrocínio, com feedback de poder ⭐ MVP

**User Story**: Como jogador, quero ver quando meu poder especial está pronto e saber quando ele foi ativado, e quero que o HUD não gaste espaço fixo com patrocínio durante a partida, para que eu confie que o poder está funcionando e tenha mais espaço útil na tela.

**Why P1**: É a única entrega desta feature — cobre reorganização de layout e feedback de poder juntos, já que ambos mexem no mesmo `topbar`/`utility-card`.

**Acceptance Criteria**:

1. WHEN o HUD de jogo (`topbar`) é renderizado THEN o card "Patrocínio/Apoie o jogo" (`.sponsor-card`) SHALL não aparecer mais nele.
2. WHEN o menu inicial (tela de título) é exibido THEN SHALL existir uma 4ª opção "Apoie o jogo" na lista `title-menu-actions`, clicável e navegável por teclado (setas Cima/Baixo + Enter), abrindo o mesmo painel de apoio já existente (mesma função `openSupportPanel` já usada pelo card antigo).
3. WHEN o jogador navega o menu inicial com seta Cima/Baixo THEN o índice ativo SHALL ciclar corretamente entre as 4 opções (aritmética `% 4`), sem pular a nova opção nem quebrar o wrap-around das 3 já existentes.
4. WHEN os controles de som (botão mute + slider de volume) são renderizados THEN SHALL ocupar o slot do HUD antes usado pelo card de patrocínio, mantendo o mesmo comportamento funcional de hoje (mutar, ajustar volume).
5. WHEN o personagem ativo tem `specialPower` não nulo THEN o `utility-card` SHALL exibir, ao lado da barra de Rajada e do mesmo tamanho visual, um segundo medidor (barra de progresso + porcentagem) representando a disponibilidade do poder: 0% logo após o uso, subindo até 100% quando volta a ficar disponível.
6. WHEN o personagem ativo NÃO tem `specialPower` (`null`) THEN o medidor de cooldown do poder SHALL não ser renderizado (sem espaço vazio/quebrado no lugar).
7. WHEN o jogador ativa o poder especial com sucesso (`Q`, fora de cooldown, `gameState === "playing"`) THEN o sistema SHALL exibir o mesmo banner central já usado pelos power-ups (`announceEffect`), com o texto `"${NOME DO PODER EM MAIÚSCULAS}: ativado"`.
8. WHEN `Q` é pressionado mas o poder está em cooldown, o personagem não tem poder, ou `gameState` não é `"playing"` THEN nenhum banner SHALL aparecer — mesmo comportamento de "ignorar" silenciosamente já existente para essas guardas.

**Independent Test**: Jogar uma partida, ver a barra de Rajada e a nova barra de cooldown do poder lado a lado, apertar `Q` e ver o banner "REFACTOR DASH: ativado" (ou equivalente do personagem selecionado) e a barra de cooldown zerar e subir de volta; abrir o menu inicial e ver "Apoie o jogo" como 4ª opção navegável.

---

## Edge Cases

- WHEN uma nova partida começa ou o "novo chamado" (reset) acontece THEN o medidor de cooldown do poder SHALL mostrar 100% (disponível) imediatamente — mesmo momento em que `abilityCooldownRemaining` já zera hoje (CHAR-06).
- WHEN o jogador ativa o poder e depois um power-up é coletado (ou vice-versa) antes do banner anterior sumir THEN o texto do banner SHALL ser substituído pelo mais recente — mesmo comportamento já existente entre power-ups diferentes (sem fila, sem sobreposição).
- WHEN o "Apoie o jogo" é ativado a partir do menu (não mais de um clique de HUD) THEN o comportamento de pausar a partida se `gameState === "playing"` SHALL continuar válido caso essa função seja chamada durante uma sessão paused/menu (hoje só é alcançável do menu de título, então esse ramo de código existente fica ocioso mas não quebra).

---

## Emenda — 2026-08-30 (gap encontrado durante o Execute)

**HUD-09**: ao remover `.sponsor-card` (HUD-01), o worker de implementação identificou que os únicos links de `/privacidade` e `/sobre` do jogo estavam dentro daquele card (`.sponsor-links`) e sumiram junto — nem `spec.md` nem `design.md` previam realocar esses links. **Decisão do usuário**: colocar os dois links dentro do painel "Apoie o jogo" (o mesmo painel que a nova 4ª opção do menu abre, HUD-02), não no HUD de jogo nem no menu de título diretamente.

**Acceptance Criteria**:

9. WHEN o painel "Apoie o jogo" (`support-screen`) é renderizado THEN SHALL exibir links para `/privacidade` e `/sobre`, navegáveis e visíveis, no mesmo painel — restaurando o acesso que existia antes via `.sponsor-links` no HUD.

**Independent Test**: Abrir "Apoie o jogo" pelo menu inicial, ver e clicar nos links de Privacidade e Sobre dentro do painel.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| HUD-01 | P1: Remove card de patrocínio do HUD | Verified | Verified |
| HUD-02 | P1: "Apoie o jogo" como 4ª opção do menu | Verified | Verified |
| HUD-03 | P1: Navegação do menu ciclando `% 4` | Verified | Verified |
| HUD-04 | P1: Controles de som ocupam o slot liberado | Verified | Verified |
| HUD-05 | P1: Medidor de cooldown do poder, mesmo tamanho da Rajada | Verified | Verified |
| HUD-06 | P1: Sem medidor quando personagem não tem poder | Verified | Verified — sem cobertura automatizada (limitação aceita, ver tasks.md T1) |
| HUD-07 | P1: Banner de ativação do poder (reaproveita `announceEffect`) | Verified | Verified |
| HUD-08 | P1: Sem banner quando a ativação é ignorada (cooldown/estado/sem poder) | Verified | Verified |
| HUD-09 | Emenda: Links de Privacidade/Sobre dentro de "Apoie o jogo" | Design | Pending |

**ID format:** `HUD-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 9 total, 8 Verified (T1-T3), 1 novo (T4 a caminho)

---

## Success Criteria

- [ ] O card de patrocínio some do HUD de jogo; "Apoie o jogo" continua acessível pelo menu inicial.
- [ ] Controles de som continuam funcionando, agora no slot antigo do patrocínio.
- [ ] O jogador vê visualmente quando o poder está disponível (barra + %) e quando foi ativado (banner), sem precisar de modo debug.
- [ ] Nenhum teste existente quebra; a suíte sobe com os novos testes desta feature.
