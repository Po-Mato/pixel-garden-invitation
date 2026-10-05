-- Additive only: existing invitation analytics are never copied or changed.
CREATE TABLE pages_analytics_config (
  site TEXT PRIMARY KEY CHECK (site = 'blog'),
  enabled_at TEXT NOT NULL
);
INSERT INTO pages_analytics_config VALUES ('blog', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
CREATE TABLE pages_analytics_daily (
  site TEXT NOT NULL CHECK (site = 'blog'),
  local_date TEXT NOT NULL,
  visits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (site, local_date)
);
CREATE TABLE pages_analytics_receipts (
  event_id TEXT PRIMARY KEY,
  site TEXT NOT NULL CHECK (site = 'blog'),
  local_date TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX pages_receipts_expiry ON pages_analytics_receipts(expires_at);
-- Receipt insertion and increment are one atomic statement, including retries.
CREATE TRIGGER pages_visit_received AFTER INSERT ON pages_analytics_receipts
BEGIN
  INSERT INTO pages_analytics_daily(site, local_date, visits)
  VALUES (NEW.site, NEW.local_date, 1)
  ON CONFLICT(site, local_date) DO UPDATE SET visits = visits + 1;
END;
