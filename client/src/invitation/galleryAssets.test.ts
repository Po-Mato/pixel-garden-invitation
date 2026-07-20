import { describe, expect, it } from "vitest";
import { resolveGalleryAssetPath } from "./galleryAssets";

describe("갤러리 자산 경로", () => {
  it("Pages 기준 경로와 자산 경로의 슬래시를 정규화한다", () => {
    expect(resolveGalleryAssetPath("images/wedding-gallery/01-cover-1024.webp", "./"))
      .toBe("./images/wedding-gallery/01-cover-1024.webp");
    expect(resolveGalleryAssetPath("/images/wedding-gallery/01-cover-1024.webp", "/pixel-garden-invitation"))
      .toBe("/pixel-garden-invitation/images/wedding-gallery/01-cover-1024.webp");
  });
});
