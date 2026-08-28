# Especificação: Fase 2 — Estabilidade e Qualidade (ESTAB)

## Statement do Problema

O jogo *Java Pleno Pixel Hunt* possui o seu loop principal de gameplay funcional, mas carece de testes automatizados, ferramentas de debug interno e proteção de API. Além disso, existem alertas de build/panic com Turbopack em ambientes locais e smells de código identificados pela análise estática (SonarQube) que podem comprometer a manutenibilidade e confiabilidade do projeto à medida que novos recursos forem adicionados.

## Objetivos

- [ ] **Zero Falhas de Build:** Garantir que o comando `npm run build` execute de forma reproduzível e sem panics de bundler em Node.js 22+.
- [ ] **Ambiente de Testes / Modo Debug Interno:** Disponibilizar atalhos de desenvolvedor para spawn direto de chefes, concessão instantânea de power-ups e teste rápido das telas de vitória/derrota.
- [ ] **Proteção da API de Scores:** Adicionar sanitização com fallback seguro e limitação contra abuso no endpoint `/api/scores`.
- [ ] **Cobertura por Testes Automáticos:** Implementar testes unitários para a lógica de ranking (`high-scores.ts`), sanitização e componentes de UI.
- [ ] **Limpeza de Código e Qualidade:** Resolver code smells e avisos de lint/TypeScript mapeados durante o Code Review.

## Fora de Escopo (Out of Scope)

| Recurso | Motivo de Exclusão |
| --- | --- |
| Novos modos de jogo (Modo Infinito, Co-op) | Pertence às Prioridades 5 e 6 do Roadmap. |
| Integração ativa de anúncios em tela cheia | AdSense aguardando aprovação (Prioridade 1/3). |
| Troca do motor gráfico de HTML5 Canvas para WebGL/Phaser | Fora do escopo de estabilização do motor atual. |

---

## premissas & Perguntas Abertas (Assumptions & Open Questions)

| Premissa / Decisão | Escolha Padrão | Justificativa | Confirmado? |
| --- | --- | --- | --- |
| Modo Debug deve estar em produção? | Exclusivamente em development (`NODE_ENV === 'development'`); produção ignora `?debug=1` e eventos `CustomEvent` não autorizados | Elimina a superfície pública de cheats aprovada anteriormente e fecha o gap classificado no code review. | Sim — decisão substituída no ciclo interno 1 |
| Suíte de testes unitários | Vitest + React Testing Library | Compatível com a stack Next.js 16 / Vite existente no repositório. | Sim |
| Tratamento de erro quando Vercel Blob falhar | Fallback gracioso para localStorage com notificação visual silenciosa | O jogador não deve perder o score se a rede ou Vercel Blob falhar. | Sim |
| Throttle em produção | Armazenamento Redis compartilhado, operação atômica e TTL de 10 segundos por IP | Garante o intervalo entre instâncias serverless da Vercel. | Sim — ciclo interno 1 |
| Pendências offline | Fila separada `java-pleno-pixel-hunt-pending-scores`, contendo somente submissões criadas pelo jogador neste cliente | Impede que entradas globais/localmente exibidas sejam reenviadas como próprias. | Sim — ciclo interno 1 |
| Drenagem da fila | Sequencial no carregamento e no evento `online`, com no mínimo 10 segundos entre inícios de POST até esvaziar | Mantém ordenação, respeita o throttle e evita rajadas concorrentes. | Sim — ciclo interno 1 |
| Posse do claim idempotente | Token exclusivo por aquisição; `complete` e `release` somente alteram o claim quando o token ainda é o proprietário | Impede que um worker antigo conclua ou libere o claim adquirido por outro após expiração. | Sim — ciclo interno 2, 2026-08-28 |
| Dedupe no armazenamento autoritativo | `submissionId` persistido junto ao score e escrita condicional por ETag no Vercel Blob | Faz o Blob decidir a unicidade mesmo quando a gravação termina e a confirmação Redis falha. | Sim — ciclo interno 2, 2026-08-28 |
| Aprovação de qualidade | Quality Gate verde para código novo; dívida histórica fora do diff não bloqueia | Fecha as três violações novas S3776/S1871/S7776 sem expandir a rodada para dívida anterior. | Sim — ciclo interno 2, 2026-08-28 |

