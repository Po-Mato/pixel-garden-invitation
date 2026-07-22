import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDefaultEditableInvitationGallery,
  weddingContent,
  type InvitationGalleryAdminResult
} from "@wedding-game/shared";
import type { Env } from "./index";

const repository = vi.hoisted(() => ({
  getAdminInvitationGallery: vi.fn(),
  getPublicInvitationGallery: vi.fn(),
  isPublishedGalleryAsset: vi.fn(),
  publishInvitationGallery: vi.fn(),
  restoreInvitationGalleryVersion: vi.fn(),
  saveInvitationGalleryDraft: vi.fn()
}));
const security = vi.hoisted(() => ({ verifyAdminToken: vi.fn() }));

vi.mock("./invitationGalleryRepository", () => repository);
vi.mock("./security", async (importOriginal) => ({
  ...await importOriginal<typeof import("./security")>(),
  verifyAdminToken: security.verifyAdminToken
}));

import {
  handleAdminGalleryAssetRequest,
  handleAdminInvitationGalleryRequest,
  handlePublishedGalleryMediaRequest,
  handlePublicInvitationGalleryRequest
} from "./invitationGalleryHttp";

const assetId = "12345678-1234-4000-8123-123456789abc";

function completeGallery() {
  const gallery = buildDefaultEditableInvitationGallery(weddingContent);
  gallery.photos.forEach((photo, index) => {
    photo.assetId = `12345678-1234-4${String(index).padStart(3, "0")}-8123-123456789abc`;
  });
  return gallery;
}

function adminResult(): InvitationGalleryAdminResult {
  return {
    draft: completeGallery(),
    revision: 2,
    publishedRevision: null,
    updatedAt: "2026-07-22T03:00:00.000Z",
    publishedAt: null,
    history: []
  };
}

function webpBytes(): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode("RIFF0000WEBPpayload");
  const bytes = new Uint8Array(encoded.byteLength);
  bytes.set(encoded);
  return bytes;
}

function env() {
  const media = {
    get: vi.fn(),
    put: vi.fn()
  };
  return {
    value: {
      DB: {} as D1Database,
      GARDEN_ROOM: {} as DurableObjectNamespace,
      WEDDING_MEDIA: media as unknown as KVNamespace,
      RSVP_ADMIN_PASSWORD_HASH: "hash",
      RSVP_ADMIN_SESSION_SECRET: "session-secret",
      RSVP_CLIENT_KEY_SECRET: "client-secret",
      RSVP_ALLOWED_ORIGINS: "https://po-mato.github.io"
    } satisfies Env,
    media
  };
}

describe("invitation gallery HTTP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    security.verifyAdminToken.mockResolvedValue({ invitationId: "sample-garden", expiresAt: Date.now() + 1000 });
    repository.getAdminInvitationGallery.mockResolvedValue(adminResult());
    repository.getPublicInvitationGallery.mockResolvedValue({ gallery: null, revision: null, publishedAt: null });
    repository.saveInvitationGalleryDraft.mockResolvedValue({ ok: true, result: adminResult() });
    repository.publishInvitationGallery.mockResolvedValue({ ok: true, result: { ...adminResult(), publishedRevision: 2 } });
    repository.restoreInvitationGalleryVersion.mockResolvedValue({ ok: true, result: adminResult() });
    repository.isPublishedGalleryAsset.mockResolvedValue(true);
  });

  it("공개 갤러리가 없으면 캐시 가능한 빈 결과를 반환한다", async () => {
    const { value } = env();
    const response = await handlePublicInvitationGalleryRequest(
      new Request("https://worker.test/api/invitations/sample-garden/gallery"),
      value,
      "sample-garden"
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("max-age=60");
    await expect(response.json()).resolves.toEqual({ gallery: null, revision: null, publishedAt: null });
  });

  it("관리자 인증 없이 사진 초안을 조회하지 못한다", async () => {
    const { value } = env();
    const response = await handleAdminInvitationGalleryRequest(
      new Request("https://worker.test/api/invitations/sample-garden/admin/gallery"),
      value,
      "sample-garden",
      "gallery"
    );
    expect(response.status).toBe(401);
  });

  it("WebP 파생본만 제한된 키에 업로드한다", async () => {
    const { value, media } = env();
    const bytes = webpBytes();
    const response = await handleAdminGalleryAssetRequest(
      new Request(`https://worker.test/api/invitations/sample-garden/admin/gallery/assets/${assetId}/640`, {
        method: "PUT",
        headers: {
          authorization: "Bearer token",
          "content-type": "image/webp",
          "content-length": String(bytes.byteLength),
          "x-gallery-slot-id": "01-cover"
        },
        body: bytes
      }),
      value,
      "sample-garden",
      assetId,
      640
    );
    expect(response.status).toBe(201);
    expect(media.put).toHaveBeenCalledWith(
      `invitations/sample-garden/gallery/${assetId}-640.webp`,
      expect.any(Uint8Array),
      expect.objectContaining({ metadata: expect.objectContaining({ contentType: "image/webp" }) })
    );
  });

  it("공개 시 두 해상도의 KV 객체 존재를 확인한다", async () => {
    const { value, media } = env();
    media.get.mockResolvedValue(new ArrayBuffer(16));
    const response = await handleAdminInvitationGalleryRequest(
      new Request("https://worker.test/api/invitations/sample-garden/admin/gallery/publish", {
        method: "POST",
        headers: { authorization: "Bearer token", "content-type": "application/json" },
        body: JSON.stringify({ revision: 2 })
      }),
      value,
      "sample-garden",
      "publish"
    );
    expect(response.status).toBe(200);
    expect(media.get).toHaveBeenCalledTimes(20);
    expect(repository.publishInvitationGallery).toHaveBeenCalled();
  });

  it("공개 목록에 포함된 KV 사진만 장기 캐시로 제공한다", async () => {
    const { value, media } = env();
    media.get.mockResolvedValue(webpBytes().buffer);
    const response = await handlePublishedGalleryMediaRequest(
      new Request(`https://worker.test/media/invitations/sample-garden/gallery/${assetId}-1024.webp`),
      value,
      "sample-garden",
      assetId,
      1024
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("immutable");

    repository.isPublishedGalleryAsset.mockResolvedValue(false);
    const hidden = await handlePublishedGalleryMediaRequest(
      new Request(`https://worker.test/media/invitations/sample-garden/gallery/${assetId}-1024.webp`),
      value,
      "sample-garden",
      assetId,
      1024
    );
    expect(hidden.status).toBe(404);
  });
});
