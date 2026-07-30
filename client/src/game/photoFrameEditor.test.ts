import { describe, expect, it } from "vitest";
import { normalizePhotoFrameTransform, normalizePhotoStickerText, resolveCoverCrop } from "./photoFrameEditor";

describe("photoFrameEditor", () => {
  it("확대와 초점을 이미지 경계 안의 cover 영역으로 계산한다", () => {
    const crop = resolveCoverCrop({ sourceWidth: 1600, sourceHeight: 900, targetWidth: 800, targetHeight: 600, transform: { zoom: 1.5, offsetX: 1, offsetY: -1 } });
    expect(crop.x).toBeGreaterThan(700);
    expect(crop.y).toBe(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(1600);
  });

  it("편집 수치와 문구 길이를 허용 범위로 제한한다", () => {
    expect(normalizePhotoFrameTransform({ zoom: 5, offsetX: -3, offsetY: 4 })).toEqual({ zoom: 1.6, offsetX: -1, offsetY: 1 });
    expect(normalizePhotoStickerText("  오래   행복하세요  ", 8)).toBe("오래 행복하세요");
  });
});
