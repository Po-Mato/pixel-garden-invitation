import { describe, expect, it } from "vitest";
import { gardenWorld } from "./world";
import { auditWorldGeometry } from "./worldGeometryAudit";

describe("맵 이동 영역 자동 감사", () => {
  it.each(gardenWorld.zones)("%s 맵의 이동 타일과 모든 목적지가 연결된다", (zone) => {
    const audit = auditWorldGeometry(zone);
    expect(audit.issues, `${zone.id}: ${audit.issues.join(" / ")}`).toEqual([]);
    expect(audit.reachableCount).toBeGreaterThan(0);
    expect(audit.unreachableCount).toBe(0);
  });

  it("단절된 이동 영역을 오류와 빨간 타일로 식별한다", () => {
    const source = gardenWorld.zones[0];
    const audit = auditWorldGeometry({
      ...source,
      paths: [...source.paths, {
        id: "isolated-audit-fixture",
        kind: "floor",
        x: 30,
        y: 30,
        width: 30,
        height: 30
      }]
    });
    expect(audit.unreachableCount).toBeGreaterThan(0);
    expect(audit.issues.some((issue) => issue.includes("닿을 수 없는"))).toBe(true);
  });
});
