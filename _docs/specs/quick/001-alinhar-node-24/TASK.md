# Quick Task 001: Alinhar versão do Node para 24.x

**Scope:** Small (≤3 arquivos, sem decisão arquitetural) — Design e Tasks pulados por regra do auto-sizing.

## Problema

`README.md` (linha 101) documenta "Node.js 22.13 ou superior" enquanto `package.json` declara `engines.node: "24.x"`. A divergência confunde quem for configurar o ambiente: não fica claro qual versão é a exigida de fato.

## Pesquisa (Knowledge Verification Chain)

- **Step 1 — Codebase:** únicas referências a versão de Node no repo são `README.md:101` e `package.json:6` (`engines.node`). Não há `.nvmrc`, `Dockerfile`, `vercel.json` nem workflows em `.github/` — nenhum outro ponto de verdade a sincronizar.
- **Step 2 — Docs do projeto:** `_docs/roadmap.md:34` já registra o item como pendência conhecida ("Alinhar a versão de Node entre README e package.json").
- **Step 3 — Context7 MCP (`/vercel/next.js/v16.2.9`):** Next.js 16 exige Node **20.9.0+** (LTS mínimo suportado; Node 18 foi descontinuado). `24.x` atende esse requisito com folga — não há conflito técnico em manter 24.x como versão-alvo.

## Decisão

Alinhar tudo para **Node 24.x**, mantendo `package.json` como fonte canônica (já correto) e corrigindo o README para citar a mesma versão.

## Escopo dos arquivos

| Arquivo | Ação |
| --- | --- |
| `README.md` | Atualizar linha 101 de "Node.js 22.13 ou superior" para "Node.js 24.x" |
| `package.json` | Nenhuma mudança — já declara `engines.node: "24.x"` |
| `_docs/roadmap.md` | Marcar o item da linha 34 como concluído |

## Acceptance Criteria

1. WHEN alguém ler o `README.md` THEN a versão de Node exigida SHALL ser idêntica à declarada em `package.json` (`engines.node`).
2. WHEN o roadmap for revisado THEN o item "Alinhar a versão de Node entre README e package.json" SHALL estar marcado como concluído.
3. WHEN `npm run build` e `npm test` forem executados após a mudança THEN ambos SHALL passar sem erro (garante que a edição não quebrou nada).

## Fora de escopo

| Item | Motivo |
| --- | --- |
| Criar `.nvmrc` | Não existe hoje no repo; não faz parte da divergência reportada |
| Adicionar CI/workflow validando engine | Repo não tem `.github/workflows`; fora do pedido original |
| Trocar a versão-alvo para 22.13 | `package.json` já está em 24.x e é compatível com Next 16 (>=20.9) — realinhar para trás não traz benefício |

## Execução planejada

Design e Tasks formais pulados (straightforward, 2 arquivos de conteúdo + 1 de tracking). Execute inline:

1. Editar `README.md:101`.
2. Marcar item no `_docs/roadmap.md`.
3. Gate: `npm test` + `npm run build` verdes.
4. 1 commit atômico.
5. Verifier fresh-eyes standalone ao final (sem sub-agent, escopo pequeno demais para justificar).
