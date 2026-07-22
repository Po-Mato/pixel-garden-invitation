import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAdminInvitationReminders, recordAdminInvitationReminders } from "./invitationRemindersApi";

const result = {
  summary: { totalSent: 0, uniqueGuests: 0, lastSentAt: null, byStage: { d30: 0, d14: 0, d7: 0, d1: 0, manual: 0 } },
  events: []
};

describe("invitation reminders API", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" }
    })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("관리자 인증으로 이력을 조회하고 발송 기록을 저장한다", async () => {
    await fetchAdminInvitationReminders("admin-token");
    await recordAdminInvitationReminders("admin-token", {
      linkIds: ["invite_abc"], stage: "d14", channel: "kakao", note: "재안내"
    });
    expect(fetch).toHaveBeenNthCalledWith(1, expect.stringContaining("/api/invitations/sample-garden/admin/reminders"), expect.objectContaining({
      method: "GET",
      headers: expect.objectContaining({ authorization: "Bearer admin-token" })
    }));
    expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining("/api/invitations/sample-garden/admin/reminders"), expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ linkIds: ["invite_abc"], stage: "d14", channel: "kakao", note: "재안내" })
    }));
  });
});
