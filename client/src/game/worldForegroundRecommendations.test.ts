import { describe, expect, it } from "vitest";
import {
  buildWorldForegroundRecommendationPatch,
  foregroundGeometryDeltaIntensity,
  foregroundGeometryDeltaScore,
  foregroundRecommendationReviewsForZone,
  worldForegroundRecommendationKey
} from "./worldForegroundRecommendations";

describe("전경 추천 검토 계약", () => {
  it("적용 완료 항목은 제외하고 선택적 충돌 추천만 검토 대상으로 만든다", () => {
    expect(foregroundRecommendationReviewsForZone("lobby")).toEqual([]);
    const venue = foregroundRecommendationReviewsForZone("venue-exterior");
    expect(venue).toEqual([expect.objectContaining({
      key: "venue-exterior/venue-arch",
      depthChanged: false,
      collisionChanged: true,
      recommended: {
        depthY: 339,
        collision: { x: 361, y: 197, width: 238, height: 146 }
      }
    })]);
    expect(foregroundGeometryDeltaScore(venue[0]!)).toBe(160);
    expect(foregroundGeometryDeltaIntensity(venue[0]!)).toBe("high");
    expect(foregroundRecommendationReviewsForZone("subway-train")).toEqual([]);
  });

  it("승인한 전경만 안정적인 JSON patch에 포함한다", () => {
    const decisions = {
      [worldForegroundRecommendationKey("lobby", "lobby-desk")]: "accepted",
      [worldForegroundRecommendationKey("venue-exterior", "venue-arch")]: "accepted"
    } as const;
    const patch = buildWorldForegroundRecommendationPatch(decisions, "2026-08-04T00:00:00.000Z");
    expect(patch.acceptedPlacementKeys).toEqual([
      "venue-exterior/venue-arch"
    ]);
    expect(patch.operations).toEqual([
      { op: "add", path: "/zones/venue-exterior/0/collision", value: { x: 361, y: 197, width: 238, height: 146 } }
    ]);
    expect(patch.operationCount).toBe(1);
    expect(patch.sourceChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(patch.generatedAt).toBe("2026-08-04T00:00:00.000Z");
  });
});
