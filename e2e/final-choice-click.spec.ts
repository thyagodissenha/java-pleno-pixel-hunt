import { expect, test } from "@playwright/test";

// Clique/toque direto num dos dois power-ups da "escolha final" resolve
// instantaneamente, no MESMO evento — sem esperar o jogador se mover até o
// power-up (colisão passiva, ver `stepWorld`). Fix1, ENGINE-16 — restaura o
// comportamento pré-migração do motor (`FINAL_CHOICE_CLICK_RADIUS`).
//
// Reusa o padrão de e2e/full-run.spec.ts (Playwright, dispensa a cutscene,
// usa a tecla de debug F2 = "spawn_boss" para chegar a um estado
// determinístico sem depender de RNG de sobrevivência). F2 spawna o chefe da
// wave/bossIndex ATUAL (e inicia a run primeiro, se ainda no menu); o
// jogador nunca se move (sem WASD/clique) e atira sozinho no inimigo vivo
// mais próximo (`stepWorld`/`shoot`), então basta repetir F2 — inofensivo
// enquanto o chefe atual ainda está vivo (guard `!world.run.bossSpawned`
// em `NormalRunPhase.handleDebugAction`) — até o chefe FINAL (o 4º,
// `bossNames.length - 1`) morrer e abrir a tela de escolha.
test("full run: chegar à escolha final via debug -> clique direto num power-up resolve no mesmo evento", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/");

  const cutsceneOverlay = page.getByRole("dialog", { name: /Abertura da história/ });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (!(await cutsceneOverlay.isVisible().catch(() => false))) break;
    await page.keyboard.press("Space");
    await page.waitForTimeout(200);
  }
  await expect(cutsceneOverlay).toBeHidden({ timeout: 15_000 });

  const arena = page.locator('canvas[aria-label="Arena pixel art"]');
  await expect(arena).toBeVisible();

  const statusHeading = page.getByRole("heading", { level: 1 });

  let reachedChoice = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await page.keyboard.press("F2");
    await page.waitForTimeout(1500);
    const text = (await statusHeading.textContent())?.trim();
    if (text === "Escolha final") {
      reachedChoice = true;
      break;
    }
  }
  expect(reachedChoice).toBe(true);

  // O jogador nunca se moveu (nenhum WASD/seta/clique de movimento) —
  // continua na origem fixa do mundo (960x540, jogador em (480, 270)), a
  // mesma base que `spawnFinalChoices` (`final-choice.ts`) usa para
  // posicionar as duas escolhas: "promotion" em
  // (480 - 104, clamp(270 - 76, 120, 430)) = (376, 194).
  const box = await arena.boundingBox();
  if (!box) throw new Error("Arena canvas sem bounding box");
  const worldX = 376;
  const worldY = 194;
  const clickX = box.x + (worldX / 960) * box.width;
  const clickY = box.y + (worldY / 540) * box.height;

  await page.mouse.click(clickX, clickY);

  // Clique instantâneo (fix1, ENGINE-16): resolve no MESMO evento de
  // pointerdown, sem esperar `stepWorld` mover o jogador até o power-up —
  // a tela de promoção aparece imediatamente.
  await expect(page.getByRole("dialog", { name: "Promoção para sênior" })).toBeVisible({ timeout: 2_000 });
});
