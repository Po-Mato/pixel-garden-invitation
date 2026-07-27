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
  "performance_fps",
  "performance_long_task",
  "performance_quality_change"
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
    pageLoadSamples: number;
    averagePageLoadMs: number | null;
    fpsSamples: number;
    averageFps: number | null;
    longTaskCount: number;
    averageLongTaskMs: number | null;
    qualityDowngrades: number;
    qualityRecoveries: number;
  };
  daily: InvitationAnalyticsDaily[];
  breakdowns: {
    devices: InvitationAnalyticsBreakdown[];
    modes: InvitationAnalyticsBreakdown[];
    maps: InvitationAnalyticsBreakdown[];
    shares: InvitationAnalyticsBreakdown[];
    calendars: InvitationAnalyticsBreakdown[];
    qualityModes: InvitationAnalyticsBreakdown[];
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

export type InvitationAnalyticsAdminResponse = InvitationAnalyticsAdminResult & {
  performance: InvitationPerformanceAdminState;
};
