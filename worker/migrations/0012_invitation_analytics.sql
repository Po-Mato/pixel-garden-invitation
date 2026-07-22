CREATE TABLE invitation_analytics_daily (
  invitation_id TEXT NOT NULL,
  local_date TEXT NOT NULL CHECK (local_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  event_name TEXT NOT NULL CHECK (event_name IN (
    'visit',
    'mode_open',
    'directions_view',
    'map_click',
    'call_click',
    'share_click',
    'calendar_click',
    'rsvp_view',
    'rsvp_start',
    'rsvp_submit',
    'guestbook_view',
    'gallery_view',
    'gallery_zoom',
    'page_load',
    'client_error'
  )),
  dimension TEXT NOT NULL CHECK (length(dimension) BETWEEN 1 AND 40),
  event_count INTEGER NOT NULL DEFAULT 0 CHECK (event_count >= 0),
  value_sum INTEGER NOT NULL DEFAULT 0 CHECK (value_sum >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (invitation_id, local_date, event_name, dimension),
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE
);

CREATE INDEX idx_invitation_analytics_daily_range
  ON invitation_analytics_daily(invitation_id, local_date DESC);
