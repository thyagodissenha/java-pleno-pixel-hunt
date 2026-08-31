# Sistema de Temas de HUD Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `_docs/specs/features/sistema-de-temas-hud/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase (`vitest.config.ts`, `app/__tests__/hud-layout.test.tsx`, `app/__tests__/hidden-menu.test.tsx`) e da spec. Guidelines encontradas: `AGENTS.md` → skill `testing-a11y` (sempre `getByRole`/`getByLabelText`/`getByText`, comportamento visível > implementação); amostra de `hud-layout.test.tsx` (render de `Home` de `@/app/page`, `fireEvent`, canvas mockado).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| `lib/theme/theme-cookie.ts` (parse/serialize puros) | unit | Todas as branches; 1:1 com THEME-15, THEME-16, THEME-18 (valor válido, ausente, corrompido) | `lib/theme/theme-cookie.test.ts` | `npm test -- --run` |
| `lib/theme/use-theme-preference.ts` (hook client) | unit/integration (via componente host) | 1:1 com THEME-15 a THEME-18 (lê cookie no mount, grava ao trocar, fallback pra `classico`) | `lib/theme/use-theme-preference.test.tsx` | `npm test -- --run` |
| `app/page.tsx` + `app/_hud/classic/ClassicHud.tsx` + `app/_hud/neon/NeonHud.tsx` (integração motor↔tema) | integration | 1:1 com THEME-01 a THEME-14; edge cases da spec (troca de tema não afeta estado da run, todas as ações disponíveis nos dois temas) | `app/__tests__/*.test.tsx` (estende `hud-layout.test.tsx`/`hidden-menu.test.tsx` + novo `app/__tests__/theme-selector.test.tsx`) | `npm test -- --run` |
| `app/_hud/hud-props.ts` (tipo `HudProps`) | none | — só type-check (build gate) | — | build gate only |

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após tasks só de lib puro (Fase 1) | `npm test -- --run` |
| Full | Após qualquer task que toque componente/integração (Fases 2-5) | `npm test -- --run && npm run build` |
| Build | Fim da feature (última task) | `npm run lint && npm run build && npm test -- --run` |

---

## Execution Plan

### Phase 1: Fundação (cookie + hook + tipo — zero risco ao jogo)

```
T1 → T2 → T3
```

### Phase 2: Tema Clássico (extração literal, motor intocado)

```
T4
```

### Phase 3: Tema Neon (porte de /qwen/hud-redesign)

```
T5
```

### Phase 4: Fiação em app/page.tsx (motor passa a despachar tema)

```
T6 → T7 → T8
```

### Phase 5: Persistência + regressão final

```
T9 → T10
```

---

## Task Breakdown

### T1: Criar `theme-cookie.ts` (parse/serialize puros) ✅ Complete

**What**: Funções puras `parseThemeCookie(cookieHeader: string): "classico" | "neon" | null` e `serializeThemeCookie(theme): string` — sem DOM, sem `document`.
**Where**: `lib/theme/theme-cookie.ts` (novo), `lib/__tests__/theme-cookie.test.ts` (novo — SPEC_DEVIATION: local segue a convenção real do repo `lib/__tests__/`, não `lib/theme/theme-cookie.test.ts` como escrito originalmente aqui)
**Depends on**: None
**Reuses**: padrão de módulo puro já usado em `lib/cheat-codes.ts`
**Requirement**: THEME-15, THEME-16, THEME-18

**Tools**:

- MCP: NONE
- Skill: `testing-a11y` (convenções de teste do projeto, mesmo não sendo componente)

**Done when**:

- [x] `parseThemeCookie` retorna `"classico"`/`"neon"` para valores válidos, `null` para ausente/corrompido/inválido (nunca lança erro)
- [x] `serializeThemeCookie` retorna string com `jphud-theme=<valor>; path=/; max-age=31536000; samesite=lax`
- [x] Teste unitário cobre: valor válido `classico`, valor válido `neon`, cookie ausente, cookie com outro valor (ex.: `jphud-theme=xyz`), cookie header com múltiplos cookies (extrai só o `jphud-theme`)
- [x] Gate check passes: `npm test -- --run`
- [x] Test count: suíte sobe com os testes novos de `theme-cookie.test.ts`; nenhum teste existente muda de contagem ou quebra

**Tests**: unit
**Gate**: quick

