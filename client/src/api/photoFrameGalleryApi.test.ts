import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAdminPhotoFrameGallery, fetchPublicPhotoFrameGallery, moderateAdminPhotoFrameGallery, submitPhotoFrameGallery } from "./photoFrameGalleryApi";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const input = {
  contributorName: "정원하객",
  design: {
    label: "정원 리본",
    photoTransform: { zoom: 1, offsetX: 0, offsetY: 0, rotation: 0 },
    stickerText: "축하해요",
    stickerStyle: { tone: "rose" as const, font: "hand" as const },
    stickerTransform: { x: 0.5, y: 0.3, scale: 1, rotation: 0 }
  }
};

beforeEach(() => fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 })));

describe("photoFrameGalleryApi", () => {
  it("공개 조회·승인 대기 제출·관리자 승인 경로를 분리한다", async () => {
    await fetchPublicPhotoFrameGallery();
    await submitPhotoFrameGallery(input);
    await fetchAdminPhotoFrameGallery("admin-token");
    await moderateAdminPhotoFrameGallery("admin-token", "frame_123", "approved");
    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining("/api/invitations/sample-garden/photo-frame-gallery"), expect.objectContaining({ method: "GET" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining("/api/invitations/sample-garden/photo-frame-gallery"), expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, expect.stringContaining("/api/invitations/sample-garden/admin/photo-frame-gallery"), expect.objectContaining({ headers: { authorization: "Bearer admin-token" } }));
    expect(fetchMock).toHaveBeenNthCalledWith(4, expect.stringContaining("/api/invitations/sample-garden/admin/photo-frame-gallery/frame_123"), expect.objectContaining({ method: "PATCH" }));
  });
});
