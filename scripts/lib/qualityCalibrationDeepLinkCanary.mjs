export const qualityCalibrationDeepLinkCanaryPolicy = Object.freeze({
  sessionEndpointSuffix: "/admin/session",
  analyticsEndpointSuffix: "/admin/analytics"
});

export function assessQualityCalibrationDeepLinkCanary({
  sessionStatus = null,
  analyticsStatuses = [],
  target = null,
  deepLinked = false,
  focused = false,
  visible = false,
  pageErrors = []
} = {}) {
  const issues = [];
  if (sessionStatus !== 200) issues.push(`관리자 세션 응답 ${sessionStatus ?? "누락"}`);
  if (analyticsStatuses.length === 0 || analyticsStatuses.some((status) => status !== 200)) {
    issues.push(`관리자 통계 응답 ${analyticsStatuses.length ? analyticsStatuses.join(",") : "누락"}`);
  }
  if (!target?.weekStart || !target?.metricKey) issues.push("보정 딥링크 대상 누락");
  if (!deepLinked) issues.push("정확한 보정 카드 강조 누락");
  if (!focused) issues.push("보정 카드 키보드 초점 누락");
  if (!visible) issues.push("보정 카드 화면 중앙 노출 누락");
  for (const message of pageErrors) issues.push(`페이지 오류 ${message}`);
  return { status: issues.length === 0 ? "passed" : "failed", issues };
}

export function qualityCalibrationDeepLinkUrl(baseUrl, target) {
  const url = new URL(baseUrl);
  url.searchParams.set("admin", "analytics");
  url.searchParams.set("calibrationWeek", target.weekStart);
  url.searchParams.set("calibrationMetric", target.metricKey);
  return url.toString();
}
