CREATE TABLE invitation_invite_links (
  id TEXT PRIMARY KEY CHECK (id GLOB 'invite_*'),
  invitation_id TEXT NOT NULL,
  token_hash TEXT NOT NULL CHECK (length(token_hash) = 43),
  guest_name TEXT NOT NULL CHECK (length(trim(guest_name)) BETWEEN 1 AND 40),
  side TEXT NOT NULL CHECK (side IN ('groom', 'bride')),
  group_label TEXT NOT NULL DEFAULT '' CHECK (length(group_label) <= 40),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  open_count INTEGER NOT NULL DEFAULT 0 CHECK (open_count >= 0),
  first_opened_at TEXT,
  last_opened_at TEXT,
  responded_at TEXT,
  rsvp_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (invitation_id, token_hash),
  UNIQUE (invitation_id, rsvp_id),
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE,
  FOREIGN KEY (rsvp_id) REFERENCES rsvps(id) ON DELETE SET NULL
);

CREATE INDEX idx_invitation_invite_links_admin
  ON invitation_invite_links(invitation_id, created_at DESC);

CREATE INDEX idx_invitation_invite_links_token
  ON invitation_invite_links(invitation_id, token_hash, active);