---

## User Stories

### P1: Estabilidade de Build e Suíte de Testes Unitários ⭐ MVP

**User Story**: Como desenvolvedor e mantenedor do projeto, quero que a suíte de testes valide as regras do jogo e o build passe de forma reproduzível para evitar regressões a cada novo commit.

**Por que P1**: Fundamental para garantir que alterações na arena não quebrem o cálculo de score ou o deploy na Vercel.

**Critérios de Aceite**:

1. WHEN o comando `npm run build` for executado THEN o Next.js SHALL compilar a aplicação sem erros de TypeScript, ESLint ou panics de bundler.
2. WHEN o desenvolvedor executar `npm run test` THEN o Vitest SHALL validar as funções puras de `lib/high-scores.ts` (`sanitizeScore`, `cleanScores`) garantindo limite de caracteres e ordenação correta.
3. WHEN um payload inválido for enviado para `sanitizeScore` THEN a função SHALL retornar um objeto `HighScore` válido com fallback padrão (`DEV ANON`, valores saneados).

**Teste Independente**: Execução de `npm run build && npm run test` retornando código de saída 0.

---

### P1: Modo Debug / Developer Tools para Validação de Gameplay ⭐ MVP

**User Story**: Como desenvolvedor ou testador de QA, quero atalhos de teclado em ambiente de desenvolvimento para simular fases, chefes e power-ups sem precisar jogar 20 minutos de partida.

**Por que P1**: Acelera drasticamente a verificação de bugs e validação visual de novos chefes e finais.

**Critérios de Aceite**:

1. WHEN a aplicação estiver rodando em ambiente dev (`NODE_ENV === 'development'`) THEN o jogo SHALL escutar atalhos de desenvolvedor (`F1` para toggle menu debug, `F2` para invocar boss, `F3` para conceder power-up).
2. WHEN o botão de "Spawn Boss Final" for acionado no menu debug THEN a arena SHALL transicionar imediatamente para a fase de boss com barra de vida completa.
3. WHEN a opção "Testar Tela de Vitória" for selecionada THEN o jogo SHALL encerrar a run com status `won` e abrir a tela de entrada de High Score.

**Teste Independente**: Pressionar `F1` no navegador em dev e acionar cada função de simulação.

---

### P2: Resiliência e Proteção contra Spam no Ranking de Scores

**User Story**: Como jogador e administrador do ranking, quero que a API de scores seja resiliente contra envios excessivos ou quedas do banco para que o placar permaneça confiável.

**Por que P2**: Evita sobrecarga no armazenamento Vercel Blob e previne pontuações duplicadas em massa.

**Critérios de Aceite**:

1. WHEN a variável de ambiente `BLOB_READ_WRITE_TOKEN` não estiver presente THEN a API `POST /api/scores` SHALL retornar resposta amigável sem interromper a execução com exceção não tratada.
2. WHEN requisições consecutivas de envio de score forem recebidas em curto intervalo de tempo THEN a API SHALL aplicar validação de tempo mínimo entre submissões.
3. WHEN a conexão de rede falhar no cliente THEN a aplicação SHALL salvar a pontuação no `localStorage` e tentar sincronizar posteriormente.

**Teste Independente**: Simular chamadas POST repetidas para `/api/scores` e verificar a resposta de bloqueio/fallback.

---

### P3: Refatoração de Code Smells e Organização da UI

**User Story**: Como desenvolvedor, quero que os componentes e estilos do jogo estejam organizados e sem trechos confusos de código para facilitar a manutenção futura.

**Por que P3**: Melhora o índice de mantenedor (Clean Code) e reduz os Code Smells apontados pelo SonarQube.

**Critérios de Aceite**:

1. WHEN a análise estática do SonarQube for executada THEN o número de Code Smells em `app/page.tsx` SHALL ser reduzido com a extração de estruturas condicionais ternárias aninhadas.
2. WHEN o CSS do painel legal/estilo for renderizado THEN as propriedades de altura de viewport SHALL usar `min-height: 100dvh` evitando cortes em telas mobile.

