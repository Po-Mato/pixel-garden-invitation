import { describe, expect, it } from "vitest";
import { createFrameQualityMonitor } from "./frameQualityMonitor";

function feedFrames(monitor: ReturnType<typeof createFrameQualityMonitor>, start: number, delta: number, count: number) {
  let now = start;
  let decision = null;
  for (let index = 0; index < count; index += 1) {
    now += delta;
    decision = monitor.sample(now) ?? decision;
  }
  return { now, decision };
}

describe("frame quality monitor", () => {
  const options = {
    sampleWindowSize: 4,
    slowWindowsRequired: 2,
    recoveryWindowsRequired: 2,
    minimumDegradedMs: 0
  };

  it("지속된 저프레임에서만 품질 저하를 요청한다", () => {
    const monitor = createFrameQualityMonitor(options);
    const first = feedFrames(monitor, 0, 34, 5);
    expect(first.decision).toBeNull();
    const second = feedFrames(monitor, first.now, 34, 4);
    expect(second.decision).toBe("downgrade");
    expect(monitor.isDegraded()).toBe(true);
  });

  it("충분히 회복된 프레임이 이어질 때 표준 품질 복원을 요청한다", () => {
    const monitor = createFrameQualityMonitor(options);
    const slow = feedFrames(monitor, 0, 34, 9);
    expect(slow.decision).toBe("downgrade");
    const recovery = feedFrames(monitor, slow.now, 16, 8);
    expect(recovery.decision).toBe("restore");
    expect(monitor.isDegraded()).toBe(false);
  });

  it("백그라운드 전환처럼 긴 프레임 공백은 저사양 판정에서 제외한다", () => {
    const monitor = createFrameQualityMonitor(options);
    monitor.sample(0);
    monitor.sample(1_000);
    const normal = feedFrames(monitor, 1_000, 16, 12);
    expect(normal.decision).toBeNull();
    expect(monitor.isDegraded()).toBe(false);
  });
});
