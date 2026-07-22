ALTER TABLE invitation_invite_links
ADD COLUMN delivery_channel TEXT
CHECK (delivery_channel IS NULL OR delivery_channel IN ('kakao', 'sms', 'in_person', 'other'));

ALTER TABLE invitation_invite_links
ADD COLUMN send_count INTEGER NOT NULL DEFAULT 0
CHECK (send_count >= 0);

ALTER TABLE invitation_invite_links
ADD COLUMN first_sent_at TEXT;

ALTER TABLE invitation_invite_links
ADD COLUMN last_sent_at TEXT;

ALTER TABLE invitation_invite_links
ADD COLUMN delivery_note TEXT NOT NULL DEFAULT ''
CHECK (length(delivery_note) <= 200);

CREATE INDEX idx_invitation_invite_links_delivery
  ON invitation_invite_links(invitation_id, last_sent_at DESC);
