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
  "client_error"
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
  };
  daily: InvitationAnalyticsDaily[];
  breakdowns: {
    devices: InvitationAnalyticsBreakdown[];
    modes: InvitationAnalyticsBreakdown[];
    maps: InvitationAnalyticsBreakdown[];
    shares: InvitationAnalyticsBreakdown[];
    calendars: InvitationAnalyticsBreakdown[];
  };
  generatedAt: string;
};
