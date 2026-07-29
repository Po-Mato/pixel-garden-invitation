import { describe, expect, it } from "vitest";
import { shouldAutoHideGameHud } from "./gameHudVisibility";

describe("게임 HUD 자동 숨김", () => {
  it("일반 보행 중에만 HUD를 숨긴다", () => {
    expect(shouldAutoHideGameHud({ moving: true, toolsOpen: false, overlayOpen: false, portalTransitioning: false })).toBe(true);
    expect(shouldAutoHideGameHud({ moving: false, toolsOpen: false, overlayOpen: false, portalTransitioning: false })).toBe(false);
    expect(shouldAutoHideGameHud({ moving: true, toolsOpen: true, overlayOpen: false, portalTransitioning: false })).toBe(false);
    expect(shouldAutoHideGameHud({ moving: true, toolsOpen: false, overlayOpen: true, portalTransitioning: false })).toBe(false);
    expect(shouldAutoHideGameHud({ moving: true, toolsOpen: false, overlayOpen: false, portalTransitioning: true })).toBe(false);
  });
});
