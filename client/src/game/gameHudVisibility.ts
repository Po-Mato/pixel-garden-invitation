export type GameHudDensity = "idle" | "route" | "context" | "moving" | "expanded" | "complete";

export type GameHudDensityInput = {
  moving: boolean;
  routeActive: boolean;
  contextActive: boolean;
  toolsOpen: boolean;
  overlayOpen: boolean;
  dialogueOpen: boolean;
  journeyComplete?: boolean;
};

export function resolveGameHudDensity(input: GameHudDensityInput): GameHudDensity {
  if (input.toolsOpen) return "expanded";
  if (input.dialogueOpen || input.contextActive) return "context";
  if (input.overlayOpen) return "expanded";
  if (input.moving) return "moving";
  if (input.routeActive) return "route";
  if (input.journeyComplete) return "complete";
  return "idle";
}
