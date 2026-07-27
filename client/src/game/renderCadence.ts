import type { DevicePerformanceMode } from "../performance/DevicePerformanceContext";

export const liteRenderFrameIntervalMs = 1_000 / 30;

export function shouldProcessGameFrame(
  mode: DevicePerformanceMode,
  lastProcessedAt: number | null,
  now: number
): boolean {
  if (mode === "standard" || lastProcessedAt === null || now < lastProcessedAt) return true;
  return now - lastProcessedAt >= liteRenderFrameIntervalMs;
}
