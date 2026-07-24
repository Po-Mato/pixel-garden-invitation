import { describe, expect, it } from "vitest";
import { buildGalleryFormatSrcSet, gallerySourcePathForFormat, resolveGalleryAssetPath } from "./galleryAssets";

describe("갤러리 자산 경로", () => {
  it("Worker가 제공하는 절대 미디어 URL은 그대로 사용한다", () => {
    const url = "https://worker.test/media/invitations/sample/gallery/photo-1024.webp";
    expect(resolveGalleryAssetPath(url, "/pixel-garden-invitation/")).toBe(url);
  });

  it("Pages 기준 경로와 자산 경로의 슬래시를 정규화한다", () => {
    expect(resolveGalleryAssetPath("images/wedding-gallery/01-cover-1024.webp", "./"))
      .toBe("./images/wedding-gallery/01-cover-1024.webp");
    expect(resolveGalleryAssetPath("/images/wedding-gallery/01-cover-1024.webp", "/pixel-garden-invitation"))
      .toBe("/pixel-garden-invitation/images/wedding-gallery/01-cover-1024.webp");
  });

  it("정적 WebP 소스에만 AVIF 대체 경로를 만든다", () => {
    expect(gallerySourcePathForFormat("images/wedding-gallery/photo-640.webp", "avif"))
      .toBe("images/wedding-gallery/photo-640.avif");
    expect(gallerySourcePathForFormat("https://worker.test/photo-640.webp", "avif")).toBeNull();
    expect(buildGalleryFormatSrcSet([
      { assetPath: "images/wedding-gallery/photo-640.webp", width: 640 },
      { assetPath: "images/wedding-gallery/photo-1024.webp", width: 1024 }
    ], "avif", "./")).toContain("photo-1024.avif 1024w");
  });
});
