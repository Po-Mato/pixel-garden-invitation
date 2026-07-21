ALTER TABLE admin_notifications ADD COLUMN event_key TEXT;
ALTER TABLE admin_notifications ADD COLUMN email_attempts INTEGER NOT NULL DEFAULT 0
  CHECK (email_attempts BETWEEN 0 AND 5);
ALTER TABLE admin_notifications ADD COLUMN email_last_attempt_at TEXT;
ALTER TABLE admin_notifications ADD COLUMN email_next_attempt_at TEXT;

UPDATE admin_notifications
SET event_key = id
WHERE event_key IS NULL;

CREATE UNIQUE INDEX idx_admin_notifications_event_key
  ON admin_notifications(invitation_id, event_key);
CREATE INDEX idx_admin_notifications_email_queue
  ON admin_notifications(emailed_at, email_next_attempt_at, email_attempts, created_at);
