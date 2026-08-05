function round(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function percentile(values, ratio) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new TypeError("Percentile values must contain at least one number");
  }
  if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) {
    throw new RangeError("Percentile ratio must be between zero and one");
  }
  const sorted = values.map(Number).filter(Number.isFinite).sort((left, right) => left - right);
  if (sorted.length === 0) throw new TypeError("Percentile values must include a finite number");
  const position = (sorted.length - 1) * ratio;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function summarizeFrameTimings(frameDeltas, targetFps = 60) {
  const samples = frameDeltas.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  if (samples.length === 0) throw new TypeError("Frame timing samples must contain at least one positive value");
  const frameBudgetMs = 1000 / targetFps;
  return {
    sampleCount: samples.length,
    frameBudgetMs: round(frameBudgetMs),
    p50FrameMs: round(percentile(samples, 0.5)),
    p95FrameMs: round(percentile(samples, 0.95)),
    p99FrameMs: round(percentile(samples, 0.99)),
    maximumFrameMs: round(Math.max(...samples)),
    slowFrameRatio: round(samples.filter((value) => value > frameBudgetMs * 1.5).length / samples.length, 4),
    droppedFrameRatio: round(samples.filter((value) => value > frameBudgetMs * 2).length / samples.length, 4)
  };
}

export function assessFrameTimingHeadroom(current, baseline = null) {
  const issues = [];
  const p95Limit = Math.max(50, (baseline?.p95FrameMs ?? 0) * 1.8);
  const p99Limit = Math.max(90, (baseline?.p99FrameMs ?? 0) * 2);
  if (current.p95FrameMs > p95Limit) issues.push(`p95 프레임 ${current.p95FrameMs}ms`);
  if (current.p99FrameMs > p99Limit) issues.push(`p99 프레임 ${current.p99FrameMs}ms`);
  return issues;
}
