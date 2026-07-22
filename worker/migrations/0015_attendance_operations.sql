ALTER TABLE rsvps
ADD COLUMN child_count INTEGER NOT NULL DEFAULT 0
CHECK (child_count >= 0 AND child_count <= party_size);

ALTER TABLE invitation_invite_links
ADD COLUMN follow_up_completed_at TEXT;

CREATE INDEX idx_invitation_invite_links_follow_up
  ON invitation_invite_links(invitation_id, follow_up_completed_at, responded_at, last_opened_at);
