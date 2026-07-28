import { describe, expect, it } from "vitest";
import { createEmptyJourneyProgress } from "./journeyProgress";
import { smartJourneyRecommendation } from "./smartJourneyRecommendation";

const event = {
  startAt: "2027-05-01T17:10:00+09:00",
  endAt: "2027-05-01T18:40:00+09:00"
};

describe("smartJourneyRecommendation", () => {
  it.each([
    ["2027-05-01T13:00:00+09:00", "arrival", "directions"],
    ["2027-05-01T16:10:00+09:00", "greeting", "bride"],
    ["2027-05-01T17:00:00+09:00", "ceremony-soon", "ceremony"],
    ["2027-05-01T17:30:00+09:00", "ceremony", "ceremony"],
    ["2027-05-01T19:00:00+09:00", "reception", "guestbook"]
  ] as const)("%s 시간대에 %s 목적지를 추천한다", (now, phase, checkpointId) => {
    expect(smartJourneyRecommendation(createEmptyJourneyProgress(), event, new Date(now))).toMatchObject({
      phase,
      checkpointId
    });
  });

  it("이미 완료한 목적지는 건너뛴다", () => {
    expect(smartJourneyRecommendation({
      version: 1,
      completedIds: ["bride"],
      updatedAt: null
    }, event, new Date("2027-05-01T16:10:00+09:00"))?.checkpointId).toBe("gallery");
  });

  it("예식 당일 운영 시간 밖에서는 기존 여정 순서를 유지하도록 추천하지 않는다", () => {
    expect(smartJourneyRecommendation(
      createEmptyJourneyProgress(),
      event,
      new Date("2027-04-30T12:00:00+09:00")
    )).toBeNull();
  });
});
