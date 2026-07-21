import type {
  GuestbookAdminResult,
  GuestbookMessage,
  GuestbookOwnedMessage,
  GuestbookPage,
  GuestbookSubmission
} from "@wedding-game/shared";

export type CreateGuestbookArgs = {
  id: string;
  invitationId: string;
  submission: GuestbookSubmission;
  clientHash: string;
  editTokenHash: string;
  createdAt: string;
};

export type UpdateGuestbookArgs = {
  invitationId: string;
  guestbookId: string;
  submission: GuestbookSubmission;
  expectedRevision: number;
  updatedAt: string;
};

export type ModerateGuestbookArgs = {
  invitationId: string;
  guestbookId: string;
  hidden: boolean;
  expectedRevision: number;
  updatedAt: string;
};

export type OwnedGuestbook = {
  response: GuestbookOwnedMessage;
  editTokenHash: string | null;
};

export type GuestbookCursor = {
  createdAt: string;
  id: string;
};

type GuestbookRow = {
  id: string;
  nickname: string;
  message: string;
  is_hidden: number;
  edit_token_hash: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
};

type GuestbookDeletePolicyRow = {
  guestbook_delete_at: string | null;
};

type RecentWriteRow = {
  write_count: number;
  oldest_created_at: string | null;
};

const guestbookColumns = `
  id, nickname, message, is_hidden, edit_token_hash, revision, created_at, updated_at
`;

function mapOwnedGuestbookRow(row: GuestbookRow): GuestbookOwnedMessage {
  return {
    id: row.id,
    nickname: row.nickname,
    message: row.message,
    isHidden: row.is_hidden === 1,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPublicGuestbookRow(row: GuestbookRow): GuestbookMessage {
  const { isHidden: _isHidden, ...message } = mapOwnedGuestbookRow(row);
  return message;
}

function encodeBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) return null;
  try {
    return atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
  } catch {
    return null;
  }
}

export function encodeGuestbookCursor(cursor: GuestbookCursor): string {
  return encodeBase64Url(JSON.stringify([cursor.createdAt, cursor.id]));
}

export function decodeGuestbookCursor(value: string): GuestbookCursor | null {
  const decoded = decodeBase64Url(value);
  if (!decoded) return null;
  try {
    const parsed: unknown = JSON.parse(decoded);
    if (
      !Array.isArray(parsed)
      || parsed.length !== 2
      || typeof parsed[0] !== "string"
      || parsed[0].length === 0
      || typeof parsed[1] !== "string"
      || parsed[1].length === 0
    ) return null;
    return { createdAt: parsed[0], id: parsed[1] };
  } catch {
    return null;
  }
}

export async function createGuestbook(db: D1Database, args: CreateGuestbookArgs): Promise<GuestbookOwnedMessage> {
  const row = await db.prepare(`
    INSERT INTO guestbook_messages (
      id, invitation_id, nickname, message, is_hidden, client_hash,
      edit_token_hash, revision, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 0, ?, ?, 1, ?, ?)
    RETURNING ${guestbookColumns}
  `).bind(
    args.id,
    args.invitationId,
    args.submission.nickname,
    args.submission.message,
    args.clientHash,
    args.editTokenHash,
    args.createdAt,
    args.createdAt
  ).first<GuestbookRow>();

  if (!row) throw new Error("D1 did not return the created guestbook message");
  return mapOwnedGuestbookRow(row);
}

export async function findGuestbook(
  db: D1Database,
  invitationId: string,
  guestbookId: string
): Promise<OwnedGuestbook | null> {
  const row = await db.prepare(`
    SELECT ${guestbookColumns}
    FROM guestbook_messages
    WHERE invitation_id = ? AND id = ?
  `).bind(invitationId, guestbookId).first<GuestbookRow>();

  return row ? { response: mapOwnedGuestbookRow(row), editTokenHash: row.edit_token_hash } : null;
}

export async function updateGuestbook(
  db: D1Database,
  args: UpdateGuestbookArgs
): Promise<GuestbookOwnedMessage | null> {
  const row = await db.prepare(`
    UPDATE guestbook_messages
    SET nickname = ?, message = ?, updated_at = ?, revision = revision + 1
    WHERE invitation_id = ? AND id = ? AND revision = ?
    RETURNING ${guestbookColumns}
  `).bind(
    args.submission.nickname,
    args.submission.message,
    args.updatedAt,
    args.invitationId,
    args.guestbookId,
    args.expectedRevision
  ).first<GuestbookRow>();

  return row ? mapOwnedGuestbookRow(row) : null;
}

