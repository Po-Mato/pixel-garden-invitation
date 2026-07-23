import { describe, expect, it } from "vitest";
import { journeyCheckpoints } from "./journeyProgress";
import { resolveJourneyGuidance } from "./journeyGuidance";
import { gardenWorld, getWorldZone } from "./world";

describe("게임 목적지 경로 미리보기", () => {
  it("현재 맵 상호작용 지점까지 방향과 타일 수를 계산한다", () => {
    const home = getWorldZone(gardenWorld, "home");
    const guidance = resolveJourneyGuidance(home, home.spawn, journeyCheckpoints[0]);

    expect(guidance?.available).toBe(true);
    expect(guidance?.portalId).toBeNull();
    expect(guidance?.tileCount).toBeGreaterThan(0);
    expect(guidance?.direction).not.toBeNull();
  });

  it("다른 맵 목적지는 첫 번째 연결 포털을 안내한다", () => {
    const home = getWorldZone(gardenWorld, "home");
    const guidance = resolveJourneyGuidance(home, home.spawn, journeyCheckpoints[1]);

    expect(guidance?.available).toBe(true);
    expect(guidance?.portalId).toBe("home-to-neighborhood");
    expect(guidance?.tileCount).toBeGreaterThan(0);
  });
});
