import { expect, test } from "@playwright/test";

const legalPages = [
  { path: "/privacidade", heading: "Politica de Privacidade", lastLink: "Sobre o jogo" },
  { path: "/sobre", heading: "Java Pleno Pixel Hunt", lastLink: "Privacidade" },
];

for (const legalPage of legalPages) {
  test(`${legalPage.path} remains scrollable and complete on mobile`, async ({ page }) => {
    await page.goto(legalPage.path);

    const main = page.getByRole("main");
    await expect(page.getByRole("heading", { level: 1, name: legalPage.heading })).toBeVisible();
    await expect(main).toHaveCSS("min-height", "844px");
    await expect(main).toHaveCSS("overflow-y", "auto");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(true);

    const lastLink = page.getByRole("link", { name: legalPage.lastLink });
    await lastLink.scrollIntoViewIfNeeded();
    await expect(lastLink).toBeVisible();
    await expect.poll(async () => {
      const box = await lastLink.boundingBox();
      return box !== null && box.y >= 0 && box.y + box.height <= 844;
    }).toBe(true);
  });
}
