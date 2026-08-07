CREATE TABLE invitation_quality_calibration_snapshots (
  invitation_id TEXT NOT NULL,
  week_start TEXT NOT NULL CHECK (week_start GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  metric_key TEXT NOT NULL CHECK (metric_key IN ('camera-center', 'cls', 'long-frame')),
  window_from TEXT NOT NULL,
  window_to TEXT NOT NULL,
  active_days INTEGER NOT NULL CHECK (active_days >= 7),
  sample_count INTEGER NOT NULL CHECK (sample_count >= 20),
  daily_p95 REAL NOT NULL CHECK (daily_p95 >= 0),
  suggested_threshold REAL NOT NULL CHECK (suggested_threshold >= 0),
  current_threshold REAL NOT NULL CHECK (current_threshold >= 0),
  recommendation TEXT NOT NULL CHECK (recommendation IN ('retain', 'review-increase')),
  decision TEXT NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending', 'approve-candidate', 'retain-current')),
  decision_note TEXT,
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  PRIMARY KEY (invitation_id, week_start, metric_key),
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE,
  CHECK (
    (decision = 'pending' AND reviewed_at IS NULL AND decision_note IS NULL)
    OR (decision <> 'pending' AND reviewed_at IS NOT NULL)
  )
);

CREATE INDEX idx_quality_calibration_snapshots_history
  ON invitation_quality_calibration_snapshots(invitation_id, week_start DESC, metric_key ASC);
