import { describe, expect, it } from "vitest";
import {
  defaultWorldGeometryAuditHeatmapMode,
  parseWorldGeometryAuditHeatmapMode,
  worldGeometryAuditHeatmapModes
} from "./worldGeometryAuditHeatmap";

describe("맵 진단 히트맵 접근성 모드", () => {
  it("색상·패턴·고대비 모드를 허용하고 알 수 없는 값은 기본값으로 복원한다", () => {
    expect(worldGeometryAuditHeatmapModes).toEqual(["color", "pattern", "contrast"]);
    expect(parseWorldGeometryAuditHeatmapMode("pattern")).toBe("pattern");
    expect(parseWorldGeometryAuditHeatmapMode("contrast")).toBe("contrast");
    expect(parseWorldGeometryAuditHeatmapMode("unknown")).toBe(defaultWorldGeometryAuditHeatmapMode);
    expect(parseWorldGeometryAuditHeatmapMode(null)).toBe("color");
  });
});
