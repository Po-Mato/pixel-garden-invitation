export const gameHudAutoHideDelayMs = 520;

export type GameHudVisibilityInput = {
  moving: boolean;
  toolsOpen: boolean;
  overlayOpen: boolean;
  portalTransitioning: boolean;
};

export function shouldAutoHideGameHud(input: GameHudVisibilityInput): boolean {
  return input.moving
    && !input.toolsOpen
    && !input.overlayOpen
    && !input.portalTransitioning;
}