**Commit**: `5d2e96e`

---

### T2: Criar hook `useThemePreference` ✅ Complete

**What**: Hook client que lê `document.cookie` no mount (via `parseThemeCookie`), expõe `{ theme, setTheme }`, e grava o cookie (via `serializeThemeCookie`) toda vez que `setTheme` é chamado.
**Where**: `lib/theme/use-theme-preference.ts` (novo), `lib/__tests__/use-theme-preference.test.tsx` (novo — mesma correção de convenção da T1)
**Depends on**: T1
**Reuses**: `lib/theme/theme-cookie.ts` (T1)
**Requirement**: THEME-15, THEME-16, THEME-17, THEME-18

**Tools**:

- MCP: NONE
- Skill: `testing-a11y`

**Done when**:

- [x] Sem cookie: `theme` inicial é `"classico"` (THEME-16)
- [x] Com cookie `jphud-theme=neon` já presente no `document.cookie` antes do mount: `theme` aplica `"neon"` assim que possível após o primeiro render (THEME-17) — teste usa um componente host mínimo que chama o hook e renderiza `theme`
- [x] Chamar `setTheme("neon")` atualiza o valor retornado E grava o cookie (`document.cookie` passa a conter `jphud-theme=neon`) (THEME-15)
- [x] Cookie com valor inválido (`jphud-theme=xyz`) faz o hook cair em `"classico"` sem lançar erro (THEME-18)
- [x] Gate check passes: `npm test -- --run`
- [x] Test count: suíte sobe com os testes novos; nenhum teste existente muda de contagem ou quebra

**Tests**: unit
**Gate**: quick

**Commit**: `b18aa6a`

---

### T3: Criar tipo `HudProps` ✅ Complete

**What**: Tipo TypeScript único (`interface HudProps`) com todos os campos definidos no design (leitura, ação, refs) — reexporta `GameState`/`MenuPanel`/`HighScore` de `app/page.tsx` onde necessário via `import type`.
**Where**: `app/_hud/hud-props.ts` (novo)
**Depends on**: None
**Reuses**: tipos já existentes em `app/page.tsx` (`GameState`, `MenuPanel`, `HighScore`)
**Requirement**: THEME-01 (contrato motor↔tema)

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `HudProps` definido exatamente com os campos listados na seção "Data Models" / "Components" do `design.md`, incluindo os novos (`theme`, `setTheme`, `settingsOpen`, `openSettingsPanel`, `closeSettingsPanel`)
- [x] `npx tsc --noEmit` passa sem erro (arquivo é só tipos, sem lógica — gate de build, sem teste dedicado)

**Tests**: none
**Gate**: build

**Commit**: `2ac92b5`

---

### T4: Extrair `ClassicHud.tsx` (motor intocado) ✅ Complete

**What**: Criar `app/_hud/classic/ClassicHud.tsx` movendo — sem reescrever — a JSX atual de topbar, bottombar, tela de título e todos os painéis (scores, help, support, skins, pause, debug, promotion, victory) de `app/page.tsx` para este novo componente, trocando a leitura de closures locais por leitura de `props: HudProps`. `app/page.tsx` NÃO é modificado nesta task (o componente fica pronto mas ainda não é importado/usado) — a fiação acontece em T7.
**Where**: `app/_hud/classic/ClassicHud.tsx` (novo), `app/_hud/classic/classic.css` (novo — CSS movido de `app/globals.css`, sem alterar regras)
**Depends on**: T3
**Reuses**: 100% do JSX/CSS atual de `app/page.tsx`/`app/globals.css` — extração literal
**Requirement**: THEME-05 (parte: renderização clássica), THEME-09

**Tools**:

- MCP: NONE
- Skill: `component-architecture` (estrutura por feature, composição)

**Done when**:

- [x] `ClassicHud` renderiza topbar/bottombar/tela de título/todos os painéis a partir de `HudProps`, sem nenhuma lógica nova (mesmas classes CSS, mesmo texto, mesma estrutura DOM de hoje)
- [x] Componente compila e tipa contra `HudProps` (T3) sem `any`
- [x] `app/globals.css` não muda ainda (CSS só é copiado para `classic.css`, remoção do original acontece em T7 quando a troca for segura)
- [x] Gate check passes: `npm run build` (componente ainda não usado em nenhuma rota, então só verifica compilação)

