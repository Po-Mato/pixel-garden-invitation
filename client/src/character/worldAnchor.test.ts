import { guestCharacterPresets } from "@wedding-game/shared";
import { describe, expect, it } from "vitest";
import {
  resolveWorldCharacterAnchor,
  snapToDevicePixel,
  worldCharacterAnchorStyle
} from "./worldAnchor";

describe("월드 캐릭터 시각 중심", () => {
  it("12개 프리셋 모두 닉네임 높이와 무관한 실측 중심을 사용한다", () => {
    expect(guestCharacterPresets).toHaveLength(12);
    for (const preset of guestCharacterPresets) {
      const anchor = resolveWorldCharacterAnchor({ presetId: preset.id }, 4);
      expect(anchor.presetId).toBe(preset.id);
      expect(anchor.centerOffsetX).toBeGreaterThanOrEqual(0);
      expect(anchor.centerOffsetX).toBeLessThanOrEqual(0.25);
      expect(anchor.centerY).toBe(35);
      expect(anchor.feetY).toBe(66.5);
    }
  });

  it("DPR 1·2·3에서 기준점을 물리 픽셀 경계에 맞춘다", () => {
    for (const ratio of [1, 2, 3]) {
      const anchor = resolveWorldCharacterAnchor({ presetId: "feminine-sage-bolero-dress" }, ratio);
      expect(anchor.centerOffsetX * ratio).toBeCloseTo(Math.round(anchor.centerOffsetX * ratio), 8);
      expect(anchor.centerY * ratio).toBeCloseTo(Math.round(anchor.centerY * ratio), 8);
      expect(anchor.feetY * ratio).toBeCloseTo(Math.round(anchor.feetY * ratio), 8);
    }
  });

  it("유효하지 않은 DPR과 프리셋은 안전한 기본값으로 대체한다", () => {
    expect(snapToDevicePixel(34.75, 0)).toBe(35);
    expect(resolveWorldCharacterAnchor({ presetId: "missing" }, Number.NaN)).toEqual({
      presetId: "feminine-long-wave-dress",
      centerOffsetX: 0,
      centerY: 35,
      feetY: 67
    });
    expect(worldCharacterAnchorStyle({ presetId: "missing" }, 2)).toEqual({
      "--character-world-anchor-offset-x": "0px",
      "--character-world-anchor-y": "35px"
    });
  });
});
