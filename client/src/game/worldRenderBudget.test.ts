import { describe, expect, it } from "vitest";
import { resolveWorldRenderBudget } from "./worldRenderBudget";

describe("resolveWorldRenderBudget", () => {
  it("표준 기기에서는 전체 애니메이션 예산을 유지한다", () => {
    expect(resolveWorldRenderBudget("standard", "full")).toEqual({
      targetFps: 60,
      npcMotionIntervalMs: 720,
      remoteGuestLimit: 24,
      ambientMotion: "full"
    });
  });

  it("저사양 기기에서는 캐릭터와 맵 갱신량을 함께 줄인다", () => {
    expect(resolveWorldRenderBudget("lite", "minimal")).toEqual({
      targetFps: 24,
      npcMotionIntervalMs: 1_200,
      remoteGuestLimit: 6,
      ambientMotion: "minimal"
    });
  });
});
