import { describe, expect, it } from "vitest";
import { weddingContent } from "./weddingContent";
import {
  buildDefaultEditableInvitationGallery,
  editableInvitationGalleryPublishIssues,
  parseEditableInvitationGallery
} from "./editableInvitationGallery";

describe("editable invitation gallery", () => {
  it("현재 10개 사진을 공개 전 초안으로 만든다", () => {
    const gallery = buildDefaultEditableInvitationGallery(weddingContent);
    expect(gallery.photos).toHaveLength(10);
    expect(gallery.photos.every((photo) => photo.assetId === null)).toBe(true);
    expect(editableInvitationGalleryPublishIssues(gallery)).toEqual(["images"]);
  });

  it("고정 슬롯 순서와 레이아웃을 보존한 유효한 갤러리를 파싱한다", () => {
    const gallery = buildDefaultEditableInvitationGallery(weddingContent);
    gallery.photos.forEach((photo, index) => {
      photo.assetId = `12345678-1234-4${String(index).padStart(3, "0")}-8123-123456789abc`;
    });
    expect(parseEditableInvitationGallery(gallery, weddingContent.gallery)).toEqual(gallery);
    expect(editableInvitationGalleryPublishIssues(gallery)).toEqual([]);
  });

  it("순서 변경, 방향 불일치와 잘못된 자산 ID를 거부한다", () => {
    const gallery = buildDefaultEditableInvitationGallery(weddingContent);
    [gallery.photos[0], gallery.photos[1]] = [gallery.photos[1], gallery.photos[0]];
    expect(parseEditableInvitationGallery(gallery, weddingContent.gallery)).toBeNull();

    const invalidOrientation = buildDefaultEditableInvitationGallery(weddingContent);
    invalidOrientation.photos[0].height = invalidOrientation.photos[0].width + 1;
    expect(parseEditableInvitationGallery(invalidOrientation, weddingContent.gallery)).toBeNull();

    const invalidAsset = buildDefaultEditableInvitationGallery(weddingContent);
    invalidAsset.photos[0].assetId = "not-an-asset";
    expect(parseEditableInvitationGallery(invalidAsset, weddingContent.gallery)).toBeNull();
  });

  it("대체 텍스트가 비어 있으면 공개 차단 사유를 반환한다", () => {
    const gallery = buildDefaultEditableInvitationGallery(weddingContent);
    gallery.photos.forEach((photo, index) => {
      photo.assetId = `12345678-1234-4${String(index).padStart(3, "0")}-8123-123456789abc`;
    });
    gallery.photos[2].alt = "";
    expect(editableInvitationGalleryPublishIssues(gallery)).toEqual(["alt_text"]);
  });
});
