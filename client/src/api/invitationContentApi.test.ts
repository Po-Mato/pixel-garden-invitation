import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDefaultEditableInvitationContent, invitationContent } from "@wedding-game/shared";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("invitation content API", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubEnv("VITE_WORKER_URL", "https://worker.test/");
    vi.stubEnv("VITE_INVITATION_ID", "sample-garden");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ content: null, revision: null, publishedAt: null }));
  });

  it("공개본을 인증 없이 조회한다", async () => {
    const { fetchPublishedInvitationContent } = await import("./invitationContentApi");
    await fetchPublishedInvitationContent();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://worker.test/api/invitations/sample-garden/content",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("관리자 토큰으로 초안 저장·공개·복구 요청을 구분한다", async () => {
    const content = buildDefaultEditableInvitationContent(invitationContent.event, invitationContent.content);
    fetchMock.mockImplementation(async () => jsonResponse({
      draft: content,
      revision: 2,
      publishedRevision: 2,
      updatedAt: "2026-07-22T00:00:00.000Z",
      publishedAt: "2026-07-22T00:00:00.000Z",
      history: []
    }));
    const {
      publishAdminInvitationContent,
      restoreAdminInvitationContent,
      saveAdminInvitationContent
    } = await import("./invitationContentApi");

    await saveAdminInvitationContent("token", content, 1);
    await publishAdminInvitationContent("token", 2);
    await restoreAdminInvitationContent("token", "content_1", 2);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://worker.test/api/invitations/sample-garden/admin/content", {
      method: "PATCH",
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      body: JSON.stringify({ content, revision: 1 })
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://worker.test/api/invitations/sample-garden/admin/content/publish", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, "https://worker.test/api/invitations/sample-garden/admin/content/restore", expect.objectContaining({ body: JSON.stringify({ versionId: "content_1", revision: 2 }) }));
  });
});
