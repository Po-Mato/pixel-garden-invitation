import { createEditCredential, hashEditToken } from "./security";

export type GameTransferStatus = "active" | "claimed" | "revoked" | "expired";

export type GameTransferState = {
  id: string;
  status: GameTransferStatus;
  entryCount: number;
  createdAt: string;
  expiresAt: string;
  claimedAt: string | null;
  revokedAt: string | null;
};

export type CreatedGameTransfer = GameTransferState & {
  claimToken: string;
  manageToken: string;
};

type GameTransferRow = {
  id: string;
  status: "active" | "claimed" | "revoked";
  entry_count: number;
  created_at: string;
  expires_at: string;
  claimed_at: string | null;
  revoked_at: string | null;
};

function state(row: GameTransferRow, now: Date): GameTransferState {
  return {
    id: row.id,
    status: row.status === "active" && row.expires_at <= now.toISOString() ? "expired" : row.status,
    entryCount: row.entry_count,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    claimedAt: row.claimed_at,
    revokedAt: row.revoked_at
  };
}

const transferColumns = "id, status, entry_count, created_at, expires_at, claimed_at, revoked_at";

export async function createGameTransfer(
  db: D1Database,
  input: { invitationId: string; clientHash: string; entryCount: number; expiresAt: string },
  now = new Date()
): Promise<CreatedGameTransfer | "not_found" | "rate_limited"> {
  const invitation = await db.prepare("SELECT id FROM invitations WHERE id = ?").bind(input.invitationId).first();
  if (!invitation) return "not_found";
  await db.prepare("DELETE FROM game_save_transfers WHERE expires_at < ?")
    .bind(new Date(now.getTime() - 30 * 24 * 60 * 60_000).toISOString()).run();
  const recent = await db.prepare(`
    SELECT COUNT(*) AS count FROM game_save_transfers
    WHERE invitation_id = ? AND client_hash = ? AND created_at >= ?
  `).bind(input.invitationId, input.clientHash, new Date(now.getTime() - 60 * 60_000).toISOString()).first<{ count: number }>();
  if (Number(recent?.count ?? 0) >= 8) return "rate_limited";

  const claim = await createEditCredential();
  const manage = await createEditCredential();
  const id = `transfer_${crypto.randomUUID()}`;
  const createdAt = now.toISOString();
  const row = await db.prepare(`
    INSERT INTO game_save_transfers (
      id, invitation_id, claim_token_hash, manage_token_hash, client_hash,
      entry_count, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING ${transferColumns}
  `).bind(
    id,
    input.invitationId,
    claim.editTokenHash,
    manage.editTokenHash,
    input.clientHash,
    input.entryCount,
    createdAt,
    input.expiresAt
  ).first<GameTransferRow>();
  if (!row) return "not_found";
  return { ...state(row, now), claimToken: claim.editToken, manageToken: manage.editToken };
}

async function authorizedTransfer(
  db: D1Database,
  invitationId: string,
  transferId: string,
  token: string,
  role: "claim" | "manage"
) {
  const tokenHash = await hashEditToken(token);
  return db.prepare(`
    SELECT ${transferColumns} FROM game_save_transfers
    WHERE invitation_id = ? AND id = ? AND ${role}_token_hash = ?
  `).bind(invitationId, transferId, tokenHash).first<GameTransferRow>();
}

export async function loadGameTransfer(
  db: D1Database,
  invitationId: string,
  transferId: string,
  token: string,
  now = new Date()
): Promise<GameTransferState | null> {
  const row = await authorizedTransfer(db, invitationId, transferId, token, "claim")
    ?? await authorizedTransfer(db, invitationId, transferId, token, "manage");
  return row ? state(row, now) : null;
}

export async function claimGameTransfer(
  db: D1Database,
  invitationId: string,
  transferId: string,
  token: string,
  now = new Date()
): Promise<{ state: GameTransferState; changed: boolean } | null> {
  const tokenHash = await hashEditToken(token);
  const claimedAt = now.toISOString();
  const row = await db.prepare(`
    UPDATE game_save_transfers
    SET status = 'claimed', claimed_at = ?
    WHERE invitation_id = ? AND id = ? AND claim_token_hash = ?
      AND status = 'active' AND expires_at > ?
    RETURNING ${transferColumns}
  `).bind(claimedAt, invitationId, transferId, tokenHash, claimedAt).first<GameTransferRow>();
  if (row) return { state: state(row, now), changed: true };
  const existing = await authorizedTransfer(db, invitationId, transferId, token, "claim");
  return existing ? { state: state(existing, now), changed: false } : null;
}

export async function revokeGameTransfer(
  db: D1Database,
  invitationId: string,
  transferId: string,
  token: string,
  now = new Date()
): Promise<{ state: GameTransferState; changed: boolean } | null> {
  const tokenHash = await hashEditToken(token);
  const revokedAt = now.toISOString();
  const row = await db.prepare(`
    UPDATE game_save_transfers
    SET status = 'revoked', revoked_at = ?
    WHERE invitation_id = ? AND id = ? AND manage_token_hash = ?
      AND status = 'active' AND expires_at > ?
    RETURNING ${transferColumns}
  `).bind(revokedAt, invitationId, transferId, tokenHash, revokedAt).first<GameTransferRow>();
  if (row) return { state: state(row, now), changed: true };
  const existing = await authorizedTransfer(db, invitationId, transferId, token, "manage");
  return existing ? { state: state(existing, now), changed: false } : null;
}
