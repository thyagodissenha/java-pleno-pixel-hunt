# Validation — 001-alinhar-node-24

## Status atual
Veredito: PASS
Spec vigente: TASK.md (quick task, escopo Small)
HEAD: 74e5a8b6319b187a1cb0fb9df3a7685ea31b7e8f
Gaps abertos: nenhum

---

## Execução 2026-08-29 — commit range 4d1c243..74e5a8b

PASS

### Evidência por AC

- **AC1** — file: `README.md:101`, `package.json:6`.
  Assertion (spec): "a versão de Node exigida SHALL ser idêntica à declarada em `package.json` (`engines.node`)".
  Outcome esperado: README cita a mesma string de versão que `engines.node`.
  Resultado observado: `README.md:101` = `- Node.js 24.x`; `package.json:6` = `"node": "24.x"`. Strings idênticas ("24.x"). AC1 satisfeito.

- **AC2** — file: `_docs/roadmap.md:34`.
  Assertion (spec): "o item 'Alinhar a versão de Node entre README e package.json' SHALL estar marcado como concluído".
  Outcome esperado: checkbox `[ ]` → `[x]` no item correspondente.
  Resultado observado: diff do commit mostra `- [ ] Alinhar a versão de Node entre README (...)` → `+ [x] Alinhar a versão de Node entre README (...)`. Item marcado como concluído. AC2 satisfeito.

- **AC3** — comando rodado: `npm test` e `npm run build`, executados diretamente por este Verifier (não relato do worker), no HEAD do commit 74e5a8b.
  Resultado: `npm test` → 10 test files / 126 tests, todos passando (vitest v4.1.11, 2.63s). `npm run build` → `next build --webpack` compilou com sucesso, TypeScript ok, 5 páginas geradas (3 estáticas, 1 dinâmica `/api/scores`, 1 not-found), sem erros. AC3 satisfeito.

### Sensor de discriminação

Mutação temporária aplicada em `README.md:101` (via script, nunca commitada): `"Node.js 24.x"` → `"Node.js 22.13 ou superior"`. Extraído programaticamente o valor declarado no README (regex `Node\.js ([0-9.x]+)`) e comparado a `package.json` `engines.node`:

```
package.json engines.node: 24.x
README declared version: 22.13
AC1 would PASS: false
```

A mutação produziu `AC1 would PASS: false` de forma determinística — confirma que a verificação de AC1 discrimina corretamente entre estado correto e incorreto (não é vácua). Após o teste, `git checkout -- README.md` restaurou o arquivo; `git status --short` confirmou ausência de alterações rastreáveis em README.md, e `grep -n "Node.js" README.md` confirmou o conteúdo commitado (`- Node.js 24.x`) intacto.

### Escopo

`git show 74e5a8b6319b187a1cb0fb9df3a7685ea31b7e8f` lista exatamente 2 arquivos alterados: `README.md` e `_docs/roadmap.md`. Nenhum outro arquivo (incluindo `package.json`) aparece no diff do commit. `package.json:6` (`engines.node: "24.x"`) permanece inalterado, conforme previsto na tabela "Escopo dos arquivos" da TASK.md (ação = "Nenhuma mudança").

### Gaps encontrados

nenhum

---

## Code Review — 2026-08-29 — commit 74e5a8b (skill `code-review`, nível medium)

**Resultado:** aprovado, zero achados.

Diff estritamente docs-only (`README.md` 1 linha, `_docs/roadmap.md` 1 checkbox). Skill `code-review` retornou `[]`. Nenhum achado (a)/(b)/(c) a classificar.

### SonarQube (sonar-scanner CLI via Docker, `sonarsource/sonar-scanner-cli`, contra instância local `localhost:9000`)

Quality Gate: **OK**

| Métrica | Valor | Threshold |
| --- | --- | --- |
| new_violations | 0 | ≤0 |
| new_coverage | 91.8% | ≥80% |
| new_duplicated_lines_density | 1.01% | ≤3% |

Nenhuma violação nova introduzida por este commit.

### Questões abertas (débito técnico pré-existente, fora do escopo desta task — item (c), não implementado)

73 issues Sonar pré-existentes, todas em `app/page.tsx`, agrupadas por categoria:
- Cognitive complexity acima do limite em várias funções (ex.: linha 1259 com complexidade 311 vs. 15 permitido)
- `Math.random()` usado em contexto potencialmente sensível a segurança (rule `typescript:S2245`)
- Ternários aninhados prejudicando legibilidade (rule `typescript:S3358`)
- Acessibilidade: uso de `role="dialog"` em vez de `<dialog>` nativo (rule `typescript:S6819`)
- 1 issue de contraste CSS em `app/globals.css:857`

Recomendação: tratar em quick task/feature própria de refactor de `app/page.tsx`, alinhado ao item "Prioridade 2: Estabilidade e qualidade" do roadmap. Nenhuma ação necessária nesta execução.

### Veredito final

**Aprovado.** Nenhum ciclo de fix→re-verify necessário.
