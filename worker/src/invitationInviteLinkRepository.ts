import type {
  InvitationInviteLinkAdminResult,
  InvitationInviteLinkCreated,
  InvitationInviteDeliveryInput,
  InvitationInviteLinkInput,
  InvitationInviteLinkRecord,
  InvitationInviteLinkUpdate,
  PublicInvitationInvite
} from "@wedding-game/shared";
import { createInvitationInviteToken, hashInvitationInviteToken } from "./invitationInviteToken";

type InviteLinkRow = {
  id: string;
  guest_name: string;
  side: "groom" | "bride";
  group_label: string;
  active: number;
  delivery_channel: "kakao" | "sms" | "in_person" | "other" | null;
  send_count: number;
  first_sent_at: string | null;
  last_sent_at: string | null;
  delivery_note: string;
  open_count: number;
  first_opened_at: string | null;
  last_opened_at: string | null;
  responded_at: string | null;
  rsvp_id: string | null;
  follow_up_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

function record(row: InviteLinkRow): InvitationInviteLinkRecord {
  return {
    id: row.id,
    guestName: row.guest_name,
    side: row.side,
    groupLabel: row.group_label,
    active: row.active === 1,
    deliveryChannel: row.delivery_channel,
    sendCount: row.send_count,
    firstSentAt: row.first_sent_at,
    lastSentAt: row.last_sent_at,
    deliveryNote: row.delivery_note,
    openCount: row.open_count,
    firstOpenedAt: row.first_opened_at,
    lastOpenedAt: row.last_opened_at,
    respondedAt: row.responded_at,
    rsvpId: row.rsvp_id,
    followUpCompletedAt: row.follow_up_completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function inviteId(): string {
  return `invite_${crypto.randomUUID()}`;
}

export async function listInvitationInviteLinks(
  db: D1Database,
  invitationId: string
): Promise<InvitationInviteLinkAdminResult | null> {
  const invitation = await db.prepare("SELECT id FROM invitations WHERE id = ?")
    .bind(invitationId)
    .first<{ id: string }>();
  if (!invitation) return null;
  const rows = await db.prepare(`
    SELECT id, guest_name, side, group_label, active, delivery_channel, send_count,
           first_sent_at, last_sent_at, delivery_note, open_count, first_opened_at,
           last_opened_at, responded_at, rsvp_id, follow_up_completed_at, created_at, updated_at
    FROM invitation_invite_links
    WHERE invitation_id = ?
    ORDER BY created_at DESC, id DESC
  `).bind(invitationId).all<InviteLinkRow>();
  const links = rows.results.map(record);
  return {
    summary: {
      total: links.length,
      active: links.filter(({ active }) => active).length,
      delivered: links.filter(({ sendCount }) => sendCount > 0).length,
      opened: links.filter(({ openCount }) => openCount > 0).length,
      responded: links.filter(({ respondedAt }) => respondedAt !== null).length
    },
    links
  };
}

export async function createInvitationInviteLinks(
  db: D1Database,
  invitationId: string,
  inputs: readonly InvitationInviteLinkInput[],
  now = new Date()
): Promise<InvitationInviteLinkCreated[] | null> {
  const invitation = await db.prepare("SELECT id FROM invitations WHERE id = ?")
    .bind(invitationId)
    .first<{ id: string }>();
  if (!invitation) return null;
  const createdAt = now.toISOString();
  const created = await Promise.all(inputs.map(async (input) => ({
    id: inviteId(),
    input,
    ...(await createInvitationInviteToken())
  })));
  await db.batch(created.map((item) => db.prepare(`
    INSERT INTO invitation_invite_links (
      id, invitation_id, token_hash, guest_name, side, group_label, active,
      open_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)
  `).bind(
    item.id,
    invitationId,
    item.tokenHash,
    item.input.guestName,
    item.input.side,
    item.input.groupLabel,
    createdAt,
    createdAt
  )));
  return created.map((item) => ({
    token: item.token,
    link: {
      id: item.id,
      ...item.input,
      active: true,
      deliveryChannel: null,
      sendCount: 0,
      firstSentAt: null,
      lastSentAt: null,
      deliveryNote: "",
      openCount: 0,
      firstOpenedAt: null,
      lastOpenedAt: null,
      respondedAt: null,
      rsvpId: null,
      followUpCompletedAt: null,
      createdAt,
      updatedAt: createdAt
    }
  }));
}

export async function updateInvitationInviteLink(
  db: D1Database,
  invitationId: string,
  linkId: string,
  update: InvitationInviteLinkUpdate,
  now = new Date()
): Promise<InvitationInviteLinkRecord | null> {
  const row = await db.prepare(`
    UPDATE invitation_invite_links
    SET guest_name = COALESCE(?, guest_name),
        side = COALESCE(?, side),
        group_label = COALESCE(?, group_label),
        active = COALESCE(?, active),
        follow_up_completed_at = CASE
          WHEN ? IS NULL THEN follow_up_completed_at
          WHEN ? = 1 THEN COALESCE(follow_up_completed_at, ?)
          ELSE NULL
        END,
        updated_at = ?
    WHERE invitation_id = ? AND id = ?
    RETURNING id, guest_name, side, group_label, active, delivery_channel, send_count,
              first_sent_at, last_sent_at, delivery_note, open_count, first_opened_at,
              last_opened_at, responded_at, rsvp_id, follow_up_completed_at, created_at, updated_at
  `).bind(
    update.guestName ?? null,
    update.side ?? null,
    update.groupLabel ?? null,
    update.active === undefined ? null : Number(update.active),
    update.followUpCompleted === undefined ? null : Number(update.followUpCompleted),
    update.followUpCompleted === undefined ? null : Number(update.followUpCompleted),
    now.toISOString(),
    now.toISOString(),
    invitationId,
    linkId
  ).first<InviteLinkRow>();
  return row ? record(row) : null;
}

export async function rotateInvitationInviteLink(
  db: D1Database,
  invitationId: string,
  linkId: string,
  now = new Date()
): Promise<InvitationInviteLinkCreated | null> {
  const credential = await createInvitationInviteToken();
  const row = await db.prepare(`
    UPDATE invitation_invite_links
    SET token_hash = ?, active = 1, updated_at = ?
    WHERE invitation_id = ? AND id = ?
    RETURNING id, guest_name, side, group_label, active, delivery_channel, send_count,
              first_sent_at, last_sent_at, delivery_note, open_count, first_opened_at,
              last_opened_at, responded_at, rsvp_id, follow_up_completed_at, created_at, updated_at
  `).bind(credential.tokenHash, now.toISOString(), invitationId, linkId).first<InviteLinkRow>();
  return row ? { link: record(row), token: credential.token } : null;
}

export async function recordInvitationInviteLinkDeliveries(
  db: D1Database,
  invitationId: string,
  input: InvitationInviteDeliveryInput,
  now = new Date()
): Promise<boolean> {
  const placeholders = input.linkIds.map(() => "?").join(", ");
  const found = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM invitation_invite_links
    WHERE invitation_id = ? AND id IN (${placeholders})
  `).bind(invitationId, ...input.linkIds).first<{ count: number }>();
  if (Number(found?.count ?? 0) !== input.linkIds.length) return false;

  const sentAt = now.toISOString();
  await db.batch(input.linkIds.map((linkId) => db.prepare(`
    UPDATE invitation_invite_links
    SET delivery_channel = ?,
        send_count = send_count + 1,
        first_sent_at = COALESCE(first_sent_at, ?),
        last_sent_at = ?,
        delivery_note = ?,
        updated_at = ?
    WHERE invitation_id = ? AND id = ?
  `).bind(input.channel, sentAt, sentAt, input.note, sentAt, invitationId, linkId)));
  return true;
}

export async function deleteInvitationInviteLink(
  db: D1Database,
  invitationId: string,
  linkId: string
): Promise<boolean> {
  const result = await db.prepare(`
    DELETE FROM invitation_invite_links WHERE invitation_id = ? AND id = ?
  `).bind(invitationId, linkId).run();
  return Number(result.meta?.changes ?? 0) > 0;
}

export async function openInvitationInviteLink(
  db: D1Database,
  invitationId: string,
  token: string,
  now = new Date()
): Promise<PublicInvitationInvite | null> {
  const tokenHash = await hashInvitationInviteToken(token);
  const openedAt = now.toISOString();
  const row = await db.prepare(`
    UPDATE invitation_invite_links
    SET open_count = open_count + 1,
        first_opened_at = COALESCE(first_opened_at, ?),
        last_opened_at = ?,
        updated_at = ?
    WHERE invitation_id = ? AND token_hash = ? AND active = 1
    RETURNING guest_name, side, group_label
  `).bind(openedAt, openedAt, openedAt, invitationId, tokenHash)
    .first<Pick<InviteLinkRow, "guest_name" | "side" | "group_label">>();
  return row ? { guestName: row.guest_name, side: row.side, groupLabel: row.group_label } : null;
}

export async function markInvitationInviteLinkResponded(
  db: D1Database,
  invitationId: string,
  token: string,
  rsvpId: string,
  now = new Date()
): Promise<boolean> {
  const tokenHash = await hashInvitationInviteToken(token);
  const respondedAt = now.toISOString();
  const result = await db.prepare(`
    UPDATE invitation_invite_links
    SET responded_at = ?, rsvp_id = ?, updated_at = ?
    WHERE invitation_id = ? AND token_hash = ? AND active = 1
  `).bind(respondedAt, rsvpId, respondedAt, invitationId, tokenHash).run();
  return Number(result.meta?.changes ?? 0) > 0;
}