---

## Matriz de Rastreabilidade de Requisitos (Requirement Traceability)

| ID do Requisito | História / Prioridade | Fase | Status |
| --- | --- | --- | --- |
| `ESTAB-01` | P1: Estabilidade de Build | Design | Pending |
| `ESTAB-02` | P1: Suíte de Testes Unitários | Design | Pending |
| `ESTAB-03` | P1: Modo Debug / Dev Tools | Design | Pending |
| `ESTAB-04` | P2: Resiliência e Proteção na API | Design | Pending |
| `ESTAB-05` | P3: Refatoração de Code Smells | Design | Pending |
| `ESTAB-06` | P1: Fronteira de segurança do debug | Design | Pending |
| `ESTAB-07` | P1: Scores originados por debug fora do ranking | Design | Pending |
| `ESTAB-08` | P2: Throttle distribuído e atômico | Design | Pending |
| `ESTAB-09` | P2: Fila local própria e idempotente | Design | Pending |
| `ESTAB-10` | P2: Drenagem sequencial da fila | Design | Pending |
| `ESTAB-11` | P1: Evidência discriminante de boss e F3 | Design | Pending |
| `ESTAB-12` | P2: Contrato GET e sanitização da API | Design | Pending |
| `ESTAB-13` | P3: Validação mobile real | Design | Pending |
| `ESTAB-14` | P3: Semântica do diálogo de debug | Design | Pending |
| `ESTAB-15` | P3: Cobertura LCOV no Quality Gate | Design | Pending |
| `ESTAB-16` | P2: Ownership exclusivo do claim Redis | Design | Pending |
| `ESTAB-17` | P2: Dedupe autoritativa e recuperação de falha parcial | Design | Pending |
| `ESTAB-18` | P1/P2/P3: Evidência discriminante e Quality Gate verde | Design | Pending |

---

## Critérios de Sucesso

- [ ] Execução limpa do `npm run build` e `npm run test` com 100% de aprovação.
- [ ] Presença do painel de Debug funcional em ambiente de desenvolvimento (`F1`).
- [ ] Cobertura de testes unitários para a lógica de sanitização e ranking em `lib/high-scores.ts`.
- [ ] Tratamento gracioso de exceções na API de ranking com fallback local verificado.

---

## Emenda do Ciclo Interno 1 — Remediação de Estabilidade

Esta emenda preserva os requisitos e a evidência do ciclo anterior e resolve somente os gaps categoria (a) e as decisões categoria (b) registradas em `tasks.md`. Os itens categoria (c) continuam fora da implementação deste ciclo.

### Requisitos e critérios de aceite adicionais

#### `ESTAB-06` — Fronteira de segurança do debug

1. WHEN a aplicação executar com `NODE_ENV !== 'development'` THEN `isDebugAllowed()` SHALL retornar `false` para qualquer query string, inclusive `?debug=1`.
2. WHEN um `CustomEvent` com o nome de debug for recebido THEN o listener da arena SHALL revalidar `isDebugAllowed()` e SHALL executar a ação somente quando `event.detail` pertencer à allowlist `DebugAction`.
3. WHEN o ambiente não for development ou o payload do evento não pertencer à allowlist THEN o listener SHALL ignorar o evento sem alterar estado, entidades, HUD ou ranking.

#### `ESTAB-07` — Scores de runs debug fora do ranking

1. WHEN qualquer ação de debug alterar uma run THEN a run SHALL permanecer marcada como `debug` até ser reiniciada.
2. WHEN uma run marcada como `debug` terminar THEN o cliente SHALL impedir sua inclusão no ranking global e na fila de submissões pendentes.
3. WHEN `POST /api/scores` receber payload explicitamente marcado como originado por debug THEN a API SHALL rejeitá-lo sem persistir no Vercel Blob.

#### `ESTAB-08` — Throttle distribuído por IP

