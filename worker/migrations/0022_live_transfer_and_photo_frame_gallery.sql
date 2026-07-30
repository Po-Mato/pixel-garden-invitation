ALTER TABLE game_save_transfers
ADD COLUMN receiver_phase TEXT CHECK (receiver_phase IS NULL OR receiver_phase IN ('opened', 'previewing', 'restoring'));

ALTER TABLE game_save_transfers
ADD COLUMN receiver_seen_at TEXT;

ALTER TABLE game_save_transfers
ADD COLUMN updated_at TEXT;

UPDATE game_save_transfers SET updated_at = created_at WHERE updated_at IS NULL;

CREATE TABLE photo_frame_gallery_submissions (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL,
  client_hash TEXT NOT NULL CHECK (length(client_hash) = 43),
  contributor_name TEXT NOT NULL CHECK (length(trim(contributor_name)) BETWEEN 1 AND 20),
  design_json TEXT NOT NULL CHECK (json_valid(design_json) AND length(design_json) <= 4096),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  reviewed_at TEXT,
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE
);

CREATE INDEX photo_frame_gallery_public_idx
ON photo_frame_gallery_submissions(invitation_id, status, reviewed_at DESC);

CREATE INDEX photo_frame_gallery_client_idx
ON photo_frame_gallery_submissions(invitation_id, client_hash, created_at DESC);
