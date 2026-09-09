// Único ponto que `app/page.tsx` importa. Guarda o `EngineWorld`, sabe qual
// `EnginePhase` está ativa, expõe o ciclo `tick`. Porta `tick()`/`syncHud()`/
// `onDebugAction` (`app/page.tsx:740-782`, `1211-1254`, `2478-2517`), reusa
// `NormalRunPhase` (T10) e `SecretMainframePhase` (T13), inclui o boundary
// de captura de erro (ENGINE-12). Nenhum import de `react`.

import { resolveCharacter, type CharacterDefinition } from "@/lib/characters";
import { createAudioEngine } from "@/lib/pixel-hunt-engine/audio";
import { triggerActivePower } from "@/lib/pixel-hunt-engine/physics";
import type { EnginePhase, PhaseContext } from "@/lib/pixel-hunt-engine/phases/phase";
import { createNormalRunPhase } from "@/lib/pixel-hunt-engine/phases/normal-run";
import { bossKillTarget, bossNames } from "@/lib/pixel-hunt-engine/phases/normal-run/wave-progression";
import { createSecretMainframePhase } from "@/lib/pixel-hunt-engine/phases/secret-mainframe";
import type {
  DebugAction,
  EngineSnapshot,
  EngineWorld,
  GameState,
  InputState,
  RunOrigin,
  SoundName,
} from "@/lib/pixel-hunt-engine/types";

const WORLD = { width: 960, height: 540 };
const BURST_STAMINA_MAX = 100;
// Rótulos de "bioma" exibidos no HUD — puramente de apresentação (o motor
// genérico não conhece esse conceito), duplicado aqui do array homônimo de
// `app/page.tsx:154` pelo mesmo motivo documentado em outros módulos (ver
// design.md § Tech Decisions): evita acoplar `orchestrator.ts` a um módulo
// de `normal-run/` só para 4 strings de UI.
const biomeNames = ["Escritório", "Produção", "Cloud", "War Room"];

export type EngineOptions = {
  character: CharacterDefinition;
  // Reservados para consumidores futuros (ex.: canvas responsivo) — o
  // motor hoje sempre simula sobre o mundo fixo 960x540 (`WORLD`, igual a
  // `physics.ts`/`renderer.ts`/`spawn.ts`), então não são usados
  // internamente ainda. Mantidos na assinatura por fidelidade ao contrato
  // de `createEngine` do design.md § Components.
  canvasWidth: number;
  canvasHeight: number;
};

