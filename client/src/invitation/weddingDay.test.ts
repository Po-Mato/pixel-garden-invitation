import { invitationContent } from "@wedding-game/shared";
import { describe, expect, it } from "vitest";
import { getWeddingDayPreviewNow, getWeddingDayStatus } from "./weddingDay";

const event = invitationContent.event;

describe("예식 당일 상태", () => {
  it("한국 시간 기준 다른 날짜에는 비활성화한다", () => {
    expect(getWeddingDayStatus(event, new Date("2027-04-30T14:59:59.999Z"))).toBeNull();
    expect(getWeddingDayStatus(event, new Date("2027-05-01T15:00:00.000Z"))).toBeNull();
  });

  it("시작 전 남은 시간을 올림해 안내한다", () => {
    expect(getWeddingDayStatus(event, new Date("2027-05-01T06:39:30.000Z"))).toEqual({
      phase: "before",
      headline: "예식까지 1시간 31분",
      detail: "교통과 주차 시간을 고려해 여유 있게 출발해주세요."
    });
  });

  it("시작 시각부터 종료 직전까지 진행 중으로 표시한다", () => {
    expect(getWeddingDayStatus(event, new Date("2027-05-01T08:10:00.000Z"))).toEqual({
      phase: "in-progress",
      headline: "예식이 진행 중이에요",
      detail: "5층 파티오볼룸으로 바로 이동해주세요."
    });
    expect(getWeddingDayStatus(event, new Date("2027-05-01T09:39:59.999Z"))?.phase).toBe("in-progress");
  });

  it("종료 시각부터 당일 자정 전까지 감사 인사를 표시한다", () => {
    expect(getWeddingDayStatus(event, new Date("2027-05-01T09:40:00.000Z"))?.phase).toBe("after");
  });

  it("미리보기 시각은 예식 시작 45분 전이다", () => {
    expect(getWeddingDayPreviewNow(event).toISOString()).toBe("2027-05-01T07:25:00.000Z");
  });
});
