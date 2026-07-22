import {
  parseEditableInvitationContent,
  type EditableInvitationContent,
  type InvitationContentAdminResult,
  type InvitationContentPublicResult,
  type InvitationContentVersion,
  type InvitationContentVersionAction
} from "@wedding-game/shared";

type ContentRow = {
  draft_json: string;
  draft_revision: number;
  published_json: string | null;
  published_revision: number | null;
  updated_at: string;
  published_at: string | null;
};

type HistoryRow = {
  id: string;
  revision: number;
  action: InvitationContentVersionAction;
  content_json: string;
  created_at: string;
};

export type ContentWriteResult =
  | { ok: true; result: InvitationContentAdminResult }
  | { ok: false; reason: "not_found" | "conflict" };

function parseStoredContent(value: string): EditableInvitationContent {
  const parsed = parseEditableInvitationContent(JSON.parse(value) as unknown);
  if (!parsed) throw new Error("Stored invitation content is invalid");
  return parsed;
}

function mapVersion(row: HistoryRow): InvitationContentVersion {
  return {
    id: row.id,
    revision: row.revision,
    action: row.action,
    content: parseStoredContent(row.content_json),
    createdAt: row.created_at
  };
}

async function findContentRow(db: D1Database, invitationId: string): Promise<ContentRow | null> {
  return db.prepare(`
    SELECT draft_json, draft_revision, published_json, published_revision, updated_at, published_at
    FROM invitation_content
    WHERE invitation_id = ?
  `).bind(invitationId).first<ContentRow>();
}

async function invitationExists(db: D1Database, invitationId: string): Promise<boolean> {
  return Boolean(await db.prepare("SELECT id FROM invitations WHERE id = ?").bind(invitationId).first());
}

