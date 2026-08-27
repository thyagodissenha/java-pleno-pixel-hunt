# Contexto: estabilidade-qualidade — ciclo interno 1

**Coletado em:** 2026-08-27
**Spec:** `_docs/specs/features/estabilidade-qualidade/spec.md`
**Status:** Ready for design

---

## Limite da feature

Remediar os gaps categoria (a) do ciclo anterior e incorporar as decisões aprovadas para debug, throttle distribuído e fila offline. Os itens categoria (c) permanecem documentados como questões abertas e não entram em implementação neste ciclo.

## Decisões confirmadas

### Segurança do debug

- Debug existe somente em `NODE_ENV === 'development'`.
- Produção não aceita `?debug=1` como autorização e ignora eventos de debug não autorizados ou com payload fora da allowlist.
- Qualquer run alterada por debug é marcada e nunca entra no ranking global nem na fila pendente.

### Throttle distribuído

- Produção usa armazenamento compartilhado compatível com Vercel.
- A aquisição por IP é atômica e a chave expira em 10 segundos sem renovação quando uma tentativa é bloqueada.
- Falha ou ausência do armazenamento compartilhado em produção fecha o POST com `503`; o cliente preserva a submissão.
- Fallback em memória é permitido apenas em development/testes e deve ser identificável como não distribuído.

### Fila offline

- A chave é `java-pleno-pixel-hunt-pending-scores` e contém somente submissões próprias.
- Cada entrada mantém um `submissionId` estável, usado para dedupe local e idempotência da API.
- A drenagem é FIFO, sequencial, disparada no load/online e mantém pelo menos 10 segundos entre inícios de POST até esvaziar.
- Falhas conservam o item e encerram a drenagem atual; gatilhos concorrentes não criam POSTs concorrentes.

### Discrição técnica delimitada

- Nomes de helpers e divisão interna de módulos podem seguir os padrões do repositório, desde que os contratos da spec e do design sejam preservados.
- Logs podem usar a infraestrutura padrão do runtime, sem IP em claro nem payload de score.

## Questões abertas preservadas — categoria (c)

- Limite/limpeza do `Map` de fallback local.
- Migração do mock direto de `fetch` para MSW em `game-debug.test.tsx`.
- Contenção/restauração de foco do diálogo de debug.
- Extração da ordenação compartilhada, da sincronização offline de `Home` e decisão sobre `HighScoreStorage`.

## Referências específicas

- Evidência Sonar histórica: 54 → 52 Code Smells; `CR-F4` concluído como evidência.
- Fila pendente: `java-pleno-pixel-hunt-pending-scores`.
- Intervalo e TTL do throttle: 10 segundos por IP.

## Ideias deferidas

Nenhuma além das questões categoria (c) preservadas acima.
