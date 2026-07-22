import {
  parseEditableInvitationGallery,
  weddingContent,
  type EditableInvitationGallery,
  type InvitationGalleryAdminResult,
  type InvitationGalleryPublicResult,
  type InvitationGalleryVersion,
  type InvitationGalleryVersionAction
} from "@wedding-game/shared";

type GalleryRow = {
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
  action: InvitationGalleryVersionAction;
  gallery_json: string;
  created_at: string;
};

export type GalleryWriteResult =
  | { ok: true; result: InvitationGalleryAdminResult }
  | { ok: false; reason: "not_found" | "conflict" };

function parseStoredGallery(value: string): EditableInvitationGallery {
  const parsed = parseEditableInvitationGallery(JSON.parse(value) as unknown, weddingContent.gallery);
  if (!parsed) throw new Error("Stored invitation gallery is invalid");
  return parsed;
}

function mapVersion(row: HistoryRow): InvitationGalleryVersion {
  return {
    id: row.id,
    revision: row.revision,
    action: row.action,
    gallery: parseStoredGallery(row.gallery_json),
    createdAt: row.created_at
  };
}

async function invitationExists(db: D1Database, invitationId: string): Promise<boolean> {
  return Boolean(await db.prepare("SELECT id FROM invitations WHERE id = ?").bind(invitationId).first());
}

async function findGalleryRow(db: D1Database, invitationId: string): Promise<GalleryRow | null> {
  return db.prepare(`
    SELECT draft_json, draft_revision, published_json, published_revision, updated_at, published_at
    FROM invitation_gallery
    WHERE invitation_id = ?
  `).bind(invitationId).first<GalleryRow>();
}

async function insertHistory(
  db: D1Database,
  args: {
    id: string;
    invitationId: string;
    revision: number;
    action: InvitationGalleryVersionAction;
    galleryJson: string;
    createdAt: string;
  }
): Promise<void> {
  await db.prepare(`
    INSERT INTO invitation_gallery_versions (
      id, invitation_id, revision, action, gallery_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    args.id,
    args.invitationId,
    args.revision,
    args.action,
    args.galleryJson,
    args.createdAt
  ).run();

  await db.prepare(`
    DELETE FROM invitation_gallery_versions
    WHERE invitation_id = ? AND id IN (
      SELECT id FROM invitation_gallery_versions
      WHERE invitation_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT -1 OFFSET 20
    )
  `).bind(args.invitationId, args.invitationId).run();
}

export async function getPublicInvitationGallery(
  db: D1Database,
  invitationId: string
): Promise<InvitationGalleryPublicResult | null> {
  if (!(await invitationExists(db, invitationId))) return null;
  const row = await findGalleryRow(db, invitationId);
  return {
    gallery: row?.published_json ? parseStoredGallery(row.published_json) : null,
    revision: row?.published_revision ?? null,
    publishedAt: row?.published_at ?? null
  };
}

export async function getAdminInvitationGallery(
  db: D1Database,
  invitationId: string
): Promise<InvitationGalleryAdminResult | null> {
  if (!(await invitationExists(db, invitationId))) return null;
  const [row, historyResult] = await Promise.all([
    findGalleryRow(db, invitationId),
    db.prepare(`
      SELECT id, revision, action, gallery_json, created_at
      FROM invitation_gallery_versions
      WHERE invitation_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 20
    `).bind(invitationId).all<HistoryRow>()
  ]);
  return {
    draft: row ? parseStoredGallery(row.draft_json) : null,
    revision: row?.draft_revision ?? 0,
    publishedRevision: row?.published_revision ?? null,
    updatedAt: row?.updated_at ?? null,
    publishedAt: row?.published_at ?? null,
    history: (historyResult.results ?? []).map(mapVersion)
  };
}

export async function saveInvitationGalleryDraft(
  db: D1Database,
  args: {
    invitationId: string;
    gallery: EditableInvitationGallery;
    expectedRevision: number;
    historyId: string;
    now: string;
  }
): Promise<GalleryWriteResult> {
  const galleryJson = JSON.stringify(args.gallery);
  const existing = await findGalleryRow(db, args.invitationId);
  let nextRevision: number;
  if (!existing) {
    if (!(await invitationExists(db, args.invitationId))) return { ok: false, reason: "not_found" };
    if (args.expectedRevision !== 0) return { ok: false, reason: "conflict" };
    try {
      await db.prepare(`
        INSERT INTO invitation_gallery (
          invitation_id, draft_json, draft_revision, updated_at
        ) VALUES (?, ?, 1, ?)
      `).bind(args.invitationId, galleryJson, args.now).run();
    } catch {
      return { ok: false, reason: "conflict" };
    }
    nextRevision = 1;
  } else {
    const updated = await db.prepare(`
      UPDATE invitation_gallery
      SET draft_json = ?, draft_revision = draft_revision + 1, updated_at = ?
      WHERE invitation_id = ? AND draft_revision = ?
    `).bind(galleryJson, args.now, args.invitationId, args.expectedRevision).run();
    if (updated.meta.changes === 0) return { ok: false, reason: "conflict" };
    nextRevision = args.expectedRevision + 1;
  }

  await insertHistory(db, {
    id: args.historyId,
    invitationId: args.invitationId,
    revision: nextRevision,
    action: "save",
    galleryJson,
    createdAt: args.now
  });
  const result = await getAdminInvitationGallery(db, args.invitationId);
  return result ? { ok: true, result } : { ok: false, reason: "not_found" };
}

export async function publishInvitationGallery(
  db: D1Database,
  args: {
    invitationId: string;
    expectedRevision: number;
    historyId: string;
    now: string;
  }
): Promise<GalleryWriteResult> {
  const row = await findGalleryRow(db, args.invitationId);
  if (!row) {
    return { ok: false, reason: await invitationExists(db, args.invitationId) ? "conflict" : "not_found" };
  }
  const updated = await db.prepare(`
    UPDATE invitation_gallery
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
    galleryJson: row.draft_json,
    createdAt: args.now
  });
  const result = await getAdminInvitationGallery(db, args.invitationId);
  return result ? { ok: true, result } : { ok: false, reason: "not_found" };
}

