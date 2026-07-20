UPDATE invitations
SET config_json = json_set(
  config_json,
  '$.rsvp.consentVersion',
  '2026-07-20'
)
WHERE id = 'sample-garden';
