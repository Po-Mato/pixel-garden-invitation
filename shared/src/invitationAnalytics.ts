export const invitationAnalyticsEventNames = [
  "visit",
  "mode_open",
  "directions_view",
  "map_click",
  "call_click",
  "share_click",
  "calendar_click",
  "rsvp_view",
  "rsvp_start",
  "rsvp_submit",
  "guestbook_view",
  "gallery_view",
  "gallery_zoom",
  "page_load",
  "client_error",
  "character_asset_fallback",
  "performance_fps",
  "performance_long_task",
  "performance_quality_change",
  "quality_camera_center",
  "quality_cls",
  "quality_long_frame",
  "device_qa"
] as const;

export type InvitationAnalyticsEventName = typeof invitationAnalyticsEventNames[number];

export type InvitationAnalyticsEvent = {
  name: InvitationAnalyticsEventName;
  dimension: string;
  value?: number;
};

export type InvitationAnalyticsEventBatch = {
  events: InvitationAnalyticsEvent[];
};

export type InvitationAnalyticsRange = {
  from: string;
  to: string;
  days: number;
};

export type InvitationAnalyticsDaily = {
  date: string;
  visits: number;
  returningVisits: number;
  gameEntries: number;
  simpleEntries: number;
  rsvpResponses: number;
  guestbookMessages: number;
  shares: number;
  clientErrors: number;
  characterAssetFallbacks: number;
  deviceQaReports: number;
  deviceQaIssues: number;
};

export type InvitationAnalyticsBreakdown = {
  key: string;
  count: number;
};

export type InvitationAnalyticsAdminResult = {
  range: InvitationAnalyticsRange;
  totals: {
    visits: number;
    returningVisits: number;
    gameEntries: number;
    simpleEntries: number;
    directionsViews: number;
    mapClicks: number;
    callClicks: number;
    shareClicks: number;
    calendarClicks: number;
    rsvpViews: number;
    rsvpStarts: number;
    rsvpSubmits: number;
    rsvpResponses: number;
    attendingGuests: number;
    guestbookViews: number;
    guestbookMessages: number;
    galleryViews: number;
    galleryZooms: number;
    clientErrors: number;
    characterAssetFallbacks: number;
    pageLoadSamples: number;
    averagePageLoadMs: number | null;
    fpsSamples: number;
    averageFps: number | null;
    longTaskCount: number;
    averageLongTaskMs: number | null;
    qualityDowngrades: number;
    qualityRecoveries: number;
    cameraCenterSamples: number;
    averageCameraCenterErrorPx: number | null;
    clsSamples: number;
    averageCls: number | null;
    longFrameSamples: number;
    averageLongFrameMs: number | null;
    deviceQaReports: number;
    deviceQaIssues: number;
  };
  daily: InvitationAnalyticsDaily[];
  breakdowns: {
    devices: InvitationAnalyticsBreakdown[];
    modes: InvitationAnalyticsBreakdown[];
    maps: InvitationAnalyticsBreakdown[];
    shares: InvitationAnalyticsBreakdown[];
    calendars: InvitationAnalyticsBreakdown[];
    qualityModes: InvitationAnalyticsBreakdown[];
    characterFallbacks: InvitationAnalyticsBreakdown[];
    deviceQaDevices: InvitationAnalyticsBreakdown[];
    deviceQaIssues: InvitationAnalyticsBreakdown[];
  };
  generatedAt: string;
};

export type InvitationPerformanceConfig = {
  version: 1;
  source: "default" | "observed";
  sampleCount: number;
  observedAverageFps: number | null;
  slowFpsThreshold: number;
  recoveryFpsThreshold: number;
  slowWindowsRequired: number;
  recoveryWindowsRequired: number;
  generatedAt: string;
};

export type InvitationPerformanceAdminState = {
  mode: "adaptive" | "safe-default";
  effective: InvitationPerformanceConfig;
  adaptive: InvitationPerformanceConfig;
  updatedAt: string | null;
};

export type DeviceQaProfileBreakdown = {
  key: string;
  platform: "ios" | "android" | "other";
  osLabel: string;
  browserLabel: string;
  reports: number;
  warnings: number;
  issues: number;
  issueRate: number;
  topIssues: InvitationAnalyticsBreakdown[];
};

export type DeviceQaServerAlert = {
  id: string;
  severity: "watch" | "regression";
  title: string;
  body: string;
  createdAt: string;
  emailStatus: "disabled" | "pending" | "sent" | "failed";
};

export type DeviceQaDetailAdminState = {
  profiles: DeviceQaProfileBreakdown[];
  latestAlert: DeviceQaServerAlert | null;
  recentAlerts: DeviceQaServerAlert[];
  emailConfigured: boolean;
  emailEnabled: boolean;
  warningThreshold: number;
  generatedAt: string;
};

export type InvitationExperienceQualityMetric = {
  key: "camera-center" | "cls" | "long-frame";
  label: string;
  unit: "px" | "score" | "ms";
  sampleCount: number;
  activeDays: number;
  average: number | null;
  alertThreshold: number;
  status: "collecting" | "stable" | "watch";
  calibration: {
    status: "locked" | "ready";
    remainingActiveDays: number;
    remainingSamples: number;
    dailyP95: number | null;
    suggestedThreshold: number | null;
    decision: "collect-more" | "retain" | "review-increase";
  };
};

export type InvitationExperienceQualityGuard = {
  window: InvitationAnalyticsRange;
  status: "collecting" | "stable" | "watch";
  minimumActiveDays: number;
  minimumSamples: number;
  calibrationStatus: "locked" | "ready";
  metrics: InvitationExperienceQualityMetric[];
  generatedAt: string;
};

export type InvitationQualityCalibrationDecision = "pending" | "approve-candidate" | "retain-current";

export type InvitationQualityCalibrationSnapshot = {
  weekStart: string;
  metricKey: InvitationExperienceQualityMetric["key"];
  window: { from: string; to: string };
  activeDays: number;
  sampleCount: number;
  dailyP95: number;
  suggestedThreshold: number;
  currentThreshold: number;
  recommendation: "retain" | "review-increase";
  decision: InvitationQualityCalibrationDecision;
  decisionNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type InvitationQualityCalibrationAdminState = {
  currentWeekStart: string;
  eligible: boolean;
  pendingCount: number;
  snapshots: InvitationQualityCalibrationSnapshot[];
  generatedAt: string;
};

export type InvitationAnalyticsAdminResponse = InvitationAnalyticsAdminResult & {
  performance: InvitationPerformanceAdminState;
  qualityGuard: InvitationExperienceQualityGuard;
  qualityCalibration?: InvitationQualityCalibrationAdminState;
  deviceQaDetail?: DeviceQaDetailAdminState;
};
