// Comportamento do "cobol snake" da fase secreta ("O Mainframe"). Porta a
// lógica hoje dispersa dentro de `update()` (`app/page.tsx:1668-1698`), que
// lê/muta `cobolSnake.*` sob dois branches: `cobolSnake.active` (movimento +
// dano ao jogador) e o `else if (runOriginRef.current === "secret")`
// (contagem regressiva do cooldown até a próxima ativação). Dentro de
// `SecretMainframePhase` o segundo branch é sempre alcançável (a Phase só
// roda quando a run é "secret"), então `stepCobolSnake` sempre aplica um dos
// dois ramos — não precisa do parâmetro `runOrigin` que o código original
// verificava.
//
// Nenhum import de `react`.

import type { AudioEngine } from "@/lib/pixel-hunt-engine/audio";
import { burst, distance } from "@/lib/pixel-hunt-engine/geometry";
import type { CobolSnake, EngineWorld } from "@/lib/pixel-hunt-engine/types";

const WORLD = { width: 960, height: 540 };
const COBOL_SNAKE_HIT_RADIUS = 18;
const COBOL_SNAKE_DAMAGE = 20;
const COBOL_SNAKE_MAX_HIST = 42;

/** Cria o estado inicial do cobol snake (inativo, aguardando o primeiro cooldown) — porta os campos definidos em `app/page.tsx:731` + o reset em `startSecretRun()` (`app/page.tsx:1179-1181`). */
export function createCobolSnake(): CobolSnake {
  return { active: false, cd: 8, t: 0, dir: 1, y0: 300, x: 0, y: 0, hist: [] };
}

/**
 * Avança o cobol snake em `delta` segundos. Porta o bloco
 * `if (cobolSnake.active) { ... } else if (...) { ... }`
 * (`app/page.tsx:1668-1698`):
 * - Ativo: desliza pela arena (trajetória senoidal determinística dado
 *   `dir`/`y0`), atualiza o rastro (`hist`, no máximo 42 pontos), causa dano
 *   ao jogador em colisão (respeitando `player.invincible`), e desativa-se
 *   (com um novo cooldown aleatório) ao sair da tela.
 * - Inativo: conta regressivamente `cd`; ao expirar, ativa-se com direção e
 *   `y0` aleatórios; o rastro encolhe 2 pontos por frame enquanto inativo
 *   (mesmo comportamento do código original).
 */
export function stepCobolSnake(world: EngineWorld, snake: CobolSnake, audio: AudioEngine, delta: number) {
  const { player, run } = world;

  if (snake.active) {
    snake.t += delta;
    snake.x = snake.dir > 0 ? -80 + snake.t * 150 : WORLD.width + 80 - snake.t * 150;
    snake.y = snake.y0 + Math.sin(snake.t * 3) * 46;
    snake.hist.unshift({ x: snake.x, y: snake.y });
    if (snake.hist.length > COBOL_SNAKE_MAX_HIST) snake.hist.pop();

    if (distance(snake, player) < COBOL_SNAKE_HIT_RADIUS && player.invincible <= 0) {
      player.hp -= COBOL_SNAKE_DAMAGE;
      player.invincible = 0.92;
      run.damageFlash = 16;
      run.shake = 14;
      audio.playSound("hurt");
      burst(world, player.x, player.y, "#ff5353", 12);
    }

    if (snake.x < -120 || snake.x > WORLD.width + 120) {
      snake.active = false;
      snake.cd = 12 + Math.random() * 8;
    }
  } else {
    snake.cd -= delta;
    if (snake.hist.length) {
      snake.hist.pop();
      snake.hist.pop();
    }
    if (snake.cd <= 0) {
      snake.active = true;
      snake.t = 0;
      snake.dir = Math.random() < 0.5 ? 1 : -1;
      snake.y0 = 140 + Math.random() * (WORLD.height - 280);
    }
  }
}
