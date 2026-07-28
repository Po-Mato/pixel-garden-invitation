import { describe, expect, it } from "vitest";
import { routeArrivalCue } from "./routeArrivalGuidance";

describe("목적지 도착 단계 안내", () => {
  it("마지막 세 타일에서 포털 안내를 단계별로 제공한다", () => {
    expect(routeArrivalCue(3, "동네로 나가기", true)).toEqual({
      remainingTiles: 3,
      eyebrow: "3타일 앞",
      message: "포털 진입 방향을 확인하세요"
    });
    expect(routeArrivalCue(1, "동네로 나가기", true)?.message).toBe("곧 다음 맵으로 이동해요");
  });

  it("일반 목적지는 이름을 포함하고 범위 밖에서는 표시하지 않는다", () => {
    expect(routeArrivalCue(3, "오시는 길", false)?.message).toBe("오시는 길 진입을 준비하세요");
    expect(routeArrivalCue(4, "오시는 길", false)).toBeNull();
    expect(routeArrivalCue(0, "오시는 길", false)).toBeNull();
  });
});
