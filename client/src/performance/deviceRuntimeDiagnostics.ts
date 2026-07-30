export type RuntimePerformanceHealth = "good" | "watch" | "protected";

export type DeviceRuntimeDiagnostics = {
  health: RuntimePerformanceHealth;
  averageFps: number | null;
  memoryUsageRatio: number | null;
  sampleCount: number;
  recommendation: string;
};

export type RuntimeMemorySnapshot = {
  usedBytes: number;
  limitBytes: number;
};

export const initialDeviceRuntimeDiagnostics: DeviceRuntimeDiagnostics = {
  health: "good",
  averageFps: null,
  memoryUsageRatio: null,
  sampleCount: 0,
  recommendation: "기기 상태를 확인하고 있어요"
};

export function readRuntimeMemorySnapshot(
  source: Performance = performance
): RuntimeMemorySnapshot | null {
  const memory = (source as Performance & {
    memory?: { usedJSHeapSize?: number; jsHeapSizeLimit?: number };
  }).memory;
  if (
    typeof memory?.usedJSHeapSize !== "number"
    || typeof memory.jsHeapSizeLimit !== "number"
    || memory.jsHeapSizeLimit <= 0
  ) return null;
  return { usedBytes: memory.usedJSHeapSize, limitBytes: memory.jsHeapSizeLimit };
}

export function resolveRuntimePerformanceHealth(
  averageFps: number,
  memoryUsageRatio: number | null
): Pick<DeviceRuntimeDiagnostics, "health" | "recommendation"> {
  if (averageFps < 30 || (memoryUsageRatio !== null && memoryUsageRatio >= 0.85)) {
    return { health: "protected", recommendation: "보호 모드로 효과를 최소화했어요" };
  }
  if (averageFps < 45 || (memoryUsageRatio !== null && memoryUsageRatio >= 0.68)) {
    return { health: "watch", recommendation: "프레임과 메모리를 살피며 효과를 조정 중이에요" };
  }
  return { health: "good", recommendation: "현재 기기에서 부드럽게 실행 중이에요" };
}

export function createDeviceRuntimeDiagnosticsMonitor(sampleSize = 30) {
  let previousAt: number | null = null;
  let frameDurations: number[] = [];
  let sampleCount = 0;

  return {
    sample(now: number, memory: RuntimeMemorySnapshot | null): DeviceRuntimeDiagnostics | null {
      if (previousAt !== null) {
        const duration = now - previousAt;
        if (duration > 0 && duration < 1_000) frameDurations.push(duration);
      }
      previousAt = now;
      sampleCount += 1;
      if (frameDurations.length < sampleSize) return null;

      const averageDuration = frameDurations.reduce((sum, duration) => sum + duration, 0) / frameDurations.length;
      const averageFps = Math.round(Math.min(60, 1_000 / averageDuration));
      const memoryUsageRatio = memory
        ? Math.round(memory.usedBytes / memory.limitBytes * 100) / 100
        : null;
      const health = resolveRuntimePerformanceHealth(averageFps, memoryUsageRatio);
      frameDurations = [];
      return { ...health, averageFps, memoryUsageRatio, sampleCount };
    },
    reset() {
      previousAt = null;
      frameDurations = [];
      sampleCount = 0;
    }
  };
}