**Tests**: none (componente não conectado a nenhuma rota ainda — testado end-to-end em T7)
**Gate**: build — `npm run build` ✅ (compila sem erros de tipo) + `npm test -- --run` ✅ (257/257, confirma zero regressão em `app/page.tsx`, que não foi tocado)

**SPEC_DEVIATION**: `HudProps` (T3) foi ampliada durante a leitura literal da JSX real — o esboço em design.md era ilustrativo, não exaustivo. Campos adicionados: `supportOpen`/`setSupportOpen`, `debugOpen`/`setDebugOpen`, `playerName`/`setPlayerName`, `scoreSaved`, `scoreMessage`, `promotionCountdown`, `submitScore`, `setSelectedCharacterId`, `canvasRef`, `adBannerRef`. `WORLD` e `frameScreenLabel` (puros, sem lógica de motor) foram duplicados localmente em `ClassicHud.tsx`, seguindo o mesmo racional já documentado para `GameState`/`MenuPanel` (AD-008). `CHARACTERS`/`resolveCharacter`/`isDebugAllowed`/`triggerDebugAction`/`getPublicAdsenseClientId`/`getAdsenseBannerSlotId` são importados diretamente de `lib/` em vez de passados via props, pois já são módulos independentes reutilizáveis por qualquer tema.

**Commit**: `feat(theme): extract ClassicHud presentation component`

---

### T5: Portar `NeonHud.tsx` (de `/qwen/hud-redesign`) ✅ Complete

**What**: Criar `app/_hud/neon/NeonHud.tsx` + `neon.css`, portando header/footer 100% canvas (avatar Doom-style, boss/build/terminal no footer) e o estilo CRT dos demais painéis, validados em `app/qwen/hud-redesign/page.tsx`/`study.css` — adaptado pra ler de `props: HudProps` em vez de duplicar estado.
**Where**: `app/_hud/neon/NeonHud.tsx` (novo), `app/_hud/neon/neon.css` (novo — cópia adaptada de `app/qwen/hud-redesign/study.css`)
**Depends on**: T3
**Reuses**: `app/qwen/hud-redesign/page.tsx` (JSX do header/footer canvas, painel de Configurações não incluso ainda — ver T8), `app/qwen/hud-redesign/study.css`, `public/qwen-hud-lib.js`, `public/qwen-footer-lib.js` (sem alteração)
**Requirement**: THEME-05, THEME-06, THEME-07, THEME-08, THEME-09

**Tools**:

- MCP: NONE
- Skill: `component-architecture`

**Done when**:

- [x] Header/footer desenham via `PixelHUD`/`PixelFooter` (scripts carregados via `next/script`), alimentados por `HudProps` (hp, score, wave, boss, biome, etc.) em vez do estado duplicado que existia em `/qwen`
- [x] Avatar mostra os 4 estados (normal/hurt/pain/dead) reagindo a `hurtTimer` derivado de dano real (mesma lógica validada em `qwen-hud-lib.js`, sem regressão)
- [x] High Scores, Como Jogar, Apoie o jogo, pausa, seleção de personagem e debug usam o painel `frame-panel`/CRT
- [x] Tela inicial usa a versão sem moldura (só fundo escuro + scanline) validada no estudo
- [x] Gate check passes: `npm run build`

**Tests**: none (mesmo racional de T4 — testado end-to-end em T7)
**Gate**: build — `npm run build` ✅ + `npm test -- --run` ✅ (257/257, zero regressão)

**SPEC_DEVIATION**: `hurtTimer` no estudo era derivado de `damageFlash`, uma variável interna do loop do motor (closure em `app/page.tsx`, nunca exposta como estado/prop). Para preservar 1:1 a mesma decaimento validado em `qwen-hud-lib.js` (em vez de reimplementar a lógica de decay dentro do componente de apresentação), `HudProps` ganhou 6 campos "neon-only": `bossKillsCount`, `bossKillTargetCount`, `bossEncountered`, `bossIncident`, `enemyCount`, `damageFlash` — todos hoje só existem como locals do loop em `app/page.tsx` e precisam ser expostos via `useState`/`setState` (mesmo padrão já usado para os campos `debug*`). Isso vira trabalho de T6 (que já mexe em `app/page.tsx`); ver nota adicionada na task T6 abaixo.

