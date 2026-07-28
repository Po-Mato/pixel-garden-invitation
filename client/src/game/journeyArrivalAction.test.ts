import { describe, expect, it } from "vitest";
import { journeyArrivalAction } from "./journeyArrivalAction";

describe("journeyArrivalAction", () => {
  it("완료 직후 계획상 다음 목적지를 연결한다", () => {
    expect(journeyArrivalAction({
      version: 1,
      completedIds: ["directions"],
      updatedAt: null
    }, "directions", ["bride", "gallery"])).toMatchObject({
      completedLabel: "오시는 길",
      nextCheckpointId: "bride",
      nextLabel: "신부에게 인사"
    });
  });

  it("예식홀 다음에는 연회장 행동을 구체적으로 안내한다", () => {
    expect(journeyArrivalAction({
      version: 1,
      completedIds: ["directions", "gallery", "bride", "ceremony"],
      updatedAt: null
    }, "ceremony", ["guestbook"])?.detail).toContain("연회장");
  });

  it("여정을 모두 완료하면 다음 행동을 만들지 않는다", () => {
    expect(journeyArrivalAction({
      version: 1,
      completedIds: ["directions", "gallery", "bride", "ceremony", "guestbook"],
      updatedAt: null
    }, "guestbook", [])).toBeNull();
  });
});
