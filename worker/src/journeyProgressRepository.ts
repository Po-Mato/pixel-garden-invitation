import { hashInvitationInviteToken } from "./invitationInviteToken";

const journeyCheckpointIds = ["directions", "gallery", "bride", "ceremony", "guestbook"] as const;

export type SyncedJourneyProgress = {
  version: 1;
  completedIds: Array<(typeof journeyCheckpointIds)[number]>;
  updatedAt: string | null;
};

type JourneyRow = { completed_json: string; updated_at: string };

function normalizeCompletedIds(value: unknown): SyncedJourneyProgress["completedIds"] {
  if (!Array.isArray(value)) return [];
  return journeyCheckpointIds.filter((id) => value.includes(id));
}

async function inviteLinkId(db: D1Database, invitationId: string, token: string): Promise<string | null> {
  const tokenHash = await hashInvitationInviteToken(token);
  const row = await db.prepare(`
    SELECT id FROM invitation_invite_links
    WHERE invitation_id = ? AND token_hash = ? AND active = 1
  `).bind(invitationId, tokenHash).first<{ id: string }>();
  return row?.id ?? null;
}

export async function loadJourneyProgress(
  db: D1Database,
  invitationId: string,
  token: string
): Promise<SyncedJourneyProgress | null> {
  const linkId = await inviteLinkId(db, invitationId, token);
  if (!linkId) return null;
  const row = await db.prepare(`
    SELECT completed_json, updated_at
    FROM invitation_journey_progress
    WHERE invitation_id = ? AND invite_link_id = ?
  `).bind(invitationId, linkId).first<JourneyRow>();
  if (!row) return { version: 1, completedIds: [], updatedAt: null };
  return {
    version: 1,
    completedIds: normalizeCompletedIds(JSON.parse(row.completed_json)),
    updatedAt: row.updated_at
  };
}

export async function mergeJourneyProgress(
  db: D1Database,
  invitationId: string,
  token: string,
  completedIds: readonly string[],
  now = new Date()
): Promise<SyncedJourneyProgress | null> {
  const linkId = await inviteLinkId(db, invitationId, token);
  if (!linkId) return null;
  const existing = await db.prepare(`
    SELECT completed_json, updated_at
    FROM invitation_journey_progress
    WHERE invitation_id = ? AND invite_link_id = ?
  `).bind(invitationId, linkId).first<JourneyRow>();
  const merged = normalizeCompletedIds([
    ...normalizeCompletedIds(existing ? JSON.parse(existing.completed_json) : []),
    ...normalizeCompletedIds(completedIds)
  ]);
  const updatedAt = now.toISOString();
  await db.prepare(`
    INSERT INTO invitation_journey_progress (invitation_id, invite_link_id, completed_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (invitation_id, invite_link_id) DO UPDATE SET
      completed_json = excluded.completed_json,
      updated_at = excluded.updated_at
  `).bind(invitationId, linkId, JSON.stringify(merged), updatedAt).run();
  return { version: 1, completedIds: merged, updatedAt };
}
