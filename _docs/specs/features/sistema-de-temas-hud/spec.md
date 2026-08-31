# Sistema de Temas de HUD Specification

## Problem Statement

O jogo real (`app/page.tsx`, ~2500 linhas: motor de canvas, estado, áudio, high scores, menus) ganhou dois redesigns de HUD nesta sessão (`/clude/hud-redesign` e `/qwen/hud-redesign`), cada um implementado como cópia integral e independente do arquivo inteiro só para testar sem arriscar o jogo publicado. O usuário aprovou o redesign "neon" (baseado no estudo `/qwen`) e agora quer oferecê-lo como tema alternativo dentro do jogo real, com um clássico e o neon coexistindo, escolhidos pelo jogador e persistidos entre visitas — sem duplicar as ~2500 linhas do motor.

## Goals

- [ ] O motor do jogo (estado, loop de canvas, áudio, high scores) existe em um único lugar; nenhum tema duplica essa lógica.
- [ ] O jogador escolhe entre pelo menos dois temas de HUD (Clássico, Neon) em uma tela de Configurações acessível pelo menu inicial.
- [ ] A escolha de tema persiste entre visitas via cookie, com "Clássico" como padrão para quem nunca escolheu.
- [ ] O volume/mute também fica selecionável na tela de Configurações, sem duplicar o estado de áudio já existente.
- [ ] `/clude/hud-redesign` e `/qwen/hud-redesign` deixam de ser necessários depois que o tema Neon estiver disponível em `/`.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Acesso a Configurações pela tela de pausa | Usuário confirmou: só no menu inicial nesta rodada. Pode virar um P2 futuro. |
| Novos temas além de Clássico/Neon | Fora do escopo desta feature; a arquitetura deve permitir adicionar mais depois, mas só esses dois são entregues agora. |
| Migração da persistência para servidor/conta de usuário | Cookie local do navegador é suficiente; sem conceito de conta de jogador no projeto. |
| Remoção física de `/clude/hud-redesign` | Fica documentada como possível cleanup, mas não é uma tarefa desta feature (é outro estudo, decisão separada do usuário). `/qwen/hud-redesign` também não é removido automaticamente — só deixa de ser a única forma de ver o tema neon. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Tema padrão sem cookie | Clássico | Confirmado pelo usuário via pergunta direta. | y |
| Acesso a Configurações | Só menu inicial, como 3º item (Jogar, High Scores, Configurações, Como Jogar, Apoie o jogo) | Confirmado pelo usuário. | y |
| Escopo do tema Neon | Paridade total com `/qwen/hud-redesign`: header+footer 100% canvas (avatar Doom-style, boss/build/terminal no footer) + estilo CRT em High Scores/Como Jogar/Apoie o jogo/pausa/skins/debug | Confirmado pelo usuário. | y |
| Formato do cookie | Nome `jphud-theme`, valor `classico` \| `neon`, `path=/`, `max-age` de 1 ano, sem `httpOnly` (precisa ser lido no cliente) | Simples, sem lib externa; suficiente pra uma preferência de UI não sensível. | n — assumido, sem gray area de segurança/privacidade real (não é dado sensível) |
| Onde o motor mora | Continua em `app/page.tsx`, sem migrar para hook separado — só a JSX de apresentação sai para `app/_hud/[tema]/` | Decidido na fase de Design (Approach Exploration) após comparar 3 abordagens: mover o `useEffect` de física de ~1300 linhas foi descartado por risco de regressão (ver `AD-009`). | y — decisão técnica confirmada no Design, registrada em `AD-009` |
| Leitura do cookie no primeiro render | Lido em `useEffect` no client (sem SSR do valor) — pode haver 1 frame com o tema padrão antes de aplicar o salvo | Evita complexidade de Server Component + Client Component split só para eliminar um flash; jogo já é 100% client-rendered (`"use client"`). Se o flash incomodar na prática, vira ajuste futuro. | n — assumido, documentado como trade-off aceito |

**Open questions:** nenhuma — todas resolvidas ou registradas acima.

---

## User Stories

### P1: Separar apresentação (HUD) do motor sem duplicar o motor ⭐ MVP

**User Story**: Como mantenedor do projeto, eu quero que a lógica do jogo (estado, loop de canvas, áudio, high scores, input) continue existindo em um único lugar — e que os dois temas de HUD sejam só apresentação alimentada por esse único lugar — para que adicionar ou ajustar um tema nunca exija duplicar ou editar em paralelo o motor inteiro.

**Why P1**: É a base técnica sem a qual "sistema de temas sem duplicação" é impossível — as outras stories dependem desta.

> Decisão de design (ver `design.md`, Approach Exploration): o motor **permanece em `app/page.tsx`**, sem migrar para um hook separado — mover o `useEffect` de física de ~1300 linhas foi avaliado e descartado por risco (ver `AD-009` em `STATE.md`). "Único lugar" aqui significa: uma única implementação do motor, não necessariamente um módulo isolado.

**Acceptance Criteria**:

