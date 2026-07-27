export type FpsSamplerOptions = {
  sampleSize: number;
  reportIntervalMs: number;
  maxFrameGapMs: number;
};

const defaultOptions: FpsSamplerOptions = {
  sampleSize: 120,
  reportIntervalMs: 30_000,
  maxFrameGapMs: 250
};

export type FpsSampler = {
  sample(now: number): number | null;
  reset(): void;
};

export function createFpsSampler(options: Partial<FpsSamplerOptions> = {}): FpsSampler {
  const config = { ...defaultOptions, ...options };
  let previousAt: number | null = null;
  let deltas: number[] = [];
  let lastReportAt = Number.NEGATIVE_INFINITY;

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
        deltas = [];
        return null;
      }
      deltas.push(delta);
      if (deltas.length < config.sampleSize || now - lastReportAt < config.reportIntervalMs) return null;
      const averageDelta = deltas.reduce((total, value) => total + value, 0) / deltas.length;
      deltas = [];
      lastReportAt = now;
      return Math.max(1, Math.min(120, Math.round(1_000 / averageDelta)));
    },
    reset() {
      previousAt = null;
      deltas = [];
      lastReportAt = Number.NEGATIVE_INFINITY;
    }
  };
}

export function observeLongTasks(
  onDuration: (durationMs: number) => void,
  Observer: typeof PerformanceObserver | undefined = typeof PerformanceObserver === "undefined"
    ? undefined
    : PerformanceObserver
): () => void {
  if (!Observer || !Observer.supportedEntryTypes?.includes("longtask")) return () => undefined;
  const observer = new Observer((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration >= 50) onDuration(Math.min(60_000, Math.round(entry.duration)));
    }
  });
  observer.observe({ entryTypes: ["longtask"] });
  return () => observer.disconnect();
}