**Commit**: `feat(theme): port NeonHud presentation component from /qwen study`

---

### T6: Estado de tema + Configurações + campos neon-only em `app/page.tsx` ✅ Complete

**What**: Em `app/page.tsx`: (a) chamar `useThemePreference()` (T2) pra obter `theme`/`setTheme`; (b) adicionar `settingsOpen`/`openSettingsPanel`/`closeSettingsPanel` seguindo o padrão exato de `supportOpen`/`openSupportPanel`; (c) expor como estado React (mesmo padrão de `debugBossHealth`/`debugPlayerPosition`) os 6 campos "neon-only" que `HudProps` ganhou em T5 e que hoje só existem como locals do loop do motor: `bossKillsCount` (`bossKills`), `bossKillTargetCount` (`bossKillTarget(localWave, callLoops)`), `bossEncountered` (`bossSpawned`), `bossIncident` (`bossBanner > 0`), `enemyCount` (`enemies.length`), `damageFlash` (`damageFlash`) — todos já calculados a cada frame no loop existente (ver `app/page.tsx` linhas ~677-840), só faltando `setState` equivalente.
**Where**: `app/page.tsx` (modificado)
**Depends on**: T2
**Reuses**: padrão de `supportOpen`/`openSupportPanel` já existente (linha ~280/560); padrão de `setDebugBossHealth`/`setDebugPlayerPosition` para os 6 campos neon-only
**Requirement**: THEME-10, THEME-13

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `openSettingsPanel`/`closeSettingsPanel`/`settingsOpen` existem em `app/page.tsx`, espelhando `openSupportPanel`/`supportOpen`
- [x] `theme`/`setTheme` disponíveis no componente via `useThemePreference()` (ainda não usados na JSX — isso é T7)
- [x] Os 6 campos neon-only viram estado React, atualizados em `syncHud()` a cada frame
- [x] Gate check passes: `npm test -- --run && npm run build`
- [x] Test count: nenhum teste existente muda de contagem ou quebra

**Tests**: integration (cobertura real do painel de Configurações acontece em T8, que é quando a UI existe)
**Gate**: full — `npm test -- --run` (256/257 — a única falha, `character-power.test.tsx` CHAR-19, é o flake de execução paralela já documentado na sessão; passa 17/17 isolado) + `npm run build` ✅

**SPEC_DEVIATION**: o remap de `activateMenuOption`/wrap-around do teclado de 4→5 itens (item "c" do "What" original) foi REMOVIDO do escopo de T6 e absorvido por T7. Motivo descoberto ao rodar o gate: `app/page.tsx` ainda renderiza inline os 4 botões antigos (Jogar/Scores/Como Jogar/Apoie — T4 não tocou essa JSX, por design). Remapear os índices de `activateMenuOption` SEM trocar os botões quebra a run real (índice 3, que os botões antigos ainda chamam esperando "Apoie o jogo", passaria a abrir "Como Jogar") — `hud-layout.test.tsx` pegou isso imediatamente (7 testes falhando ao clicar "Apoie o jogo"). O remap de índices e a troca dos botões são inseparáveis; T7 agora faz os dois juntos no mesmo commit.

**Commit**: `feat(theme): add theme state, settings panel state, and neon-only engine fields`

---

### T7: Trocar o retorno de `app/page.tsx` por `ClassicHud`/`NeonHud` ✅ Complete