export async function restoreInvitationGalleryVersion(
  db: D1Database,
  args: {
    invitationId: string;
    versionId: string;
    expectedRevision: number;
    historyId: string;
    now: string;
  }
): Promise<GalleryWriteResult> {
  const version = await db.prepare(`
    SELECT id, revision, action, gallery_json, created_at
    FROM invitation_gallery_versions
    WHERE invitation_id = ? AND id = ?
  `).bind(args.invitationId, args.versionId).first<HistoryRow>();
  if (!version) return { ok: false, reason: "not_found" };
  const updated = await db.prepare(`
    UPDATE invitation_gallery
    SET draft_json = ?, draft_revision = draft_revision + 1, updated_at = ?
    WHERE invitation_id = ? AND draft_revision = ?
  `).bind(version.gallery_json, args.now, args.invitationId, args.expectedRevision).run();
  if (updated.meta.changes === 0) return { ok: false, reason: "conflict" };
  const nextRevision = args.expectedRevision + 1;
  await insertHistory(db, {
    id: args.historyId,
    invitationId: args.invitationId,
    revision: nextRevision,
    action: "restore",
    galleryJson: version.gallery_json,
    createdAt: args.now
  });
  const result = await getAdminInvitationGallery(db, args.invitationId);
  return result ? { ok: true, result } : { ok: false, reason: "not_found" };
}

export async function isPublishedGalleryAsset(
  db: D1Database,
  invitationId: string,
  assetId: string
): Promise<boolean> {
  const row = await db.prepare(`
    SELECT 1 AS found
    FROM invitation_gallery, json_each(invitation_gallery.published_json, '$.photos')
    WHERE invitation_id = ?
      AND json_extract(json_each.value, '$.assetId') = ?
    LIMIT 1
  `).bind(invitationId, assetId).first<{ found: number }>();
  return Boolean(row);
}