1. WHEN `POST /api/scores` receber a primeira submissão de um IP fora de uma janela ativa THEN a API SHALL adquirir atomicamente a chave compartilhada daquele IP com TTL de 10 segundos e processar a submissão.
2. WHEN qualquer instância da API receber nova submissão do mesmo IP enquanto a chave existir THEN a API SHALL responder HTTP `429`, `Retry-After: 10` e `{ "error": "Aguarde antes de enviar outro score.", "retryAfterMs": 10000 }`, sem persistir o score e sem renovar o TTL.
3. WHEN a chave expirar após 10 segundos THEN a próxima submissão do IP SHALL poder adquirir uma nova janela.
4. WHEN as credenciais ou o serviço Redis estiverem indisponíveis em produção THEN a API SHALL responder HTTP `503` e SHALL not persistir o score; o cliente SHALL manter a submissão na fila pendente.
5. WHEN Redis estiver indisponível fora de produção THEN a API MAY usar um armazenamento em memória com a mesma operação lógica e TTL apenas para desenvolvimento/testes, identificando esse modo em observabilidade como não distribuído.

#### `ESTAB-09` — Fila local própria, deduplicada e idempotente

1. WHEN uma submissão própria falhar por rede, HTTP `429` ou HTTP `503` THEN o cliente SHALL armazenar uma entrada na chave `java-pleno-pixel-hunt-pending-scores`, separada de `java-pleno-pixel-hunt-high-scores`.
2. WHEN uma entrada for criada THEN ela SHALL conter `version: 1`, `submissionId`, o score saneado, `enqueuedAt`, `attempts` e `lastAttemptAt`; o mesmo `submissionId` SHALL ser preservado em todos os retries e enviado no header `Idempotency-Key`.
3. WHEN a fila já contiver o mesmo `submissionId` THEN o cliente SHALL manter uma única entrada.
4. WHEN a API receber novamente um `Idempotency-Key` já concluído dentro de 24 horas THEN SHALL retornar sucesso idempotente sem inserir uma segunda ocorrência do score; o registro compartilhado de idempotência SHALL expirar após 24 horas.
5. WHEN o ranking global for carregado THEN nenhuma entrada recebida por GET SHALL ser adicionada à fila pendente.

#### `ESTAB-10` — Drenagem sequencial da fila

1. WHEN a página carregar ou o navegador emitir `online` e a fila não estiver vazia THEN o cliente SHALL iniciar uma única drenagem, sem sobrepor drenagens concorrentes.
2. WHEN uma drenagem estiver ativa THEN o cliente SHALL enviar somente a primeira entrada pendente e aguardar no mínimo 10 segundos entre o início de POSTs consecutivos até a fila ficar vazia.
3. WHEN um POST retornar sucesso persistido ou sucesso idempotente THEN o cliente SHALL remover somente a entrada correspondente e continuar com a próxima após o intervalo.
4. WHEN um POST falhar por rede, HTTP `429` ou HTTP `503` THEN o cliente SHALL incrementar `attempts`, atualizar `lastAttemptAt`, manter a entrada na fila e encerrar a drenagem atual; um próximo `load` ou `online` SHALL tentar novamente.
5. WHEN `load` e `online` ocorrerem durante uma drenagem THEN SHALL existir no máximo um POST em voo e uma única sequência de timers.

#### `ESTAB-11` — Evidência discriminante das ações de gameplay

1. WHEN “Invocar Boss” for acionado THEN o teste SHALL provar a existência de uma entidade boss real e `hp === maxHp`, falhando se `spawnEnemy("boss")` for removido.
2. WHEN F3 for pressionado em development THEN o teste da arena SHALL provar o efeito observável da criação/concessão do power-up, falhando se o side effect for removido.

#### `ESTAB-12` — Contrato de leitura e sanitização da API

1. WHEN `GET /api/scores` concluir com dados do armazenamento THEN a resposta SHALL conter somente scores saneados e ordenados pelo contrato de `cleanScores`.
2. WHEN GET encontrar registros malformados THEN SHALL aplicar os fallbacks de `sanitizeScore` sem propagar payload inválido ao cliente.
3. WHEN POST receber payload malformado THEN SHALL persistir somente o resultado saneado já definido por `sanitizeScore`.

#### `ESTAB-13` — Comportamento mobile das páginas legais

