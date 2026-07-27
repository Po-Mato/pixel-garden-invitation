import type { RsvpHistoryAction, RsvpHistoryEntry, RsvpHistoryResult, RsvpRecord } from "@wedding-game/shared";

type RsvpHistoryRow = {
  id: number;
  rsvp_id: string;
  revision: number;
  action: RsvpHistoryAction;
  snapshot_json: string;
  occurred_at: string;
  change_reason: string | null;
};

export type RestoreRsvpHistoryResult =
  | { status: "restored"; revision: number }
  | { status: "not_found" }
  | { status: "conflict" };

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
    SELECT id, rsvp_id, revision, action, snapshot_json, occurred_at, change_reason
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
      occurredAt: row.occurred_at,
      ...(row.change_reason ? { changeReason: row.change_reason } : {})
    }))
  };
}

export async function restoreRsvpHistory(
  db: D1Database,
  invitationId: string,
  rsvpId: string,
  targetRevision: number,
  expectedCurrentRevision: number,
  reason: string,
  now = new Date()
): Promise<RestoreRsvpHistoryResult> {
  const source = await db.prepare(`
    SELECT snapshot_json
    FROM rsvp_revision_history
    WHERE invitation_id = ? AND rsvp_id = ? AND revision = ?
  `).bind(invitationId, rsvpId, targetRevision).first<{ snapshot_json: string }>();
  if (!source) return { status: "not_found" };

  const current = await db.prepare(`
    SELECT revision
    FROM rsvps
    WHERE invitation_id = ? AND id = ?
  `).bind(invitationId, rsvpId).first<{ revision: number }>();
  if (!current) return { status: "not_found" };
  if (current.revision !== expectedCurrentRevision || targetRevision >= current.revision) {
    return { status: "conflict" };
  }

  const snapshot = parseSnapshot(source.snapshot_json);
  const restoredRevision = current.revision + 1;
  const restoredAt = now.toISOString();
  const update = db.prepare(`
    UPDATE rsvps
    SET side = ?, guest_name = ?, phone = ?, attendance = ?, party_size = ?, child_count = ?,
        meal_status = ?, note = ?, consent_version = ?, updated_at = ?, revision = ?
    WHERE invitation_id = ? AND id = ? AND revision = ?
  `).bind(
    snapshot.side,
    snapshot.guestName,
    snapshot.phone,
    snapshot.attendance,
    snapshot.partySize,
    snapshot.childCount ?? 0,
    snapshot.mealStatus,
    snapshot.note,
    snapshot.consentVersion,
    restoredAt,
    restoredRevision,
    invitationId,
    rsvpId,
    expectedCurrentRevision
  );
  const annotate = db.prepare(`
    UPDATE rsvp_revision_history
    SET change_reason = ?
    WHERE invitation_id = ? AND rsvp_id = ? AND revision = ?
  `).bind(reason, invitationId, rsvpId, restoredRevision);
  const [updated] = await db.batch([update, annotate]);
  if ((updated.meta.changes ?? 0) !== 1) return { status: "conflict" };
  return { status: "restored", revision: restoredRevision };
}
