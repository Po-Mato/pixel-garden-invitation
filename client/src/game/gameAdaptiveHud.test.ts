import { describe, expect, it } from "vitest";
import { resolveAdaptiveQuickDockActions } from "./gameAdaptiveHud";

describe("resolveAdaptiveQuickDockActions", () => {
  it("가까운 상호작용에서는 보조 도구를 숨기고 이동 중에는 첫 즐겨찾기만 남긴다", () => {
    expect(resolveAdaptiveQuickDockActions({
      favorites: ["reaction", "guide"],
      contextActive: true,
      moving: false,
      routeActive: false
    })).toEqual({ state: "context", actions: [] });
    expect(resolveAdaptiveQuickDockActions({
      favorites: ["reaction", "guide"],
      contextActive: false,
      moving: true,
      routeActive: false
    })).toEqual({ state: "moving", actions: ["reaction"] });
  });

  it("길안내 중에는 여정 도구만 남기고 평상시에는 즐겨찾기를 복원한다", () => {
    expect(resolveAdaptiveQuickDockActions({
      favorites: ["reaction", "guide"],
      contextActive: false,
      moving: false,
      routeActive: true
    })).toEqual({ state: "route", actions: ["journey"] });
    expect(resolveAdaptiveQuickDockActions({
      favorites: ["sound", "reaction"],
      contextActive: false,
      moving: false,
      routeActive: false
    })).toEqual({ state: "favorites", actions: ["sound", "reaction"] });
  });
});
