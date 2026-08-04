import { describe, expect, it } from "vitest";
import { previewWorldForegroundRecommendationPatch } from "./worldForegroundPatchPreview";
import { buildWorldForegroundRecommendationPatch } from "./worldForegroundRecommendations";

describe("검토 Patch 브라우저 미리보기", () => {
  it("현재 계약과 일치하는 Patch를 구역별 정확한 지오메트리로 변환한다", () => {
    const patch = buildWorldForegroundRecommendationPatch({ "lobby/lobby-desk": "accepted" });
    const preview = previewWorldForegroundRecommendationPatch(patch);
    expect(preview.zoneIds).toEqual(["lobby"]);
    expect(preview.decisions).toEqual({ "lobby/lobby-desk": "accepted" });
    expect(preview.reviewsByZone.lobby?.[0]).toMatchObject({
      decorationId: "lobby-desk",
      current: { depthY: 480 },
      recommended: { depthY: 475, collision: { x: 456, y: 437, width: 158, height: 42 } }
    });
  });

  it("오래된 체크섬·중복 경로·승인되지 않은 대상을 거부한다", () => {
    const patch = buildWorldForegroundRecommendationPatch({ "lobby/lobby-desk": "accepted" });
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
