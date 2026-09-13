# Estudo — Menu IDCLIP v1.4 (canvas verbatim) Specification

## Problem Statement

O painel "Fases Secretas" já implementado (`menu-secreto-idclip-v14`) é uma tradução do mockup
`_docs/game-design/IDCLIP v1.4.html` pra React/DOM/CSS — fiel, mas deliberadamente **não**
replica 100% da mecânica do mockup (cheats por fase, Konami code, easter egg da abóbora,
clique-na-track pra saltar ficaram fora de escopo porque não há `PhaseGraph` real por trás das 7
fases bloqueadas). O usuário quer ver o mockup rodando **exatamente como ele é, com tudo
funcional** (inclusive os cheats/Konami/easter-egg, mesmo sem gameplay real atrás), **sem
modificar** o painel já verificado.

## Goals

- [ ] Nova rota de estudo isolada, sem nenhuma ligação com `app/page.tsx`/o jogo real — mesmo
      padrão já usado por `app/estudo-tela-inicial/`, `app/qwen/hud-redesign/`,
      `app/clude/hud-redesign/` (canvas port direto, `"use client"`, sem CSS separado, fonte via
      `<link>` inline).
- [ ] O canvas+JS do mockup (`IDCLIP v1.4.html`) reaproveitado **quase verbatim** — mesma
      lógica, mesmos números de tuning, mesmas 8 fases, todos os cheats (`idclip`, `idboo`,
      `idyarr`, `idmelt`, `idorbit`, `idsiege`, `idcoin`), Konami code, easter egg da abóbora, e
      scroll completo (wheel, drag do thumb, clique na track pra saltar).
- [ ] `window.onPhaseSelect` mantido como no mockup original (hook não plugado a nenhum jogo
      real nesta rota — ao "confirmar" uma fase, mostra o toast de fallback do próprio mockup:
      "HOOK: onPhaseSelect(id) — plugue o loader aqui"). Sem isso, não haveria pra onde ir ao
      confirmar uma fase "desbloqueada" via cheat, já que nenhuma tem gameplay real.
- [ ] O painel `menu-secreto-idclip-v14` (React/DOM, já verificado) **não é tocado** por esta
      spec — nenhum arquivo dele entra no diff.

## Out of Scope

| Item | Razão |
| --- | --- |
| Integração com o jogo real (`app/page.tsx`) | O usuário pediu explicitamente pra manter a versão atual intacta; esta é uma rota de estudo isolada, não um substituto |
| `PhaseGraph` real para qualquer fase | Mesma razão de sempre — fora de escopo desta e das specs anteriores |
| Link/navegação visível no jogo pra esta rota | Mesmo padrão dos outros `estudo-*`/`qwen/*`/`clude/*` — acessível só por URL direta |
| Persistência de desbloqueio entre reloads | O próprio mockup não persiste (`menu.unlocked` é só estado em memória, resetando a cada reload) — comportamento herdado como está |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Local da rota | `app/estudo-menu-idclip-v14/page.tsx` | Convenção `estudo-*` já usada no projeto | y (segue convenção existente) |
| Abordagem técnica | Canvas+JS do mockup portado quase verbatim (TypeScript mínimo pra passar no build, sem reescrever lógica) | Decisão explícita do usuário (fidelidade > padrão React do resto do projeto, nesta rota isolada) | y |
| Hook `onPhaseSelect` | Mantido como no mockup (fallback de toast, sem integração real) | Não há jogo real pra essa rota se conectar; ver Out of Scope | y (implícito — nenhum jogo real foi pedido) |

**Open questions:** nenhuma.

## Success Criteria

- [ ] Abrir `/estudo-menu-idclip-v14` mostra o painel de 8 fases com scroll, exatamente como
      `IDCLIP v1.4.html` roda standalone.
- [ ] Todos os cheats (`idclip`/`idboo`/`idyarr`/`idmelt`/`idorbit`/`idsiege`/`idcoin`), o
      Konami code, e o easter egg da abóbora funcionam (desbloqueiam visualmente a fase
      correspondente).
- [ ] Scroll funciona por wheel, drag do thumb, e clique na track.
- [ ] `npm run build` e `npm run lint` passam sem erro novo; suíte de testes existente
      (`npm test`) permanece 100% verde (nenhum teste do painel já verificado quebra, já que
      nenhum arquivo dele é tocado).
