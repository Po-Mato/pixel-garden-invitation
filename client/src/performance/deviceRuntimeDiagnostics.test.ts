import { describe, expect, it } from "vitest";
import {
  createDeviceRuntimeDiagnosticsMonitor,
  resolveRuntimePerformanceHealth
} from "./deviceRuntimeDiagnostics";

describe("deviceRuntimeDiagnostics", () => {
  it("프레임과 메모리 압력으로 보호 단계를 판정한다", () => {
    expect(resolveRuntimePerformanceHealth(58, 0.4).health).toBe("good");
    expect(resolveRuntimePerformanceHealth(40, 0.4).health).toBe("watch");
    expect(resolveRuntimePerformanceHealth(58, 0.9).health).toBe("protected");
  });

  it("일정 프레임 묶음마다 실제 평균과 메모리 사용률을 보고한다", () => {
    const monitor = createDeviceRuntimeDiagnosticsMonitor(3);
    expect(monitor.sample(0, null)).toBeNull();
    expect(monitor.sample(20, null)).toBeNull();
    expect(monitor.sample(40, null)).toBeNull();
    expect(monitor.sample(60, { usedBytes: 70, limitBytes: 100 })).toMatchObject({
      averageFps: 50,
      memoryUsageRatio: 0.7,
      health: "watch"
    });
  });
});
