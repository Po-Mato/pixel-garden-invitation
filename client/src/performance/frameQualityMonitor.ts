export type FrameQualityDecision = "downgrade" | "restore" | null;

export type FrameQualityMonitorOptions = {
  sampleWindowSize: number;
  slowFpsThreshold: number;
  recoveryFpsThreshold: number;
  slowWindowsRequired: number;
  recoveryWindowsRequired: number;
  maxFrameGapMs: number;
  minimumDegradedMs: number;
};

export const defaultFrameQualityOptions: FrameQualityMonitorOptions = {
  sampleWindowSize: 45,
  slowFpsThreshold: 42,
  recoveryFpsThreshold: 52,
  slowWindowsRequired: 2,
  recoveryWindowsRequired: 4,
  maxFrameGapMs: 250,
  minimumDegradedMs: 10_000
};

export type FrameQualityMonitor = {
  sample(now: number): FrameQualityDecision;
  reset(): void;
  isDegraded(): boolean;
};

export function createFrameQualityMonitor(
  options: Partial<FrameQualityMonitorOptions> = {}
): FrameQualityMonitor {
  const config = { ...defaultFrameQualityOptions, ...options };
  let previousAt: number | null = null;
  let samples: number[] = [];
  let slowWindows = 0;
  let recoveryWindows = 0;
  let degraded = false;
  let degradedAt = 0;

  const resetSamples = () => {
    samples = [];
    slowWindows = 0;
    recoveryWindows = 0;
  };

  return {
    sample(now) {
      if (!Number.isFinite(now)) return null;
      if (previousAt === null || now <= previousAt) {
        previousAt = now;
        return null;
      }
      const delta = now - previousAt;
      previousAt = now;
      if (delta > config.maxFrameGapMs) {
        samples = [];
        return null;
      }

      samples.push(delta);
      if (samples.length < config.sampleWindowSize) return null;
      const averageDelta = samples.reduce((total, value) => total + value, 0) / samples.length;
      const framesPerSecond = 1_000 / averageDelta;
      samples = [];

      if (!degraded) {
        recoveryWindows = 0;
        slowWindows = framesPerSecond < config.slowFpsThreshold ? slowWindows + 1 : 0;
        if (slowWindows < config.slowWindowsRequired) return null;
        degraded = true;
        degradedAt = now;
        resetSamples();
        return "downgrade";
      }

      slowWindows = 0;
      recoveryWindows = framesPerSecond >= config.recoveryFpsThreshold ? recoveryWindows + 1 : 0;
      if (
        recoveryWindows < config.recoveryWindowsRequired
        || now - degradedAt < config.minimumDegradedMs
      ) return null;
      degraded = false;
      resetSamples();
      return "restore";
    },
    reset() {
      previousAt = null;
      degraded = false;
      degradedAt = 0;
      resetSamples();
    },
    isDegraded() {
      return degraded;
    }
  };
}