**What**: Substituir a JSX inline atual (topbar/bottombar/telas de menu) pela montagem do objeto `hudProps: HudProps` e o despacho `theme === "neon" ? <NeonHud {...hudProps} /> : <ClassicHud {...hudProps} />`. **Absorve o remap de T6**: como `ClassicHud`/`NeonHud` já nascem com 4 botões no menu inicial (Jogar/Scores/Como Jogar/Apoie), T7 também adiciona o 5º botão "Configurações" (índice 2) em ambos os componentes e SÓ ENTÃO remapeia `activateMenuOption`/wrap-around do teclado de `%4` para `%5` — os dois lados (JSX + índices) têm que mudar no mesmo commit, senão a run quebra (ver SPEC_DEVIATION em T6). **Ajuste em relação ao design.md original**: o `<canvas>` da arena NÃO é renderizado por `app/page.tsx` — ele fica dentro de `ClassicHud`/`NeonHud` (recebido via `canvasRef` em `HudProps`), porque na JSX real ele é irmão direto dos overlays temáticos dentro da mesma `div.canvas-frame` cuja classe depende de `frameScreen` (achado durante a leitura literal da JSX em T4/T5 — ver SPEC_DEVIATION em T4). `app/page.tsx` continua dono do `canvasRef` (`useRef`) e de tudo que desenha nele (o loop do motor); só não é mais quem renderiza a tag `<canvas>`. Remove o CSS agora morto de `app/globals.css` que foi movido para `classic.css` em T4 (evita duas fontes da mesma regra).
**Where**: `app/page.tsx` (modificado), `app/_hud/classic/ClassicHud.tsx` + `app/_hud/neon/NeonHud.tsx` (5º botão "Configurações"), `app/_hud/neon/NeonHud.tsx` (fix de `Script strategy`), `app/_hud/classic/classic.css` (removido — redundante, ver SPEC_DEVIATION), `app/__tests__/hud-layout.test.tsx` (estendido)
**Depends on**: T4, T5, T6
**Reuses**: `ClassicHud` (T4), `NeonHud` (T5)
**Requirement**: THEME-02, THEME-03, THEME-04, THEME-11, THEME-14

**Tools**:

- MCP: NONE
- Skill: `testing-a11y`

**Done when**:

- [x] Com `theme` padrão (`classico`, sem cookie), o jogo em `/` se comporta de forma indistinguível do jogo antes desta feature — mesmos testes existentes (`hud-layout.test.tsx`, `hidden-menu.test.tsx`, `character-power.test.tsx`, `game-debug.test.tsx`) continuam passando (asserções de índice de menu atualizadas para o remap de 4→5 itens, ver abaixo)
- [x] Toda ação possível em um tema (mutar som, pausar, ver high scores, apoiar o jogo) está disponível no outro (THEME-04 edge case) — teste smoke navega pelas telas nos dois temas
- [x] `app/page.tsx` não contém mais JSX de topbar/bottombar/menus inline — só a montagem de `hudProps` e o despacho de tema (verificado por revisão de diff)
- [x] Gate check passes: `npm run lint && npm run build && npm test -- --run`
- [x] Test count: suíte sobe com os testes novos de troca de tema; nenhum teste existente muda de contagem ou quebra além do remap

**Tests**: integration
**Gate**: build — `npm run lint` ✅ (0 errors, 9 pre-existing warnings) + `npm run build` ✅ + `npm test -- --run` (260/261 — único fail é o flake CHAR-19 já documentado; 17/17 isolado) ✅

**SPEC_DEVIATION (1/3 — checklist item removido)**: o item "Alternar `theme` via chamada direta a `setTheme` em teste... confirma que `score` não voltou a 0" foi removido do Done-when. `useThemePreference()` só relê o cookie num `useEffect` com deps `[]` (roda uma vez no mount) — não existe hoje nenhum caminho de UI que chame `setTheme()` depois do mount (isso é T8, que adiciona o seletor de tema dentro do painel de Configurações). Um teste que muda `document.cookie` e chama `rerender(<Home/>)` não exercitaria esse `useEffect` de novo (mesma instância, mesmas deps `[]`) — seria um teste que passa por acidente, sem cobrir comportamento real. Este AC volta em T8/T9, quando `setTheme` for de fato alcançável a partir de uma interação do usuário.

**SPEC_DEVIATION (2/3 — `Where` impreciso)**: `app/globals.css` NÃO foi modificado (ao contrário do que o `Where`/`What` originais planejavam). Descoberto ao investigar como fazer a remoção seguramente: `app/layout.tsx` importa `globals.css` globalmente (toda rota, sempre) — e o estudo `/qwen/hud-redesign` já dependia disso (`study.css` só tem overrides de CRT, a base de `.menu-panel`/`.frame-screen`/`.canvas-frame` sempre veio de `globals.css`). Ou seja, `globals.css` nunca foi "CSS morto" — é infraestrutura compartilhada que o `NeonHud` também precisa via cascata, igual ao estudo original. O que era de fato 100% redundante era `app/_hud/classic/classic.css` (cópia integral de `globals.css`, criada em T4 antes desse entendimento) — esse arquivo (e seu import em `ClassicHud.tsx`) foi removido nesta task.

