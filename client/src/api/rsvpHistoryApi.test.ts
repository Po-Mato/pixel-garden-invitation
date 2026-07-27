import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAdminRsvpHistory } from "./rsvpHistoryApi";

afterEach(() => vi.unstubAllGlobals());

describe("RSVP history API", () => {
  it("인코딩된 RSVP 식별자와 관리자 토큰으로 조회한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      rsvpId: "rsvp/1",
      entries: []
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAdminRsvpHistory("admin-token", "rsvp/1")).resolves.toEqual({
      rsvpId: "rsvp/1",
      entries: []
    });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/admin/rsvps/rsvp%2F1/history"), {
      method: "GET",
      headers: { authorization: "Bearer admin-token" }
    });
  });
});
