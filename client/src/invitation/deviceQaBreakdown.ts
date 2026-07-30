import type { InvitationAnalyticsBreakdown } from "@wedding-game/shared";

export type DeviceQaIssueDetail = { id: string; label: string; count: number };
export type DeviceQaDeviceDetail = {
  id: "ios" | "android" | "other";
  label: string;
  reports: number;
  warnings: number;
  issues: number;
  issueRate: number;
  topIssues: DeviceQaIssueDetail[];
};

const deviceLabels: Record<DeviceQaDeviceDetail["id"], string> = {
  ios: "iPhone/iPad",
  android: "Android",
  other: "기타 기기"
};

export const deviceQaIssueLabels: Record<string, string> = {
  viewport: "화면 크기",
  touch: "터치 입력",
  storage: "진행 저장",
  audio: "게임 사운드",
  movement: "조이스틱·이동",
  portal: "포털 전환",
  feedback: "소리·진동",
  layout: "화면 배치",
  photo: "사진 저장·공유"
};

function validDevice(value: string): value is DeviceQaDeviceDetail["id"] {
  return value === "ios" || value === "android" || value === "other";
}

export function analyzeDeviceQaBreakdown(
  deviceResults: readonly InvitationAnalyticsBreakdown[],
  issueResults: readonly InvitationAnalyticsBreakdown[]
): DeviceQaDeviceDetail[] {
  const devices = new Map<DeviceQaDeviceDetail["id"], { reports: number; warnings: number; issues: Map<string, number> }>();
  const ensure = (id: DeviceQaDeviceDetail["id"]) => {
    const current = devices.get(id) ?? { reports: 0, warnings: 0, issues: new Map<string, number>() };
    devices.set(id, current);
    return current;
  };

  deviceResults.forEach(({ key, count }) => {
    const [device, result] = key.split(":");
    if (!validDevice(device) || (result !== "complete" && result !== "warning")) return;
    const current = ensure(device);
    current.reports += Math.max(0, count);
    if (result === "warning") current.warnings += Math.max(0, count);
  });
  issueResults.forEach(({ key, count }) => {
    const [device, issue] = key.split(":");
    if (!validDevice(device) || !issue || count <= 0) return;
    const current = ensure(device);
    current.issues.set(issue, (current.issues.get(issue) ?? 0) + count);
  });

  return [...devices.entries()].map(([id, value]) => {
    const issues = [...value.issues.entries()].reduce((total, [, count]) => total + count, 0);
    return {
      id,
      label: deviceLabels[id],
      reports: value.reports,
      warnings: value.warnings,
      issues,
      issueRate: value.reports > 0 ? issues / value.reports : 0,
      topIssues: [...value.issues.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 3)
        .map(([issue, count]) => ({ id: issue, label: deviceQaIssueLabels[issue] ?? issue, count }))
    };
  }).sort((left, right) => right.issueRate - left.issueRate || right.issues - left.issues || left.label.localeCompare(right.label));
}
