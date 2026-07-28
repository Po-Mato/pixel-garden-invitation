import { describe, expect, it } from "vitest";
import { routeRecalculationResult } from "./routeDeviation";

describe("route deviation", () => {
  it("describes a longer detour after leaving the route", () => {
    expect(routeRecalculationResult(6, 9)).toEqual({
      deltaTiles: 3,
      notice: "우회 +3타일",
      kind: "detour"
    });
  });

  it("describes equal and shorter recalculated routes", () => {
    expect(routeRecalculationResult(6, 6).notice).toBe("자동 재탐색 완료");
    expect(routeRecalculationResult(6, 4).notice).toBe("새 경로 2타일 단축");
  });
});
