import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAdminGuestAnnouncement,
  deleteAdminGuestInformationItem,
  fetchAdminGuestInformation,
  fetchGuestInformation,
  recordGuestInformationViews,
  updateAdminGuestFaq
} from "./guestInformationApi";

const announcement = {
  title: "공지",
  body: "내용",
  tone: "info" as const,
  active: true,
  pinned: false,
  startsAt: null,
  endsAt: null,
  actionKind: "none" as const,
  actionLabel: "",
  actionUrl: null,
  sortOrder: 100
};

describe("guest information API", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ announcements: [], faqs: [] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    })));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("공개 조회와 공지 조회 기록을 전송한다", async () => {
    await fetchGuestInformation();
    await recordGuestInformationViews(["notice_1"]);
    expect(fetch).toHaveBeenNthCalledWith(1, expect.stringContaining("/api/invitations/sample-garden/guest-information"), expect.objectContaining({ method: "GET" }));
    expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining("/api/invitations/sample-garden/guest-information/views"), expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ announcementIds: ["notice_1"] })
    }));
  });

  it("관리자 인증 헤더와 항목 경로를 사용한다", async () => {
    await fetchAdminGuestInformation("admin-token");
    await createAdminGuestAnnouncement("admin-token", announcement);
    await updateAdminGuestFaq("admin-token", "faq_1", {
      category: "예식 안내",
      question: "몇 층인가요?",
      answer: "5층입니다.",
      active: true,
      featured: true,
      sortOrder: 10
    });
    await deleteAdminGuestInformationItem("admin-token", "announcements", "notice_1");

    expect(fetch).toHaveBeenNthCalledWith(1, expect.stringContaining("/api/invitations/sample-garden/admin/guest-information"), expect.objectContaining({
      headers: expect.objectContaining({ authorization: "Bearer admin-token" })
    }));
    expect(fetch).toHaveBeenNthCalledWith(3, expect.stringContaining("/api/invitations/sample-garden/admin/guest-information/faqs/faq_1"), expect.objectContaining({ method: "PATCH" }));
    expect(fetch).toHaveBeenNthCalledWith(4, expect.stringContaining("/api/invitations/sample-garden/admin/guest-information/announcements/notice_1"), expect.objectContaining({ method: "DELETE" }));
  });
});
