import { describe, expect, it } from "vitest";
import type { InvitationAnalyticsDaily } from "@wedding-game/shared";
import { analyzeDeviceQaTrend } from "./deviceQaTrend";

function day(date: string, reports: number, issues: number): InvitationAnalyticsDaily {
  return {
    date,
    visits: 0,
    returningVisits: 0,
    gameEntries: 0,
    simpleEntries: 0,
    rsvpResponses: 0,
    guestbookMessages: 0,
    shares: 0,
    clientErrors: 0,
    deviceQaReports: reports,
    deviceQaIssues: issues
  };
}

describe("analyzeDeviceQaTrend", () => {
  it("최근 불편률이 뚜렷하게 상승하면 회귀 경고를 만든다", () => {
    const daily = [
      day("2026-07-17", 4, 0), day("2026-07-18", 4, 0),
      day("2026-07-24", 4, 2), day("2026-07-25", 4, 2)
    ];
    const result = analyzeDeviceQaTrend(daily, 2);
    expect(result.status).toBe("regression");
    expect(result.currentRate).toBe(0.5);
    expect(result.rateDelta).toBe(0.5);
  });

  it("비교 표본이 작으면 성급하게 경고하지 않는다", () => {
    expect(analyzeDeviceQaTrend([day("2026-07-30", 1, 1)]).status).toBe("insufficient");
  });
});