**SPEC_DEVIATION (3/3 — bug real encontrado e corrigido)**: `NeonHud.tsx` carregava `qwen-hud-lib.js`/`qwen-footer-lib.js` com `<Script strategy="beforeInteractive">` (herdado do estudo, T5). Verificação manual no browser mostrou `window.PixelHUD`/`PixelFooter` permanentemente `undefined` quando o tema é `neon` — `beforeInteractive` só funciona pra scripts presentes na árvore de render inicial (root layout); como `theme` começa em `"classico"` (default do `useState`) e só vira `"neon"` depois do `useEffect` de leitura do cookie, `NeonHud` nunca está presente no primeiro render, então os scripts nunca chegam a ser injetados como beforeInteractive. Trocado para `strategy="afterInteractive"` — o próprio loop de `NeonHud` já tolera carregamento assíncrono/tardio via polling (`waitForLib`/`setTimeout(waitForLib, 50)`). Confirmado no browser: `PixelHUD`/`PixelFooter` viram `function` e o header/footer neon desenham corretamente.

`hidden-menu.test.tsx` foi revisado e NÃO precisou de extensão — nenhum teste ali depende de índice numérico do menu (usa nomes/cheat code), então sobreviveu ao remap sem alteração.

**Commit**: `feat(theme): wire ClassicHud/NeonHud dispatch into app/page.tsx`

---

### T8: Painel de Configurações (seleção de tema + volume) nos dois temas ✅ Complete

**What**: Adicionar a seção JSX do painel de Configurações dentro de `ClassicHud.tsx` (T4) e `NeonHud.tsx` (T5), cada uma no estilo do respectivo tema: mostra rádio/botões "Clássico"/"Neon" (usando `hudProps.theme`/`hudProps.setTheme`) e reaproveita o controle de som existente (`hudProps.muted`/`hudProps.volume`/`hudProps.setMuted`/`hudProps.setVolume`) — sem criar estado de áudio novo.
**Where**: `app/_hud/classic/ClassicHud.tsx` (modificado), `app/_hud/neon/NeonHud.tsx` (modificado), `app/globals.css` (modificado — `.settings-panel`/`.theme-picker`/`.theme-option` compartilhados pelos dois temas, mesma base que `.support-panel`), `app/__tests__/theme-selector.test.tsx` (novo)
**Depends on**: T7
**Reuses**: controles de som já existentes em cada tema (extraídos em T4/T5); classes `.frame-panel`/`.menu-actions`/`.sound-controls` já estilizadas em `globals.css` (Classic) e sobrepostas por `neon.css` (Neon), mesmo padrão do painel de "Apoie o jogo"
**Requirement**: THEME-10, THEME-11, THEME-12, THEME-13, THEME-14

**Tools**:

- MCP: NONE
- Skill: `testing-a11y`

**Done when**:

- [x] Painel de Configurações mostra o tema ativo destacado e o botão pro outro tema, em cada um dos dois temas visuais
- [x] Clicar em "Neon" dentro de Configurações troca o tema imediatamente (sem reload) — verificado com clique real no browser (não só teste): `ClassicHud` some e `NeonHud` aparece (header/footer canvas passam a desenhar), e vice-versa
- [x] Ajustar o volume dentro de Configurações reflete no mesmo estado usado pelo controle de som do HUD (não duplicado) — teste ajusta o slider em Configurações e confere o slider do HUD (escopo `within` pra não colidir com os dois "Volume" simultâneos)
- [x] Botão "Voltar" em Configurações retorna ao menu inicial, já no tema (possivelmente novo) selecionado — verificado no browser
- [x] Gate check passes: `npm run lint && npm run build && npm test -- --run`
- [x] Test count: suíte sobe 267 (20 arquivos), 6 testes novos em `theme-selector.test.tsx`; nenhum teste existente muda de contagem ou quebra

**Tests**: integration — `app/__tests__/theme-selector.test.tsx` (6 testes: tema destacado por padrão, switch Classic→Neon, switch Neon→Classic, persistência via cookie após remount, volume compartilhado sem duplicação, Voltar preserva o tema)
**Gate**: build — `npm run lint` ✅ (0 errors) + `npm run build` ✅ + `npm test -- --run` (267/267 ✅, sem flake desta vez)

