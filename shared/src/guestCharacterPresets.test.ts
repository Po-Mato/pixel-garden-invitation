import { describe, expect, it } from "vitest";
import {
  defaultCharacterAppearance,
  getDefaultAppearance,
  guestCharacterPresets,
  guestPresetFrame,
  parseCharacterAppearance,
  resolveGuestPreset
} from "./index";

describe("하객 완성 캐릭터 프리셋", () => {
  it("승인된 기준 이미지에서 복구한 12개 완성 하객 프리셋을 가진다", () => {
    expect(guestCharacterPresets).toHaveLength(12);
    expect(guestCharacterPresets.map((preset) => preset.id)).toEqual([
      "feminine-long-wave-dress",
      "feminine-formal-hanbok",
      "masculine-navy-suit",
      "masculine-charcoal-blazer",
      "feminine-sage-bolero-dress",
      "feminine-champagne-navy-skirt",
      "feminine-lavender-jacket-dress",
      "feminine-teal-modern-hanbok",
      "masculine-beige-summer-suit",
      "masculine-charcoal-burgundy-tie",
      "masculine-green-blazer-cream-pants",
      "masculine-blue-modern-hanbok"
    ]);
  });

  it("각 프리셋은 단일 통합 기준 이미지의 4x3 셀 crop을 사용한다", () => {
    const referenceImages = new Set(guestCharacterPresets.map((preset) => preset.reference.image));
    expect([...referenceImages]).toEqual([
      "character-assets/reference/guest-foundation-unified-reference-v1.png"
    ]);
    expect(guestCharacterPresets.map((preset) => preset.reference.crop)).toEqual([
      { left: 104, top: 40, width: 143, height: 387 },
      { left: 84, top: 869, width: 178, height: 367 },
      { left: 100, top: 462, width: 146, height: 384 },
      { left: 398, top: 461, width: 146, height: 385 },
      { left: 699, top: 39, width: 140, height: 388 },
      { left: 700, top: 869, width: 144, height: 367 },
      { left: 993, top: 39, width: 161, height: 388 },
      { left: 401, top: 39, width: 139, height: 388 },
      { left: 693, top: 462, width: 144, height: 384 },
      { left: 1004, top: 869, width: 135, height: 368 },
      { left: 1001, top: 461, width: 146, height: 385 },
      { left: 394, top: 867, width: 151, height: 369 }
    ]);
  });

  it("기존 하객 프레임 규격을 유지한다", () => {
    expect(guestPresetFrame.source).toEqual({ width: 96, height: 144 });
    expect(guestPresetFrame.walk.sheet).toEqual({ width: 288, height: 576 });
    expect(guestPresetFrame.idle.sheet).toEqual({ width: 192, height: 144 });
    expect(guestPresetFrame.display.world).toEqual({ width: 48, height: 72 });
    expect(guestPresetFrame.display.preview).toEqual({ width: 96, height: 144 });
  });

  it("기본 appearance는 첫 여성 프리셋이다", () => {
    expect(defaultCharacterAppearance).toEqual({ presetId: "feminine-long-wave-dress" });
    expect(getDefaultAppearance("masculine")).toEqual({ presetId: "masculine-navy-suit" });
  });

  it("프리셋 ID만 정상 appearance로 인정한다", () => {
    expect(parseCharacterAppearance({ presetId: "masculine-navy-suit" })).toEqual({
      presetId: "masculine-navy-suit"
    });
    expect(parseCharacterAppearance({ presetId: "missing" })).toEqual(defaultCharacterAppearance);
  });

  it("구버전 파츠 조합 appearance를 기본 프리셋으로 안전 변환한다", () => {
    expect(parseCharacterAppearance({
      family: "feminine",
      skinTone: "skin-02-fair",
      hairStyle: "feminine-long-wave",
      hairColor: "dark-brown",
      outfit: "feminine-midi-dress",
      outfitPalette: "dusty-rose",
      accessories: { face: null, jewelry: null, neckwear: null, carry: null }
    })).toEqual(defaultCharacterAppearance);
  });

  it("프리셋 조회 실패 시 기본 프리셋으로 대체한다", () => {
    expect(resolveGuestPreset({ presetId: "missing" }).id).toBe("feminine-long-wave-dress");
  });
});
