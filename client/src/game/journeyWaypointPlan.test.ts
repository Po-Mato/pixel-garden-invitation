import { describe, expect, it } from "vitest";
import { createEmptyJourneyProgress, type JourneyProgress } from "./journeyProgress";
import {
  firstJourneyWaypoint,
  normalizeJourneyWaypointPlan,
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
    expect(normalizeJourneyWaypointPlan(progress, ["guestbook", "gallery"])).toEqual([
      "gallery",
      "guestbook"
    ]);
  });

  it("마지막 경유지는 해제하지 않고 첫 경유지를 찾는다", () => {
    const progress = createEmptyJourneyProgress();
    expect(toggleJourneyWaypoint(progress, ["gallery"], "gallery")).toEqual(["gallery"]);
    expect(firstJourneyWaypoint(progress, ["ceremony", "gallery"])?.id).toBe("gallery");
  });

  it("빈 계획은 남은 전체 경유지로 복구한다", () => {
    const progress = createEmptyJourneyProgress();
    expect(normalizeJourneyWaypointPlan(progress, [])).toHaveLength(5);
  });
});
