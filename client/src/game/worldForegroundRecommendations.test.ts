import { describe, expect, it } from "vitest";
import {
  buildWorldForegroundRecommendationPatch,
  foregroundRecommendationReviewsForZone,
  worldForegroundRecommendationKey
} from "./worldForegroundRecommendations";

describe("전경 추천 검토 계약", () => {
  it("현재값과 다른 깊이·충돌 추천만 구역별 검토 대상으로 만든다", () => {
    const lobby = foregroundRecommendationReviewsForZone("lobby");
    expect(lobby).toEqual([expect.objectContaining({
      key: "lobby/lobby-desk",
      depthChanged: true,
      collisionChanged: true,
      recommended: {
        depthY: 475,
        collision: { x: 456, y: 437, width: 158, height: 42 }
      }
    })]);
    expect(foregroundRecommendationReviewsForZone("subway-train")).toEqual([]);
  });

  it("승인한 전경만 안정적인 JSON patch에 포함한다", () => {
    const decisions = {
      [worldForegroundRecommendationKey("home", "home-plant")]: "rejected",
      [worldForegroundRecommendationKey("lobby", "lobby-desk")]: "accepted",
      [worldForegroundRecommendationKey("venue-exterior", "venue-arch")]: "accepted"
    } as const;
    const patch = buildWorldForegroundRecommendationPatch(decisions, "2026-08-04T00:00:00.000Z");
    expect(patch.acceptedPlacementKeys).toEqual([
      "venue-exterior/venue-arch",
      "lobby/lobby-desk"
    ]);
    expect(patch.operations).toEqual([
      { op: "replace", path: "/zones/venue-exterior/0/depthY", value: 339 },
      { op: "add", path: "/zones/venue-exterior/0/collision", value: { x: 361, y: 197, width: 238, height: 146 } },
      { op: "replace", path: "/zones/lobby/0/depthY", value: 475 },
      { op: "replace", path: "/zones/lobby/0/collision", value: { x: 456, y: 437, width: 158, height: 42 } }
    ]);
    expect(patch.operationCount).toBe(4);
    expect(patch.generatedAt).toBe("2026-08-04T00:00:00.000Z");
  });
});
