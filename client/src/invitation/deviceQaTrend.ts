import type { InvitationAnalyticsDaily } from "@wedding-game/shared";

export type DeviceQaTrendStatus = "insufficient" | "stable" | "watch" | "regression";

export type DeviceQaTrend = {
  status: DeviceQaTrendStatus;
  currentReports: number;
  currentIssues: number;
  currentRate: number;
  previousReports: number;
  previousIssues: number;
  previousRate: number;
  rateDelta: number;
};

function sum(days: readonly InvitationAnalyticsDaily[], field: "deviceQaReports" | "deviceQaIssues") {
  return days.reduce((total, day) => total + day[field], 0);
}

function issueRate(reports: number, issues: number) {
  return reports > 0 ? issues / reports : 0;
}

export function analyzeDeviceQaTrend(
  daily: readonly InvitationAnalyticsDaily[],
  windowDays = 7
): DeviceQaTrend {
  const ordered = [...daily].sort((left, right) => left.date.localeCompare(right.date));
  const current = ordered.slice(-windowDays);
  const previous = ordered.slice(-(windowDays * 2), -windowDays);
  const currentReports = sum(current, "deviceQaReports");
  const currentIssues = sum(current, "deviceQaIssues");
  const previousReports = sum(previous, "deviceQaReports");
  const previousIssues = sum(previous, "deviceQaIssues");
  const currentRate = issueRate(currentReports, currentIssues);
  const previousRate = issueRate(previousReports, previousIssues);
  const rateDelta = currentRate - previousRate;

  let status: DeviceQaTrendStatus = "stable";
  if (currentReports < 3 || previousReports < 3) status = "insufficient";
  else if (currentRate >= 0.4 || (currentRate >= 0.25 && rateDelta >= 0.2)) status = "regression";
  else if (currentRate >= 0.2 && rateDelta >= 0.1) status = "watch";

  return {
    status,
    currentReports,
    currentIssues,
    currentRate,
    previousReports,
    previousIssues,
    previousRate,
    rateDelta
  };
}
