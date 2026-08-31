# Estado do Projeto e Registro de Decisões (STATE.md)

## Decisões Ativas de Arquitetura (ADR / Decisions Log)

| ID | Data | Título | Decisão | Status |
| --- | --- | --- | --- | --- |
| `AD-001` | 2026-08-27 | Organização das Especificações | Utilização do layout flat `_docs/specs/` com `tlc-spec-driven` | Confirmado |
| `AD-002` | 2026-08-27 | Integração com SonarQube | Projeto `java-pleno-pixel-hunt` registrado no SonarQube local em `http://localhost:9000` | Confirmado |
| `AD-003` | 2026-08-27 | Escopo da Fase 2 | Foco em Estabilidade, Qualidade de Código, Modo Debug e Cobertura por Testes | Em Andamento |
| `AD-004` | 2026-08-29 | Janela de dedupe assimétrica (ledger 24h vs ranking top 10) | Resolvido via quick fix: comportamento aceito por design (dedupe escopado a "enquanto o score permanecer no ranking"), fixado por teste de regressão em `high-scores.test.ts`. Ver `spec.md` seção "Quick Fix — 2026-08-29" e `validation.md`. | Confirmado |
| `AD-005` | 2026-08-29 | Quick fix `ESTAB-19` AC4 | Teste de `score-abuse-preflight.ts` passou a derivar a decisão do texto real do script Lua (em vez de reimplementar a cota em JS); mutante `count <= limit` confirmado morto. | Confirmado |
| `AD-006` | 2026-08-29 | Quick fix apodrecimento de teste `readRankingSnapshot` | Teste "returns snapshot ETags..." passou a passar `now` explícito em vez de depender do relógio real; corrige falha por passagem de calendário sem relação com código de produção. | Confirmado |
| `AD-007` | 2026-08-29 | Bug de produção: ranking duplicado visualmente | Causa raiz: `GET /api/scores` reaplicava `sanitizeScore` (que sempre estampa `createdAt: now`) sobre scores já persistidos, colapsando o `createdAt` de todos os registros e quebrando a `key` React no cliente. Corrigido com `sanitizePublicScore` (preserva `createdAt` válido). Reportado pelo usuário em produção, confirmado via JSON cru de `/api/scores`. | Confirmado |
| `AD-008` | 2026-08-29 | `app/page.tsx` não aceita exports nomeados extras | `app/page.tsx` é um arquivo de rota do Next.js App Router — o type-check gerado (`.next/types/app/page.ts`) só permite um conjunto fixo de exports nomeados (`default`, `metadata`, `generateStaticParams` etc.). Qualquer função/constante pura que precise ser exportada para teste direto SHALL viver em `lib/` (ou outro módulo não-rota), nunca ser exportada direto de `app/page.tsx`. Descoberto durante Execute de `estabilidade-qualidade-fase2` T1 (`npm run build` falhava com `TS2344` ao exportar `obstacleCount`). | Confirmado |
| `AD-009` | 2026-08-30 | Temas de HUD: split presentacional, motor não migra | O motor do jogo (estado/refs/o `useEffect` de física de ~1300 linhas) permanece em `app/page.tsx`, inalterado — só a JSX de apresentação (topbar/bottombar/telas de menu) é extraída para componentes de tema fora de rota (`app/_hud/[tema]/`, prefixo `_` ignorado pelo App Router), recebendo um único tipo `HudProps` do motor. Escolhido em vez de extrair o motor inteiro pra um hook (`useGameEngine`) por risco: mover o `useEffect` gigante teria superfície de regressão alta demais pra um jogo já publicado (ver `AD-006`/`AD-007`, bugs nascidos de refactors menores). Qualquer tema futuro segue o mesmo padrão `app/_hud/[tema]/`. Ver `_docs/specs/features/sistema-de-temas-hud/design.md`. | Confirmado |

---

## Handoff Snapshot

- **Feature Atual:** `sistema-de-temas-hud` (branch `study/hud-redesign`) — **Verified (PASS)**, sem pendência bloqueante. 10/10 tasks completas, 17/18 ACs batem o outcome exato do spec (THEME-09 é um spec-precision gap não-bloqueante, documentado — troca de tema em corrida ativa é um caminho inalcançável nesta versão, o próprio spec já marca isso). Sensor de discriminação 3/3 killed.
- **Fase Atual:** Execute (Concluído) → Verificação (PASS, HEAD `f698005`) → **Pendente**: nenhuma. SonarQube local rodado (quality gate ERROR em "new code" — causa raiz é o período de comparação "new code" do Sonar contar TODO o branch `study/hud-redesign` como novo, incluindo semanas de trabalho exploratório anterior a esta feature, não apenas os commits T1-T10; não investigado a fundo, decisão de remediar ou não fica com o usuário). Próximo passo é decisão do usuário: mergear pra `main`, remediar achados do Sonar, ou aposentar as rotas de estudo `/qwen/hud-redesign` e `/clude/hud-redesign` agora que o tema Neon está ao vivo em `/`.
- **Especificação:** [`_docs/specs/features/sistema-de-temas-hud/spec.md`](file:///Volumes/SSD_Externo/repo_personal/java-pleno-pixel-hunt/_docs/specs/features/sistema-de-temas-hud/spec.md)
- **Design:** [`_docs/specs/features/sistema-de-temas-hud/design.md`](file:///Volumes/SSD_Externo/repo_personal/java-pleno-pixel-hunt/_docs/specs/features/sistema-de-temas-hud/design.md)
- **Tarefas:** [`_docs/specs/features/sistema-de-temas-hud/tasks.md`](file:///Volumes/SSD_Externo/repo_personal/java-pleno-pixel-hunt/_docs/specs/features/sistema-de-temas-hud/tasks.md)
- **Validação:** [`_docs/specs/features/sistema-de-temas-hud/validation.md`](file:///Volumes/SSD_Externo/repo_personal/java-pleno-pixel-hunt/_docs/specs/features/sistema-de-temas-hud/validation.md)

> Feature anterior `estabilidade-qualidade-fase2` (branch `main`) também está concluída — ver `_docs/specs/features/estabilidade-qualidade-fase2/` se precisar de histórico dela. `estabilidade-qualidade` (Fase 1, sem sufixo) também concluída.
