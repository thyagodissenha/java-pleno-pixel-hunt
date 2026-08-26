# Java Pleno Pixel Hunt

Um mini jogo pixel art de arena sobre um programador Java pleno que finalmente estourou a build, pegou sua caneca de cafe e foi sobreviver ao caos corporativo: usuarios correndo atras, chefes surgindo por onda e lancamentos de dados voando pela tela como se a producao dependesse disso.

Jogue aqui: https://java-pleno-pixel-hunt.thyago-dissenha.chatgpt.site

## Ideia

Voce controla um dev Java pleno em uma arena top-down. O objetivo e sobreviver, derrotar os chefes da empresa e escapar dos perigos que aparecem durante as ondas.

O jogo mistura humor de desenvolvimento, correria de go-live e aquele leve desespero de quando alguem diz: "so sobe esse ajuste rapidinho".

## Gameplay

- Movimento em arena top-down
- Tiro automatico contra o inimigo mais proximo
- Usuarios perseguindo o jogador
- Chefes com mais vida e ataques especiais
- Projetis/obstaculos inspirados em Azure, SQL, CI/CD, Kafka, BI e deploys
- Sistema de vida, pontuacao, ondas e vitoria
- Tela HIGH SCORES com nome do jogador
- Ranking local salvo no navegador
- Visual pixel art desenhado em Canvas
- Suporte a teclado e toque

## Controles

| Acao | Teclado |
| --- | --- |
| Mover | `WASD` ou setas |
| Rajada | `Espaco` |
| Pausar | `Esc` |
| Iniciar/reiniciar | `Enter` ou toque na arena |

No celular ou tablet, arraste na arena para mover o personagem.

## Ranking

Ao final da partida, o jogo solicita o nome do jogador e salva o resultado em uma tela **HIGH SCORES** inspirada em arcades classicos.

Nesta versao, o ranking fica gravado no `localStorage` do navegador. Isso significa que cada aparelho/navegador mantem sua propria lista de pontuacoes.

## Stack

- React
- Next.js
- TypeScript
- HTML5 Canvas
- Tailwind CSS
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
  page.tsx       # Logica do jogo e renderizacao do Canvas
  globals.css    # Visual arcade/pixel art da pagina
  layout.tsx     # Metadados e layout base
public/
  favicon.svg
```

## Observacao

Este projeto e uma satira bem-humorada sobre vida de desenvolvimento de software. Qualquer semelhanca com sprints, go-lives, incidentes, releases emergenciais e reunioes infinitas talvez nao seja coincidencia.
