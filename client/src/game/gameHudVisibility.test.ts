import { describe, expect, it } from "vitest";
import { resolveGameHudDensity } from "./gameHudVisibility";

describe("게임 HUD 상황별 밀도", () => {
  const base = {
    moving: false,
    routeActive: false,
    contextActive: false,
    toolsOpen: false,
    overlayOpen: false,
    dialogueOpen: false
  };

  it("길안내·이동·상호작용에 맞춰 필요한 정보만 남긴다", () => {
    expect(resolveGameHudDensity({ ...base, routeActive: true })).toBe("route");
    expect(resolveGameHudDensity({ ...base, moving: true, routeActive: true })).toBe("moving");
    expect(resolveGameHudDensity({ ...base, contextActive: true, moving: true })).toBe("context");
    expect(resolveGameHudDensity({ ...base, dialogueOpen: true })).toBe("context");
  });

  it("여정 도구나 다른 화면을 열면 자동 접기를 해제한다", () => {
    expect(resolveGameHudDensity({ ...base, toolsOpen: true, moving: true })).toBe("expanded");
    expect(resolveGameHudDensity({ ...base, overlayOpen: true, routeActive: true })).toBe("expanded");
    expect(resolveGameHudDensity(base)).toBe("idle");
  });

  it("완주 후에는 다른 상호작용이 없을 때 청첩장 중심 밀도로 전환한다", () => {
    expect(resolveGameHudDensity({ ...base, journeyComplete: true })).toBe("complete");
    expect(resolveGameHudDensity({ ...base, journeyComplete: true, toolsOpen: true })).toBe("expanded");
    expect(resolveGameHudDensity({ ...base, journeyComplete: true, contextActive: true })).toBe("context");
  });
});