export async function moderateGuestbook(
  db: D1Database,
  args: ModerateGuestbookArgs
): Promise<GuestbookOwnedMessage | null> {
  const row = await db.prepare(`
    UPDATE guestbook_messages
    SET is_hidden = ?, updated_at = ?, revision = revision + 1
    WHERE invitation_id = ? AND id = ? AND revision = ?
    RETURNING ${guestbookColumns}
  `).bind(
    args.hidden ? 1 : 0,
    args.updatedAt,
    args.invitationId,
    args.guestbookId,
    args.expectedRevision
  ).first<GuestbookRow>();

  return row ? mapOwnedGuestbookRow(row) : null;
}

export async function deleteGuestbook(
  db: D1Database,
  invitationId: string,
  guestbookId: string
): Promise<boolean> {
  const result = await db.prepare(
    "DELETE FROM guestbook_messages WHERE invitation_id = ? AND id = ?"
  ).bind(invitationId, guestbookId).run();
  return result.meta.changes > 0;
}

export async function getGuestbookDeleteAt(db: D1Database, invitationId: string): Promise<string | null | undefined> {
  const row = await db.prepare(`
    SELECT guestbook_delete_at
    FROM invitations
    WHERE id = ?
  `).bind(invitationId).first<GuestbookDeletePolicyRow>();
  return row?.guestbook_delete_at;
}

export async function listGuestbookPage(
  db: D1Database,
  invitationId: string,
  cursor: GuestbookCursor | null,
  pageSize = 20
): Promise<GuestbookPage> {
  const limit = pageSize + 1;
  const statement = cursor
    ? db.prepare(`
        SELECT ${guestbookColumns}
        FROM guestbook_messages
        WHERE invitation_id = ? AND is_hidden = 0
          AND (created_at < ? OR (created_at = ? AND id < ?))
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `).bind(invitationId, cursor.createdAt, cursor.createdAt, cursor.id, limit)
    : db.prepare(`
        SELECT ${guestbookColumns}
        FROM guestbook_messages
        WHERE invitation_id = ? AND is_hidden = 0
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `).bind(invitationId, limit);
  const result = await statement.all<GuestbookRow>();
  const rows = result.results ?? [];
  const hasMore = rows.length > pageSize;
  const messages = rows.slice(0, pageSize).map(mapPublicGuestbookRow);
  const last = messages.at(-1);

  return {
    messages,
    nextCursor: hasMore && last ? encodeGuestbookCursor({ createdAt: last.createdAt, id: last.id }) : null
  };
}

export async function listAdminGuestbook(db: D1Database, invitationId: string): Promise<GuestbookAdminResult> {
  const deleteAt = await getGuestbookDeleteAt(db, invitationId);
  if (!deleteAt) throw new Error("Invitation guestbook delete policy is missing");

  const result = await db.prepare(`
    SELECT ${guestbookColumns}
    FROM guestbook_messages
    WHERE invitation_id = ?
    ORDER BY updated_at DESC, id DESC
  `).bind(invitationId).all<GuestbookRow>();
  const messages = (result.results ?? []).map(mapOwnedGuestbookRow);
  const hiddenCount = messages.filter(({ isHidden }) => isHidden).length;

  return {
    summary: {
      totalCount: messages.length,
      visibleCount: messages.length - hiddenCount,
      hiddenCount,
      deleteAt
    },
    messages
  };
}

export async function countRecentGuestbookWrites(
  db: D1Database,
  invitationId: string,
  clientHash: string,
  cutoff: string
): Promise<{ count: number; oldestCreatedAt: string | null }> {
  const row = await db.prepare(`
    SELECT COUNT(*) AS write_count, MIN(created_at) AS oldest_created_at
    FROM guestbook_messages
    WHERE invitation_id = ? AND client_hash = ? AND created_at >= ?
  `).bind(invitationId, clientHash, cutoff).first<RecentWriteRow>();

  return {
    count: Number(row?.write_count ?? 0),
    oldestCreatedAt: row?.oldest_created_at ?? null
  };
}
