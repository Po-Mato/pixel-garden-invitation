ALTER TABLE invitations ADD COLUMN guestbook_delete_at TEXT;

UPDATE invitations
SET guestbook_delete_at = '2027-05-31T14:59:59.000Z'
WHERE id = 'sample-garden';

ALTER TABLE guestbook_messages RENAME TO guestbook_messages_legacy;

CREATE TABLE guestbook_messages (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL,
  nickname TEXT NOT NULL CHECK (length(trim(nickname)) BETWEEN 1 AND 16),
  message TEXT NOT NULL CHECK (length(trim(message)) BETWEEN 1 AND 240),
  is_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)),
  client_hash TEXT,
  edit_token_hash TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK (length(trim(created_at)) > 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK (length(trim(updated_at)) > 0),
  FOREIGN KEY (invitation_id) REFERENCES invitations(id),
  CHECK (
    (client_hash IS NULL AND edit_token_hash IS NULL)
    OR (
      client_hash IS NOT NULL
      AND length(client_hash) = 43
      AND client_hash NOT GLOB '*[^A-Za-z0-9_-]*'
      AND edit_token_hash IS NOT NULL
      AND length(edit_token_hash) = 43
      AND edit_token_hash NOT GLOB '*[^A-Za-z0-9_-]*'
    )
  )
);

INSERT INTO guestbook_messages (
  id, invitation_id, nickname, message, is_hidden, client_hash,
  edit_token_hash, revision, created_at, updated_at
)
SELECT id, invitation_id, nickname, message, is_hidden, NULL,
       NULL, 1, created_at, created_at
FROM guestbook_messages_legacy;

DROP TABLE guestbook_messages_legacy;

CREATE INDEX idx_guestbook_public_page
  ON guestbook_messages(invitation_id, is_hidden, created_at DESC, id DESC);
CREATE INDEX idx_guestbook_client_rate
  ON guestbook_messages(invitation_id, client_hash, created_at DESC);
CREATE INDEX idx_guestbook_admin_updated
  ON guestbook_messages(invitation_id, updated_at DESC, id DESC);
