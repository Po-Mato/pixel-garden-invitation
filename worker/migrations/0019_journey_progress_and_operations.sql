CREATE TABLE invitation_journey_progress (
  invitation_id TEXT NOT NULL,
  invite_link_id TEXT NOT NULL,
  completed_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(completed_json)),
  updated_at TEXT NOT NULL CHECK (length(trim(updated_at)) > 0),
  PRIMARY KEY (invitation_id, invite_link_id),
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE,
  FOREIGN KEY (invite_link_id) REFERENCES invitation_invite_links(id) ON DELETE CASCADE
);

ALTER TABLE rsvp_revision_history
  ADD COLUMN change_reason TEXT
  CHECK (change_reason IS NULL OR length(trim(change_reason)) BETWEEN 2 AND 120);

CREATE TABLE invitation_performance_settings (
  invitation_id TEXT PRIMARY KEY,
  force_default INTEGER NOT NULL DEFAULT 0 CHECK (force_default IN (0, 1)),
  updated_at TEXT NOT NULL CHECK (length(trim(updated_at)) > 0),
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE
);