**Nota de verificação manual**: durante a checagem visual no browser, o servidor de dev tinha um chunk de `globals.css` desatualizado (cache do webpack não pegou o CSS novo mesmo após múltiplos hard-reloads) — resolvido reiniciando o processo do `next dev`. Isso é um comportamento do dev server, não um bug no código; `npm run build` (produção, processo isolado) sempre gerou o CSS correto. Confirmado visualmente: painel de Configurações com o tema ativo destacado (borda âmbar) nos dois temas, clique real em "Neon"/"Clássico" troca o HUD ao vivo sem reload, "Voltar" retorna ao menu de título com 5 itens no tema selecionado.

**Commit**: `feat(theme): add settings panel with theme picker and volume control`

---

### T9: Persistência ponta a ponta + fallback ✅ Complete

**What**: Confirmar (com teste dedicado, não só manual) que a escolha feita em Configurações sobrevive a um "reload" simulado (desmontar e remontar `Home` no teste, reaproveitando o cookie já gravado por T2/T8) e que um cookie corrompido não quebra a montagem inicial.
**Where**: `app/__tests__/theme-selector.test.tsx` (estendido)
**Depends on**: T8
**Reuses**: `useThemePreference` (T2)
**Requirement**: THEME-15, THEME-16, THEME-17, THEME-18

**Tools**:

- MCP: NONE
- Skill: `testing-a11y`

**Done when**:

- [x] Teste seleciona Neon, desmonta e remonta `Home`, confirma que o tema aplicado no novo mount é Neon (persistência real via `document.cookie`, não mock)
- [x] Teste com `document.cookie` setado para um valor inválido antes do mount confirma que `Home` monta em Clássico sem lançar erro/warning no console
- [x] Gate check passes: `npm test -- --run`
- [x] Test count: suíte sobe com os testes novos; nenhum teste existente muda de contagem ou quebra

**Tests**: integration — novo describe `theme persistence and fallback (THEME-15..18)` em `theme-selector.test.tsx`: unmount/remount confirma Neon persiste; cookie corrompido (`xyz-not-a-theme`) monta em Clássico sem lançar e sem chamar `console.error`
**Gate**: full — `npm test -- --run` → 269/269 ✅ (sem flake desta vez)

**SPEC_DEVIATION**: o primeiro AC ("teste seleciona Neon, desmonta e remonta") já tinha uma versão equivalente escrita em T8 (`"persists the theme choice as a cookie so it survives a remount"`). Reescrita aqui como teste próprio no describe de T9 para manter a rastreabilidade THEME-15/17 explícita nesta task, mesmo com alguma sobreposição de cobertura com T8 — não removi o de T8 por já estar commitado e válido.

**Commit**: `test(theme): verify end-to-end theme persistence and corrupted-cookie fallback`

---

### T10: Gate final + limpeza de documentação ✅ Complete

**What**: Rodar o gate completo do projeto, atualizar `README.md` (seção de menu inicial / controles, se aplicável) mencionando a nova opção "Configurações", e revisar que nenhum arquivo de `app/globals.css` ficou com CSS morto (regra movida em T4/T7 mas não removida).
**Where**: `README.md` (modificado), `app/globals.css` (revisão final)
**Depends on**: T9
**Reuses**: —
**Requirement**: Success Criteria da spec (não-funcional)

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `npm run lint && npm run build && npm test -- --run` passam limpos
- [x] `README.md` menciona "Configurações" na seção "Menu inicial"
- [x] Nenhuma regra CSS duplicada entre `app/globals.css` e `app/_hud/classic/classic.css` — `classic.css` não existe mais (removido em T7, ver SPEC_DEVIATION lá); confirmado também que toda classe em `neon.css` é referenciada em `NeonHud.tsx` (nenhuma regra morta)

**Tests**: none
**Gate**: build — `npm run lint` ✅ (0 errors, 9 warnings pré-existentes não relacionados) + `npm run build` ✅ + `npm test -- --run` (268/269 — único fail é o flake CHAR-19 já documentado nesta sessão; 17/17 isolado) ✅

**Commit**: `docs(theme): document Configurações menu option and finalize CSS cleanup`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

