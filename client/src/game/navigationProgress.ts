import { walkStepIntervalMs } from "./walkTiming";

export type NavigationProgress = {
  remainingTiles: number;
  estimatedSeconds: number;
  label: string;
};

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
