# Quick Task 002: Corrigir violações do SonarQube herdadas da feature de cheat code

**Scope:** Small (3 arquivos, sem decisão arquitetural) — Design e Tasks pulados por regra do auto-sizing.

## Problema

Um scan do SonarQube local rodado durante a validação da feature `sistema-personagens` (branch separada) reportou Quality Gate `ERROR` por 3 violações de "new code". Investigação confirmou (via `git blame`) que nenhuma pertence a `sistema-personagens` — as 3 vêm do commit `15f7f55` (feature de cheat-code hidden menu, já mergeada na `main`), fora do escopo daquela feature. Corrigir aqui, na `main`, isolado.

## Pesquisa (Knowledge Verification Chain)

- **Step 1 — Codebase:** `git blame -L 2073,2080 app/page.tsx` confirma as linhas 2074-2080 (o `<div role="dialog" ...>` do painel `frame-screen`) todas atribuídas a `15f7f55f`. `lib/__tests__/cheat-codes.test.ts` inteiro pertence ao mesmo commit (`git log --oneline -- lib/__tests__/cheat-codes.test.ts`).
- **Step 2 — Docs do projeto:** `_docs/specs/features/sistema-personagens/validation.md` (seção "SonarQube 2026-08-29") já documenta os 3 achados exatos com `file:line`, regra e severidade — usado como fonte primária aqui, sem precisar re-rodar o scan antes do fix.
- **Step 3 — Context7 MCP:** não necessário — nenhuma API externa nova envolvida; são ajustes de JSX/TSX e uma troca de matcher do Vitest, já usados no projeto.

## As 3 violações e a correção

| # | Arquivo:linha | Regra | Severidade | Correção |
| --- | --- | --- | --- | --- |
| 1 | `app/page.tsx:2076` | `S6819` — usar `<dialog>` nativo em vez de `role="dialog"` | MAJOR | Trocar a `<div role="dialog" ...>` do painel `frame-screen` (scores/skins/help) por `<dialog open aria-label={...}>`. Mesma classe CSS (`frame-screen`), mesmo conteúdo interno — só a tag muda. |
| 2 | `app/page.tsx:2078` | `S3358` — extrair ternário aninhado | MAJOR | Extrair o `aria-label` (3 ramos: "scores"/"skins"/"help") para uma função auxiliar `frameScreenLabel(panel: MenuPanel)` fora do componente, chamada como `frameScreenLabel(menuPanel)`. |
| 3 | `lib/__tests__/cheat-codes.test.ts:36` | `S5906` — assertion genérica | MINOR | Trocar `expect(buffer.length).toBe(5)` por `expect(buffer).toHaveLength(5)`. |

## Acceptance Criteria

1. WHEN o painel `frame-screen` (scores/skins/help) é renderizado THEN o elemento raiz SHALL ser uma tag `<dialog>` nativa, não uma `<div role="dialog">`.
2. WHEN o `aria-label` do painel `frame-screen` é calculado THEN a lógica SHALL estar numa função nomeada fora do JSX, não num ternário aninhado inline.
3. WHEN os testes de `hidden-menu.test.tsx`/`character-power.test.tsx`-equivalentes (nesta branch, só `hidden-menu.test.tsx` existe) consultam esse painel via `getByRole("dialog", ...)` THEN a consulta SHALL continuar funcionando sem alteração (papel implícito de `<dialog>` já é `dialog` na accessibility tree).
4. WHEN o teste "truncates the buffer..." em `cheat-codes.test.ts` roda THEN a asserção de tamanho SHALL usar `toHaveLength`, não `.length` + `toBe`.
5. WHEN `npm run lint && npm run build && npm test -- --run` roda após a mudança THEN todos SHALL passar sem erro, mesma contagem de testes de antes.

## Fora de escopo

| Item | Motivo |
| --- | --- |
| As outras 75 issues pré-existentes do Sonar (`sinceLeakPeriod`) | Débito técnico anterior a toda a sessão atual, não fazem parte do achado específico desta rodada (só as 3 marcadas como "new_violations" do Quality Gate) |
| Re-rodar o scan do SonarQube nesta branch | A instância local não suporta análise por branch (Community Edition); a confirmação de que a issue sumiu será por leitura de código + gate de testes, não por novo scan comparativo |
| Mexer em `sistema-personagens` | Feature em branch própria, não mergeada ainda — este fix é independente, na `main` |
