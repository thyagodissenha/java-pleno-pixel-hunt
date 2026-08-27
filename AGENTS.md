<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# AGENTS.md

## 1. Papel do agente

Este projeto utiliza agentes para apoiar planejamento, especificação, implementação, QA, documentação e organização operacional.

Cada agente deve atuar dentro da sua frente de responsabilidade, respeitando o escopo da tarefa, os documentos canônicos do projeto e as regras de governança definidas no repositório.

---

## 2. Fontes de orientação

Antes de executar qualquer tarefa, o agente deve verificar se existe orientação aplicável em:

```text
.agents/rules/
.agents/skills/
_docs/specs/
```

Quando houver conflito entre documentos, seguir esta prioridade:

```text
1. Instrução direta do usuário
2. Documentos canônicos mais recentes do projeto
3. PRD/TDD/SDD/SPEC relacionados à tarefa
4. Regras em .agents/rules/
5. Skills em .agents/skills/[pasta-da-skill]/SKILL.md
6. Convenções locais do código existente
```

O agente não deve improvisar comportamento que contradiga PRD, TDD, SDD, SPEC ou regras explícitas.

### Spec-driven outputs (TLC)

Artefatos gerados pela skill `tlc-spec-driven` devem usar **somente** o layout flat em `_docs/specs/`.

Resumo obrigatório:

- Raiz: `_docs/specs/` (nunca `.specs/`, `project/` ou `codebase/`)
- Projeto: `_docs/specs/PROJECT.md`, `ROADMAP.md`, `STATE.md`, `HANDOFF.md`
- Features: `_docs/specs/features/[feature]/{spec,context,design,tasks}.md`
- Quick tasks: `_docs/specs/quick/NNN-slug/{TASK,SUMMARY}.md`

---

## 3. Uso de rules

Arquivos em `.agents/rules/` definem regras obrigatórias de governança.

O agente deve usar uma rule quando a tarefa envolver padrões, limites, convenções ou restrições do projeto.

---

## 4. Uso de skills

Arquivos em `.agents/skills/[pasta-da-skill]/SKILL.md` definem procedimentos operacionais estruturados.

O agente deve usar uma skill quando a tarefa exigir uma execução passo a passo ou a transformação de especificações técnicas em artefatos concretos.

Skills disponíveis:

| Skill | Quando usar |
|---|---|
| `code-review` | Review multi-dimensional de código (branch, PR, uncommitted) |
| `tlc-spec-driven` | Planejar features com fases Specify→Design→Tasks→Execute |
| `modular-design-principles` | Avaliar ou redesenhar estrutura modular |
| `decomposition-planning-roadmap` | Criar roadmap de decomposição ou migração |
| `break-prd-tdd-sdd-into-linear-issues` | Quebrar specs em issues atômicas rastreáveis |
| `component-architecture` | Criar/revisar componentes React, estrutura por feature, acessibilidade |
| `testing-a11y` | Escrever/revisar testes unitários (Vitest + Testing Library) ou E2E (Playwright) |
| `modular-decomposition` | Pipeline de análise monolith→modular (Patterns 1–5) |

---

## 5. Regras gerais de execução

O agente deve:

1. Ler a demanda antes de executar.
2. Identificar a frente responsável.
3. Verificar documentos relacionados.
4. Verificar regras e skills aplicáveis.
5. Não expandir escopo sem necessidade explícita.
6. Declarar dependências, riscos e bloqueios quando existirem.
7. Preservar rastreabilidade entre documento, issue, implementação, QA e docs.
8. Entregar saída objetiva, utilizável e compatível com o fluxo do projeto.

---

## 6. Regras para tarefas de implementação

Quando a tarefa envolver código, o agente deve:

- Entender o comportamento esperado antes de alterar arquivos.
- Preservar contratos existentes, salvo instrução contrária.
- Evitar mudanças amplas e não relacionadas.
- Atualizar ou criar testes quando aplicável.
- Informar arquivos alterados.
- Informar comandos de teste executados.
- Registrar riscos ou pendências.

---

## 7. Regras para QA

Quando a tarefa envolver QA, o agente deve validar a entrega contra:

```text
PRD
TDD
SDD
SPEC
Critérios de aceite da issue
Regras em .agents/rules/
Comportamento real do sistema
```

O QA deve apontar:

- Aprovado
- Aprovado com ressalvas
- Reprovado
- Evidências
- Riscos
- Ações recomendadas

---

## 8. Regras para documentação

Quando a tarefa envolver documentação, o agente deve:

- Manter consistência com o comportamento real do sistema.
- Não documentar funcionalidades inexistentes.
- Atualizar roteiros operacionais quando uma entrega mudar comandos, APIs, telas ou fluxos.
- Escrever instruções executáveis por alguém que não conhece previamente os comandos.

---

## 9. Regra final

O agente deve favorecer entregas pequenas, rastreáveis e verificáveis.

Sempre que uma tarefa estiver grande demais, quebrar em partes menores seguindo:

```text
PRD -> TDD -> SDD -> Implementação -> QA -> Docs
```

---

## 10. Stack do projeto

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19 + HTML5 Canvas + Web Audio API
- **Estilo:** Tailwind CSS 4
- **Linguagem:** TypeScript 5.9
- **Deploy:** Vercel (Blob para ranking)
- **Testes:** Vitest + Testing Library + Playwright (quando aplicável)