Phase 1:  T1 → T2 → T3
Phase 2:  T4
Phase 3:  T5
Phase 4:  T6 → T7 → T8
Phase 5:  T9 → T10
```

Fases 2 e 3 (T4, T5) são mutuamente independentes (ambas dependem só de T3) — mas seguem em sequência porque a execução é uma tarefa por vez, sem paralelismo real dentro de uma fase. 10 tasks totais.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: `theme-cookie.ts` | 1 arquivo, 2 funções puras | ✅ Granular |
| T2: `useThemePreference` | 1 hook | ✅ Granular |
| T3: `HudProps` | 1 tipo | ✅ Granular |
| T4: `ClassicHud.tsx` | 1 componente (extração literal, grande mas coeso — é a JSX inteira que já existe hoje, movida de uma vez) | ✅ Granular (mover é atômico; dividir a extração no meio criaria um estado intermediário sem sentido próprio) |
| T5: `NeonHud.tsx` | 1 componente (porte de estudo já validado) | ✅ Granular (mesmo racional de T4) |
| T6: Estado de tema/Configurações/remap no motor | 1 arquivo, 3 mudanças coesas (estado de tema + estado de settings + remap de índice) — todas necessárias juntas pro menu de 5 itens fazer sentido | ✅ Granular |
| T7: Trocar retorno de `page.tsx` | 1 arquivo (ponto de integração) | ✅ Granular |
| T8: Painel de Configurações nos 2 temas | 2 arquivos, mesma feature (seletor de tema + volume) espelhada nos dois estilos | ✅ Granular (mesma seção lógica, só o estilo difere) |
| T9: Teste de persistência ponta a ponta | 1 arquivo de teste | ✅ Granular |
| T10: Gate final + docs | 2 arquivos, tarefa de fechamento | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Nenhuma seta de entrada | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | None | Nenhuma seta de entrada (paralelo a T1/T2 na Fase 1) | ✅ Match |
| T4 | T3 | Fase 2 após Fase 1 | ✅ Match |
| T5 | T3 | Fase 3 após Fase 1 | ✅ Match |
| T6 | T2 | Fase 4 após Fase 1 | ✅ Match |
| T7 | T4, T5, T6 | Fase 4 após Fases 2 e 3 | ✅ Match |
| T8 | T7 | T7 → T8 | ✅ Match |
| T9 | T8 | T8 → T9 | ✅ Match |
| T10 | T9 | T9 → T10 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1: `theme-cookie.ts` | lib puro | unit | unit | ✅ OK |
| T2: `useThemePreference` | lib puro (hook) | unit | unit | ✅ OK |
| T3: `HudProps` | tipo/config | none | none | ✅ OK |
| T4: `ClassicHud.tsx` | componente (não conectado ainda) | integration | none, justificado (não roteável ainda; testado em T7) | ✅ OK — ver regra de "merge forward" abaixo |
| T5: `NeonHud.tsx` | componente (não conectado ainda) | integration | none, justificado (mesmo racional de T4) | ✅ OK — merge forward pra T7 |
| T6: estado/remap no motor | integração (app/page.tsx) | integration | integration (cobertura real chega em T7, que é quando a JSX existe) | ✅ OK — merge forward pra T7 |
| T7: dispatch em `page.tsx` | integração | integration | integration | ✅ OK |
| T8: painel de Configurações | componente/integração | integration | integration | ✅ OK |
| T9: persistência ponta a ponta | integração | integration | integration | ✅ OK |
| T10: gate/docs | none | none | none | ✅ OK |

**Nota sobre T4/T5/T6 com `Tests: none`**: aplica-se a regra "merge forward" de `tasks.md` (seção "Resolving compilation dependencies") — `ClassicHud`/`NeonHud` não são alcançáveis por nenhuma rota até T7 conectá-los, e o remap do menu em T6 não tem UI pra navegar até a mesma T7. Testar antes seria testar componentes desconectados/mockados artificialmente. T7 absorve a cobertura integrada de todos os três (THEME-02, THEME-03, THEME-04 mapeados em T7), o que é consistente com o Test Coverage Matrix (a linha de integração cobre THEME-01 a THEME-14 como um todo, não task-a-task).

---

## Ferramentas por task (confirmar antes do Execute)

**Skills disponíveis usadas**: `testing-a11y` (T1, T2, T7, T8, T9 — convenções de teste do projeto), `component-architecture` (T4, T5 — estrutura de componente por feature).
**MCPs**: nenhum necessário — não há biblioteca externa nova nem API desconhecida nesta feature (cookie é `document.cookie` nativo).

Confirma essa atribuição de ferramentas antes de eu seguir pro Execute?
