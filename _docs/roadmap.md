# Roadmap do Java Pleno Pixel Hunt

Este roadmap organiza as próximas melhorias do jogo a partir do estado atual: o core arcade já está jogável, o ranking global tem proteção distribuída contra abuso, a monetização via AdSense foi corrigida após reprovação e está pronta para nova revisão, e o site tem páginas básicas de confiança para revisão.

## Estado atual

- [x] Jogo principal em arena top-down com teclado, mouse/toque e tiro automático.
- [x] Ondas, chefes, boss final, escolha final e ciclo de novo chamado.
- [x] Reset exibido no score e aumento de dificuldade por rodada.
- [x] Obstáculos temáticos por fase, afetando jogador e tiros.
- [x] Power-ups coletáveis por contato, incluindo escolhas finais.
- [x] Ranking global com fallback local, idempotência e ledger particionado contra duplicação.
- [x] Proteção distribuída contra spam no ranking: throttle por IP (10s) e preflight antiabuso (60 req/min) via Redis.
- [x] Modo debug interno (`F1`/`F2`/`F3`, restrito a `development`) para spawn de boss, concessão de power-up e teste de telas de vitória/derrota sem jogar uma run inteira.
- [x] Suíte de testes automatizados (Vitest + Testing Library + Playwright) cobrindo ranking, sanitização, modo debug (boss, power-up, reset) e páginas legais em mobile.
- [x] Build usa `next build --webpack` para evitar o panic do Turbopack visto localmente.
- [x] Menu inicial, high scores, instruções, pausa e saída do jogo.
- [x] UI em frame arcade com topo, arena e rodapé.
- [x] Som, música chiptune, mute e volume.
- [x] Espaço "Apoie o jogo" estruturado, sem placeholders "em breve" — contato real via GitHub até existir Pix/patrocínio de fato.
- [x] Google AdSense corrigido após reprovação por "anúncios em telas sem conteúdo do editor": script reativado, banner manual só aparece durante gameplay ativo (`gameState === "playing"`), nunca em menu/pausa/apoio/fim de jogo. `NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT_ID` já configurado na Vercel; falta `NEXT_PUBLIC_GOOGLE_ADSENSE_BANNER_SLOT` (só existe após aprovação, quando o bloco manual for criado no painel).
- [x] Páginas `/privacidade` e `/sobre` publicadas, com `min-height: 100dvh` validado em mobile.

## Prioridade 1: Aprovação e confiança

- [x] Corrigir a causa da reprovação "anúncios em telas sem conteúdo do editor" — banner manual restrito ao gameplay ativo, placeholders removidos.
- [ ] Pedir nova revisão do AdSense (site já está no estado corrigido, pronto para submissão).
- [ ] Acompanhar mensagens do painel do AdSense e ajustar política/conteúdo se houver nova reprovação.
- [ ] Criar uma página ou seção de contato mais clara, com GitHub, e-mail público ou formulário simples.
- [ ] Revisar a Política de Privacidade após anúncios reais começarem a aparecer.
- [ ] Decidir se o site continuará em `vercel.app` ou se terá domínio próprio.

## Prioridade 2: Estabilidade e qualidade

- [x] Alinhar a versão de Node entre README (`22.13 ou superior`) e `package.json` (`engines.node: "24.x"`) — hoje estão divergentes.
- [x] Adicionar teste leve para obstáculos temáticos (boss, power-up, reset e ranking já têm cobertura; obstáculos ainda não têm nenhum teste).
- [x] Monitorar vulnerabilidades sem usar `npm audit fix --force` às cegas.
- [x] Migrar o mock direto de `fetch` em `game-debug.test.tsx` para MSW, seguindo o padrão já usado no restante da suíte.
- [x] Extrair a sincronização offline do componente monolítico `Home` (`app/page.tsx`) em módulos menores.

## Prioridade 3: Monetização sem atrapalhar o jogo

- [x] Definir e implementar o posicionamento seguro do anúncio: banner abaixo do canvas, visível só durante gameplay ativo (nunca em tela inicial, pausa, apoio ou fim de jogo — essas são justamente as telas "sem conteúdo" que causaram a reprovação).
- [ ] Após aprovação, criar bloco manual de anúncio no AdSense e configurar `NEXT_PUBLIC_GOOGLE_ADSENSE_BANNER_SLOT` na Vercel.
- [ ] Desativar Auto ads no painel do AdSense (evita o Google reposicionar anúncios automaticamente fora do banner manual).
- [ ] Evitar qualquer formato que possa gerar clique acidental (banner já fica fora da área de toque/clique da arena).
- [ ] Transformar o painel "Apoie o jogo" em uma área real com Pix, link de apoio ou patrocínio.
- [ ] Medir se o banner prejudica tempo de jogo, carregamento ou experiência mobile.

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

Pedir a nova revisão do AdSense (site já corrigido) e, em paralelo, preparar screenshots/thumbnail para deixar o projeto mais apresentável enquanto a revisão corre.

## Aposta de monetização recomendada

Manter a versão web gratuita como porta de entrada. Usar AdSense de forma leve e controlada: banner único, restrito ao gameplay ativo, sem Auto ads e sem sobrepor a arena. Em paralelo, testar apoio direto, patrocínio dev e uma futura versão branded para empresas. Essa rota preserva a experiência do jogo e não depende só de anúncios, que tendem a pagar pouco no início.
