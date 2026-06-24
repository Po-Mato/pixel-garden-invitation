import { defaultCharacterAppearance } from "@wedding-game/shared";
import { expect, it } from "vitest";
import { resolveCharacterLayers } from "./assets";

it("완성 하객 프리셋의 단일 generated 경로를 반환한다", () => {
  const layers = resolveCharacterLayers(defaultCharacterAppearance, "./");

  expect(layers).toEqual([
    {
      slot: "base",
      walkUrl: "./characters/generated/guests/feminine-long-wave-dress__walk.png",
      idleUrl: "./characters/generated/guests/feminine-long-wave-dress__idle.png",
      sourceSize: { width: 96, height: 144 },
      displaySize: {
        world: { width: 48, height: 72 },
        preview: { width: 96, height: 144 }
      }
    }
  ]);
});

it("알 수 없는 프리셋은 기본 프리셋 경로로 대체한다", () => {
  expect(resolveCharacterLayers({ presetId: "missing" }, "./")[0].walkUrl)
    .toBe("./characters/generated/guests/feminine-long-wave-dress__walk.png");
});
