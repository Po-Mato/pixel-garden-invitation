import { describe, expect, it, vi } from "vitest";
import { createFpsSampler, createPageQualityAccumulator, observeLongTasks } from "./realUserPerformance";

describe("realUserPerformance", () => {
  it("연속 프레임의 평균 FPS를 제한된 값으로 보고한다", () => {
    const sampler = createFpsSampler({ sampleSize: 3, reportIntervalMs: 0 });
    expect(sampler.sample(0)).toBeNull();
    expect(sampler.sample(20)).toBeNull();
    expect(sampler.sample(40)).toBeNull();
    expect(sampler.sample(60)).toBe(50);
  });

  it("백그라운드 중단처럼 긴 프레임 간격은 표본에서 제외한다", () => {
    const sampler = createFpsSampler({ sampleSize: 2, reportIntervalMs: 0, maxFrameGapMs: 100 });
    sampler.sample(0);
    sampler.sample(500);
    expect(sampler.sample(520)).toBeNull();
    expect(sampler.sample(540)).toBe(50);
  });

  it("지원 환경에서 50ms 이상 긴 작업만 전달한다", () => {
    const durations: number[] = [];
    const disconnect = vi.fn();
    class Observer {
      static supportedEntryTypes = ["longtask"];
      constructor(callback: PerformanceObserverCallback) {
        callback({ getEntries: () => [{ duration: 42 }, { duration: 81 }] } as PerformanceObserverEntryList, this as unknown as PerformanceObserver);
      }
      observe() {}
      disconnect = disconnect;
      takeRecords() { return []; }
    }
    const stop = observeLongTasks((duration) => durations.push(duration), Observer as unknown as typeof PerformanceObserver);
    expect(durations).toEqual([81]);
    stop();
    expect(disconnect).toHaveBeenCalled();
  });
});

describe("page quality accumulator", () => {
  it("사용자 입력 직후 이동을 제외한 CLS와 긴 프레임 p95만 익명 요약한다", () => {
    const accumulator = createPageQualityAccumulator();
    accumulator.addLayoutShift(0.08);
    accumulator.addLayoutShift(0.5, true);
    [51, 70, 95, 1_500].forEach((duration) => accumulator.addFrame(duration));
    expect(accumulator.flush()).toEqual({ cumulativeLayoutShiftMilli: 80, longFrameP95Ms: 95 });
    expect(accumulator.flush()).toEqual({ cumulativeLayoutShiftMilli: 0, longFrameP95Ms: null });
  });
});
