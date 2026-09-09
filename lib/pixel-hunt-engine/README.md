# `lib/pixel-hunt-engine/`

Motor de jogo de Java Pleno Pixel Hunt: física, colisão, IA de inimigos, spawn e
renderer de canvas, extraídos de `app/page.tsx` (ver
`_docs/specs/features/motor-de-jogo-modular/spec.md` e `design.md`). Nenhum
arquivo aqui importa `react` ou chama `setState` — `app/page.tsx` é o único
consumidor, e só interage com o motor através de `orchestrator.ts`
(`createEngine`).

Todo conteúdo de jogo (o fluxo normal — ondas → chefe → escolha final → novo
chamado — e a fase secreta "O Mainframe") é modelado como uma **Phase**:
uma unidade plugável que implementa a interface `EnginePhase`
(`phases/phase.ts`). O `Orchestrator` só sabe orquestrar "qual Phase está
ativa agora" — ele não conhece o conteúdo de nenhuma Phase específica.

Este guia explica como adicionar uma nova Phase.

## O contrato `EnginePhase`

```ts
// lib/pixel-hunt-engine/phases/phase.ts
export type EnginePhase = {
  readonly id: "normal-run" | "secret-mainframe";
  enter(world: EngineWorld, ctx: PhaseContext): void;
  update(world: EngineWorld, ctx: PhaseContext, input: InputState, delta: number): FrameEvents;
  draw(ctx: CanvasRenderingContext2D, world: EngineWorld): void;
  isComplete(world: EngineWorld): boolean;
  handleDebugAction?(action: DebugAction, world: EngineWorld, ctx: PhaseContext): void;
  resolveFinalChoiceClick?(world: EngineWorld, ctx: PhaseContext, x: number, y: number): FrameEvents | null;
};
```

Os 4 métodos obrigatórios:

- **`enter(world, ctx)`** — chamado uma vez quando a Phase se torna ativa
  (`Orchestrator.start()`/`startSecretRun()`, ver `beginRun` em
  `orchestrator.ts`). Reseta/prepara `world` para o começo desta Phase:
  posiciona o jogador, popula `world.enemies`/`world.obstacles` iniciais, e
  inicializa `world.phaseState` com o formato de estado interno que só esta
  Phase conhece (ver "Estado privado da Phase" abaixo).
  Exemplo real: `NormalRunPhase.enter` (`phases/normal-run/index.ts`) chama
  `resetWaveOne`, `spawnObstacles` e spawna os 5 inimigos iniciais da onda 1.

- **`update(world, ctx, input, delta)`** — chamado uma vez por frame
  (`Orchestrator.tick`), só quando a run está ativa e não pausada. Faz a
  Phase avançar um passo de simulação: decide spawn por tempo, delega física
  a `stepWorld` (`physics.ts`, reaproveitado por qualquer Phase — colisão,
  movimento e tiro não são reimplementados por Phase), e reage aos
  `FrameEvents` que `stepWorld` devolve para atualizar seu próprio
  `localGameState`. Devolve `FrameEvents` (o mesmo tipo que `stepWorld`
  devolve) para o `Orchestrator`.
  Exemplo real: `NormalRunPhase.update` chama `runSpawnTimers`, depois
  `stepWorld`, e trata `events.bossDefeated`/`events.gameOver`/
  `events.gameWon` para decidir se a Phase continua "playing" ou terminou.

- **`draw(ctx, world)`** — chamado uma vez por frame (mesmo quando pausado,
  para a tela não congelar em branco), depois de `update`. Delega o desenho
  ao `renderer.ts` compartilhado (`drawFrame`), passando o `ViewState`
  específico da Phase (qual `gameState` local mostrar, qual personagem, etc).
  Nenhuma Phase deve desenhar diretamente no `CanvasRenderingContext2D` fora
  de `renderer.ts` — todo o desenho de entidades (`drawFrame`,
  `drawPlayer`, `drawEnemy`, ...) já existe lá e é reaproveitado.

- **`isComplete(world)`** — lido pelo `Orchestrator`/HUD para saber se a
  Phase chegou a um estado terminal (over/won/promotion/o que fizer sentido
  para a Phase). Puro: só lê `world` (via `world.phaseState`), não muda nada.

Os métodos opcionais:

- **`handleDebugAction?(action, world, ctx)`** — chamado pelo
  `Orchestrator.handleDebugAction` quando o modo debug (`F1`/`F2`/`F3`,
  `lib/debug.ts`) dispara uma ação (`spawn_boss`/`add_powerup`/
  `max_stamina`/`win_game`/`reset`) enquanto esta Phase está ativa. Uma
  Phase que não tem nada de especial a fazer para essas ações pode omitir o
  método por completo (é opcional no tipo) — o `Orchestrator` já trata
  `"toggle_menu"` sozinho e não chama o método nesse caso.

- **`resolveFinalChoiceClick?(world, ctx, x, y)`** — chamado por
  `Orchestrator.resolveFinalChoiceClick` quando o jogador clica/toca
  diretamente no canvas (fora do loop de `tick()`), para resolver a escolha
  final no mesmo evento de clique, sem esperar a colisão passiva do próximo
  frame (`ENGINE-16`). Recebe as coordenadas do clique já convertidas para o
  espaço do mundo; se acertar um power-up de escolha final dentro do raio de
  clique, aplica o mesmo efeito que a colisão teria e devolve os
  `FrameEvents` resultantes (`promotionClaimed`/`newCallRequested`); caso
  contrário devolve `null`. Uma Phase que não tem escolha final (como
  `SecretMainframePhase`) pode omitir o método por completo — o
  `Orchestrator` trata a ausência como "nenhum power-up acertado" e devolve
  `null` ao chamador, sem lançar erro. Uma exceção lançada dentro deste
  método é capturada pelo mesmo boundary de erro de `tick()` (`ENGINE-12`/
  `ENGINE-23`) e nunca propaga para o chamador de
  `Engine.resolveFinalChoiceClick`.
  Exemplo real: `NormalRunPhase.resolveFinalChoiceClick`
  (`phases/normal-run/index.ts`) delega a
  `physics.resolveFinalChoiceClickPowerUp` e, se houver acerto, reusa a
  mesma `applyFinalChoiceOutcome` que `update()` chama para a colisão
  passiva.

