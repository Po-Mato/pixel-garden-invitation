import {
  defaultCharacterAppearance,
  parseCharacterAppearance
} from "@wedding-game/shared";
import { expect, it } from "vitest";
import { randomizeAppearance, updateAppearance } from "./appearanceState";

it("프리셋 ID 업데이트를 적용한다", () => {
  expect(updateAppearance(defaultCharacterAppearance, "masculine-navy-suit")).toEqual({
    presetId: "masculine-navy-suit"
  });
});

it("알 수 없는 프리셋 ID는 현재 값을 유지한다", () => {
  expect(updateAppearance(defaultCharacterAppearance, "missing")).toEqual(defaultCharacterAppearance);
});

it("무작위 선택은 항상 유효한 appearance를 반환한다", () => {
  for (let index = 0; index < 100; index += 1) {
    expect(parseCharacterAppearance(randomizeAppearance(index / 100))).toEqual(expect.objectContaining({
      presetId: expect.any(String)
    }));
  }
});
