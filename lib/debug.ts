export const DEBUG_ACTION_EVENT = "java-pleno-pixel-hunt:debug-action";

export type DebugAction =
  | "toggle_menu"
  | "spawn_boss"
  | "add_powerup"
  | "max_stamina"
  | "win_game"
  | "reset";

const DEBUG_ACTIONS: ReadonlySet<DebugAction> = new Set([
  "toggle_menu",
  "spawn_boss",
  "add_powerup",
  "max_stamina",
  "win_game",
  "reset",
]);

const DEBUG_KEYS: Readonly<Record<string, DebugAction>> = {
  F1: "toggle_menu",
  F2: "spawn_boss",
  F3: "add_powerup",
};

export function isDebugAllowed(_search = "") {
  return process.env.NODE_ENV === "development";
}

export function isDebugAction(value: unknown): value is DebugAction {
  return typeof value === "string" && DEBUG_ACTIONS.has(value as DebugAction);
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