## Estado privado da Phase: `world.phaseState`

`EngineWorld.phaseState` é tipado como `unknown` de propósito — o motor
genérico (`Orchestrator`, `physics.ts`, `renderer.ts`) não conhece o formato
de estado "de tela" de nenhuma Phase específica. Cada Phase define seu
próprio tipo interno e faz um type guard para lê-lo de volta. Exemplo real
(`phases/normal-run/index.ts`):

```ts
type NormalRunPhaseState = {
  localGameState: "playing" | "choice" | "over" | "won" | "promotion";
};

function readState(world: EngineWorld): NormalRunPhaseState {
  const existing = world.phaseState as NormalRunPhaseState | null;
  if (existing && typeof existing === "object" && "localGameState" in existing) return existing;
  const fresh: NormalRunPhaseState = { localGameState: "playing" };
  world.phaseState = fresh;
  return fresh;
}
```

`SecretMainframePhase` (`phases/secret-mainframe/index.ts`) segue o mesmo
padrão com seu próprio formato de estado — as duas Phases não compartilham
nem conhecem o formato uma da outra.

## Exemplo mínimo: uma Phase nova

```ts
// lib/pixel-hunt-engine/phases/my-new-phase/index.ts
import { stepWorld } from "@/lib/pixel-hunt-engine/physics";
import { drawFrame, type ViewState } from "@/lib/pixel-hunt-engine/renderer";
import type { EnginePhase, PhaseContext } from "@/lib/pixel-hunt-engine/phases/phase";
import type { EngineWorld, FrameEvents, InputState } from "@/lib/pixel-hunt-engine/types";

type MyNewPhaseState = { localGameState: "playing" | "over" | "won" };

function readState(world: EngineWorld): MyNewPhaseState {
  const existing = world.phaseState as MyNewPhaseState | null;
  if (existing && typeof existing === "object" && "localGameState" in existing) return existing;
  const fresh: MyNewPhaseState = { localGameState: "playing" };
  world.phaseState = fresh;
  return fresh;
}

export function createMyNewPhase(): EnginePhase {
  return {
    id: "my-new-phase", // precisa ser adicionado à union de EnginePhase["id"] (ver abaixo)

    enter(world: EngineWorld, ctx: PhaseContext) {
      world.phaseState = { localGameState: "playing" } satisfies MyNewPhaseState;
      // popular world.player / world.enemies / world.obstacles aqui
    },

    update(world: EngineWorld, ctx: PhaseContext, input: InputState, delta: number): FrameEvents {
      const state = readState(world);
      const events = stepWorld(world, input, delta, ctx.audio);
      if (events.gameOver) state.localGameState = "over";
      if (events.gameWon) state.localGameState = "won";
      return events;
    },

    draw(ctx: CanvasRenderingContext2D, world: EngineWorld) {
      const state = readState(world);
      const view: ViewState = { character: ctx.character, gameState: state.localGameState, runOrigin: "normal", menuPanel: "home" };
      drawFrame(ctx, world, view);
    },

    isComplete(world: EngineWorld): boolean {
      return readState(world).localGameState !== "playing";
    },
  };
}
```

## Registrando a Phase no `Orchestrator`

`orchestrator.ts` é o único lugar que sabe instanciar Phases — nenhum outro
módulo do motor importa `normal-run`/`secret-mainframe` diretamente. Para
registrar uma nova Phase:

1. **Alargar a union de `id`** em `phases/phase.ts`:
   ```ts
   readonly id: "normal-run" | "secret-mainframe" | "my-new-phase";
   ```
2. **Importar a factory** em `orchestrator.ts`:
   ```ts
   import { createMyNewPhase } from "@/lib/pixel-hunt-engine/phases/my-new-phase";
   ```
3. **Expor um jeito de iniciar essa Phase**, seguindo o padrão de
   `start()`/`startSecretRun()` (ambas só chamam o helper privado
   `beginRun(phase, origin)`, que recria `world`, chama `phase.enter(...)` e
   atualiza `runOrigin`):
   ```ts
   function startMyNewPhase(): EngineSnapshot {
     return beginRun(createMyNewPhase(), "my-new-origin"); // RunOrigin também precisa incluir esse valor (types.ts)
   }
   ```
4. **Adicionar o método ao tipo `Engine`** (e ao objeto retornado no final
   de `createEngine`) para que `app/page.tsx` consiga chamá-lo — mesmo
   padrão de `startSecretRun` hoje (cheat `idclip`).
5. Se a nova Phase precisa de rótulos de HUD (biome/boss/upgrade) diferentes
   dos usados por `buildSnapshot()`, estender os `isSecret ? ... : ...`
   ternários de `buildSnapshot()` com mais um branch (`runOrigin ===
   "my-new-origin" ? ... : ...`), do mesmo jeito que hoje distingue
   `normal` de `secret`.

Nenhuma outra mudança no `Orchestrator` é necessária: `tick()`,
`handleDebugAction()`, `pause()/resume()`, `activateSpecialPower()` etc. já
operam sobre `activePhase` de forma genérica (via os métodos de
`EnginePhase`), sem conhecer qual Phase está ativa.
