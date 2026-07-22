import type {
  InvitationReminderAdminResult,
  InvitationReminderDeliveryInput,
  InvitationReminderEventRecord,
  InvitationReminderStage
} from "@wedding-game/shared";

type ReminderEventRow = {
  id: string;
  link_id: string;
  guest_name: string;
  side: InvitationReminderEventRecord["side"];
  group_label: string;
  stage: InvitationReminderStage;
  channel: InvitationReminderEventRecord["channel"];
  note: string;
  sent_at: string;
};

type ReminderSummaryRow = {
  total_sent: number;
  unique_guests: number;
  last_sent_at: string | null;
  d30_count: number;
  d14_count: number;
  d7_count: number;
  d1_count: number;
  manual_count: number;
};

function event(row: ReminderEventRow): InvitationReminderEventRecord {
  return {
    id: row.id,
    linkId: row.link_id,
    guestName: row.guest_name,
    side: row.side,
    groupLabel: row.group_label,
    stage: row.stage,
    channel: row.channel,
    note: row.note,
    sentAt: row.sent_at
  };
}

async function invitationExists(db: D1Database, invitationId: string): Promise<boolean> {
  return Boolean(await db.prepare("SELECT id FROM invitations WHERE id = ?")
    .bind(invitationId)
    .first<{ id: string }>());
}

export async function listInvitationReminders(
  db: D1Database,
  invitationId: string
): Promise<InvitationReminderAdminResult | null> {
  if (!(await invitationExists(db, invitationId))) return null;
  const [summary, rows] = await Promise.all([
    db.prepare(`
      SELECT COUNT(*) AS total_sent,
             COUNT(DISTINCT link_id) AS unique_guests,
             MAX(sent_at) AS last_sent_at,
             SUM(CASE WHEN stage = 'd30' THEN 1 ELSE 0 END) AS d30_count,
             SUM(CASE WHEN stage = 'd14' THEN 1 ELSE 0 END) AS d14_count,
             SUM(CASE WHEN stage = 'd7' THEN 1 ELSE 0 END) AS d7_count,
             SUM(CASE WHEN stage = 'd1' THEN 1 ELSE 0 END) AS d1_count,
             SUM(CASE WHEN stage = 'manual' THEN 1 ELSE 0 END) AS manual_count
      FROM invitation_invite_reminder_events
      WHERE invitation_id = ?
    `).bind(invitationId).first<ReminderSummaryRow>(),
    db.prepare(`
      SELECT events.id, events.link_id, links.guest_name, links.side, links.group_label,
             events.stage, events.channel, events.note, events.sent_at
      FROM invitation_invite_reminder_events AS events
      JOIN invitation_invite_links AS links ON links.id = events.link_id
      WHERE events.invitation_id = ?
      ORDER BY events.sent_at DESC, events.id DESC
      LIMIT 500
    `).bind(invitationId).all<ReminderEventRow>()
  ]);
  return {
    summary: {
      totalSent: Number(summary?.total_sent ?? 0),
      uniqueGuests: Number(summary?.unique_guests ?? 0),
      lastSentAt: summary?.last_sent_at ?? null,
      byStage: {
        d30: Number(summary?.d30_count ?? 0),
        d14: Number(summary?.d14_count ?? 0),
        d7: Number(summary?.d7_count ?? 0),
        d1: Number(summary?.d1_count ?? 0),
        manual: Number(summary?.manual_count ?? 0)
      }
    },
    events: rows.results.map(event)
  };
}

export async function recordInvitationReminders(
  db: D1Database,
  invitationId: string,
  input: InvitationReminderDeliveryInput,
  now = new Date()
): Promise<boolean> {
  const placeholders = input.linkIds.map(() => "?").join(", ");
  const found = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM invitation_invite_links
    WHERE invitation_id = ? AND active = 1 AND id IN (${placeholders})
  `).bind(invitationId, ...input.linkIds).first<{ count: number }>();
  if (Number(found?.count ?? 0) !== input.linkIds.length) return false;

  const sentAt = now.toISOString();
  const update = db.prepare(`
    UPDATE invitation_invite_links
    SET delivery_channel = ?,
        send_count = send_count + 1,
        first_sent_at = COALESCE(first_sent_at, ?),
        last_sent_at = ?,
        delivery_note = ?,
        updated_at = ?
    WHERE invitation_id = ? AND active = 1 AND id IN (${placeholders})
  `).bind(
    input.channel,
    sentAt,
    sentAt,
    input.note,
    sentAt,
    invitationId,
    ...input.linkIds
  );
  const inserts = input.linkIds.map((linkId) => db.prepare(`
    INSERT INTO invitation_invite_reminder_events (
      id, invitation_id, link_id, stage, channel, note, sent_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    `reminder_${crypto.randomUUID()}`,
    invitationId,
    linkId,
    input.stage,
    input.channel,
    input.note,
    sentAt
  ));
  await db.batch([update, ...inserts]);
  return true;
}
