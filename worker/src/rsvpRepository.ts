import type { RsvpAdminResult, RsvpRecord, RsvpRecordSide, RsvpSubmission } from "@wedding-game/shared";

export type CreateRsvpArgs = {
  id: string;
  invitationId: string;
  submission: RsvpSubmission;
  consentedAt: string;
  editTokenHash: string;
};

export type UpdateRsvpArgs = {
  invitationId: string;
  rsvpId: string;
  submission: RsvpSubmission;
  expectedRevision: number;
  updatedAt: string;
};

export type OwnedRsvp = {
  response: RsvpRecord;
  editTokenHash: string | null;
};

export type RsvpPolicy = {
  consentVersion: string;
  responseDeadline: string | null;
  deleteAt: string | null;
};

type RsvpRow = {
  id: string;
  side: RsvpRecordSide;
  guest_name: string;
  phone: string | null;
  attendance: RsvpRecord["attendance"];
  party_size: number;
  child_count: number;
  meal_status: RsvpRecord["mealStatus"];
  note: string;
  consent_version: string | null;
  edit_token_hash: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
};

type InvitationPolicyRow = {
  config_json: string;
  rsvp_deadline: string | null;
  rsvp_delete_at: string | null;
};

type InvitationDeletePolicyRow = {
  rsvp_delete_at: string | null;
};

const rsvpColumns = `
  id, side, guest_name, phone, attendance, party_size, child_count, meal_status, note,
  consent_version, edit_token_hash, revision, created_at, updated_at
`;

function mapRsvpRow(row: RsvpRow): RsvpRecord {
  return {
    id: row.id,
    side: row.side,
    guestName: row.guest_name,
    phone: row.phone,
    attendance: row.attendance,
    partySize: row.party_size,
    childCount: row.child_count,
    mealStatus: row.meal_status,
    note: row.note,
    consentVersion: row.consent_version,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readConsentVersion(configJson: string): string {
  const config: unknown = JSON.parse(configJson);
  if (!isRecord(config) || !isRecord(config.rsvp) || typeof config.rsvp.consentVersion !== "string") {
    throw new Error("Invitation RSVP policy is missing consentVersion");
  }
  return config.rsvp.consentVersion;
}

export async function createRsvp(db: D1Database, args: CreateRsvpArgs): Promise<RsvpRecord> {
  const { submission } = args;
  const row = await db
    .prepare(`
      INSERT INTO rsvps (
        id, invitation_id, side, guest_name, phone, attendance, party_size,
        child_count, meal_status, note, consent_version, consented_at, edit_token_hash,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING ${rsvpColumns}
    `)
    .bind(
      args.id,
      args.invitationId,
      submission.side,
      submission.guestName,
      submission.phone,
      submission.attendance,
      submission.partySize,
      submission.childCount ?? 0,
      submission.mealStatus,
      submission.note,
      submission.consentVersion,
      args.consentedAt,
      args.editTokenHash,
      args.consentedAt,
      args.consentedAt
    )
    .first<RsvpRow>();

  if (!row) throw new Error("D1 did not return the created RSVP");
  return mapRsvpRow(row);
}

export async function findRsvp(db: D1Database, invitationId: string, rsvpId: string): Promise<OwnedRsvp | null> {
  const row = await db
    .prepare(`
      SELECT ${rsvpColumns}
      FROM rsvps
      WHERE invitation_id = ? AND id = ?
    `)
    .bind(invitationId, rsvpId)
    .first<RsvpRow>();

  return row ? { response: mapRsvpRow(row), editTokenHash: row.edit_token_hash } : null;
}

export async function updateRsvp(db: D1Database, args: UpdateRsvpArgs): Promise<RsvpRecord | null> {
  const { submission } = args;
  const row = await db
    .prepare(`
      UPDATE rsvps
      SET side = ?,
          guest_name = ?,
          phone = ?,
          attendance = ?,
          party_size = ?,
          child_count = CASE
            WHEN ? IS NULL THEN MIN(child_count, ?)
            ELSE ?
          END,
          meal_status = ?,
          note = ?,
          consent_version = ?,
          updated_at = ?,
          revision = revision + 1
      WHERE invitation_id = ? AND id = ? AND revision = ?
      RETURNING ${rsvpColumns}
    `)
    .bind(
      submission.side,
      submission.guestName,
      submission.phone,
      submission.attendance,
      submission.partySize,
      submission.childCount ?? null,
      submission.partySize,
      submission.childCount ?? null,
      submission.mealStatus,
      submission.note,
      submission.consentVersion,
      args.updatedAt,
      args.invitationId,
      args.rsvpId,
      args.expectedRevision
    )
    .first<RsvpRow>();

  return row ? mapRsvpRow(row) : null;
}

export async function getRsvpPolicy(db: D1Database, invitationId: string): Promise<RsvpPolicy | null> {
  const row = await db
    .prepare(`
      SELECT config_json, rsvp_deadline, rsvp_delete_at
      FROM invitations
      WHERE id = ?
    `)
    .bind(invitationId)
    .first<InvitationPolicyRow>();

  if (!row) return null;
  return {
    consentVersion: readConsentVersion(row.config_json),
    responseDeadline: row.rsvp_deadline,
    deleteAt: row.rsvp_delete_at
  };
}

export async function listRsvps(db: D1Database, invitationId: string): Promise<RsvpAdminResult> {
  const invitation = await db
    .prepare(`
      SELECT rsvp_delete_at
      FROM invitations
      WHERE id = ?
    `)
    .bind(invitationId)
    .first<InvitationDeletePolicyRow>();
  if (!invitation?.rsvp_delete_at) throw new Error("Invitation RSVP delete policy is missing");

  const result = await db
    .prepare(`
      SELECT ${rsvpColumns}
      FROM rsvps
      WHERE invitation_id = ?
      ORDER BY updated_at DESC
    `)
    .bind(invitationId)
    .all<RsvpRow>();
  const responses = (result.results ?? []).map(mapRsvpRow);

  return {
    summary: {
      responseCount: responses.length,
      attendingResponseCount: responses.filter(({ attendance }) => attendance === "yes").length,
      attendingPartySize: responses
        .filter(({ attendance }) => attendance === "yes")
        .reduce((total, { partySize }) => total + partySize, 0),
      mealPartySize: responses
        .filter(({ attendance, mealStatus }) => attendance === "yes" && mealStatus === "yes")
        .reduce((total, { partySize }) => total + partySize, 0),
      declinedResponseCount: responses.filter(({ attendance }) => attendance === "no").length,
      unsureResponseCount: responses.filter(({ attendance }) => attendance === "unsure").length,
      unsurePartySize: responses
        .filter(({ attendance }) => attendance === "unsure")
        .reduce((total, { partySize }) => total + partySize, 0),
      deleteAt: invitation.rsvp_delete_at
    },
    responses
  };
}

export async function deleteRsvp(db: D1Database, invitationId: string, rsvpId: string): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM rsvps WHERE invitation_id = ? AND id = ?")
    .bind(invitationId, rsvpId)
    .run();
  return result.meta.changes > 0;
}
