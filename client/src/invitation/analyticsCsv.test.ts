import { describe, expect, it } from "vitest";
import type { InvitationAnalyticsAdminResult } from "@wedding-game/shared";
import { buildInvitationAnalyticsCsv } from "./analyticsCsv";

describe("analytics CSV", () => {
  it("일별 집계만 한국어 열로 내보낸다", () => {
    const result = {
      range: { from: "2026-07-22", to: "2026-07-22", days: 1 },
      daily: [{
        date: "2026-07-22",
        visits: 3,
        returningVisits: 1,
        gameEntries: 2,
        simpleEntries: 1,
        rsvpResponses: 1,
        guestbookMessages: 2,
        shares: 1,
        clientErrors: 0
      }]
    } as InvitationAnalyticsAdminResult;
    expect(buildInvitationAnalyticsCsv(result)).toContain("날짜,방문,재방문");
    expect(buildInvitationAnalyticsCsv(result)).toContain("2026-07-22,3,1,2,1,1,2,1,0");
  });
});
