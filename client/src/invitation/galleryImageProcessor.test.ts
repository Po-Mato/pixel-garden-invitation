import { describe, expect, it } from "vitest";
import { calculateGalleryCropRect, validateGallerySourceFile } from "./galleryImageProcessor";

describe("gallery image processor", () => {
  it("가로 원본을 세로 슬롯 중앙에 cover 방식으로 자른다", () => {
    const crop = calculateGalleryCropRect(2400, 1600, 2 / 3, { focusX: 0, focusY: 0, zoom: 1 });
    expect(crop).toEqual({ x: expect.closeTo(666.666, 2), y: 0, width: expect.closeTo(1066.666, 2), height: 1600 });
  });

  it("초점과 확대값을 안전한 범위로 제한한다", () => {
    const crop = calculateGalleryCropRect(1600, 1200, 3 / 2, { focusX: 5, focusY: -5, zoom: 4 });
    expect(crop.x).toBeGreaterThan(0);
    expect(crop.y).toBe(0);
    expect(crop.width).toBeLessThan(1600);
  });

  it("지원 형식과 15MB 제한을 검사한다", () => {
    expect(validateGallerySourceFile(new File(["ok"], "photo.jpg", { type: "image/jpeg" }))).toBeNull();
    expect(validateGallerySourceFile(new File(["bad"], "photo.gif", { type: "image/gif" }))).toContain("JPG");
  });
});
