CREATE TABLE invitation_releases (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL,
  release_number INTEGER NOT NULL CHECK (release_number >= 1),
  action TEXT NOT NULL CHECK (action IN ('publish', 'scheduled', 'restore')),
  source_release_id TEXT,
  content_json TEXT NOT NULL CHECK (length(content_json) BETWEEN 2 AND 65536 AND json_valid(content_json)),
  content_revision INTEGER NOT NULL CHECK (content_revision >= 1),
  gallery_json TEXT NOT NULL CHECK (length(gallery_json) BETWEEN 2 AND 32768 AND json_valid(gallery_json)),
  gallery_revision INTEGER NOT NULL CHECK (gallery_revision >= 1),
  created_at TEXT NOT NULL,
  UNIQUE (invitation_id, release_number),
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE
);

CREATE INDEX idx_invitation_releases_recent
  ON invitation_releases(invitation_id, release_number DESC);

CREATE TABLE invitation_release_schedules (
  invitation_id TEXT PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  content_json TEXT NOT NULL CHECK (length(content_json) BETWEEN 2 AND 65536 AND json_valid(content_json)),
  content_revision INTEGER NOT NULL CHECK (content_revision >= 1),
  gallery_json TEXT NOT NULL CHECK (length(gallery_json) BETWEEN 2 AND 32768 AND json_valid(gallery_json)),
  gallery_revision INTEGER NOT NULL CHECK (gallery_revision >= 1),
  scheduled_for TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE
);

CREATE INDEX idx_invitation_release_schedules_due
  ON invitation_release_schedules(scheduled_for);
