CREATE TABLE invitation_invite_reminder_events (
  id TEXT PRIMARY KEY CHECK (id GLOB 'reminder_*'),
  invitation_id TEXT NOT NULL,
  link_id TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('d30', 'd14', 'd7', 'd1', 'manual')),
  channel TEXT NOT NULL CHECK (channel IN ('kakao', 'sms', 'in_person', 'other')),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 200),
  sent_at TEXT NOT NULL,
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE,
  FOREIGN KEY (link_id) REFERENCES invitation_invite_links(id) ON DELETE CASCADE
);

CREATE INDEX idx_invitation_reminders_timeline
  ON invitation_invite_reminder_events(invitation_id, sent_at DESC);

CREATE INDEX idx_invitation_reminders_link_stage
  ON invitation_invite_reminder_events(invitation_id, link_id, stage, sent_at DESC);
