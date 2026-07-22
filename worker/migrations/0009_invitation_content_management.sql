CREATE TABLE invitation_content (
  invitation_id TEXT PRIMARY KEY,
  draft_json TEXT NOT NULL CHECK (length(draft_json) BETWEEN 2 AND 65536 AND json_valid(draft_json)),
  draft_revision INTEGER NOT NULL DEFAULT 1 CHECK (draft_revision >= 1),
  published_json TEXT CHECK (
    published_json IS NULL
    OR (length(published_json) BETWEEN 2 AND 65536 AND json_valid(published_json))
  ),
  published_revision INTEGER CHECK (published_revision IS NULL OR published_revision >= 1),
  updated_at TEXT NOT NULL CHECK (length(trim(updated_at)) > 0),
  published_at TEXT,
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE,
  CHECK (
    (published_json IS NULL AND published_revision IS NULL AND published_at IS NULL)
    OR (published_json IS NOT NULL AND published_revision IS NOT NULL AND published_at IS NOT NULL)
  )
);

CREATE TABLE invitation_content_versions (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  action TEXT NOT NULL CHECK (action IN ('save', 'publish', 'restore')),
  content_json TEXT NOT NULL CHECK (length(content_json) BETWEEN 2 AND 65536 AND json_valid(content_json)),
  created_at TEXT NOT NULL CHECK (length(trim(created_at)) > 0),
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE
);

CREATE INDEX idx_invitation_content_versions_recent
  ON invitation_content_versions(invitation_id, created_at DESC, id DESC);
