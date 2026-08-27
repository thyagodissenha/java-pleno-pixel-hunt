export const DEBUG_ACTION_EVENT = "java-pleno-pixel-hunt:debug-action";

export type DebugAction =
  | "toggle_menu"
  | "spawn_boss"
  | "add_powerup"
  | "max_stamina"
  | "win_game"
  | "reset";

const DEBUG_KEYS: Readonly<Record<string, DebugAction>> = {
  F1: "toggle_menu",
  F2: "spawn_boss",
  F3: "add_powerup",
};

export function isDebugAllowed(search = typeof window === "undefined" ? "" : window.location.search) {
  return process.env.NODE_ENV !== "production" || new URLSearchParams(search).get("debug") === "1";
}

export function triggerDebugAction(action: DebugAction) {
  if (!isDebugAllowed() || typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent<DebugAction>(DEBUG_ACTION_EVENT, { detail: action }));
}

export function createDebugKeyHandler() {
  return (event: KeyboardEvent) => {
    const action = DEBUG_KEYS[event.key];
    if (!action || !isDebugAllowed()) return;

    event.preventDefault();
    triggerDebugAction(action);
  };
}