1. WHEN `/privacidade` e `/sobre` forem abertas no viewport mobile configurado no Playwright THEN cada `.legal-shell` SHALL computar `min-height: 100dvh`, permitir rolagem vertical quando o conteúdo exceder a viewport e não cortar o último conteúdo focável.

#### `ESTAB-14` — Semântica do diálogo de debug

1. WHEN o painel de debug estiver aberto THEN SHALL ser renderizado com o elemento nativo `<dialog>` aberto, nome acessível “Ferramentas de debug” e tratamento do evento de fechamento que atualize `debugOpen`.
2. WHEN a análise Sonar for executada sobre a alteração THEN a issue `typescript:S6819` associada ao diálogo customizado SHALL estar resolvida.

#### `ESTAB-15` — Cobertura LCOV no Quality Gate

1. WHEN a versão instalada do Vitest suportar o provider de cobertura configurado THEN `npm run test:coverage` SHALL gerar `coverage/lcov.info` consumível pelas propriedades Sonar existentes.
2. WHEN a análise Sonar for executada após a geração do LCOV THEN o Quality Gate SHALL importar cobertura maior que `0%`; se a compatibilidade não puder ser confirmada sem alterar a stack, a task SHALL registrar evidência e permanecer bloqueada, sem inventar provider ou formato.

### Dimensions sweep do ciclo interno 1

| Dimensão | Resolução |
| --- | --- |
| Estado / persistência | A fila pendente usa chave própria e modelo versionado; ranking exibido e fila têm ciclos de vida independentes. |
| Autorização | Debug é autorizado somente por build/runtime development; query pública e `CustomEvent` isolado não concedem autorização. |
| Rate limit | Uma submissão por IP a cada 10 segundos, coordenada por armazenamento compartilhado em produção. |
| Concorrência / ordenação | Aquisição Redis é atômica; drenagem cliente tem mutex lógico, um POST em voo e ordem FIFO. |
| TTL / lifecycle | Chave de throttle expira em 10 segundos; chave de idempotência em 24 horas; item da fila só é removido após sucesso persistido/idempotente. |
| Retry / dedupe / idempotência | `submissionId` estável, fila deduplicada por ID e API idempotente; falha conserva o item e encerra a drenagem corrente. |
| Observabilidade | Falhas Redis e uso do fallback local são registrados sem IP em claro nem payload de score; respostas mantêm status/payload determinísticos para testes. |
| Validação de entrada | Eventos debug usam allowlist; GET e POST retornam/persistem somente `HighScore` saneado. |
| Falha parcial / dependência externa | Redis indisponível em produção resulta em `503` fail-closed e fila preservada; Blob/rede indisponíveis não descartam submissão própria. |
| Integridade de transição | Run normal torna-se debug após qualquer ação debug e só volta a normal em nova run; fila transita `pending → in-flight → removed` apenas no sucesso. |

### Questões abertas preservadas — categoria (c), fora da implementação

- Limpar/limitar o `Map` local caso o fallback exclusivo de desenvolvimento seja mantido.
- Migrar o mock direto de `fetch` em `game-debug.test.tsx` para MSW.
- Conter e restaurar foco do diálogo de debug.
- Extrair a ordenação duplicada de scores para módulo puro compartilhado.
- Extrair a sincronização offline do componente monolítico `Home`.
- Usar ou remover o tipo exportado `HighScoreStorage`.

### Evidência histórica reclassificada

- `CR-F4 / ESTAB-05` está concluído como evidência: o SonarQube registrou redução de **54 para 52 Code Smells** entre `2026-08-27T10:41:07Z` e `2026-08-27T15:11:39Z`. Isso não cria fix task no ciclo interno 1.

**Cobertura após a emenda:** 15 requisitos totais; `ESTAB-06` a `ESTAB-15` seguem para Design/Tasks; `ESTAB-01` a `ESTAB-05` preservam histórico e evidências anteriores.

---

## Emenda do Ciclo Interno 2 — Integridade de Concorrência e Fechamento de Qualidade

