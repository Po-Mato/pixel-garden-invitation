export type AdminNotificationKind =
  | "rsvp_created"
  | "rsvp_updated"
  | "guestbook_created"
  | "guestbook_updated"
  | "quality_calibration_ready";

export type AdminNotificationEmailStatus = "pending" | "retrying" | "sent" | "failed";

export type AdminNotification = {
  id: string;
  kind: AdminNotificationKind;
  sourceId: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  emailStatus: AdminNotificationEmailStatus;
  emailAttempts: number;
  emailSentAt: string | null;
};

export type AdminNotificationResult = {
  notifications: AdminNotification[];
  unreadCount: number;
  emailConfigured: boolean;
  emailPendingCount: number;
  emailFailedCount: number;
  lastEmailSentAt: string | null;
};

const qualityCalibrationMetricKeys = ["camera-center", "cls", "long-frame"] as const;
export type QualityCalibrationMetricKey = typeof qualityCalibrationMetricKeys[number];

export function qualityCalibrationNotificationSourceId(
  weekStart: string,
  metricKey: QualityCalibrationMetricKey
): string {
  return `${weekStart}:${metricKey}`;
}

export function parseQualityCalibrationNotificationSourceId(sourceId: string): {
  weekStart: string;
  metricKey: QualityCalibrationMetricKey | null;
} {
  const [weekStart, metricCandidate] = sourceId.split(":", 2);
  const metricKey = qualityCalibrationMetricKeys.find((candidate) => candidate === metricCandidate) ?? null;
  return { weekStart, metricKey };
}

export function qualityCalibrationAdminHref(sourceId: string): string {
  const target = parseQualityCalibrationNotificationSourceId(sourceId);
  const parameters = new URLSearchParams({ admin: "analytics", calibrationWeek: target.weekStart });
  if (target.metricKey) parameters.set("calibrationMetric", target.metricKey);
  return `?${parameters.toString()}`;
}
