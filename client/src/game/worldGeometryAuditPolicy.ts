import type { WorldZoneId } from "@wedding-game/shared";
import policyData from "./worldGeometryAuditPolicy.json";
import type { WorldGeometryAudit } from "./worldGeometryAudit";

export type WorldGeometryZoneAuditPolicy = {
  failOnBlocking: boolean;
  maxWarnings: number;
};

export type WorldGeometryAuditPolicyResult = {
  status: "passed" | "blocked";
  blockingCount: number;
  warningCount: number;
  maxWarnings: number;
  violations: string[];
};

export const worldGeometryAuditPolicies = policyData.zones as Record<
  WorldZoneId,
  WorldGeometryZoneAuditPolicy
>;

export function evaluateWorldGeometryAuditPolicy(
  audit: Pick<WorldGeometryAudit, "zoneId" | "severityCounts">,
  policy: WorldGeometryZoneAuditPolicy = worldGeometryAuditPolicies[audit.zoneId]
): WorldGeometryAuditPolicyResult {
  const violations: string[] = [];
  if (policy.failOnBlocking && audit.severityCounts.blocking > 0) {
    violations.push(`차단 오류 ${audit.severityCounts.blocking}건`);
  }
  if (audit.severityCounts.warning > policy.maxWarnings) {
    violations.push(`경고 ${audit.severityCounts.warning}건이 허용 ${policy.maxWarnings}건을 초과`);
  }
  return {
    status: violations.length > 0 ? "blocked" : "passed",
    blockingCount: audit.severityCounts.blocking,
    warningCount: audit.severityCounts.warning,
    maxWarnings: policy.maxWarnings,
    violations
  };
}