Esta emenda preserva integralmente os requisitos e o histórico anteriores. Ela incorpora somente os fixes categoria (a) registrados pelo Verifier/code review e as três decisões categoria (b) aprovadas pelo usuário em 2026-08-28. Melhorias categoria (c) permanecem explicitamente fora da implementação.

### Requisitos e critérios de aceite adicionais

#### `ESTAB-16` — Ownership exclusivo do claim Redis

1. WHEN um `submissionId` sem estado ativo for reivindicado THEN o store SHALL criar um token de posse imprevisível e exclusivo daquela aquisição, armazená-lo no valor `in-flight` com TTL de 60 segundos e devolvê-lo ao chamador.
2. WHEN `complete` ou `release` for chamado THEN a operação SHALL usar compare-and-set/delete atômico e SHALL alterar a chave somente se o token informado for igual ao token de posse armazenado.
3. WHEN o TTL de um claim expirar e outro worker adquirir o mesmo `submissionId` com novo token THEN tentativas posteriores do worker antigo de concluir ou liberar SHALL retornar `ownership-lost`, SHALL preservar integralmente o claim novo e SHALL not marcar a submissão como concluída.
4. WHEN um token proprietário concluir o claim THEN o estado SHALL transicionar atomicamente para `completed` com TTL de 24 horas; retries do mesmo `submissionId` nesse período SHALL observar `completed` sem adquirir novo claim.
5. WHEN o store local de development/test for usado THEN SHALL aplicar as mesmas transições e verificações de token, TTL e `ownership-lost`, sem ser tratado como coordenação distribuída.

#### `ESTAB-17` — Dedupe autoritativa e recuperação de falha parcial

1. WHEN um score for persistido no Vercel Blob THEN o registro autoritativo SHALL incluir seu `submissionId`, e a resposta pública de GET SHALL continuar expondo somente o contrato `HighScore` saneado e ordenado, sem exigir migração dos registros legados que não possuem ID.
2. WHEN dois writers concorrentes lerem a mesma versão do ranking THEN cada escrita SHALL usar a ETag lida como precondição; no máximo uma escrita daquela versão SHALL vencer, e o perdedor SHALL reler o Blob, detectar `submissionId` já persistido ou reaplicar sua alteração sobre a versão mais recente antes de nova escrita condicional.
3. WHEN o Blob já contiver o mesmo `submissionId` THEN a persistência SHALL retornar sucesso idempotente com o ranking atual e SHALL not adicionar outra ocorrência, inclusive se o marcador Redis estiver ausente, expirado ou ainda `in-flight`.
4. WHEN a escrita no Blob for confirmada e `complete` no Redis falhar ou retornar `ownership-lost` THEN a API SHALL responder sucesso persistido/idempotente, SHALL not liberar claim pertencente a outro worker e um retry SHALL ser resolvido pela dedupe autoritativa sem segunda ocorrência.
5. WHEN a API responder HTTP `200` com `storage: "local"` THEN o cliente SHALL tratar a submissão como ainda pendente: no envio inicial SHALL criar/manter uma única entrada e, durante drain, SHALL manter a entrada corrente e encerrar a drenagem; somente `storage: "blob"` ou `idempotent: true` SHALL remover a pendência.
6. WHEN uma submissão própria nova falhar por rede, HTTP `429` ou HTTP `503` THEN o cliente SHALL criar imediatamente a entrada pendente com o mesmo `submissionId`; WHEN um `load` ou `online` posterior ocorrer THEN SHALL reenviar essa mesma entrada e ID, atualizando tentativa sem criar duplicata.
7. WHEN a API reconhecer um `submissionId` como `completed` THEN SHALL retornar sucesso idempotente antes de consumir a janela de throttle daquele IP, sem novo Blob write; IDs ainda não concluídos continuam sujeitos ao throttle antes de persistir.

#### `ESTAB-18` — Evidência discriminante e aprovação de qualidade