1. WHEN `ClassicHud`/`NeonHud` são renderizados por `app/page.tsx` THEN eles SHALL receber todo o estado necessário para o HUD (score, wave, hp, boss, biome, upgrade, bossProgress, burstStaminaPct, abilityCooldownPct, muted, volume, gameState, menuPanel, highScores, selectedCharacterId, refs de canvas/debug) e os handlers de ação (setMuted, setVolume, setMenuPanel, startNewGame, resumeGame, returnToTitle, activateMenuOption, etc.) via um único tipo de props (`HudProps`), sem reimplementar nenhuma regra de jogo dentro do componente de tema.
2. WHEN o jogo é jogado através do tema Clássico (rota `/`) THEN o comportamento observável (pontuação, ondas, colisões, high scores salvos, áudio) SHALL ser idêntico ao existente antes desta feature — nenhuma regressão de gameplay.
3. WHEN `app/page.tsx` é inspecionado após a feature THEN a JSX de retorno SHALL conter apenas: montagem de `hudProps` + despacho `<ClassicHud>`/`<NeonHud>` + o `<canvas>` compartilhado da arena — nenhuma JSX de topbar/bottombar/telas de menu inline no arquivo de rota (a lógica de jogo em si — spawn, colisão, física, cálculo de score — nunca sai de `app/page.tsx`, por decisão de design).
4. WHEN o build de produção (`npm run build`) roda THEN SHALL passar sem erros de `AD-008` (exports extras em arquivo de rota) — `HudProps`, `theme-cookie.ts` e `use-theme-preference.ts` SHALL viver fora de `app/page.tsx`.

**Independent Test**: Rodar a suíte de testes existente (`npm test -- --run`) e `npm run build` antes e depois da feature; o jogo em `/` (tema Clássico, padrão) deve se comportar de forma indistinguível para quem já jogou (mesmos controles, mesma UI, mesmo ranking).

---

### P1: Tema Clássico e tema Neon consomem o mesmo motor ⭐ MVP

**User Story**: Como jogador, eu quero poder trocar entre o visual clássico e o visual neon do HUD sem que isso afete o jogo em si (pontuação, dificuldade, controles), para escolher a aparência que prefiro.

**Why P1**: É o valor visível da feature — sem os dois temas renderizando de verdade a partir do motor único, a extração da P1 anterior não tem propósito demonstrável.

**Acceptance Criteria**:

1. WHEN o tema ativo é "Clássico" THEN o header/footer/telas de menu SHALL renderizar exatamente como o jogo publicado hoje (DOM/CSS, sem canvas de HUD).
2. WHEN o tema ativo é "Neon" THEN o header e o footer SHALL ser desenhados em canvas (`PixelHUD`/`PixelFooter`, portados de `public/qwen-hud-lib.js`/`public/qwen-footer-lib.js`) refletindo o estado real do jogo (HP, Rajada, Poder, Score, boss, build status, log de terminal), incluindo o avatar com os estados Doom-style (normal/hurt/pain/dead) reagindo a dano real.
3. WHEN o tema ativo é "Neon" THEN as telas de High Scores, Como Jogar, Apoie o jogo, pausa, seleção de personagem e debug SHALL usar o estilo CRT neon (painel `frame-panel`, scanline) em vez do estilo clássico — a tela inicial (título) usa a versão sem moldura validada no estudo.
4. WHEN o jogador troca de tema (Clássico ↔ Neon) THEN o estado da partida em andamento (score, wave, hp, etc.) SHALL permanecer inalterado — só a apresentação muda.
5. WHEN um tema não implementa um elemento visual específico que o outro tem (ex.: nenhum tema perde funcionalidade) THEN o sistema SHALL garantir que toda ação possível em um tema (mutar som, pausar, ver high scores, apoiar o jogo) continua possível no outro, ainda que com aparência diferente.

**Independent Test**: Alternar entre os dois temas na tela de Configurações e navegar por todas as telas (menu, high scores, como jogar, apoie o jogo, pausa) confirmando que cada uma renderiza no estilo do tema ativo e nenhuma ação fica indisponível.

---

### P1: Tela de Configurações com seleção de tema e volume ⭐ MVP

**User Story**: Como jogador, eu quero uma tela de Configurações acessível pelo menu inicial onde eu escolho o tema visual e ajusto o volume, para centralizar essas preferências em um só lugar.

**Why P1**: É o ponto de entrada da feature para o jogador — sem isso, o sistema de temas existe só no código, não é utilizável.

**Acceptance Criteria**:

1. WHEN o jogador está no menu inicial THEN o sistema SHALL mostrar "Configurações" como 3º item da lista de opções (Jogar, High Scores, Configurações, Como Jogar, Apoie o jogo), navegável por teclado (setas + Enter) e clique, do mesmo jeito que os outros itens.
2. WHEN o jogador abre "Configurações" THEN o sistema SHALL mostrar: (a) um seletor com as opções "Clássico" e "Neon" indicando qual está ativo, e (b) o controle de volume/mute já existente no jogo (reaproveitado, não duplicado).
3. WHEN o jogador seleciona um tema diferente do ativo em Configurações THEN o sistema SHALL aplicar a mudança imediatamente (sem precisar recarregar a página) e persistir a escolha em cookie.
4. WHEN o jogador ajusta o volume em Configurações THEN o comportamento SHALL ser idêntico a ajustar pelo controle de som já existente no HUD (mesmo estado, sem dessincronia).
5. WHEN o jogador sai de Configurações (botão voltar) THEN o sistema SHALL retornar ao menu inicial no tema (possivelmente novo) selecionado.

