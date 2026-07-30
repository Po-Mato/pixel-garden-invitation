export const gameHudAutoHideDelayMs = 520;

export type GameHudVisibilityInput = {
  moving: boolean;
  toolsOpen: boolean;
  overlayOpen: boolean;
  portalTransitioning: boolean;
};

export type GameHudDensity = "idle" | "route" | "context" | "moving" | "expanded";

export type GameHudDensityInput = {
  moving: boolean;
  routeActive: boolean;
  contextActive: boolean;
  toolsOpen: boolean;
  overlayOpen: boolean;
  dialogueOpen: boolean;
};

export function resolveGameHudDensity(input: GameHudDensityInput): GameHudDensity {
  if (input.toolsOpen) return "expanded";
  if (input.dialogueOpen || input.contextActive) return "context";
  if (input.overlayOpen) return "expanded";
  if (input.moving) return "moving";
  if (input.routeActive) return "route";
  return "idle";
}

export function shouldAutoHideGameHud(input: GameHudVisibilityInput): boolean {
  return input.moving
    && !input.toolsOpen
    && !input.overlayOpen
    && !input.portalTransitioning;
}