1. WHEN evento debug for recebido em production ou com action fora da allowlist THEN os testes SHALL provar conjuntamente que estado/HUD, coleção observável de entidades, chamadas POST e chaves de ranking/fila no `localStorage` permanecem inalterados.
2. WHEN `POST /api/scores` receber `origin: "debug"` ou `debug: true` THEN cada marcador SHALL produzir HTTP `400`, payload de erro definido em `ESTAB-07` e zero chamadas a throttle, idempotência ou Blob.
3. WHEN uma run debug terminar e uma nova run normal for iniciada THEN a nova run SHALL voltar a ser elegível e seu encerramento normal SHALL produzir exatamente um POST com novo `submissionId`.
4. WHEN `load` e um ou mais eventos `online` se sobrepuserem durante a drenagem THEN os testes SHALL observar no máximo um POST em voo e exatamente uma sequência de espera de 10 segundos entre entradas, sem timer concorrente adicional.
5. WHEN o E2E alterar a altura do viewport mobile entre dois valores distintos THEN o `min-height` computado de `.legal-shell` em `/privacidade` e `/sobre` SHALL acompanhar `window.innerHeight` em ambos os valores, e o último conteúdo focável SHALL permanecer visível após scroll.
6. WHEN a análise SonarQube for executada com LCOV fresco no HEAD do ciclo 2 THEN o Quality Gate para código novo SHALL estar `OK`, com `typescript:S3776` em `app/page.tsx:526`, `typescript:S1871` em `app/page.tsx:1094` e `typescript:S7776` em `lib/debug.ts:11` ausentes; issues históricas fora das linhas alteradas SHALL not bloquear este critério.

### Dimensions sweep do ciclo interno 2

| Dimensão | Resolução |
| --- | --- |
| Estado / persistência | O registro Blob passa a carregar `submissionId`; leitura pública remove metadados internos e aceita registros legados sem ID. |
| Concorrência / ordenação | Redis protege ownership por token; Blob usa ETag e retry limitado sobre versão fresca; cliente mantém mutex, FIFO e uma sequência de timers. |
| Falha / falha parcial | Blob confirmado prevalece sobre falha posterior do Redis; a API responde sucesso e o Blob resolve retries por ID. |
| Idempotência / retry | Redis oferece fast path de `completed`; Blob é a autoridade final para dedupe; cliente conserva ID em rede, 429, 503 e storage local. |
| TTL / lifecycle | Claim proprietário expira em 60 segundos; completed Redis em 24 horas; `submissionId` acompanha o score enquanto ele permanecer no ranking autoritativo. |
| Auth / abuso | Ambos os marcadores debug são rejeitados antes de throttle/persistência; parse/body throttle permanece questão categoria (c). |
| Observabilidade | `ownership-lost`, conflito ETag e falha de complete são outcomes testáveis sem expor token, payload ou IP. |
| Validação de entrada | Contrato público continua `HighScore`; `submissionId` interno é validado pelo contrato de Idempotency-Key vigente. |
| Integridade de transição | `claimed(token) → completed` exige posse; `pending → removed` exige Blob ou resposta idempotente; nova run restaura origem normal. |
| Dependência externa | APIs usadas foram confirmadas na stack instalada (`@upstash/redis` 1.38.3 e `@vercel/blob` 2.8.0); não há desvio de spec. |

### Questões abertas preservadas — categoria (c), fora da implementação do ciclo 2

- Limitar o tamanho/processamento do body e antecipar throttle ao parse de JSON inválido.
- Otimizar a drenagem O(N²) de `localStorage` carregando a fila uma única vez.
- Reduzir round trips Redis além do necessário para ownership correto.
- Adicionar cobertura de indisponibilidade/factory que não seja necessária aos ACs deste ciclo.
- Extrair a sincronização offline do componente monolítico `Home` ou extrair `Home` em componentes menores.
- Migrar mock direto de `fetch` para MSW, conter/restaurar foco do diálogo e extrair ordenação compartilhada.
- Limpar/limitar o `Map` local e usar/remover `HighScoreStorage` quando houver escopo próprio.

**Open questions:** none — as decisões de ownership, dedupe autoritativa e Quality Gate foram aprovadas pelo usuário em 2026-08-28.

**Cobertura após a emenda do ciclo 2:** 18 requisitos totais; `ESTAB-16` a `ESTAB-18` seguem para Design/Tasks, e `ESTAB-01` a `ESTAB-15` preservam requisitos e evidências históricas.
