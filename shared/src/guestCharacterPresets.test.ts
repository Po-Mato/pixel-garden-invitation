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
  it("확정된 8개 완성 하객 프리셋을 가진다", () => {
    expect(guestCharacterPresets).toHaveLength(8);
    expect(guestCharacterPresets.map((preset) => preset.id)).toEqual([
      "feminine-long-wave-dress",
      "feminine-formal-hanbok",
      "feminine-half-up-skirt",
      "feminine-short-bob-suit",
      "masculine-navy-suit",
      "masculine-charcoal-blazer",
      "masculine-formal-hanbok",
      "masculine-knit-jacket"
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
