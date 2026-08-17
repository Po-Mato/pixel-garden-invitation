import { defaultCharacterAppearance } from "@wedding-game/shared";
import { expect, it } from "vitest";
import { resolveCharacterLayers, resolveCharacterPortraitUrl } from "./assets";

it("월드에서도 96x144 고밀도 generated 경로를 48x72로 표시한다", () => {
  const layers = resolveCharacterLayers(defaultCharacterAppearance, "./");

  expect(layers).toEqual([
    {
      slot: "base",
      walkUrl: "./characters/generated/guests/feminine-long-wave-dress__walk.png",
      idleUrl: "./characters/generated/guests/feminine-long-wave-dress__idle.png",
      fallbackWalkUrl: "./characters/generated/guests/feminine-long-wave-dress__walk.png",
      fallbackIdleUrl: "./characters/generated/guests/feminine-long-wave-dress__idle.png",
      sourceSize: { width: 96, height: 144 },
      displaySize: {
        world: { width: 48, height: 72 },
        thumbnail: { width: 48, height: 72 },
        preview: { width: 96, height: 144 }
      }
    }
  ]);
});

it("미리보기에서는 2배 해상도와 통일된 3등신 전용 시트를 사용한다", () => {
  const layer = resolveCharacterLayers(defaultCharacterAppearance, "./", "preview")[0];

  expect(layer).toMatchObject({
    walkUrl: "./characters/generated/guests/preview/feminine-long-wave-dress__walk.png",
    idleUrl: "./characters/generated/guests/preview/feminine-long-wave-dress__idle.png",
    fallbackWalkUrl: "./characters/generated/guests/preview/feminine-long-wave-dress__walk.png",
    fallbackIdleUrl: "./characters/generated/guests/preview/feminine-long-wave-dress__idle.png",
    sourceSize: { width: 192, height: 288 }
  });
});

it("선택 카드 썸네일도 월드 자산 대신 동일한 공통 골격 시트를 사용한다", () => {
  const layer = resolveCharacterLayers(defaultCharacterAppearance, "./", "thumbnail")[0];

  expect(layer).toMatchObject({
    walkUrl: "./characters/generated/guests/preview/feminine-long-wave-dress__walk.png",
    idleUrl: "./characters/generated/guests/preview/feminine-long-wave-dress__idle.png",
    sourceSize: { width: 192, height: 288 }
  });
});

it("알 수 없는 프리셋은 고밀도 기본 프리셋 경로로 대체한다", () => {
  expect(resolveCharacterLayers({ presetId: "missing" }, "./")[0].walkUrl)
    .toBe("./characters/generated/guests/feminine-long-wave-dress__walk.png");
});

it("선택 화면과 포토존은 192x288 전용 초상 경로를 사용한다", () => {
  expect(resolveCharacterPortraitUrl(defaultCharacterAppearance, "./"))
    .toBe("./characters/generated/guests/portraits/feminine-long-wave-dress.png");
});

it("6·7·8번 교정 에셋은 기존 서비스 워커 캐시와 다른 URL을 사용한다", () => {
  const layer = resolveCharacterLayers(
    { presetId: "feminine-champagne-navy-skirt" },
    "./",
    "preview"
  )[0];

  expect(layer.walkUrl).toBe(
    "./characters/generated/guests/preview/feminine-champagne-navy-skirt__walk.png?v=optical-three-head-v2"
  );
  expect(layer.idleUrl).toBe(
    "./characters/generated/guests/preview/feminine-champagne-navy-skirt__idle.png?v=optical-three-head-v2"
  );
});
