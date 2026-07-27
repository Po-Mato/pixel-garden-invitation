import { describe, expect, it } from "vitest";
import { journeyCheckpoints } from "./journeyProgress";
import { journeyAccessibilityGuide, quickInvitationHashForCheckpoint } from "./journeyAccessibility";

describe("journey accessibility", () => {
  it("게임의 모든 목적지를 간편 초대장 섹션에 연결한다", () => {
    expect(journeyCheckpoints.map((checkpoint) => quickInvitationHashForCheckpoint(checkpoint))).toEqual([
      "#directions",
      "#gallery",
      "#couple",
      "#schedule",
      "#guestbook"
    ]);
  });

  it("각 목적지에 계단 없는 이동과 편의시설 확인 안내를 제공한다", () => {
    for (const checkpoint of journeyCheckpoints) {
      const guide = journeyAccessibilityGuide(checkpoint);
      expect(guide.stepFree).toContain("계단");
      expect(guide.elevator).toContain("엘리베이터");
      expect(guide.restroom).toContain("화장실");
    }
  });
});