export type Engine = {
  tick(now: number, input: InputState, ctx: CanvasRenderingContext2D): EngineSnapshot;
  // Devolvem o snapshot recém-criado (elaboração sobre o `void` do
  // design.md § Components — `start()`/`startSecretRun()` substituem
  // `start()`/`startSecretRun()` originais, que terminavam com
  // `stateRef.current = "playing"; setGameState("playing"); ...
  // syncHud();`, uma atualização SÍNCRONA do HUD, no mesmo evento que
  // disparou o start — ex.: o cheat `idclip` precisa mostrar "Em combate"
  // no mesmo tick de teste, sem esperar o próximo `requestAnimationFrame`).
  start(): EngineSnapshot;
  startSecretRun(): EngineSnapshot;
  handleDebugAction(action: DebugAction): EngineSnapshot;
  setAudioPrefs(prefs: { muted: boolean; volume: number }): void;
  setCharacter(characterId: string): void;
  pause(): void;
  resume(): void;
  // Volta ao estado "menu" sem recriar/resetar o mundo — porta
  // `returnToTitle()` (`app/page.tsx:538-555`), que hoje só faz
  // `stateRef.current = "menu"` e para a música, sem tocar no mundo (ele
  // fica "congelado" onde estava até o próximo `start()`/`startSecretRun()`
  // recriá-lo). Precisa de um método próprio porque, diferente do código
  // original (onde `stateRef` era a única fonte de verdade, mutável
  // livremente por `page.tsx`), `currentGameState()` agora é computado a
  // partir de `started`/`paused`/`phaseState` — sem isto, o próximo
  // `tick()` reescreveria "menu" de volta para o estado real da Phase
  // (ex.: "over"/"won") ainda congelada no mundo.
  returnToMenu(): void;
  // Repasses finos para o `AudioEngine` compartilhado (dono único de
  // `AudioContext` no motor, ver design.md § Tech Decisions) — necessários
  // porque vários pontos de `app/page.tsx` que permanecem 100% UI (start
  // do menu, navegação, envio de score) tocam efeitos sonoros hoje, e
  // criar um segundo `AudioEngine` só para isso duplicaria o
  // `AudioContext` do navegador.
  playSound(sound: SoundName): void;
  startMusic(): void;
  stopMusic(): void;
  // Ativa o poder especial do personagem (tecla "Q", evento de borda de
  // subida — não é um estado contínuo de `InputState`, ver o comentário de
  // `triggerActivePower` em `physics.ts`). Só tem efeito com uma run ativa
  // e não pausada (`gameState === "playing"`), replicando o guard que
  // existia dentro da própria função no código original antes da extração.
  // Devolve o snapshot atualizado (igual a `handleDebugAction`) porque o
  // original chamava `syncHud()` no fim de `triggerActivePower()` — a
  // posição/cooldown do jogador precisam refletir no HUD de debug no MESMO
  // evento de tecla, sem esperar o próximo `tick()`. Devolve `null` quando
  // o guard `gameState === "playing"` barra a ativação (ex.: "Q" pressionado
  // no menu) — igual ao original, que não chamava `syncHud()` nesse caso;
  // `app/page.tsx` não deve sincronizar nada do HUD nesse cenário.
  activateSpecialPower(): EngineSnapshot | null;
  // Clique/toque direto num dos power-ups da escolha final (fix1,
  // ENGINE-16 — restaura o clique instantâneo do código pré-refactor).
  // Delega à Phase ativa (só `NormalRunPhase` implementa; devolve `null`
  // quando a Phase ativa não trata o ponto — fora do raio, fora do estado
  // "choice", ou `SecretMainframePhase` ativa/nenhuma Phase ativa). Devolve
  // o snapshot atualizado (mesmo papel de `activateSpecialPower`) porque a
  // UI precisa refletir o resultado no MESMO evento de clique, sem esperar
  // o próximo `tick()`.
  resolveFinalChoiceClick(x: number, y: number): EngineSnapshot | null;
  // Introspecção adicional (não faz parte do contrato mínimo do
  // design.md, mas é informação que o Orchestrator já guarda internamente
  // e que `app/page.tsx`/testes precisam sem violar ENGINE-01): qual Phase
  // está ativa agora, e a origem da run atual (`normal`/`debug`/`secret`) —
  // usada hoje por `submitScore()` (`app/page.tsx:616-620`) para não
  // enviar scores de runs de debug.
  getActivePhaseId(): EnginePhase["id"] | null;
  getRunOrigin(): RunOrigin;
};

function createWorld(character: CharacterDefinition): EngineWorld {
  return {
    player: {
      x: WORLD.width / 2,
      y: WORLD.height / 2,
      hp: character.maxHp,
      maxHp: character.maxHp,
      size: character.size,
      speed: character.speed,
      invincible: 0,
      fury: 0,
      focus: 0,
      haste: 0,
    },
    enemies: [],
    shots: [],
    particles: [],
    powerUps: [],
    obstacles: [],
    run: {
      score: 0,
      wave: 1,
      callLoops: 0,
      bossIndex: 0,
      bossKills: 0,
      bossSpawned: false,
      finalChoicePending: false,
      weaponLevel: 1,
      burstStamina: BURST_STAMINA_MAX,
      abilityCooldownRemaining: 0,
      damageFlash: 0,
      shake: 0,
      bossBanner: 0,
      effectMessage: "",
      effectBanner: 0,
      finalBossCorpse: null,
      frame: 0,
      visualFrame: 0,
      spawnTimer: 0,
      dataTimer: 0,
      powerUpTimer: 0,
      shotTimer: 0,
      lastMoveX: 0,
      lastMoveY: 0,
    },
    phaseState: null,
  };
}

// Leitura "de fora" do estado local de uma Phase (`localGameState`, campo
// comum aos dois membros do union `PhaseState`, `types.ts`, fix2 ENGINE-28)
// — só para montar o snapshot exposto a `app/page.tsx`. `EnginePhase.
// isComplete()` só devolve um booleano (motor genérico não distingue
// "over"/"won"/"choice"/"promotion"), e essa distinção granular é
// exatamente o que o HUD precisa exibir; em vez de estender o contrato
// `EnginePhase` só para isso (ele já cobre tudo que o design.md pede),
// `Orchestrator` lê o campo direto do union — ambos os membros já o
// declaram.
function readPhaseLocalGameState(world: EngineWorld): GameState | null {
  const raw = world.phaseState?.localGameState;
  if (raw === "over" || raw === "won" || raw === "choice" || raw === "promotion" || raw === "playing") return raw;
  return null;
}

