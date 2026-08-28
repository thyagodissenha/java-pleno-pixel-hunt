import { expect, test } from "@playwright/test";

const legalPages = [
  { path: "/privacidade", heading: "Politica de Privacidade", lastLink: "Sobre o jogo" },
  { path: "/sobre", heading: "Java Pleno Pixel Hunt", lastLink: "Privacidade" },
];
const viewportHeights = [844, 667];

for (const legalPage of legalPages) {
  test(`${legalPage.path} remains scrollable and complete on mobile`, async ({ page }) => {
    await page.goto(legalPage.path);

    const main = page.getByRole("main");
    await expect(page.getByRole("heading", { level: 1, name: legalPage.heading })).toBeVisible();
    const lastLink = page.getByRole("link", { name: legalPage.lastLink });

    for (const height of viewportHeights) {
      await page.setViewportSize({ width: 390, height });
      await expect.poll(() => main.evaluate((element) => Number.parseFloat(getComputedStyle(element).minHeight))).toBe(height);
      await expect(main).toHaveCSS("overflow-y", "auto");
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(true);

      await lastLink.scrollIntoViewIfNeeded();
      await expect(lastLink).toBeVisible();
      await expect.poll(async () => {
        const box = await lastLink.boundingBox();
        const innerHeight = await page.evaluate(() => window.innerHeight);
        return box !== null && box.y >= 0 && box.y + box.height <= innerHeight;
      }).toBe(true);
    }
  });
}
