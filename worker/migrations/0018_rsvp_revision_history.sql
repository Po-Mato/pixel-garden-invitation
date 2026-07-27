CREATE TABLE rsvp_revision_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invitation_id TEXT NOT NULL,
  rsvp_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'snapshot')),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  occurred_at TEXT NOT NULL CHECK (length(trim(occurred_at)) > 0),
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE,
  FOREIGN KEY (rsvp_id) REFERENCES rsvps(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_rsvp_revision_history_revision
  ON rsvp_revision_history(rsvp_id, revision);

CREATE INDEX idx_rsvp_revision_history_recent
  ON rsvp_revision_history(invitation_id, rsvp_id, revision DESC, id DESC);

INSERT INTO rsvp_revision_history (
  invitation_id, rsvp_id, revision, action, snapshot_json, occurred_at
)
SELECT
  invitation_id,
  id,
  revision,
  'snapshot',
  json_object(
    'id', id,
    'side', side,
    'guestName', guest_name,
    'phone', phone,
    'attendance', attendance,
    'partySize', party_size,
    'childCount', child_count,
    'mealStatus', meal_status,
    'note', note,
    'consentVersion', consent_version,
    'revision', revision,
    'createdAt', created_at,
    'updatedAt', updated_at
  ),
  updated_at
FROM rsvps;

CREATE TRIGGER rsvp_revision_history_after_insert
AFTER INSERT ON rsvps
BEGIN
  INSERT INTO rsvp_revision_history (
    invitation_id, rsvp_id, revision, action, snapshot_json, occurred_at
  ) VALUES (
    NEW.invitation_id,
    NEW.id,
    NEW.revision,
    'created',
    json_object(
      'id', NEW.id,
      'side', NEW.side,
      'guestName', NEW.guest_name,
      'phone', NEW.phone,
      'attendance', NEW.attendance,
      'partySize', NEW.party_size,
      'childCount', NEW.child_count,
      'mealStatus', NEW.meal_status,
      'note', NEW.note,
      'consentVersion', NEW.consent_version,
      'revision', NEW.revision,
      'createdAt', NEW.created_at,
      'updatedAt', NEW.updated_at
    ),
    NEW.created_at
  );
END;

CREATE TRIGGER rsvp_revision_history_after_update
AFTER UPDATE OF side, guest_name, phone, attendance, party_size, child_count,
  meal_status, note, consent_version, revision, updated_at ON rsvps
WHEN NEW.revision > OLD.revision
BEGIN
  INSERT INTO rsvp_revision_history (
    invitation_id, rsvp_id, revision, action, snapshot_json, occurred_at
  ) VALUES (
    NEW.invitation_id,
    NEW.id,
    NEW.revision,
    'updated',
    json_object(
      'id', NEW.id,
      'side', NEW.side,
      'guestName', NEW.guest_name,
      'phone', NEW.phone,
      'attendance', NEW.attendance,
      'partySize', NEW.party_size,
      'childCount', NEW.child_count,
      'mealStatus', NEW.meal_status,
      'note', NEW.note,
      'consentVersion', NEW.consent_version,
      'revision', NEW.revision,
      'createdAt', NEW.created_at,
      'updatedAt', NEW.updated_at
    ),
    NEW.updated_at
  );
END;
