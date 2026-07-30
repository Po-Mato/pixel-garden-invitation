import { describe, expect, it } from "vitest";
import {
  commitPhotoFrameHistory,
  createPhotoCompositionTemplate,
  createPhotoFrameHistory,
  loadPhotoCompositionTemplates,
  normalizePhotoFrameTransform,
  normalizePhotoStickerTransform,
  normalizePhotoStickerText,
  panPhotoFrameTransform,
  photoFramePresetTransform,
  photoFramePreviewStyle,
  redoPhotoFrameHistory,
  resolveCoverCrop,
  rotatePhotoFrameTransform,
  savePhotoCompositionTemplates,
  undoPhotoFrameHistory,
  zoomPhotoFrameTransform
} from "./photoFrameEditor";

describe("photoFrameEditor", () => {
  it("확대와 초점을 이미지 경계 안의 cover 영역으로 계산한다", () => {
    const crop = resolveCoverCrop({ sourceWidth: 1600, sourceHeight: 900, targetWidth: 800, targetHeight: 600, transform: { zoom: 1.5, offsetX: 1, offsetY: -1 } });
    expect(crop.x).toBeGreaterThan(700);
    expect(crop.y).toBe(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(1600);
  });

  it("편집 수치와 문구 길이를 허용 범위로 제한한다", () => {
    expect(normalizePhotoFrameTransform({ zoom: 5, offsetX: -3, offsetY: 4, rotation: 30 })).toEqual({ zoom: 1.6, offsetX: -1, offsetY: 1, rotation: 12 });
    expect(normalizePhotoStickerText("  오래   행복하세요  ", 8)).toBe("오래 행복하세요");
  });

  it("드래그와 핀치 입력을 허용 범위의 초점 값으로 변환한다", () => {
    const panned = panPhotoFrameTransform({ zoom: 1.2, offsetX: 0, offsetY: 0 }, 40, -20, 200, 100);
    expect(panned.offsetX).toBeLessThan(0);
    expect(panned.offsetY).toBeGreaterThan(0);
    expect(zoomPhotoFrameTransform(panned, 2).zoom).toBe(1.6);
  });

  it("구도 프리셋과 회전 편집을 실행 취소하고 다시 실행한다", () => {
    const preset = photoFramePresetTransform("portrait");
    const rotated = rotatePhotoFrameTransform(preset, 3);
    const edited = commitPhotoFrameHistory(commitPhotoFrameHistory(createPhotoFrameHistory(), preset), rotated);
    expect(edited.current).toEqual(expect.objectContaining({ zoom: 1.25, rotation: 3 }));
    const undone = undoPhotoFrameHistory(edited);
    expect(undone.current.rotation).toBe(0);
    expect(redoPhotoFrameHistory(undone).current.rotation).toBe(3);
    expect(photoFramePreviewStyle({ ...rotated, rotation: 12 }).transform).toMatch(/scale\(1\.[3-9]/);
  });

  it("문구 스티커 좌표를 제한하고 사용자 웨딩 프레임을 다시 불러온다", () => {
    expect(normalizePhotoStickerTransform({ x: -1, y: 3, scale: 4, rotation: -90 })).toEqual({ x: 0.08, y: 0.92, scale: 1.5, rotation: -30 });
    let saved = "";
    const template = createPhotoCompositionTemplate(
      { zoom: 1.2, offsetX: 0.1, offsetY: -0.2, rotation: 2 },
      { tone: "sage", font: "hand" },
      { x: 0.3, y: 0.7, scale: 1.1, rotation: -5 },
      0,
      "frame-test"
    );
    expect(savePhotoCompositionTemplates([template], { getItem: () => saved, setItem: (_key, value) => { saved = value; } })).toBe(true);
    expect(loadPhotoCompositionTemplates({ getItem: () => saved, setItem: () => undefined })).toEqual([template]);
  });
});
