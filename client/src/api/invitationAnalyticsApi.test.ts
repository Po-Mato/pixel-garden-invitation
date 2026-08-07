import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAdminInvitationAnalytics,
  postInvitationAnalyticsEvents,
  reviewAdminInvitationQualityCalibration,
  updateAdminInvitationPerformanceMode
} from "./invitationAnalyticsApi";

describe("invitation analytics API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("공개 행동 이벤트를 일괄 전송한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await postInvitationAnalyticsEvents({ events: [{ name: "map_click", dimension: "naver" }] });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/analytics/events"),
      expect.objectContaining({ method: "POST", keepalive: true })
    );
  });

  it("관리자 토큰과 기간으로 통계를 조회한다", async () => {
    const body = { range: { from: "2026-07-16", to: "2026-07-22", days: 7 } };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" }
    }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchAdminInvitationAnalytics("admin-token", {
      from: "2026-07-16",
      to: "2026-07-22"
    })).resolves.toEqual(body);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/admin\/analytics\?from=2026-07-16&to=2026-07-22/),
      expect.objectContaining({ headers: { authorization: "Bearer admin-token" } })
    );
  });

  it("관리자 성능 운영 모드를 변경한다", async () => {
    const body = { mode: "safe-default" };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" }
    }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(updateAdminInvitationPerformanceMode("admin-token", "safe-default")).resolves.toEqual(body);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/admin/analytics"), {
      method: "POST",
      headers: {
        authorization: "Bearer admin-token",
        "content-type": "application/json"
      },
      body: JSON.stringify({ performanceMode: "safe-default" })
    });
  });

  it("주간 보정 후보의 수동 검토 결정을 기록한다", async () => {
    const body = { currentWeekStart: "2026-08-03", eligible: true, pendingCount: 2, snapshots: [] };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" }
    }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(reviewAdminInvitationQualityCalibration("admin-token", {
      weekStart: "2026-08-03",
      metricKey: "long-frame",
      decision: "approve-candidate"
    })).resolves.toEqual(body);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/admin/analytics"), expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ qualityCalibrationReview: {
        weekStart: "2026-08-03",
        metricKey: "long-frame",
        decision: "approve-candidate"
      } })
    }));
  });
});
