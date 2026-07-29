import { describe, expect, it } from "vitest";
import { resolveContextHudAction } from "./contextHudAction";
import type { WorldPhotoSpot, WorldPortal } from "./world";

const portal: WorldPortal = {
  id: "portal", label: "연회장", to: "banquet", x: 0, y: 0, width: 90, height: 30,
  approach: { x: 90, y: 90 }, entryTiles: [{ x: 60, y: 90 }, { x: 90, y: 90 }, { x: 120, y: 90 }],
  facing: "up", spawn: { x: 120, y: 120 }
};
const photo: WorldPhotoSpot = {
  id: "lobby-photo-wall", zoneId: "lobby", label: "포토월", sceneLabel: "로비", x: 220, y: 70,
  width: 80, height: 70, actionRadius: 84, cast: "couple", backgroundCrop: { x: 0, y: 0, width: 100, height: 100 },
  previewPosition: "center"
};

describe("상황형 HUD 대상 선택", () => {
  it("현재 위치에서 가장 가까운 상호작용 한 개만 선택한다", () => {
    expect(resolveContextHudAction({
      player: { x: 150, y: 90 }, portals: [portal], photoSpots: [photo],
      npcs: [{ id: "bride", label: "신부 이건희", point: { x: 155, y: 90 } }]
    })).toMatchObject({ kind: "npc", id: "bride", actionLabel: "대화" });
  });

  it("모든 대상이 감지 범위 밖이면 표시하지 않는다", () => {
    expect(resolveContextHudAction({
      player: { x: 900, y: 900 }, portals: [portal], photoSpots: [photo], npcs: []
    })).toBeNull();
  });
});
