ALTER TABLE admin_notifications RENAME TO admin_notifications_before_quality_calibration;

CREATE TABLE admin_notifications (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'rsvp_created',
    'rsvp_updated',
    'guestbook_created',
    'guestbook_updated',
    'quality_calibration_ready'
  )),
  source_id TEXT NOT NULL CHECK (length(trim(source_id)) > 0),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 80),
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 240),
  created_at TEXT NOT NULL CHECK (length(trim(created_at)) > 0),
  read_at TEXT,
  emailed_at TEXT,
  email_error TEXT CHECK (email_error IS NULL OR length(email_error) <= 240),
  expires_at TEXT NOT NULL CHECK (length(trim(expires_at)) > 0),
  event_key TEXT,
  email_attempts INTEGER NOT NULL DEFAULT 0 CHECK (email_attempts BETWEEN 0 AND 5),
  email_last_attempt_at TEXT,
  email_next_attempt_at TEXT,
  FOREIGN KEY (invitation_id) REFERENCES invitations(id),
  CHECK (read_at IS NULL OR length(trim(read_at)) > 0),
  CHECK (emailed_at IS NULL OR length(trim(emailed_at)) > 0)
);

INSERT INTO admin_notifications (
  id, invitation_id, kind, source_id, title, body, created_at, read_at,
  emailed_at, email_error, expires_at, event_key, email_attempts,
  email_last_attempt_at, email_next_attempt_at
)
SELECT
  id, invitation_id, kind, source_id, title, body, created_at, read_at,
  emailed_at, email_error, expires_at, event_key, email_attempts,
  email_last_attempt_at, email_next_attempt_at
FROM admin_notifications_before_quality_calibration;

DROP TABLE admin_notifications_before_quality_calibration;

CREATE INDEX idx_admin_notifications_recent
  ON admin_notifications(invitation_id, created_at DESC, id DESC);
CREATE INDEX idx_admin_notifications_unread
  ON admin_notifications(invitation_id, read_at, created_at DESC);
CREATE INDEX idx_admin_notifications_expiry
  ON admin_notifications(expires_at);
CREATE UNIQUE INDEX idx_admin_notifications_event_key
  ON admin_notifications(invitation_id, event_key);
CREATE INDEX idx_admin_notifications_email_queue
  ON admin_notifications(emailed_at, email_next_attempt_at, email_attempts, created_at);
