# Context — Estabilidade e Qualidade Fase 2

Decisões do usuário para as zonas cinzentas identificadas durante o scan de código no Specify.

## 1. Escopo do teste de obstáculos

**Gray area**: `obstacleCount` é pura e testável direto; `obstacleTemplates`/`spawnObstacles`/`obstacleBlocksCircle` vivem dentro do closure do game loop (não são módulo-level).

**Decisão**: teste leve, só cobrindo o que já é puro (`obstacleCount`, `circleIntersectsRect`, `pointInRect`). Extrair a lógica de spawn/posicionamento fica fora de escopo desta fase.

**Rationale do usuário**: bate com a redação original do roadmap ("teste leve"); extrair spawn é um refactor maior que se sobrepõe ao item do `Home` monolítico.

## 2. Escopo da extração do `Home`

**Gray area**: as funções puras de sync (load/save de scores, merge, postPendingScore etc.) já estão soltas no arquivo — só não estão em `lib/`. `drainPendingScores`/`refreshHighScores` continuam presas ao componente porque chamam `setState` direto.

**Decisão**: mover só as ~14 funções já puras para `lib/score-sync.ts`. Não criar hook custom (`useScoreSync()`) para encapsular as duas funções que tocam estado.

**Rationale do usuário**: menor risco; funções que tocam `setState`/`useRef` exigiriam redesenhar o fluxo (fora do apetite desta fase, que é sobre estabilidade, não sobre uma nova arquitetura de hooks).

## 3. Escopo do item de vulnerabilidades

**Gray area**: `npm audit` está zerado agora — não há nada para "corrigir". O item podia virar só documentação ou também ferramenta.

**Decisão**: adicionar script `npm run audit` ao `package.json` + parágrafo de política no README/CLAUDE.md.

**Rationale do usuário**: preferiu ferramentar em vez de só documentar, para o comando existir pronto na próxima vez que precisar.

## Ordem de execução (decidida antes do Specify, na conversa)

O refactor do `Home` (extração para `lib/score-sync.ts`) é a fase de maior risco de regressão entre as quatro. Fica por último na sequência de fases do Design/Tasks, para que os itens independentes (obstáculos, MSW, auditoria) não fiquem bloqueados se o refactor precisar de um ciclo fix→re-verify.