**Independent Test**: Abrir Configurações, trocar de tema, confirmar que o menu inicial (por trás/depois) já reflete o novo tema; ajustar o volume e confirmar que o som real do jogo muda.

---

### P2: Persistência do tema entre visitas

**User Story**: Como jogador que já escolheu um tema, eu quero que minha escolha seja lembrada na próxima vez que eu abrir o jogo, para não ter que escolher de novo toda vez.

**Why P2**: Complementa a P1 de Configurações — sem persistência a feature "funciona" mas frustra o uso repetido; ainda assim, é demonstrável e testável separadamente da escolha em si.

**Acceptance Criteria**:

1. WHEN o jogador seleciona um tema em Configurações THEN o sistema SHALL gravar um cookie `jphud-theme` com o valor do tema escolhido (`classico` ou `neon`), `path=/`, validade de 1 ano.
2. WHEN o jogador abre o jogo em uma visita nova (sem interação prévia nesta sessão) E o cookie `jphud-theme` existe THEN o sistema SHALL aplicar o tema salvo assim que possível após o primeiro render no client.
3. WHEN o jogador abre o jogo pela primeira vez (cookie ausente ou com valor inválido) THEN o sistema SHALL usar "Clássico" como tema.
4. WHEN o cookie é lido e o valor não é `classico` nem `neon` (corrompido/desatualizado) THEN o sistema SHALL tratar como ausente e cair no padrão Clássico, sem lançar erro.

**Independent Test**: Selecionar Neon, recarregar a página (F5) e confirmar que o jogo abre em Neon; apagar o cookie manualmente (ou trocar o valor pra algo inválido via devtools) e recarregar, confirmando que volta para Clássico sem erro no console.

---

## Edge Cases

- WHEN o jogador troca de tema no meio de uma partida ativa (não só no menu) THEN o sistema SHALL preservar o estado da run — este fluxo só é alcançável a partir do menu inicial (fora de partida) nesta versão, já que Configurações não está na pausa (Out of Scope), então não há partida ativa nesse momento.
- WHEN o navegador do jogador bloqueia cookies (modo privado restritivo, configuração do usuário) THEN o sistema SHALL continuar funcionando normalmente dentro da sessão (o tema escolhido se aplica), só não persiste entre visitas — sem erro visível para o jogador.
- WHEN o tema Neon está ativo e o jogador aciona o cheat code (`iddqd`/`idkfa`) que abre o painel de seleção de personagem THEN esse painel também SHALL usar o estilo CRT neon, consistente com o restante do tema.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| THEME-01 | P1: Extrair motor | Design | ✅ Verified |
| THEME-02 | P1: Extrair motor | Design | ✅ Verified |
| THEME-03 | P1: Extrair motor | Design | ✅ Verified |
| THEME-04 | P1: Extrair motor | Design | ✅ Verified |
| THEME-05 | P1: Temas consomem motor único | Design | ✅ Verified |
| THEME-06 | P1: Temas consomem motor único | Design | ✅ Verified |
| THEME-07 | P1: Temas consomem motor único | Design | ✅ Verified |
| THEME-08 | P1: Temas consomem motor único | Design | ✅ Verified |
| THEME-09 | P1: Temas consomem motor único | Design | ⚠️ Verified (spec-precision gap) |
| THEME-10 | P1: Tela de Configurações | Design | ✅ Verified |
| THEME-11 | P1: Tela de Configurações | Design | ✅ Verified |
| THEME-12 | P1: Tela de Configurações | Design | ✅ Verified |
| THEME-13 | P1: Tela de Configurações | Design | ✅ Verified |
| THEME-14 | P1: Tela de Configurações | Design | ✅ Verified |
| THEME-15 | P2: Persistência | Design | ✅ Verified |
| THEME-16 | P2: Persistência | Design | ✅ Verified |
| THEME-17 | P2: Persistência | Design | ✅ Verified |
| THEME-18 | P2: Persistência | Design | ✅ Verified |

**Coverage:** 18 total, 18 mapped to tasks (ver `tasks.md`), 0 unmapped

---

## Success Criteria

- [ ] `npm test -- --run` e `npm run build` passam depois da extração, sem regressão de comportamento no tema Clássico.
- [ ] Um jogador consegue, a partir do menu inicial, abrir Configurações, trocar para Neon, ver header/footer/menus mudarem de estilo, jogar uma partida completa nesse tema, e ao recarregar a página continuar em Neon.
- [ ] Nenhuma lógica de jogo (spawn, física, colisão, cálculo de score/ranking) está duplicada entre `app/page.tsx` e os arquivos de tema.
