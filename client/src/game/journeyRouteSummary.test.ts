import { describe, expect, it } from "vitest";
import { createEmptyJourneyProgress } from "./journeyProgress";
import { findWorldZonePath, journeyDestinationInstruction, summarizeRemainingJourney } from "./journeyRouteSummary";
import { gardenWorld } from "./world";

describe("여정 전체 경로 요약", () => {
  it("현재 구역에서 다음 목적지까지 연결된 구역을 순서대로 찾는다", () => {
    const path = findWorldZonePath("home", "lobby");
    expect(path[0]).toBe("home");
    expect(path.at(-1)).toBe("lobby");
    expect(path.length).toBeGreaterThan(1);
  });

  it("남은 체크포인트와 맵 이동을 예상 단계로 합산한다", () => {
    const summary = summarizeRemainingJourney(createEmptyJourneyProgress(), "home");
    expect(summary.remainingCheckpoints).toBe(5);
    expect(summary.estimatedStages).toBe(summary.remainingCheckpoints + summary.zoneTransitions);
    expect(summary.nextZonePath).toEqual(["home"]);
  });

  it("목적지 종류에 맞는 비시각 안내를 만든다", () => {
    const checkpoint = {
      id: "gallery" as const,
      label: "웨딩 갤러리",
      detail: "사진 감상",
      zoneId: "lobby" as const,
      target: { type: "spot" as const, spotId: "gallery" as const }
    };
    expect(journeyDestinationInstruction(checkpoint, gardenWorld)).toContain("상호작용");
  });
});
