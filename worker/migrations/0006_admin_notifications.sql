CREATE TABLE admin_notifications (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'rsvp_created',
    'rsvp_updated',
    'guestbook_created',
    'guestbook_updated'
  )),
  source_id TEXT NOT NULL CHECK (length(trim(source_id)) > 0),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 80),
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 240),
  created_at TEXT NOT NULL CHECK (length(trim(created_at)) > 0),
  read_at TEXT,
  emailed_at TEXT,
  email_error TEXT CHECK (email_error IS NULL OR length(email_error) <= 240),
  expires_at TEXT NOT NULL CHECK (length(trim(expires_at)) > 0),
  FOREIGN KEY (invitation_id) REFERENCES invitations(id),
  CHECK (read_at IS NULL OR length(trim(read_at)) > 0),
  CHECK (emailed_at IS NULL OR length(trim(emailed_at)) > 0)
);

CREATE INDEX idx_admin_notifications_recent
  ON admin_notifications(invitation_id, created_at DESC, id DESC);
CREATE INDEX idx_admin_notifications_unread
  ON admin_notifications(invitation_id, read_at, created_at DESC);
CREATE INDEX idx_admin_notifications_expiry
  ON admin_notifications(expires_at);
