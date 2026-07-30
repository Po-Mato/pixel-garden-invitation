export type RuntimePerformanceHealth = "good" | "watch" | "protected";

export type DeviceRuntimeDiagnostics = {
  health: RuntimePerformanceHealth;
  averageFps: number | null;
  memoryUsageRatio: number | null;
  sampleCount: number;
  sessionMinutes: number;
  memoryTrend: "unknown" | "stable" | "rising";
  recoveryCount: number;
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
  sessionMinutes: 0,
  memoryTrend: "unknown",
  recoveryCount: 0,
  recommendation: "기기 상태를 확인하고 있어요"
};

export const runtimeProtectionEventName = "wedding-game:runtime-protection";

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
  let startedAt: number | null = null;
  let frameDurations: number[] = [];
  let memoryRatios: number[] = [];
  let sampleCount = 0;
  let lastHealth: RuntimePerformanceHealth = "good";
  let healthyWindowsAfterProtection = 0;
  let recoveryCount = 0;

  return {
    sample(now: number, memory: RuntimeMemorySnapshot | null): DeviceRuntimeDiagnostics | null {
      if (startedAt === null) startedAt = now;
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
      if (memoryUsageRatio !== null) memoryRatios = [...memoryRatios, memoryUsageRatio].slice(-4);
      const memoryTrend = memoryRatios.length < 3
        ? "unknown"
        : memoryRatios.at(-1)! - memoryRatios[0] >= 0.08 ? "rising" : "stable";
      const rawHealth = resolveRuntimePerformanceHealth(averageFps, memoryUsageRatio);
      if (memoryTrend === "rising" && rawHealth.health === "good") {
        rawHealth.health = "watch";
        rawHealth.recommendation = "메모리 증가 추세를 살피며 효과를 조정 중이에요";
      }
      let health = rawHealth.health;
      let recommendation = rawHealth.recommendation;
      if (lastHealth === "protected" && rawHealth.health !== "protected") {
        healthyWindowsAfterProtection += 1;
        if (healthyWindowsAfterProtection < 2) {
          health = "protected";
          recommendation = "안정적인 상태가 유지되는지 한 번 더 확인하고 있어요";
        } else {
          recoveryCount += 1;
          healthyWindowsAfterProtection = 0;
          recommendation = "자동 정리를 마치고 안정적인 효과로 복귀했어요";
        }
      } else if (rawHealth.health === "protected") {
        healthyWindowsAfterProtection = 0;
      }
      lastHealth = health;
      frameDurations = [];
      return {
        health,
        recommendation,
        averageFps,
        memoryUsageRatio,
        memoryTrend,
        sessionMinutes: Math.max(0, Math.floor((now - startedAt) / 60_000)),
        recoveryCount,
        sampleCount
      };
    },
    reset() {
      previousAt = null;
      startedAt = null;
      frameDurations = [];
      memoryRatios = [];
      sampleCount = 0;
      lastHealth = "good";
      healthyWindowsAfterProtection = 0;
      recoveryCount = 0;
    }
  };
}
