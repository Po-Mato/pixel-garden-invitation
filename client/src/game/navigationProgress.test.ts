import { describe, expect, it } from "vitest";
import { navigationProgress } from "./navigationProgress";

describe("navigation progress", () => {
  it("남은 타일을 실제 자동 보행 간격 기준 예상 시간으로 바꾼다", () => {
    expect(navigationProgress(10)).toEqual({
      remainingTiles: 10,
      estimatedSeconds: 3,
      label: "10타일 · 약 3초"
    });
  });

  it("이동 경로가 없거나 잘못된 값이면 표시하지 않는다", () => {
    expect(navigationProgress(0)).toBeNull();
    expect(navigationProgress(Number.NaN)).toBeNull();
  });
});
