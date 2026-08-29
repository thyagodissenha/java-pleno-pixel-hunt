# Java Pleno Pixel Hunt

Um mini jogo pixel art de arena sobre um programador Java pleno que finalmente estourou a build, pegou sua caneca de café e foi sobreviver ao caos corporativo: usuários correndo atrás, chefes surgindo por onda e lançamentos de dados voando pela tela como se a produção dependesse disso.

Jogue aqui: https://java-pleno-pixel-hunt.vercel.app

## Ideia

Você controla um dev Java pleno em uma arena top-down. O objetivo é sobreviver, derrotar os chefes da empresa e escapar dos perigos que aparecem durante as ondas.

O jogo mistura humor de desenvolvimento, correria de go-live e aquele leve desespero de quando alguém diz: "só sobe esse ajuste rapidinho".

## Gameplay

- Movimento em arena top-down
- Tiro automático contra o inimigo mais próximo
- Usuários perseguindo o jogador
- Chefes com mais vida e ataques especiais
- Padrões de ataque diferentes por chefe
- Boss final maior, com 3 fases e 3 barras de vida
- Inimigos especiais: QA nervoso, usuário VIP, incidente P1 e legado sem teste
- Projéteis/obstáculos inspirados em Azure, SQL, CI/CD, Kafka, BI e deploys
- Power-ups: café, refactor, rollback, hotfix, code review e sprint
- Escolha final entre a cilada da promoção e atender um novo chamado
- Progressão de arma por onda, indo de JDK 8 para JDK 17 e JDK 21
- Biomas por fase: Escritório, Produção, Cloud e War Room
- Sistema de vida, pontuação, ondas e vitória
- Tela HIGH SCORES com nome do jogador
- Ranking global via API
- Fallback local no navegador quando o servidor estiver indisponível
- Menu inicial com acesso ao ranking e instruções
- Curva de ondas balanceada para reduzir picos injustos
- Feedback visual de dano, tremida de tela e aviso de chefe
- Botão de mute/volume com efeitos sonoros via Web Audio
- Música chiptune gerada no navegador durante a partida
- Visual pixel art desenhado em Canvas, com animações simples e tela de vitória arcade
- Tela inicial pixel art funcional, com cenas e botões reais do menu
- Suporte a teclado e toque

## Controles

| Ação | Teclado |
| --- | --- |
| Mover | `WASD` ou setas |
| Rajada | `Espaço`, consumindo estamina |
| Pausar | `Esc` |
| Iniciar/reiniciar | `Enter` ou toque na arena |

No celular ou tablet, arraste na arena para mover o personagem.

## Power-ups

- **Café** aumenta a velocidade por alguns segundos.
- **Refactor** acelera os tiros.
- **Rollback** remove ameaças próximas que não sejam chefes.
- **Hotfix** recupera vida.
- **Code Review** cria uma janela de proteção e melhora o dano.
- **Sprint** recupera 5% da estamina de rajada se ela ainda não estiver cheia.

## Menu inicial

A tela inicial tem acesso rápido para iniciar a partida, abrir o ranking global e consultar os controles antes de jogar.

## Ranking

Ao final da partida, o jogo solicita o nome do jogador e salva o resultado em uma tela **HIGH SCORES** inspirada em arcades clássicos.

Em produção, o ranking usa a rota `/api/scores` e persiste os resultados com Vercel Blob quando a variável `BLOB_READ_WRITE_TOKEN` está configurada.

Em desenvolvimento local, o ranking usa `data/high-scores.json`. Se a API global estiver indisponível no navegador, o jogo salva uma cópia local em `localStorage`.

## Monetização

O projeto já está preparado para Google AdSense. Configure na Vercel a variável:

```text
GOOGLE_ADSENSE_PUBLISHER_ID=pub-0000000000000000
```

Também funciona se o valor vier no formato `ca-pub-0000000000000000`; o projeto normaliza automaticamente.

Com a variável configurada, o layout adiciona a meta tag `google-adsense-account`, carrega o script do AdSense e expõe o arquivo `/ads.txt` com o publisher ID correto.

O banner de anúncio manual (abaixo da arena) só aparece durante o gameplay ativo (`gameState === "playing"`) — nunca em telas de menu, pausa, apoio ou fim de jogo, para não violar a política de "anúncios em telas sem conteúdo do editor". Ele exige duas variáveis adicionais (públicas, pois o client ID de AdSense já é exposto no HTML de qualquer forma):

```text
NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT_ID=ca-pub-0000000000000000
NEXT_PUBLIC_GOOGLE_ADSENSE_BANNER_SLOT=0000000000
```

O slot é o ID do bloco de anúncio manual criado no painel do AdSense. Sem as duas variáveis configuradas, o banner simplesmente não renderiza.

**Importante:** com blocos manuais em uso, desative "Anúncios automáticos" (Auto ads) nas configurações do site no painel do AdSense — caso contrário o Google pode continuar posicionando anúncios automaticamente em telas sem conteúdo (menu, pausa, apoio), reproduzindo a violação original.

## Stack

- React
- Next.js
- TypeScript
- HTML5 Canvas
- Web Audio API
- Tailwind CSS
- Vercel Blob
- Vinext / Sites

## Rodando localmente

Requisitos:

- Node.js 24.x
- npm

Instale as dependências:

```bash
npm install
```

Inicie o servidor local:

```bash
npm run dev
```

Abra:

```text
http://localhost:3000
```

## Build

Para gerar a versão de produção:

```bash
npm run build
```

## Estrutura principal

```text
app/
  api/scores/    # API do ranking global
  page.tsx       # Lógica do jogo e renderização do Canvas
  globals.css    # Visual arcade/pixel art da página
  layout.tsx     # Metadados e layout base
lib/
  high-scores.ts # Persistência e validação do ranking
public/
  favicon.svg
```

## Observação

Este projeto é uma sátira bem-humorada sobre vida de desenvolvimento de software. Qualquer semelhança com sprints, go-lives, incidentes, releases emergenciais e reuniões infinitas talvez não seja coincidência.
