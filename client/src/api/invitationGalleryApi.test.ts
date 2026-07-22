import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDefaultEditableInvitationGallery, weddingContent } from "@wedding-game/shared";

const fetchMock = vi.fn();
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("invitation gallery API", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubEnv("VITE_WORKER_URL", "https://worker.test/");
    vi.stubEnv("VITE_INVITATION_ID", "sample-garden");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(async () => jsonResponse({
      draft: null,
      revision: 0,
      publishedRevision: null,
      updatedAt: null,
      publishedAt: null,
      history: []
    }));
  });

  it("공개 갤러리와 관리자 초안 경로를 분리한다", async () => {
    const { fetchPublishedInvitationGallery, fetchAdminInvitationGallery } = await import("./invitationGalleryApi");
    await fetchPublishedInvitationGallery();
    await fetchAdminInvitationGallery("token");
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://worker.test/api/invitations/sample-garden/gallery", expect.objectContaining({ method: "GET" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://worker.test/api/invitations/sample-garden/admin/gallery", expect.objectContaining({ headers: { authorization: "Bearer token" } }));
  });

  it("WebP 파생본을 슬롯 정보와 함께 업로드한다", async () => {
    const { uploadAdminGalleryAsset } = await import("./invitationGalleryApi");
    const blob = new Blob(["webp"], { type: "image/webp" });
    await uploadAdminGalleryAsset("token", "01-cover", "asset-id", 640, blob);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://worker.test/api/invitations/sample-garden/admin/gallery/assets/asset-id/640",
      expect.objectContaining({
        method: "PUT",
        body: blob,
        headers: expect.objectContaining({ "x-gallery-slot-id": "01-cover" })
      })
    );
  });

  it("초안 저장 요청에 revision을 포함한다", async () => {
    const { saveAdminInvitationGallery } = await import("./invitationGalleryApi");
    const gallery = buildDefaultEditableInvitationGallery(weddingContent);
    await saveAdminInvitationGallery("token", gallery, 3);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://worker.test/api/invitations/sample-garden/admin/gallery",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ gallery, revision: 3 }) })
    );
  });
});
