# Validation — 002-sonar-cheat-code-violations

## Status atual
Veredito: PASS
Spec vigente: TASK.md (quick task, escopo Small)
HEAD: 86f1c36
Gaps abertos: nenhum

---

## Execução 2026-08-29 — commit range 7cc2929..86f1c36

PASS

### Evidência por AC

- **AC1** — `app/page.tsx:2080`. Assertion (spec): "o elemento raiz SHALL ser uma tag `<dialog>` nativa, não uma `<div role="dialog">`". Resultado observado: `<dialog open className="frame-screen" aria-label={frameScreenLabel(menuPanel)}>` (antes: `<div className="frame-screen" role="dialog" aria-label={...}>`). AC1 satisfeito.
- **AC2** — `app/page.tsx:157-161` (nova função `frameScreenLabel`) + `app/page.tsx:2080` (chamada). Assertion: "a lógica SHALL estar numa função nomeada fora do JSX, não num ternário aninhado inline". Resultado: `frameScreenLabel(panel: MenuPanel)` extraída para module scope, com 2 `if` sequenciais (sem ternário aninhado); JSX chama `frameScreenLabel(menuPanel)`. AC2 satisfeito.
- **AC3** — `app/__tests__/hidden-menu.test.tsx` (7 testes que usam `screen.getByRole("dialog", { name: ... })` sobre esse painel). Resultado: `npm test -- --run` → 195/195 passando, mesma contagem de antes da mudança — nenhuma consulta `getByRole("dialog", ...)` precisou de ajuste, confirmando que `<dialog>` nativo expõe o mesmo papel implícito na accessibility tree que `role="dialog"` explícito. AC3 satisfeito.
- **AC4** — `lib/__tests__/cheat-codes.test.ts:36`. Resultado: `expect(buffer).toHaveLength(5)` no lugar de `expect(buffer.length).toBe(5)`. AC4 satisfeito.
- **AC5** — comandos rodados diretamente neste HEAD: `npm run lint` → 0 erros (2 warnings pré-existentes não relacionados: `coverage/lcov-report/block-navigation.js`, `lib/debug.ts:26`); `npm run build` → compilou limpo, 5 rotas geradas; `npm test -- --run` → 195/195 (mesma contagem da `main` antes desta mudança). AC5 satisfeito.

### Sensor de discriminação

Reversão temporária de AC1/AC2 (`git stash` do commit, não commitada): voltei `<dialog open ...>` para `<div role="dialog" aria-label={frameScreenLabel(menuPanel)}>` e rodei uma consulta `axe`-equivalente manual — o `role="dialog"` explícito também passaria nas queries `getByRole` (não discrimina no nível de teste automatizado), então a evidência real de AC1/AC2 é o Sonar em si (métrica objetiva, não um teste unitário): re-scan com o código revertido reproduziria as 2 violações `S6819`/`S3358` — confirmado indiretamente pelo scan original (que efetivamente detectou essas 2 regras nesse exato trecho antes do fix, ver seção SonarQube abaixo) e pela ausência delas após o fix. Restaurado com `git stash pop` + confirmação de `git diff` vazio contra o commit `86f1c36`.

Para AC4, mutação: `expect(buffer).toHaveLength(5)` → `expect(buffer).toHaveLength(6)` — teste falhou como esperado (assertion killed). Revertido.

### Escopo

`git show 86f1c36 --stat`: `app/page.tsx` (1 função nova + 1 troca de tag), `lib/__tests__/cheat-codes.test.ts` (1 linha), `_docs/specs/quick/002-sonar-cheat-code-violations/TASK.md` (novo). Nenhum outro arquivo tocado — em particular, nada em `_docs/specs/features/sistema-personagens/` (feature em branch separada, não afetada).

### Gaps encontrados

nenhum

---

## SonarQube — 2026-08-29 — commit 86f1c36

Quality Gate: **OK** (era `ERROR` antes do fix).

| Métrica | Antes (branch sistema-personagens, `32a656d`) | Depois (`86f1c36`) | Threshold |
| --- | --- | --- | --- |
| new_violations | 3 | **0** | ≤0 |
| new_coverage | 92.3% | 91.9% | ≥80% |
| new_duplicated_lines_density | 0.76% | 0.83% | ≤3% |

`api/issues/search?inNewCodePeriod=true` retorna `total: 0` — confirma que nenhuma das 3 issues (`S6819`, `S3358`, `S5906`) persiste, e nenhuma issue nova foi introduzida pelo fix.

### Veredito final

**Aprovado.** Nenhum ciclo de fix→re-verify necessário — implementação correta na primeira tentativa.

---

## Code Review — 2026-08-29 — commit 86f1c36 (skill `code-review`, nível medium)

**1 achado real, corrigido:**

`app/page.tsx:2080` — trocar `<div role="dialog">` por `<dialog open>` herda o stylesheet padrão do navegador para `<dialog>` (`width/height: fit-content; margin: auto`). `.frame-screen` (`app/globals.css:403`) só define `position: absolute; inset: 0`, sem `width`/`height`/`margin` explícitos — suficiente para uma `<div>` esticar full-bleed via `inset:0`, mas não anula o `fit-content` do `<dialog>` nativo. Resultado: o painel encolheria para o tamanho do conteúdo e centralizaria (via `margin:auto`), em vez de cobrir a tela inteira — regressão visual real que os testes em jsdom não detectam (não calculam layout CSS).

**Fix**: adicionado `width: 100%; height: 100%; margin: 0;` a `.frame-screen` (`app/globals.css:403-410`), restaurando o comportamento full-bleed original. Gate re-rodado após o fix: `npm run lint && npm run build && npm test -- --run` → PASS, 195/195.

**Nota registrada, não corrigida (fora do escopo desta task)**: `.pause-menu-overlay` (`app/globals.css:426`, usado pelo `<dialog>` de debug já existente antes desta sessão) tem a mesma lacuna (`inset:0` sem `width`/`height` explícitos) — mesma causa raiz, mas é código pré-existente não tocado por este quick fix. Recomendado tratar numa task própria se confirmado como bug real em produção (o painel de debug só roda em `NODE_ENV=development`, então o impacto prático é menor).

### Veredito final (revisado)

**Aprovado, com 1 ciclo de fix aplicado antes do fechamento.** Gate re-confirmado PASS após o fix de CSS.
