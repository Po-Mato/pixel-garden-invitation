import type { GameQuickDockAction } from "./gameQuickDockPreferences";

export type AdaptiveHudState = "context" | "moving" | "route" | "favorites";

type AdaptiveHudInput = {
  favorites: readonly GameQuickDockAction[];
  contextActive: boolean;
  moving: boolean;
  routeActive: boolean;
};

export function resolveAdaptiveQuickDockActions({
  favorites,
  contextActive,
  moving,
  routeActive
}: AdaptiveHudInput): { state: AdaptiveHudState; actions: GameQuickDockAction[] } {
  if (contextActive) return { state: "context", actions: [] };
  if (moving) return { state: "moving", actions: favorites.slice(0, 1) };
  if (routeActive) return { state: "route", actions: ["journey"] };
  return { state: "favorites", actions: [...favorites] };
}
