CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  wedding_date TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  venue_address TEXT NOT NULL,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rsvps (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  attendance TEXT NOT NULL CHECK (attendance IN ('yes', 'no', 'unsure')),
  party_size INTEGER NOT NULL CHECK (party_size >= 1 AND party_size <= 10),
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invitation_id) REFERENCES invitations(id)
);

CREATE TABLE IF NOT EXISTS guestbook_messages (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  message TEXT NOT NULL,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invitation_id) REFERENCES invitations(id)
);

CREATE TABLE IF NOT EXISTS moderation_events (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('guestbook')),
  target_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('hide', 'show')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invitation_id) REFERENCES invitations(id)
);

INSERT OR IGNORE INTO invitations (
  id,
  slug,
  title,
  wedding_date,
  venue_name,
  venue_address,
  config_json
) VALUES (
  'sample-garden',
  'sample-garden',
  '서준 & 하린의 정원',
  '2027-05-15',
  '라온가든 웨딩홀',
  '서울특별시 강남구 테헤란로 123',
  '{}'
);
