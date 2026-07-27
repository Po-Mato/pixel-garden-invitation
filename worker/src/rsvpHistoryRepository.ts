import type { RsvpHistoryAction, RsvpHistoryEntry, RsvpHistoryResult, RsvpRecord } from "@wedding-game/shared";

type RsvpHistoryRow = {
  id: number;
  rsvp_id: string;
  revision: number;
  action: RsvpHistoryAction;
  snapshot_json: string;
  occurred_at: string;
};

function parseSnapshot(value: string): RsvpRecord {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid RSVP history snapshot");
  return parsed as RsvpRecord;
}

export async function listRsvpHistory(
  db: D1Database,
  invitationId: string,
  rsvpId: string
): Promise<RsvpHistoryResult | null> {
  const result = await db.prepare(`
    SELECT id, rsvp_id, revision, action, snapshot_json, occurred_at
    FROM rsvp_revision_history
    WHERE invitation_id = ? AND rsvp_id = ?
    ORDER BY revision DESC, id DESC
  `).bind(invitationId, rsvpId).all<RsvpHistoryRow>();
  const rows = result.results ?? [];
  if (rows.length === 0) return null;

  return {
    rsvpId,
    entries: rows.map((row): RsvpHistoryEntry => ({
      id: String(row.id),
      action: row.action,
      revision: row.revision,
      response: parseSnapshot(row.snapshot_json),
      occurredAt: row.occurred_at
    }))
  };
}
