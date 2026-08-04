import { describe, expect, it } from "vitest";
import { previewWorldForegroundRecommendationPatch } from "./worldForegroundPatchPreview";
import { buildWorldForegroundRecommendationPatch } from "./worldForegroundRecommendations";

describe("검토 Patch 브라우저 미리보기", () => {
  it("현재 계약과 일치하는 Patch를 구역별 정확한 지오메트리로 변환한다", () => {
    const patch = buildWorldForegroundRecommendationPatch({ "venue-exterior/venue-arch": "accepted" });
    const preview = previewWorldForegroundRecommendationPatch(patch);
    expect(preview.zoneIds).toEqual(["venue-exterior"]);
    expect(preview.decisions).toEqual({ "venue-exterior/venue-arch": "accepted" });
    expect(preview.reviewsByZone["venue-exterior"]?.[0]).toMatchObject({
      decorationId: "venue-arch",
      current: { depthY: 339 },
      recommended: { depthY: 339, collision: { x: 361, y: 197, width: 238, height: 146 } }
    });
  });

  it("오래된 체크섬·중복 경로·승인되지 않은 대상을 거부한다", () => {
    const patch = buildWorldForegroundRecommendationPatch({ "venue-exterior/venue-arch": "accepted" });
    expect(() => previewWorldForegroundRecommendationPatch({ ...patch, sourceChecksum: "0".repeat(64) }))
      .toThrow(/체크섬/);
    expect(() => previewWorldForegroundRecommendationPatch({
      ...patch,
      operationCount: patch.operationCount + 1,
      operations: [...patch.operations, patch.operations[0]]
    })).toThrow(/중복/);
    expect(() => previewWorldForegroundRecommendationPatch({
      ...patch,
      acceptedPlacementKeys: ["home/home-plant"]
    })).toThrow(/승인되지 않은/);
  });
});
