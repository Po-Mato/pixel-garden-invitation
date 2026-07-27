import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAdminRsvpHistory, fetchOwnedRsvpHistory } from "./rsvpHistoryApi";

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

  it("기기에 저장된 편집 권한으로 본인 이력을 조회한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      rsvpId: "rsvp/owned",
      entries: []
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchOwnedRsvpHistory({ rsvpId: "rsvp/owned", editToken: "edit-token" });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/rsvps/rsvp%2Fowned/history"), {
      method: "GET",
      headers: { authorization: "Bearer edit-token" }
    });
  });
});
