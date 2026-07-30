import { describe, expect, it } from "vitest";
import { parsePhotoFrameGallerySubmission } from "./photoFrameGallery";

const valid = {
  contributorName: "정원 하객",
  design: {
    label: "봄날 리본",
    photoTransform: { zoom: 1.2, offsetX: 0.1, offsetY: -0.2, rotation: 3 },
    stickerText: "오래 행복하세요",
    stickerStyle: { tone: "rose", font: "hand" },
    stickerTransform: { x: 0.6, y: 0.3, scale: 1.1, rotation: -4 }
  }
};

describe("포토프레임 공동 갤러리 입력", () => {
  it("공개 가능한 구도 값과 짧은 작성자 이름만 허용한다", () => {
    expect(parsePhotoFrameGallerySubmission(valid)).toMatchObject({
      contributorName: "정원 하객",
      design: { label: "봄날 리본", stickerText: "오래 행복하세요" }
    });
    expect(parsePhotoFrameGallerySubmission({ ...valid, contributorName: " ".repeat(3) })).toBeNull();
    expect(parsePhotoFrameGallerySubmission({
      ...valid,
      design: { ...valid.design, photoTransform: { ...valid.design.photoTransform, zoom: 9 } }
    })).toBeNull();
  });
});
