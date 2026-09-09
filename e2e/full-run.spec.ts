import { expect, test } from "@playwright/test";

// Caminho feliz completo: menu -> iniciar partida -> interagir com o jogo
// (mover) -> chegar a um estado de fim de partida (via a ação de debug
// determinística "Testar Tela de Vitória", já que sobreviver a uma run real
// dependeria de RNG de spawn) -> formulário de envio de score visível e
// funcional. Reusa o padrão de e2e/legal-pages-mobile.spec.ts (Playwright,
// getByRole). O modo debug só fica disponível com NODE_ENV=development, que
// é o ambiente do webServer configurado em playwright.config.ts.
test("full run: menu -> jogar -> interagir -> fim de partida -> envio de score", async ({ page }) => {
  await page.goto("/");

  // A cutscene de abertura (3 cenas, cada uma com texto digitado) cobre o
  // menu com um overlay clicável. Cada Espaço primeiro completa a digitação
  // da cena atual e só depois avança/dispensa a cutscene, então repete a
  // tecla até o overlay sumir (mesmo padrão usado pelo próprio jogo:
  // espaço/Enter/clique avançam a cutscene).
  const cutsceneOverlay = page.getByRole("dialog", { name: /Abertura da história/ });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (!(await cutsceneOverlay.isVisible().catch(() => false))) break;
    await page.keyboard.press("Space");
    await page.waitForTimeout(200);
  }
  await expect(cutsceneOverlay).toBeHidden({ timeout: 15_000 });

  const playButton = page.getByRole("menuitem", { name: /^▶?\s*Jogar$/ });
  await expect(playButton).toBeVisible();
  await playButton.click();

  const arena = page.locator('canvas[aria-label="Arena pixel art"]');
  await expect(arena).toBeVisible();

  // Interação de jogo: movimento do jogador (WASD/setas), como no gameplay real.
  await arena.click();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(200);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.down("ArrowDown");
  await page.waitForTimeout(200);
  await page.keyboard.up("ArrowDown");

  // Abre o menu de debug (F1) e força o fim de partida de forma determinística
  // (F2/F3 spawnam boss/power-up; "Testar Tela de Vitória" resolve o estado
  // terminal sem depender de RNG de sobrevivência).
  await page.keyboard.press("F1");
  const debugPanel = page.getByRole("dialog", { name: "Ferramentas de debug" });
  await expect(debugPanel).toBeVisible();

  const winButton = page.getByRole("button", { name: "Testar Tela de Vitória" });
  await winButton.click();

  const scorePanel = page.getByRole("dialog", { name: "Ranking de maiores pontuações" });
  await expect(scorePanel).toBeVisible();
  await expect(page.getByRole("heading", { name: "HIGH SCORES" })).toBeVisible();

  const nameInput = page.getByLabel("Digite seu nome");
  await expect(nameInput).toBeVisible();
  const saveButton = page.getByRole("button", { name: "Salvar" });
  await expect(saveButton).toBeVisible();

  await nameInput.fill("E2E TEST");
  await nameInput.press("Enter");

  await expect(page.getByRole("button", { name: "Jogar de novo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Voltar ao início" })).toBeVisible();
});