async function insertHistory(
  db: D1Database,
  args: {
    id: string;
    invitationId: string;
    revision: number;
    action: InvitationContentVersionAction;
    contentJson: string;
    createdAt: string;
  }
): Promise<void> {
  await db.prepare(`
    INSERT INTO invitation_content_versions (
      id, invitation_id, revision, action, content_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    args.id,
    args.invitationId,
    args.revision,
    args.action,
    args.contentJson,
    args.createdAt
  ).run();

  await db.prepare(`
    DELETE FROM invitation_content_versions
    WHERE invitation_id = ? AND id IN (
      SELECT id
      FROM invitation_content_versions
      WHERE invitation_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT -1 OFFSET 20
    )
  `).bind(args.invitationId, args.invitationId).run();
}

export async function getPublicInvitationContent(
  db: D1Database,
  invitationId: string
): Promise<InvitationContentPublicResult | null> {
  if (!(await invitationExists(db, invitationId))) return null;
  const row = await findContentRow(db, invitationId);
  return {
    content: row?.published_json ? parseStoredContent(row.published_json) : null,
    revision: row?.published_revision ?? null,
    publishedAt: row?.published_at ?? null
  };
}

export async function getAdminInvitationContent(
  db: D1Database,
  invitationId: string
): Promise<InvitationContentAdminResult | null> {
  if (!(await invitationExists(db, invitationId))) return null;
  const [row, historyResult] = await Promise.all([
    findContentRow(db, invitationId),
    db.prepare(`
      SELECT id, revision, action, content_json, created_at
      FROM invitation_content_versions
      WHERE invitation_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 20
    `).bind(invitationId).all<HistoryRow>()
  ]);
  return {
    draft: row ? parseStoredContent(row.draft_json) : null,
    revision: row?.draft_revision ?? 0,
    publishedRevision: row?.published_revision ?? null,
    updatedAt: row?.updated_at ?? null,
    publishedAt: row?.published_at ?? null,
    history: (historyResult.results ?? []).map(mapVersion)
  };
}

export async function saveInvitationContentDraft(
  db: D1Database,
  args: {
    invitationId: string;
    content: EditableInvitationContent;
    expectedRevision: number;
    historyId: string;
    now: string;
  }
): Promise<ContentWriteResult> {
  const contentJson = JSON.stringify(args.content);
  const existing = await findContentRow(db, args.invitationId);
  let nextRevision: number;

  if (!existing) {
    if (!(await invitationExists(db, args.invitationId))) return { ok: false, reason: "not_found" };
    if (args.expectedRevision !== 0) return { ok: false, reason: "conflict" };
    try {
      await db.prepare(`
        INSERT INTO invitation_content (
          invitation_id, draft_json, draft_revision, updated_at
        ) VALUES (?, ?, 1, ?)
      `).bind(args.invitationId, contentJson, args.now).run();
    } catch {
      return { ok: false, reason: "conflict" };
    }
    nextRevision = 1;
  } else {
    const updated = await db.prepare(`
      UPDATE invitation_content
      SET draft_json = ?, draft_revision = draft_revision + 1, updated_at = ?
      WHERE invitation_id = ? AND draft_revision = ?
    `).bind(contentJson, args.now, args.invitationId, args.expectedRevision).run();
    if (updated.meta.changes === 0) return { ok: false, reason: "conflict" };
    nextRevision = args.expectedRevision + 1;
  }

  await insertHistory(db, {
    id: args.historyId,
    invitationId: args.invitationId,
    revision: nextRevision,
    action: "save",
    contentJson,
    createdAt: args.now
  });
  const result = await getAdminInvitationContent(db, args.invitationId);
  if (!result) return { ok: false, reason: "not_found" };
  return { ok: true, result };
}

export async function publishInvitationContent(
  db: D1Database,
  args: {
    invitationId: string;
    expectedRevision: number;
    historyId: string;
    now: string;
  }
): Promise<ContentWriteResult> {
  const row = await findContentRow(db, args.invitationId);
  if (!row) {
    return { ok: false, reason: await invitationExists(db, args.invitationId) ? "conflict" : "not_found" };
  }
  const updated = await db.prepare(`
    UPDATE invitation_content
    SET published_json = draft_json,
        published_revision = draft_revision,
        published_at = ?
    WHERE invitation_id = ? AND draft_revision = ?
  `).bind(args.now, args.invitationId, args.expectedRevision).run();
  if (updated.meta.changes === 0) return { ok: false, reason: "conflict" };

  await insertHistory(db, {
    id: args.historyId,
    invitationId: args.invitationId,
    revision: row.draft_revision,
    action: "publish",
    contentJson: row.draft_json,
    createdAt: args.now
  });
  const result = await getAdminInvitationContent(db, args.invitationId);
  if (!result) return { ok: false, reason: "not_found" };
  return { ok: true, result };
}

export async function restoreInvitationContentVersion(
  db: D1Database,
  args: {
    invitationId: string;
    versionId: string;
    expectedRevision: number;
    historyId: string;
    now: string;
  }
): Promise<ContentWriteResult> {
  const version = await db.prepare(`
    SELECT id, revision, action, content_json, created_at
    FROM invitation_content_versions
    WHERE invitation_id = ? AND id = ?
  `).bind(args.invitationId, args.versionId).first<HistoryRow>();
  if (!version) return { ok: false, reason: "not_found" };

  const updated = await db.prepare(`
    UPDATE invitation_content
    SET draft_json = ?, draft_revision = draft_revision + 1, updated_at = ?
    WHERE invitation_id = ? AND draft_revision = ?
  `).bind(version.content_json, args.now, args.invitationId, args.expectedRevision).run();
  if (updated.meta.changes === 0) return { ok: false, reason: "conflict" };

  const nextRevision = args.expectedRevision + 1;
  await insertHistory(db, {
    id: args.historyId,
    invitationId: args.invitationId,
    revision: nextRevision,
    action: "restore",
    contentJson: version.content_json,
    createdAt: args.now
  });
  const result = await getAdminInvitationContent(db, args.invitationId);
  if (!result) return { ok: false, reason: "not_found" };
  return { ok: true, result };
}
