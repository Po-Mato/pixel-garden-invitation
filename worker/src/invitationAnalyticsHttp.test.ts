import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./security", () => ({ verifyAdminToken: vi.fn() }));
vi.mock("./invitationAnalyticsRepository", () => ({
  analyticsLocalDate: vi.fn(() => "2026-07-22"),
  recordInvitationAnalytics: vi.fn(),
  getInvitationAnalytics: vi.fn()
}));

import {
  handleAdminInvitationAnalyticsRequest,
  handlePublicInvitationAnalyticsRequest
} from "./invitationAnalyticsHttp";
import * as repository from "./invitationAnalyticsRepository";
import { verifyAdminToken } from "./security";
import type { Env } from "./index";

const mockedRepository = vi.mocked(repository);
const mockedVerify = vi.mocked(verifyAdminToken);
const env = {
  DB: {} as D1Database,
  RSVP_ADMIN_SESSION_SECRET: "session-secret"
} as Env;

describe("invitation analytics HTTP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRepository.recordInvitationAnalytics.mockResolvedValue(true);
    mockedRepository.getInvitationAnalytics.mockResolvedValue({
      range: { from: "2026-07-16", to: "2026-07-22", days: 7 },
      totals: {
        visits: 0, returningVisits: 0, gameEntries: 0, simpleEntries: 0,
        directionsViews: 0, mapClicks: 0, callClicks: 0, shareClicks: 0, calendarClicks: 0,
        rsvpViews: 0, rsvpStarts: 0, rsvpSubmits: 0, rsvpResponses: 0, attendingGuests: 0,
        guestbookViews: 0, guestbookMessages: 0, galleryViews: 0, galleryZooms: 0,
        clientErrors: 0, pageLoadSamples: 0, averagePageLoadMs: null
      },
      daily: [],
      breakdowns: { devices: [], modes: [], maps: [], shares: [], calendars: [] },
      generatedAt: "2026-07-22T00:00:00.000Z"
    });
    mockedVerify.mockResolvedValue({ invitationId: "sample-garden", expiresAt: Date.now() + 60_000 });
  });

  it("허용된 집계 이벤트 묶음만 저장한다", async () => {
    const response = await handlePublicInvitationAnalyticsRequest(new Request(
      "https://worker.test/api/invitations/sample-garden/analytics/events",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events: [
          { name: "visit", dimension: "entry:new:mobile" },
          { name: "page_load", dimension: "mobile", value: 900 }
        ] })
      }
    ), env, "sample-garden");
    expect(response.status).toBe(204);
    expect(mockedRepository.recordInvitationAnalytics).toHaveBeenCalledWith(
      env.DB,
      "sample-garden",
      expect.arrayContaining([expect.objectContaining({ name: "visit" })])
    );
  });

  it("임의 이벤트·차원·성능 값을 거부한다", async () => {
    for (const event of [
      { name: "unknown", dimension: "x" },
      { name: "map_click", dimension: "unknown" },
      { name: "page_load", dimension: "mobile", value: 60_001 }
    ]) {
      const response = await handlePublicInvitationAnalyticsRequest(new Request("https://worker.test", {
        method: "POST",
        body: JSON.stringify({ events: [event] })
      }), env, "sample-garden");
      expect(response.status).toBe(400);
    }
    expect(mockedRepository.recordInvitationAnalytics).not.toHaveBeenCalled();
  });

  it("관리자 인증과 날짜 검증 후 집계만 반환한다", async () => {
    const request = new Request("https://worker.test/api/invitations/sample-garden/admin/analytics?from=2026-07-16&to=2026-07-22", {
      headers: { authorization: "Bearer admin-token" }
    });
    const response = await handleAdminInvitationAnalyticsRequest(request, env, "sample-garden");
    expect(response.status).toBe(200);
    expect(mockedVerify).toHaveBeenCalledWith("admin-token", "session-secret", "sample-garden", expect.any(Number));
    expect(mockedRepository.getInvitationAnalytics).toHaveBeenCalledWith(env.DB, "sample-garden", {
      from: "2026-07-16",
      to: "2026-07-22"
    });
  });

  it("인증 실패와 잘못된 기간을 구분한다", async () => {
    mockedVerify.mockResolvedValueOnce(null);
    const unauthorized = await handleAdminInvitationAnalyticsRequest(new Request("https://worker.test/api/invitations/sample-garden/admin/analytics", {
      headers: { authorization: "Bearer invalid" }
    }), env, "sample-garden");
    const invalid = await handleAdminInvitationAnalyticsRequest(new Request("https://worker.test/api/invitations/sample-garden/admin/analytics?from=2026-07-23&to=2026-07-22", {
      headers: { authorization: "Bearer valid" }
    }), env, "sample-garden");
    expect(unauthorized.status).toBe(401);
    expect(invalid.status).toBe(400);
  });
});
