CREATE TABLE game_save_transfers (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL,
  claim_token_hash TEXT NOT NULL CHECK (length(claim_token_hash) = 43),
  manage_token_hash TEXT NOT NULL CHECK (length(manage_token_hash) = 43),
  client_hash TEXT NOT NULL CHECK (length(client_hash) = 43),
  entry_count INTEGER NOT NULL CHECK (entry_count BETWEEN 0 AND 64),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'claimed', 'revoked')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  claimed_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE
);

CREATE INDEX game_save_transfers_expiry_idx
ON game_save_transfers(expires_at);

CREATE INDEX game_save_transfers_client_idx
ON game_save_transfers(invitation_id, client_hash, created_at DESC);

CREATE TABLE device_qa_reports (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL,
  client_hash TEXT NOT NULL CHECK (length(client_hash) = 43),
  local_date TEXT NOT NULL CHECK (length(local_date) = 10),
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'other')),
  os_name TEXT NOT NULL CHECK (length(trim(os_name)) BETWEEN 1 AND 24),
  os_version TEXT NOT NULL CHECK (length(trim(os_version)) BETWEEN 1 AND 16),
  browser_name TEXT NOT NULL CHECK (length(trim(browser_name)) BETWEEN 1 AND 24),
  browser_version TEXT NOT NULL CHECK (length(trim(browser_version)) BETWEEN 1 AND 16),
  status TEXT NOT NULL CHECK (status IN ('complete', 'warning')),
  issues_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(issues_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (invitation_id, client_hash, local_date),
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE
);

CREATE INDEX device_qa_reports_recent_idx
ON device_qa_reports(invitation_id, updated_at DESC);

CREATE TABLE device_qa_alert_settings (
  invitation_id TEXT PRIMARY KEY,
  email_enabled INTEGER NOT NULL DEFAULT 0 CHECK (email_enabled IN (0, 1)),
  warning_threshold INTEGER NOT NULL DEFAULT 3 CHECK (warning_threshold BETWEEN 2 AND 20),
  updated_at TEXT NOT NULL,
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE
);

CREATE TABLE device_qa_alert_events (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL,
  event_key TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 80),
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 240),
  created_at TEXT NOT NULL,
  emailed_at TEXT,
  email_error TEXT CHECK (email_error IS NULL OR length(email_error) <= 240),
  UNIQUE (invitation_id, event_key),
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE
);

CREATE INDEX device_qa_alert_events_recent_idx
ON device_qa_alert_events(invitation_id, created_at DESC);
