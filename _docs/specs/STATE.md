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

---

## Handoff Snapshot

- **Feature Atual:** `estabilidade-qualidade-fase2` — **Verified (PASS)**, sem pendência bloqueante.
- **Fase Atual:** Execute (Concluído) → Verificação (PASS, HEAD `488012d`, 13/13 ACs) → **Pendente**: nenhuma. Próximo passo é decisão do usuário sobre nova feature/escopo.
- **Especificação:** [`_docs/specs/features/estabilidade-qualidade-fase2/spec.md`](file:///Volumes/SSD_Externo/repo_personal/java-pleno-pixel-hunt/_docs/specs/features/estabilidade-qualidade-fase2/spec.md)
- **Design:** [`_docs/specs/features/estabilidade-qualidade-fase2/design.md`](file:///Volumes/SSD_Externo/repo_personal/java-pleno-pixel-hunt/_docs/specs/features/estabilidade-qualidade-fase2/design.md)
- **Tarefas:** [`_docs/specs/features/estabilidade-qualidade-fase2/tasks.md`](file:///Volumes/SSD_Externo/repo_personal/java-pleno-pixel-hunt/_docs/specs/features/estabilidade-qualidade-fase2/tasks.md)
- **Validação:** [`_docs/specs/features/estabilidade-qualidade-fase2/validation.md`](file:///Volumes/SSD_Externo/repo_personal/java-pleno-pixel-hunt/_docs/specs/features/estabilidade-qualidade-fase2/validation.md)

> Feature anterior `estabilidade-qualidade` (sem sufixo, Fase 1) também está concluída — ver `_docs/specs/features/estabilidade-qualidade/` se precisar de histórico dela.
