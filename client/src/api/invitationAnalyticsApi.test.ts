import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAdminInvitationAnalytics,
  postInvitationAnalyticsEvents
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
});
