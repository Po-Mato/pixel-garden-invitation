ALTER TABLE invitations ADD COLUMN rsvp_deadline TEXT;
ALTER TABLE invitations ADD COLUMN rsvp_delete_at TEXT;

UPDATE invitations
SET rsvp_deadline = '2027-04-24T14:59:59.000Z',
    rsvp_delete_at = '2027-05-31T14:59:59.000Z'
WHERE id = 'sample-garden';

ALTER TABLE rsvps RENAME TO rsvps_legacy;

CREATE TABLE rsvps (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('groom', 'bride', 'legacy')),
  guest_name TEXT NOT NULL,
  phone TEXT,
  attendance TEXT NOT NULL CHECK (attendance IN ('yes', 'no', 'unsure')),
  party_size INTEGER NOT NULL CHECK (party_size >= 0 AND party_size <= 10),
  meal_status TEXT NOT NULL CHECK (meal_status IN ('yes', 'no', 'unsure', 'not_applicable')),
  note TEXT NOT NULL,
  consent_version TEXT,
  consented_at TEXT,
  edit_token_hash TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invitation_id) REFERENCES invitations(id),
  CHECK (
    side = 'legacy'
    OR (attendance = 'yes' AND party_size BETWEEN 1 AND 10 AND meal_status IN ('yes', 'no', 'unsure'))
    OR (attendance = 'no' AND party_size = 0 AND meal_status = 'not_applicable')
    OR (attendance = 'unsure' AND party_size BETWEEN 1 AND 10 AND meal_status = 'unsure')
  )
);

INSERT INTO rsvps (
  id, invitation_id, side, guest_name, phone, attendance, party_size,
  meal_status, note, consent_version, consented_at, edit_token_hash,
  revision, created_at, updated_at
)
SELECT id, invitation_id, 'legacy', guest_name, NULL, attendance, party_size,
       'unsure', note, NULL, NULL, NULL, 1, created_at, created_at
FROM rsvps_legacy;

DROP TABLE rsvps_legacy;

CREATE INDEX idx_rsvps_invitation_updated ON rsvps(invitation_id, updated_at DESC);

CREATE TABLE admin_login_attempts (
  invitation_id TEXT NOT NULL,
  client_hash TEXT NOT NULL,
  window_started_at TEXT NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts >= 1),
  PRIMARY KEY (invitation_id, client_hash),
  FOREIGN KEY (invitation_id) REFERENCES invitations(id)
);
