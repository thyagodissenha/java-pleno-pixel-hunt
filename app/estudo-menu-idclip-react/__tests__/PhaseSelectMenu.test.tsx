import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EstudoMenuIdclipReact from "@/app/estudo-menu-idclip-react/page";

// ESTUDOREACT-01..07 (_docs/specs/features/estudo-menu-idclip-react/spec.md) — testa a rota real
// (`page.tsx`, com o mesmo `unlocked` que só libera o Mainframe), não o componente isolado com
// seus defaults (que deixariam tudo desbloqueado).

function typeKeys(keys: string) {
  for (const key of keys) fireEvent.keyDown(window, { key });
}

describe("estudo menu idclip react (PhaseSelectMenu, ESTUDOREACT)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows O Mainframe unlocked and the other phases locked (ESTUDOREACT-01)", () => {
    render(<EstudoMenuIdclipReact />);

    const mainframe = screen.getByRole("button", { name: /O MAINFRAME/ });
    expect(within(mainframe).queryByText("BLOQUEADO")).not.toBeInTheDocument();

    const hellBranch = screen.getByRole("button", { name: /HELL BRANCH/ });
    expect(within(hellBranch).getByText("BLOQUEADO")).toBeInTheDocument();
  });

  it("reaches all 8 phases via arrow navigation, wrapping at both ends (ESTUDOREACT-02)", () => {
    render(<EstudoMenuIdclipReact />);

    const mainframe = screen.getByRole("button", { name: /O MAINFRAME/ });
    expect(within(mainframe).getByText("ENTER PARA ENTRAR")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowUp" });
    const metaArcade = screen.getByRole("button", { name: /META\.ARCADE/ });
    expect(within(metaArcade).getByText("ENTER PARA ENTRAR")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /O MAINFRAME/ })).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(within(screen.getByRole("button", { name: /O MAINFRAME/ })).getByText("ENTER PARA ENTRAR")).toBeInTheDocument();
  });

  it("confirming a locked phase shows its BLOQUEADO toast and never starts the loading transition (ESTUDOREACT-03)", () => {
    render(<EstudoMenuIdclipReact />);

    fireEvent.click(screen.getByRole("button", { name: /HELL BRANCH/ }));

    expect(screen.getByText("BLOQUEADO — ONDA 6 · DOOM.WAD")).toBeInTheDocument();
    expect(screen.queryByText(/CARREGANDO/)).not.toBeInTheDocument();
  });

  it("confirming O Mainframe shows the loading transition then redirects to the real game (ESTUDOREACT-04/MFLAUNCH)", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    render(<EstudoMenuIdclipReact />);

    fireEvent.click(screen.getByRole("button", { name: /O MAINFRAME/ }));
    expect(screen.getByText("CARREGANDO O MAINFRAME...")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1400);
    });

    expect(screen.queryByText("CARREGANDO O MAINFRAME...")).not.toBeInTheDocument();
    expect(assign).toHaveBeenCalledWith("/?autostart=mainframe");
    expect(screen.queryByText(/plugue o loader/)).not.toBeInTheDocument();
  });

  it("confirming a phase unlocked only via cheat (not O Mainframe) still falls back to the component's own toast, no redirect (regression guard)", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    render(<EstudoMenuIdclipReact />);
    typeKeys("idboo");

    fireEvent.click(screen.getByRole("button", { name: /GRAVEYARD SHIFT/ }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1400);
    });

    expect(screen.getByText("onSelect(2) — plugue o loader")).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it("typing a phase cheat (idboo) unlocks Graveyard Shift cosmetically (ESTUDOREACT-05)", () => {
    render(<EstudoMenuIdclipReact />);

    const graveyard = screen.getByRole("button", { name: /GRAVEYARD SHIFT/ });
    expect(within(graveyard).getByText("BLOQUEADO")).toBeInTheDocument();

    typeKeys("idboo");

    expect(screen.getByText("IDBOO — GRAVEYARD SHIFT LIBERADO. Ele sabe que você chamou.")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /GRAVEYARD SHIFT/ })).queryByText("BLOQUEADO")).not.toBeInTheDocument();
  });

  it("completing the Konami code unlocks Meta.Arcade cosmetically (ESTUDOREACT-06)", () => {
    render(<EstudoMenuIdclipReact />);

    const konami = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
    for (const key of konami) fireEvent.keyDown(window, { key });

    expect(screen.getByText("KONAMI CODE! META.ARCADE LIBERADO — 1UP")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(within(screen.getByRole("button", { name: /META\.ARCADE/ })).queryByText("BLOQUEADO")).not.toBeInTheDocument();
  });

  it("clicking the pumpkin 3 times unlocks Graveyard Shift via the easter egg (ESTUDOREACT-07)", () => {
    render(<EstudoMenuIdclipReact />);

    const pumpkin = screen.getByText("🎃");
    fireEvent.click(pumpkin);
    expect(screen.getByText("a abóbora piscou... (1/3)")).toBeInTheDocument();
    fireEvent.click(pumpkin);
    expect(screen.getByText("a abóbora piscou... (2/3)")).toBeInTheDocument();
    fireEvent.click(pumpkin);

    expect(screen.getByText("A ABÓBORA SORRIU DE VOLTA — GRAVEYARD SHIFT LIBERADO")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /GRAVEYARD SHIFT/ })).queryByText("BLOQUEADO")).not.toBeInTheDocument();
  });
});
