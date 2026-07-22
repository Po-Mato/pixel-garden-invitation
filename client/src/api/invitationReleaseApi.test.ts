import { beforeEach, describe, expect, it, vi } from "vitest";

describe("invitation release API", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VITE_WORKER_URL", "https://worker.test/");
    vi.stubEnv("VITE_INVITATION_ID", "sample-garden");
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({
      content: { draftRevision: 1 },
      gallery: { draftRevision: 2 },
      history: []
    }), { status: 200, headers: { "content-type": "application/json" } }));
  });

  it("상태 조회와 통합 공개 작업을 인증된 경로로 전송한다", async () => {
    const api = await import("./invitationReleaseApi");
    await api.fetchPublishedInvitationRelease();
    await api.fetchAdminInvitationRelease("token");
    await api.publishAdminInvitationRelease("token", 1, 2);
    await api.scheduleAdminInvitationRelease("token", 1, 2, "2027-01-01T00:00:00.000Z");
    await api.cancelAdminInvitationReleaseSchedule("token");
    await api.restoreAdminInvitationRelease("token", "release_1");

    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://worker.test/api/invitations/sample-garden/release", expect.objectContaining({ method: "GET" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://worker.test/api/invitations/sample-garden/admin/releases", expect.objectContaining({ method: "GET" }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, "https://worker.test/api/invitations/sample-garden/admin/releases/publish", expect.objectContaining({ body: JSON.stringify({ contentRevision: 1, galleryRevision: 2 }) }));
    expect(fetchMock).toHaveBeenNthCalledWith(4, "https://worker.test/api/invitations/sample-garden/admin/releases/schedule", expect.objectContaining({ body: JSON.stringify({ contentRevision: 1, galleryRevision: 2, scheduledFor: "2027-01-01T00:00:00.000Z" }) }));
    expect(fetchMock).toHaveBeenNthCalledWith(5, "https://worker.test/api/invitations/sample-garden/admin/releases/cancel", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenNthCalledWith(6, "https://worker.test/api/invitations/sample-garden/admin/releases/restore", expect.objectContaining({ body: JSON.stringify({ releaseId: "release_1" }) }));
  });
});
