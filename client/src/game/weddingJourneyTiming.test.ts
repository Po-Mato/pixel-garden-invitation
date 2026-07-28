import { describe, expect, it } from "vitest";
import { weddingJourneyTiming } from "./weddingJourneyTiming";

const event = {
  startAt: "2027-05-01T17:10:00+09:00",
  endAt: "2027-05-01T18:40:00+09:00"
};

describe("weddingJourneyTiming", () => {
  it("예식 전에는 날짜 또는 남은 시간을 표시한다", () => {
    expect(weddingJourneyTiming(event, new Date("2027-04-01T17:10:00+09:00"))?.label).toBe("예식까지 D-30");
    expect(weddingJourneyTiming(event, new Date("2027-05-01T16:25:00+09:00"))?.label).toBe("예식까지 45분");
  });

  it("40분 전부터 예식홀 최단 안내를 제공한다", () => {
    expect(weddingJourneyTiming(event, new Date("2027-05-01T16:40:00+09:00"))).toMatchObject({
      phase: "soon",
      urgent: true,
      showFastCeremonyRoute: true
    });
  });

  it("예식 중에는 경과 시간과 지각 안내를 제공한다", () => {
    expect(weddingJourneyTiming(event, new Date("2027-05-01T17:22:00+09:00"))).toMatchObject({
      phase: "ceremony",
      label: "예식 시작 12분 경과",
      showFastCeremonyRoute: true
    });
  });

  it("예식홀 방문을 마치면 빠른 경로 버튼을 숨긴다", () => {
    expect(weddingJourneyTiming(event, new Date("2027-05-01T17:22:00+09:00"), true)?.showFastCeremonyRoute).toBe(false);
  });
});
