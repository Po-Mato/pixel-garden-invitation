export const liteRenderFrameIntervalMs = 1_000 / 30;

export function shouldProcessGameFrame(
  targetFps: 60 | 30 | 24,
  lastProcessedAt: number | null,
  now: number
): boolean {
  if (targetFps === 60 || lastProcessedAt === null || now < lastProcessedAt) return true;
  return now - lastProcessedAt >= 1_000 / targetFps - 0.001;
}
