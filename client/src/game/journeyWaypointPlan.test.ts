import { describe, expect, it } from "vitest";
import { createEmptyJourneyProgress, type JourneyProgress } from "./journeyProgress";
import {
  firstJourneyWaypoint,
  estimateJourneyWaypointPlan,
  moveJourneyWaypoint,
  normalizeJourneyWaypointPlan,
  optimizeJourneyWaypointPlan,
  remainingJourneyWaypoints,
  toggleJourneyWaypoint
} from "./journeyWaypointPlan";

describe("journeyWaypointPlan", () => {
  it("완료하지 않은 목적지만 원래 여정 순서로 구성한다", () => {
    const progress: JourneyProgress = { ...createEmptyJourneyProgress(), completedIds: ["directions", "bride"] };
    expect(remainingJourneyWaypoints(progress).map(({ id }) => id)).toEqual([
      "gallery",
      "ceremony",
      "guestbook"
    ]);
    expect(normalizeJourneyWaypointPlan(progress, ["guestbook", "gallery"])).toEqual(["guestbook", "gallery"]);
  });

  it("마지막 경유지는 해제하지 않고 첫 경유지를 찾는다", () => {
    const progress = createEmptyJourneyProgress();
    expect(toggleJourneyWaypoint(progress, ["gallery"], "gallery")).toEqual(["gallery"]);
    expect(firstJourneyWaypoint(progress, ["ceremony", "gallery"])?.id).toBe("ceremony");
  });

  it("경유지를 위아래로 이동하고 선택 순서대로 시간을 추정한다", () => {
    const progress = createEmptyJourneyProgress();
    expect(moveJourneyWaypoint(progress, ["directions", "gallery", "bride"], "bride", "up"))
      .toEqual(["directions", "bride", "gallery"]);
    expect(moveJourneyWaypoint(progress, ["directions", "gallery"], "directions", "up"))
      .toEqual(["directions", "gallery"]);
    const estimate = estimateJourneyWaypointPlan(progress, ["directions", "gallery"], "home", 10);
    expect(estimate.waypointCount).toBe(2);
    expect(estimate.zoneTransitions).toBeGreaterThan(0);
    expect(estimate.estimatedSeconds).toBeGreaterThan(20);
  });

  it("빈 계획은 남은 전체 경유지로 복구한다", () => {
    const progress = createEmptyJourneyProgress();
    expect(normalizeJourneyWaypointPlan(progress, [])).toHaveLength(5);
  });

  it("선택한 경유지는 유지하면서 맵 전환이 적은 순서로 자동 정렬한다", () => {
    const progress = createEmptyJourneyProgress();
    expect(optimizeJourneyWaypointPlan(
      progress,
      ["guestbook", "directions", "bride", "gallery"],
      "home"
    )).toEqual(["directions", "guestbook", "gallery", "bride"]);
  });
});
