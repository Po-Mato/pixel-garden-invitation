import { describe, expect, it } from "vitest";
import { resolveNpcDialoguePlacement } from "./gameOverlayPlacement";

describe("NPC 대화창 자동 배치", () => {
  it("상단 길 안내와 가까우면 NPC 아래에 배치한다", () => {
    expect(resolveNpcDialoguePlacement({
      anchor: { x: 190, y: 170 }, viewport: { width: 390, height: 520 }, destinationGuideVisible: true
    })).toBe("below");
  });

  it("좌우 가장자리에서는 화면 안쪽으로 배치한다", () => {
    expect(resolveNpcDialoguePlacement({
      anchor: { x: 70, y: 270 }, viewport: { width: 430, height: 520 }, destinationGuideVisible: false
    })).toBe("right");
    expect(resolveNpcDialoguePlacement({
      anchor: { x: 390, y: 270 }, viewport: { width: 430, height: 520 }, destinationGuideVisible: false
    })).toBe("left");
  });
});
