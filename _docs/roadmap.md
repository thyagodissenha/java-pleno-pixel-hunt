# Roadmap do Java Pleno Pixel Hunt

Este roadmap organiza as próximas melhorias do jogo a partir do estado atual: o core arcade já está jogável, o ranking global existe, a monetização via AdSense está preparada e o site tem páginas básicas de confiança para revisão.

## Estado atual

- [x] Jogo principal em arena top-down com teclado, mouse/toque e tiro automático.
- [x] Ondas, chefes, boss final, escolha final e ciclo de novo chamado.
- [x] Reset exibido no score e aumento de dificuldade por rodada.
- [x] Obstáculos temáticos por fase, afetando jogador e tiros.
- [x] Power-ups coletáveis por contato, incluindo escolhas finais.
- [x] Ranking global com fallback local.
- [x] Menu inicial, high scores, instruções, pausa e saída do jogo.
- [x] UI em frame arcade com topo, arena e rodapé.
- [x] Som, música chiptune, mute e volume.
- [x] Espaço "Apoie o jogo" estruturado.
- [x] Google AdSense integrado no `head` e `/ads.txt` autorizado.
- [x] Páginas `/privacidade` e `/sobre` publicadas.

## Prioridade 1: Aprovação e confiança

- [ ] Aguardar aprovação do AdSense.
- [ ] Acompanhar mensagens do painel do AdSense e ajustar política/conteúdo se houver reprovação.
- [ ] Criar uma página ou seção de contato mais clara, com GitHub, e-mail público ou formulário simples.
- [ ] Revisar a Política de Privacidade após anúncios reais começarem a aparecer.
- [ ] Decidir se o site continuará em `vercel.app` ou se terá domínio próprio.

## Prioridade 2: Estabilidade e qualidade

- [ ] Investigar o panic local do Turbopack no `npm run build`.
- [ ] Definir versão final de Node para produção e alinhar README, `package.json` e Vercel.
- [ ] Adicionar testes leves para regras críticas do jogo: spawn de boss, coleta de power-up, reset, ranking e obstáculos.
- [ ] Criar um modo debug/teste para validar power-ups e finais sem precisar jogar uma run inteira.
- [ ] Adicionar proteção simples contra spam no ranking.
- [ ] Monitorar vulnerabilidades sem usar `npm audit fix --force` às cegas.

## Prioridade 3: Monetização sem atrapalhar o jogo

- [ ] Após aprovação, criar bloco manual de anúncio no AdSense.
- [ ] Colocar anúncio apenas em pontos seguros: topo, tela inicial, pausa ou pós-jogo.
- [ ] Evitar anúncios dentro da arena e evitar qualquer formato que possa gerar clique acidental.
- [ ] Transformar o painel "Apoie o jogo" em uma área real com Pix, link de apoio ou patrocínio.
- [ ] Medir se anúncios prejudicam tempo de jogo, carregamento ou experiência mobile.

## Prioridade 4: Conteúdo e apresentação

- [ ] Criar screenshots oficiais para README, Vercel, Itch.io e redes sociais.
- [ ] Criar thumbnail/capa em formatos específicos para Itch.io, LinkedIn e X.
- [ ] Melhorar o README com imagens, GIF curto e links para jogar.
- [ ] Criar um trailer curto ou GIF de gameplay.
- [ ] Adicionar licença.
- [ ] Marcar uma versão `v1.0.0` quando gameplay, ranking e monetização estiverem estáveis.

## Prioridade 5: Retenção e compartilhamento

- [ ] Criar tela final compartilhável com score, onda, resets e meme da run.
- [ ] Adicionar botões de compartilhamento para LinkedIn, WhatsApp e X.
- [ ] Criar ranking semanal ou temporadas.
- [ ] Adicionar conquistas simples.
- [ ] Criar daily challenge com seed fixa por dia.
- [ ] Separar rankings por modo de jogo quando existirem novos modos.

## Prioridade 6: Expansão de gameplay

- [ ] Criar modo infinito.
- [ ] Adicionar novos power-ups com sinergias.
- [ ] Adicionar novos tipos de obstáculos e hazards por bioma.
- [ ] Criar temas visuais alternativos, como startup, banco legado, hackathon e escritório remoto.
- [ ] Adicionar cosméticos sem vantagem competitiva, como skins de estagiário, pleno, sênior, tech lead e arquiteto.
- [ ] Avaliar multiplayer local ou co-op no futuro.

## Prioridade 7: Crescimento e produto

- [ ] Publicar uma página no Itch.io.
- [ ] Avaliar patrocínio ou product placement com marcas dev, bootcamps, plataformas de vagas e ferramentas de desenvolvimento.
- [ ] Explorar uma versão corporativa/branded para eventos, recrutamento, onboarding e hackathons.
- [ ] Oferecer ranking privado, assets customizados e desafios personalizados na versão corporativa.
- [ ] Avaliar pacote premium sem anúncios, com skins exclusivas, modos extras e ranking customizado.

## Próxima entrega recomendada

Criar um modo interno de debug/teste para power-ups, boss, reset e final da partida. Isso reduz o tempo de validação de cada mudança e evita regressões em mecânicas centrais.

Depois disso, preparar screenshots e thumbnail para deixar o projeto mais apresentável enquanto o AdSense termina a revisão.

## Aposta de monetização recomendada

Manter a versão web gratuita como porta de entrada. Usar AdSense de forma leve e controlada, sem anúncios durante o gameplay. Em paralelo, testar apoio direto, patrocínio dev e uma futura versão branded para empresas. Essa rota preserva a experiência do jogo e não depende só de anúncios, que tendem a pagar pouco no início.
