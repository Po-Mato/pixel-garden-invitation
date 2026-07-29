import type { Point } from "./world";
import type { ViewportSize } from "./camera";

export type DialoguePlacement = "above" | "below" | "left" | "right";

type DialoguePlacementInput = {
  anchor: Point;
  viewport: ViewportSize;
  destinationGuideVisible: boolean;
};

export function resolveNpcDialoguePlacement({
  anchor,
  viewport,
  destinationGuideVisible
}: DialoguePlacementInput): DialoguePlacement {
  const topClearance = destinationGuideVisible ? 190 : 145;
  if (anchor.y < topClearance) return "below";
  if (anchor.y > viewport.height - 155) return "above";
  if (viewport.width >= 380 && anchor.x < 122) return "right";
  if (viewport.width >= 380 && anchor.x > viewport.width - 122) return "left";
  return "above";
}
