import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PrivacyPage from "@/app/privacidade/page";
import AboutPage from "@/app/sobre/page";

afterEach(cleanup);

describe("legal pages", () => {
  it("renders the privacy page title and primary links", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Politica de Privacidade" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Voltar ao jogo" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Sobre o jogo" })).toHaveAttribute("href", "/sobre");
  });

  it("renders the about page title and primary links", () => {
    render(<AboutPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Java Pleno Pixel Hunt" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Jogar agora" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Privacidade" })).toHaveAttribute("href", "/privacidade");
  });
});
