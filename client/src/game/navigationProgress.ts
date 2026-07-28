import { walkStepIntervalMs } from "./walkTiming";

export type NavigationProgress = {
  remainingTiles: number;
  estimatedSeconds: number;
  label: string;
};

export type DestinationNavigationProgress = NavigationProgress & {
  remainingPortals: number;
};

const estimatedPortalTransitionMs = 700;

function estimatedTimeLabel(estimatedSeconds: number): string {
  if (estimatedSeconds < 60) return `약 ${estimatedSeconds}초`;
  const minutes = Math.floor(estimatedSeconds / 60);
  const seconds = estimatedSeconds % 60;
  return `약 ${minutes}분${seconds > 0 ? ` ${seconds}초` : ""}`;
}

export function navigationProgress(pathLength: number): NavigationProgress | null {
  if (!Number.isFinite(pathLength) || pathLength <= 0) return null;

  const remainingTiles = Math.max(1, Math.floor(pathLength));
  const estimatedSeconds = Math.max(1, Math.ceil((remainingTiles * walkStepIntervalMs) / 1_000));
  return {
    remainingTiles,
    estimatedSeconds,
    label: `${remainingTiles}타일 · 약 ${estimatedSeconds}초`
  };
}

export function destinationNavigationProgress(
  pathLength: number,
  portalTransitions: number
): DestinationNavigationProgress | null {
  if (!Number.isFinite(pathLength) || pathLength < 0) return null;
  const remainingTiles = Math.max(0, Math.floor(pathLength));
  const remainingPortals = Math.max(0, Math.floor(portalTransitions));
  if (remainingTiles === 0 && remainingPortals === 0) return null;
  const estimatedSeconds = Math.max(1, Math.ceil((
    remainingTiles * walkStepIntervalMs
    + remainingPortals * estimatedPortalTransitionMs
  ) / 1_000));
  const portalLabel = remainingPortals > 0 ? ` · 포털 ${remainingPortals}회` : "";

  return {
    remainingTiles,
    remainingPortals,
    estimatedSeconds,
    label: `${remainingTiles}타일${portalLabel} · ${estimatedTimeLabel(estimatedSeconds)}`
  };
}
