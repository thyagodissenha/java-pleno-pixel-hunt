# Java Pleno Pixel Hunt

Um mini jogo pixel art de arena sobre um programador Java pleno que finalmente estourou a build, pegou sua caneca de cafe e foi sobreviver ao caos corporativo: usuarios correndo atras, chefes surgindo por onda e lancamentos de dados voando pela tela como se a producao dependesse disso.

Jogue aqui: https://java-pleno-pixel-hunt.vercel.app

## Ideia

Voce controla um dev Java pleno em uma arena top-down. O objetivo e sobreviver, derrotar os chefes da empresa e escapar dos perigos que aparecem durante as ondas.

O jogo mistura humor de desenvolvimento, correria de go-live e aquele leve desespero de quando alguem diz: "so sobe esse ajuste rapidinho".

## Gameplay

- Movimento em arena top-down
- Tiro automatico contra o inimigo mais proximo
- Usuarios perseguindo o jogador
- Chefes com mais vida e ataques especiais
- Padroes de ataque diferentes por chefe
- Inimigos especiais: QA nervoso, usuario VIP, incidente P1 e legado sem teste
- Projetis/obstaculos inspirados em Azure, SQL, CI/CD, Kafka, BI e deploys
- Power-ups: cafe, refactor, rollback, hotfix e code review
- Progressao de arma por onda, indo de JDK 8 para JDK 17 e JDK 21
- Biomas por fase: Escritorio, Producao, Cloud e War Room
- Sistema de vida, pontuacao, ondas e vitoria
- Tela HIGH SCORES com nome do jogador
- Ranking global via API
- Fallback local no navegador quando o servidor estiver indisponivel
- Menu inicial com acesso ao ranking e instrucoes
- Curva de ondas balanceada para reduzir picos injustos
- Feedback visual de dano, tremida de tela e aviso de chefe
- Botao de mute/volume com efeitos sonoros via Web Audio
- Musica chiptune gerada no navegador durante a partida
- Visual pixel art desenhado em Canvas, com animacoes simples e tela de vitoria arcade
- Arte de tela inicial em pixel art integrada ao menu
- Suporte a teclado e toque

## Controles

| Acao | Teclado |
| --- | --- |
| Mover | `WASD` ou setas |
| Rajada | `Espaco` |
| Pausar | `Esc` |
| Iniciar/reiniciar | `Enter` ou toque na arena |

No celular ou tablet, arraste na arena para mover o personagem.

## Power-ups

- **Cafe** aumenta a velocidade por alguns segundos.
- **Refactor** acelera os tiros.
- **Rollback** remove ameacas proximas que nao sejam chefes.
- **Hotfix** recupera vida.
- **Code Review** cria uma janela de protecao e melhora o dano.

## Menu inicial

A tela inicial tem acesso rapido para iniciar a partida, abrir o ranking global e consultar os controles antes de jogar.

## Ranking

Ao final da partida, o jogo solicita o nome do jogador e salva o resultado em uma tela **HIGH SCORES** inspirada em arcades classicos.

Em producao, o ranking usa a rota `/api/scores` e persiste os resultados com Vercel Blob quando a variavel `BLOB_READ_WRITE_TOKEN` esta configurada.

Em desenvolvimento local, o ranking usa `data/high-scores.json`. Se a API global estiver indisponivel no navegador, o jogo salva uma copia local em `localStorage`.

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

- Node.js 22.13 ou superior
- npm

Instale as dependencias:

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

Para gerar a versao de producao:

```bash
npm run build
```

## Estrutura principal

```text
app/
  api/scores/    # API do ranking global
  page.tsx       # Logica do jogo e renderizacao do Canvas
  globals.css    # Visual arcade/pixel art da pagina
  layout.tsx     # Metadados e layout base
lib/
  high-scores.ts # Persistencia e validacao do ranking
public/
  favicon.svg
```

## Observacao

Este projeto e uma satira bem-humorada sobre vida de desenvolvimento de software. Qualquer semelhanca com sprints, go-lives, incidentes, releases emergenciais e reunioes infinitas talvez nao seja coincidencia.
