import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PhotoFrameGalleryItem } from "@wedding-game/shared";
import type { Env } from "./index";

const repository = vi.hoisted(() => ({
  createPhotoFrameGallerySubmission: vi.fn(),
  listAdminPhotoFrameGallery: vi.fn(),
  listApprovedPhotoFrameGallery: vi.fn(),
  moderatePhotoFrameGallerySubmission: vi.fn()
}));
const security = vi.hoisted(() => ({ hashClientKey: vi.fn(), verifyAdminToken: vi.fn() }));

vi.mock("./photoFrameGalleryRepository", () => repository);
vi.mock("./security", () => security);

import { handleAdminPhotoFrameGalleryRequest, handlePublicPhotoFrameGalleryRequest } from "./photoFrameGalleryHttp";

const approved: PhotoFrameGalleryItem = {
  id: "frame_approved",
  contributorName: "꽃하객",
  design: {
    label: "정원 리본",
    photoTransform: { zoom: 1.2, offsetX: 0.1, offsetY: -0.2, rotation: 2 },
    stickerText: "행복하세요",
    stickerStyle: { tone: "rose", font: "hand" },
    stickerTransform: { x: 0.6, y: 0.3, scale: 1.1, rotation: -3 }
  },
  status: "approved",
  createdAt: "2026-07-31T01:00:00.000Z",
  reviewedAt: "2026-07-31T02:00:00.000Z"
};

function env(): Env {
  return {
    DB: {} as D1Database,
    GARDEN_ROOM: {} as DurableObjectNamespace,
    RSVP_ADMIN_PASSWORD_HASH: "hash",
    RSVP_ADMIN_SESSION_SECRET: "session-secret",
    RSVP_CLIENT_KEY_SECRET: "client-secret",
    RSVP_ALLOWED_ORIGINS: "https://po-mato.github.io"
  };
}

describe("photo frame gallery HTTP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    security.hashClientKey.mockResolvedValue("client-hash");
    security.verifyAdminToken.mockResolvedValue({ invitationId: "sample-garden", expiresAt: Date.now() + 60_000 });
    repository.listApprovedPhotoFrameGallery.mockResolvedValue([approved]);
    repository.createPhotoFrameGallerySubmission.mockResolvedValue({ ...approved, id: "frame_pending", status: "pending", reviewedAt: null });
    repository.listAdminPhotoFrameGallery.mockResolvedValue({
      items: [approved],
      generatedAt: "2026-07-31T02:00:00.000Z",
      counts: { pending: 0, approved: 1, rejected: 0 }
    });
    repository.moderatePhotoFrameGallerySubmission.mockResolvedValue(approved);
  });

  it("공개 목록에는 저장소가 돌려준 승인 프레임만 캐시해 노출한다", async () => {
    const response = await handlePublicPhotoFrameGalleryRequest(
      new Request("https://worker.test/api/invitations/sample-garden/photo-frame-gallery"),
      env(),
      "127.0.0.1",
      "sample-garden"
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("stale-while-revalidate");
    await expect(response.json()).resolves.toMatchObject({ items: [approved] });
  });

  it("하객 제출을 승인 대기 저장소로 전달한다", async () => {
    const response = await handlePublicPhotoFrameGalleryRequest(
      new Request("https://worker.test/api/invitations/sample-garden/photo-frame-gallery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contributorName: approved.contributorName, design: approved.design })
      }),
      env(),
      "127.0.0.1",
      "sample-garden"
    );
    expect(response.status).toBe(201);
    expect(repository.createPhotoFrameGallerySubmission).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      invitationId: "sample-garden",
      clientHash: "client-hash",
      contributorName: "꽃하객"
    }));
  });

  it("인증된 관리자만 프레임을 승인한다", async () => {
    const unauthorized = await handleAdminPhotoFrameGalleryRequest(
      new Request("https://worker.test/api/invitations/sample-garden/admin/photo-frame-gallery/frame_approved", { method: "PATCH" }),
      env(),
      "sample-garden",
      "frame_approved"
    );
    expect(unauthorized.status).toBe(401);

    const response = await handleAdminPhotoFrameGalleryRequest(
      new Request("https://worker.test/api/invitations/sample-garden/admin/photo-frame-gallery/frame_approved", {
        method: "PATCH",
        headers: { authorization: "Bearer admin-token", "content-type": "application/json" },
        body: JSON.stringify({ status: "approved" })
      }),
      env(),
      "sample-garden",
      "frame_approved"
    );
    expect(response.status).toBe(200);
    expect(repository.moderatePhotoFrameGallerySubmission).toHaveBeenCalledWith(expect.anything(), {
      invitationId: "sample-garden",
      submissionId: "frame_approved",
      status: "approved"
    });
  });
});
