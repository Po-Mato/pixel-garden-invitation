import { describe, expect, it } from "vitest";
import { evaluateWorldGeometryAuditPolicy, worldGeometryAuditPolicies } from "./worldGeometryAuditPolicy";

describe("구역별 맵 지오메트리 CI 정책", () => {
  it("차단 오류는 모든 구역에서 즉시 실패한다", () => {
    expect(evaluateWorldGeometryAuditPolicy({
      zoneId: "lobby",
      severityCounts: { blocking: 1, warning: 0 }
    })).toEqual(expect.objectContaining({ status: "blocked", violations: ["차단 오류 1건"] }));
  });

  it("대형 구역은 지정한 경고 한도까지만 허용한다", () => {
    expect(worldGeometryAuditPolicies["ceremony-hall"].maxWarnings).toBe(1);
    expect(evaluateWorldGeometryAuditPolicy({
      zoneId: "ceremony-hall",
      severityCounts: { blocking: 0, warning: 1 }
    }).status).toBe("passed");
    expect(evaluateWorldGeometryAuditPolicy({
      zoneId: "ceremony-hall",
      severityCounts: { blocking: 0, warning: 2 }
    })).toEqual(expect.objectContaining({
      status: "blocked",
      violations: ["경고 2건이 허용 1건을 초과"]
    }));
  });
});
