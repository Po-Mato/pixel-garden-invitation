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

export type PageQualitySummary = {
  cumulativeLayoutShiftMilli: number;
  longFrameP95Ms: number | null;
};

export function createPageQualityAccumulator() {
  let layoutShift = 0;
  let longFrames: number[] = [];
  return {
    addLayoutShift(value: number, hadRecentInput = false) {
      if (!hadRecentInput && Number.isFinite(value) && value > 0) layoutShift += value;
    },
    addFrame(durationMs: number) {
      if (Number.isFinite(durationMs) && durationMs >= 50 && durationMs <= 1_000) {
        longFrames.push(durationMs);
        if (longFrames.length > 120) longFrames = longFrames.slice(-120);
      }
    },
    flush(): PageQualitySummary {
      const sorted = [...longFrames].sort((left, right) => left - right);
      const longFrameP95Ms = sorted.length > 0
        ? Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))])
        : null;
      const summary = {
        cumulativeLayoutShiftMilli: Math.min(1_000, Math.max(0, Math.round(layoutShift * 1_000))),
        longFrameP95Ms
      };
      layoutShift = 0;
      longFrames = [];
      return summary;
    }
  };
}

type LayoutShiftEntry = PerformanceEntry & { value?: number; hadRecentInput?: boolean };

export function observePageQuality(
  onFlush: (summary: PageQualitySummary) => void,
  source: {
    Observer?: typeof PerformanceObserver;
    requestFrame?: typeof requestAnimationFrame;
    cancelFrame?: typeof cancelAnimationFrame;
    addPageHide?: (listener: () => void) => void;
    removePageHide?: (listener: () => void) => void;
  } = {}
): () => void {
  const accumulator = createPageQualityAccumulator();
  const Observer = source.Observer ?? (typeof PerformanceObserver === "undefined" ? undefined : PerformanceObserver);
  let observer: PerformanceObserver | null = null;
  if (Observer?.supportedEntryTypes?.includes("layout-shift")) {
    observer = new Observer((list) => {
      for (const entry of list.getEntries() as LayoutShiftEntry[]) {
        accumulator.addLayoutShift(entry.value ?? 0, entry.hadRecentInput ?? false);
      }
    });
    observer.observe({ entryTypes: ["layout-shift"] });
  }

  const requestFrame = source.requestFrame ?? (typeof requestAnimationFrame === "function" ? requestAnimationFrame : undefined);
  const cancelFrame = source.cancelFrame ?? (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : undefined);
  let frame = 0;
  let previousAt: number | null = null;
  const tick = (now: number) => {
    if (previousAt !== null) accumulator.addFrame(now - previousAt);
    previousAt = now;
    frame = requestFrame?.(tick) ?? 0;
  };
  if (requestFrame) frame = requestFrame(tick);

  const flush = () => onFlush(accumulator.flush());
  const addPageHide = source.addPageHide ?? ((listener) => window.addEventListener("pagehide", listener));
  const removePageHide = source.removePageHide ?? ((listener) => window.removeEventListener("pagehide", listener));
  addPageHide(flush);

  return () => {
    observer?.disconnect();
    if (frame && cancelFrame) cancelFrame(frame);
    removePageHide(flush);
  };
}