export function createEngine(options: EngineOptions): Engine {
  const audio = createAudioEngine();
  let character = options.character;
  let world = createWorld(character);
  let activePhase: EnginePhase | null = createNormalRunPhase();
  let started = false;
  let paused = false;
  let forcedError = false;
  let runOrigin: RunOrigin = "normal";
  let lastTickAt: number | null = null;
  let debugBossHealth: { hp: number; maxHp: number } | null = null;
  let debugPowerUpCount = 0;
  // fix1, ENGINE-17/ENGINE-18: sinaliza que o snapshot recém-montado precisa
  // sincronizar o HUD no MESMO frame (em vez de esperar a próxima janela do
  // throttle de `app/page.tsx`, T11). `true` por padrão — o primeiro
  // snapshot (antes de qualquer `tick()`) sempre sincroniza. `tick()`
  // recomputa a cada frame a partir de `FrameEvents`; os demais métodos que
  // chamam `buildSnapshot()` fora de `tick()` são ações discretas e sempre
  // marcam `true` antes de montar o snapshot.
  let pendingHudSync = true;

  function phaseContext(): PhaseContext {
    return { audio, character };
  }

  // Estado inicial (antes do primeiro `start()`): igual ao mount original
  // (`resetGame(); raf = requestAnimationFrame(tick);`), que já deixava o
  // mundo "pronto" (jogador/inimigos/obstáculos da onda 1) parado atrás do
  // menu — `update()` só rodava de fato quando `stateRef.current ===
  // "playing"`. `started = false` reproduz esse congelamento: `tick()`
  // sempre desenha o mundo atual, mas só chama `phase.update()` quando a
  // run está de fato ativa.
  activePhase.enter(world, phaseContext());

  function currentGameState(): GameState {
    if (forcedError) return "over";
    if (!started) return "menu";
    if (paused) return "paused";
    return readPhaseLocalGameState(world) ?? "playing";
  }

  function buildSnapshot(): EngineSnapshot {
    const { player, run } = world;
    const isSecret = runOrigin === "secret";
    const power = character.specialPower;
    const target = bossKillTarget(run.wave, run.callLoops);
    return {
      gameState: currentGameState(),
      score: run.score,
      wave: run.wave,
      resetCount: run.callLoops,
      hp: Math.max(0, Math.round(player.hp)),
      boss: isSecret
        ? "O Mainframe"
        : run.finalChoicePending
          ? "Diretoria caída"
          : bossNames[run.bossIndex] ?? "Comitê Executivo",
      biome: isSecret
        ? "Datacenter Esquecido"
        : biomeNames[Math.min(run.bossIndex, biomeNames.length - 1)] ?? "War Room",
      upgrade: run.weaponLevel >= 3 ? "JDK 21" : run.weaponLevel === 2 ? "JDK 17" : "JDK 8",
      bossProgress: isSecret
        ? "Chefe secreto"
        : run.finalChoicePending
          ? "Escolha final"
          : run.bossSpawned
            ? "Chefe em combate"
            : `${Math.min(run.bossKills, target)}/${target} mobs`,
      burstStaminaPct: Math.round(run.burstStamina),
      abilityCooldownPct: power
        ? Math.round(
            ((power.cooldownSeconds - Math.min(run.abilityCooldownRemaining, power.cooldownSeconds)) /
              power.cooldownSeconds) *
              100,
          )
        : 100,
      bossKillsCount: Math.min(run.bossKills, target),
      bossKillTargetCount: target,
      bossEncountered: run.bossSpawned,
      bossIncident: run.bossBanner > 0,
      enemyCount: world.enemies.length,
      damageFlash: run.damageFlash,
      hudSyncRequested: pendingHudSync,
      debug: {
        bossHealth: debugBossHealth,
        powerUpCount: debugPowerUpCount,
        abilityCooldown: Math.max(0, run.abilityCooldownRemaining),
        playerPosition: { x: Math.round(player.x), y: Math.round(player.y) },
        playerEffects: { haste: Math.max(0, player.haste), invincible: Math.max(0, player.invincible) },
      },
    };
  }

  function beginRun(phase: EnginePhase, origin: RunOrigin): EngineSnapshot {
    world = createWorld(character);
    activePhase = phase;
    activePhase.enter(world, phaseContext());
    started = true;
    paused = false;
    forcedError = false;
    runOrigin = origin;
    debugBossHealth = null;
    debugPowerUpCount = 0;
    audio.startMusic();
    pendingHudSync = true;
    return buildSnapshot();
  }

  function start(): EngineSnapshot {
    return beginRun(createNormalRunPhase(), "normal");
  }

  function startSecretRun(): EngineSnapshot {
    return beginRun(createSecretMainframePhase(), "secret");
  }

  function pause() {
    if (!started) return;
    paused = true;
    audio.stopMusic();
  }

  function resume() {
    if (!started) return;
    paused = false;
    audio.startMusic();
  }

  function setAudioPrefs(prefs: { muted: boolean; volume: number }) {
    audio.setPrefs(prefs);
  }

  function setCharacter(characterId: string) {
    character = resolveCharacter(characterId);
  }

  function returnToMenu() {
    // fix1, ENGINE-19: se `tick()` capturou uma exceção (ENGINE-12),
    // `activePhase` foi descartado (`null`) para não repetir o mesmo erro a
    // cada frame — mas isso deixava `draw()` sem nada a desenhar, congelando
    // o canvas mesmo depois do usuário voltar ao menu. Recria uma Phase
    // "normal" nova (mesma sequência de `beginRun`) só para existir e ser
    // desenhável, SEM marcar `started = true` — a run não deve "começar"
    // sozinha, ela só precisa parar de estar `null`. Roda antes de zerar
    // `started`/`forcedError`/`paused` porque a checagem depende do valor
    // atual de `activePhase` (só recria quando ele está de fato ausente).
    if (activePhase === null) {
      world = createWorld(character);
      activePhase = createNormalRunPhase();
      activePhase.enter(world, phaseContext());
    }
    started = false;
    paused = false;
    forcedError = false;
    audio.stopMusic();
  }

  function playSound(sound: SoundName) {
    audio.playSound(sound);
  }

  function startMusic() {
    audio.startMusic();
  }

  function stopMusic() {
    audio.stopMusic();
  }

  function activateSpecialPower(): EngineSnapshot | null {
    if (currentGameState() !== "playing") return null;
    triggerActivePower(world, character);
    pendingHudSync = true;
    return buildSnapshot();
  }

  // fix1, ENGINE-23/T16: bloco de recuperação de crash extraído de `tick()`'s
  // catch (ENGINE-12) para ser reusado também por `resolveFinalChoiceClick`
  // — nenhum caminho que invoca uma Phase pode deixar uma exceção escapar
  // para o chamador do Orchestrator.
  function handleActivePhaseCrash(error: unknown): void {
    // ENGINE-12: uma Phase nunca deve travar o loop de
    // `requestAnimationFrame` — captura no boundary, loga (mesmo canal
    // usado hoje por `lib/debug.ts`) e força o estado terminal seguro
    // ("over") em vez de propagar. A Phase corrente é descartada (não há
    // "saída" custosa a liberar — ver design.md § Error Handling
    // Strategy) para não repetir a mesma exceção a cada frame seguinte.
    console.error(error);
    forcedError = true;
    activePhase = null;
    started = false;
    audio.stopMusic();
    // A transição para o estado terminal seguro ("over") precisa refletir
    // no HUD no MESMO frame do crash, sem esperar a próxima janela do
    // throttle (T11).
    pendingHudSync = true;
  }

  function resolveFinalChoiceClick(x: number, y: number): EngineSnapshot | null {
    try {
      const result = activePhase?.resolveFinalChoiceClick?.(world, phaseContext(), x, y);
      if (!result) return null;
      pendingHudSync = true;
      return buildSnapshot();
    } catch (error) {
      // ENGINE-23: mesmo boundary de `tick()` — `resolveFinalChoiceClick`
      // também invoca código de Phase (`activePhase.resolveFinalChoiceClick?`)
      // fora do loop de `tick()`, então precisa da mesma proteção.
      handleActivePhaseCrash(error);
      return buildSnapshot();
    }
  }

  function tick(now: number, input: InputState, ctx: CanvasRenderingContext2D): EngineSnapshot {
    const delta = lastTickAt === null ? 0 : Math.min(0.033, (now - lastTickAt) / 1000);
    lastTickAt = now;
    world.run.visualFrame += 1;
    // fix1, ENGINE-17/ENGINE-18: recomputado a cada frame a partir dos
    // `FrameEvents` do próprio frame — nenhum evento discreto true ->
    // `false` (o throttle de `app/page.tsx`, T11, decide se este frame em
    // particular ainda assim sincroniza, pela cadência de 18 frames).
    pendingHudSync = false;

    try {
      if (started && !paused && activePhase) {
        const events = activePhase.update(world, phaseContext(), input, delta);
        pendingHudSync = Object.values(events).some(Boolean);
      }
      activePhase?.draw(ctx, world);
    } catch (error) {
      handleActivePhaseCrash(error);
    }

    return buildSnapshot();
  }

  function handleDebugAction(action: DebugAction): EngineSnapshot {
    // Ação discreta (fora de `tick()`) — sempre sincroniza o HUD no mesmo
    // evento, em todos os ramos de saída (fix1, ENGINE-17/ENGINE-18).
    pendingHudSync = true;

    // "toggle_menu" é puramente de UI (abre/fecha o diálogo de debug em
    // `app/page.tsx`, via `setDebugOpen`) — não afeta o mundo do jogo, então
    // o Orchestrator não tem nada a fazer além de devolver o snapshot atual;
    // `app/page.tsx` (T15) trata esse caso antes mesmo de chamar este
    // método, igual ao `return` antecipado do `onDebugAction` original
    // (`app/page.tsx:1215-1218`).
    if (action === "toggle_menu") return buildSnapshot();

    const startsRun =
      action === "reset" || ((action === "spawn_boss" || action === "add_powerup") && currentGameState() !== "playing");
    if (startsRun) start();

    // Fora de "reset" (que sempre inicia uma run normal nova, logo sempre
    // tem efeito), uma ação de debug só tem efeito real quando a Phase
    // ativa sabe tratá-la — hoje só `NormalRunPhase` implementa
    // `handleDebugAction` (`SecretMainframePhase` deliberadamente não trata
    // F1/F2/F3, ver comentário em `phases/secret-mainframe/index.ts`). Sem
    // esse gate, disparar F1/F2/F3 durante a run secreta ativa tocava
    // áudio e corrompia `runOrigin` para "debug" mesmo sem nenhuma mudança
    // de estado — quebrando o envio de score de uma run secreta legítima
    // completada depois.
    const phaseHandlesAction = !!activePhase && typeof activePhase.handleDebugAction === "function";

    if (action === "reset" || phaseHandlesAction) {
      runOrigin = "debug";
    }

    if (phaseHandlesAction && activePhase) {
      if (action === "spawn_boss") {
        const alreadySpawned = world.run.bossSpawned;
        activePhase.handleDebugAction?.(action, world, phaseContext());
        // Porta `app/page.tsx:1228-1236`: só atualiza o HP do chefe de
        // debug quando o spawn de fato aconteceu nesta chamada (a Phase
        // ignora silenciosamente se um chefe já estava em campo).
        if (!alreadySpawned) {
          const bossEntity = world.enemies.find((enemy) => enemy.kind === "boss");
          debugBossHealth = bossEntity ? { hp: bossEntity.hp, maxHp: bossEntity.maxHp } : null;
        }
      } else if (action === "add_powerup") {
        activePhase.handleDebugAction?.(action, world, phaseContext());
        debugPowerUpCount = world.powerUps.length;
      } else if (action === "max_stamina") {
        activePhase.handleDebugAction?.(action, world, phaseContext());
      } else if (action === "win_game") {
        activePhase.handleDebugAction?.(action, world, phaseContext());
        // Porta `app/page.tsx:1244-1252`: o original sempre forçava
        // `stateRef.current = "won"` diretamente, mesmo partindo de "menu"
        // (o teste "opens the high-score entry screen after a debug
        // victory" nunca inicia uma run antes de clicar "Testar Tela de
        // Vitória") — sem nunca ter chamado `start()` primeiro,
        // `started` continuaria `false` e `currentGameState()` reportaria
        // "menu" mesmo com `phaseState.localGameState === "won"` já
        // setado acima. `started = true` replica esse comportamento.
        started = true;
        // `NormalRunPhase.handleDebugAction("win_game")` (T10) só marca o
        // estado local como "won" (é o motor genérico de progressão de
        // jogo, não tem acesso à instância de áudio compartilhada do
        // Orchestrator) — o efeito sonoro/parada de música de
        // `app/page.tsx:1249-1250` é reproduzido aqui, no único lugar que
        // já tem a referência de `audio`.
        audio.playSound("won");
        audio.stopMusic();
      }
    }

    return buildSnapshot();
  }

  function getActivePhaseId(): EnginePhase["id"] | null {
    return activePhase?.id ?? null;
  }

  function getRunOrigin(): RunOrigin {
    return runOrigin;
  }

  return {
    tick,
    start,
    startSecretRun,
    handleDebugAction,
    setAudioPrefs,
    setCharacter,
    pause,
    resume,
    returnToMenu,
    playSound,
    startMusic,
    stopMusic,
    activateSpecialPower,
    resolveFinalChoiceClick,
    getActivePhaseId,
    getRunOrigin,
  };
}
