import {
  editableInvitationContentPublishIssues,
  editableInvitationGalleryPublishIssues,
  parseEditableInvitationContent,
  parseEditableInvitationGallery,
  weddingContent,
  type EditableInvitationContent,
  type EditableInvitationGallery,
  type InvitationReleaseAction,
  type InvitationReleaseAdminResult,
  type InvitationReleasePublicResult,
  type InvitationReleaseSchedule,
  type InvitationReleaseVersion
} from "@wedding-game/shared";

type ReleaseSourceRow = {
  content_json: string | null;
  content_revision: number | null;
  content_published_json: string | null;
  content_published_revision: number | null;
  content_updated_at: string | null;
  content_published_at: string | null;
  gallery_json: string | null;
  gallery_revision: number | null;
  gallery_published_json: string | null;
  gallery_published_revision: number | null;
  gallery_updated_at: string | null;
  gallery_published_at: string | null;
};

type ReleaseRow = {
  id: string;
  release_number: number;
  action: InvitationReleaseAction;
  source_release_id: string | null;
  content_revision: number;
  gallery_revision: number;
  created_at: string;
};

type ReleaseSnapshotRow = ReleaseRow & {
  content_json: string;
  gallery_json: string;
};

type ScheduleRow = {
  id: string;
  content_revision: number;
  gallery_revision: number;
  scheduled_for: string;
  created_at: string;
  updated_at: string;
};

type DueScheduleRow = ScheduleRow & { invitation_id: string };

export type ReleaseWriteResult =
  | { ok: true; result: InvitationReleaseAdminResult }
  | { ok: false; reason: "not_found" | "conflict" | "content_incomplete" | "gallery_incomplete"; issues?: string[] };

function parseContent(value: string): EditableInvitationContent {
  const parsed = parseEditableInvitationContent(JSON.parse(value) as unknown);
  if (!parsed) throw new Error("Stored invitation content is invalid");
  return parsed;
}

function parseGallery(value: string): EditableInvitationGallery {
  const parsed = parseEditableInvitationGallery(JSON.parse(value) as unknown, weddingContent.gallery);
  if (!parsed) throw new Error("Stored invitation gallery is invalid");
  return parsed;
}

function mapRelease(row: ReleaseRow): InvitationReleaseVersion {
  return {
    id: row.id,
    releaseNumber: row.release_number,
    action: row.action,
    sourceReleaseId: row.source_release_id,
    contentRevision: row.content_revision,
    galleryRevision: row.gallery_revision,
    createdAt: row.created_at
  };
}

function mapSchedule(row: ScheduleRow | null): InvitationReleaseSchedule | null {
  return row ? {
    id: row.id,
    contentRevision: row.content_revision,
    galleryRevision: row.gallery_revision,
    scheduledFor: row.scheduled_for,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  } : null;
}

async function findReleaseSource(db: D1Database, invitationId: string): Promise<ReleaseSourceRow | null> {
  return db.prepare(`
    SELECT
      content.draft_json AS content_json,
      content.draft_revision AS content_revision,
      content.published_json AS content_published_json,
      content.published_revision AS content_published_revision,
      content.updated_at AS content_updated_at,
      content.published_at AS content_published_at,
      gallery.draft_json AS gallery_json,
      gallery.draft_revision AS gallery_revision,
      gallery.published_json AS gallery_published_json,
      gallery.published_revision AS gallery_published_revision,
      gallery.updated_at AS gallery_updated_at,
      gallery.published_at AS gallery_published_at
    FROM invitations
    LEFT JOIN invitation_content AS content ON content.invitation_id = invitations.id
    LEFT JOIN invitation_gallery AS gallery ON gallery.invitation_id = invitations.id
    WHERE invitations.id = ?
  `).bind(invitationId).first<ReleaseSourceRow>();
}

export async function getPublicInvitationRelease(
  db: D1Database,
  invitationId: string
): Promise<InvitationReleasePublicResult | null> {
  const latest = await db.prepare(`
    SELECT id, release_number, action, source_release_id, content_json, content_revision,
           gallery_json, gallery_revision, created_at
    FROM invitation_releases
    WHERE invitation_id = ?
    ORDER BY release_number DESC
    LIMIT 1
  `).bind(invitationId).first<ReleaseSnapshotRow>();
  if (latest) {
    return {
      content: parseContent(latest.content_json),
      gallery: parseGallery(latest.gallery_json),
      releaseNumber: latest.release_number,
      contentRevision: latest.content_revision,
      galleryRevision: latest.gallery_revision,
      publishedAt: latest.created_at
    };
  }
  const source = await findReleaseSource(db, invitationId);
  if (!source) return null;
  const publishedTimes = [source.content_published_at, source.gallery_published_at]
    .filter((value): value is string => Boolean(value))
    .sort();
  return {
    content: source.content_published_json ? parseContent(source.content_published_json) : null,
    gallery: source.gallery_published_json ? parseGallery(source.gallery_published_json) : null,
    releaseNumber: null,
    contentRevision: source.content_published_revision,
    galleryRevision: source.gallery_published_revision,
    publishedAt: publishedTimes.at(-1) ?? null
  };
}

function validateSource(source: ReleaseSourceRow):
  | { ok: true; content: EditableInvitationContent; gallery: EditableInvitationGallery }
  | { ok: false; reason: "conflict" | "content_incomplete" | "gallery_incomplete"; issues?: string[] } {
  if (!source.content_json || !source.content_revision || !source.gallery_json || !source.gallery_revision) {
    return { ok: false, reason: "conflict" };
  }
  const content = parseContent(source.content_json);
  const contentIssues = editableInvitationContentPublishIssues(content);
  if (contentIssues.length > 0) return { ok: false, reason: "content_incomplete", issues: contentIssues };
  const gallery = parseGallery(source.gallery_json);
  const galleryIssues = editableInvitationGalleryPublishIssues(gallery);
  if (galleryIssues.length > 0) return { ok: false, reason: "gallery_incomplete", issues: galleryIssues };
  return { ok: true, content, gallery };
}

export async function getAdminInvitationRelease(
  db: D1Database,
  invitationId: string
): Promise<InvitationReleaseAdminResult | null> {
  const source = await findReleaseSource(db, invitationId);
  if (!source) return null;
  const [historyResult, schedule] = await Promise.all([
    db.prepare(`
      SELECT id, release_number, action, source_release_id, content_revision, gallery_revision, created_at
      FROM invitation_releases
      WHERE invitation_id = ?
      ORDER BY release_number DESC
      LIMIT 30
    `).bind(invitationId).all<ReleaseRow>(),
    db.prepare(`
      SELECT id, content_revision, gallery_revision, scheduled_for, created_at, updated_at
      FROM invitation_release_schedules
      WHERE invitation_id = ?
    `).bind(invitationId).first<ScheduleRow>()
  ]);
  const history = (historyResult.results ?? []).map(mapRelease);
  const contentIssues = source.content_json
    ? editableInvitationContentPublishIssues(parseContent(source.content_json))
    : ["draft_missing"];
  const galleryIssues = source.gallery_json
    ? editableInvitationGalleryPublishIssues(parseGallery(source.gallery_json))
    : ["draft_missing"];
  return {
    content: {
      draftRevision: source.content_revision ?? 0,
      publishedRevision: source.content_published_revision,
      updatedAt: source.content_updated_at,
      publishedAt: source.content_published_at,
      ready: contentIssues.length === 0,
      changed: source.content_revision !== source.content_published_revision,
      issues: contentIssues
    },
    gallery: {
      draftRevision: source.gallery_revision ?? 0,
      publishedRevision: source.gallery_published_revision,
      updatedAt: source.gallery_updated_at,
      publishedAt: source.gallery_published_at,
      ready: galleryIssues.length === 0,
      changed: source.gallery_revision !== source.gallery_published_revision,
      issues: galleryIssues
    },
    schedule: mapSchedule(schedule),
    latestRelease: history[0] ?? null,
    history
  };
}

function releaseInsert(
  db: D1Database,
  args: {
    id: string;
    invitationId: string;
    action: "publish";
    contentRevision: number;
    galleryRevision: number;
    now: string;
  }
) {
  return db.prepare(`
    INSERT INTO invitation_releases (
      id, invitation_id, release_number, action, source_release_id,
      content_json, content_revision, gallery_json, gallery_revision, created_at
    )
    SELECT ?, content.invitation_id,
      COALESCE((SELECT MAX(release_number) + 1 FROM invitation_releases WHERE invitation_id = ?), 1),
      ?, NULL, content.draft_json, content.draft_revision, gallery.draft_json, gallery.draft_revision, ?
    FROM invitation_content AS content
    JOIN invitation_gallery AS gallery ON gallery.invitation_id = content.invitation_id
    WHERE content.invitation_id = ?
      AND content.draft_revision = ?
      AND gallery.draft_revision = ?
  `).bind(
    args.id,
    args.invitationId,
    args.action,
    args.now,
    args.invitationId,
    args.contentRevision,
    args.galleryRevision
  );
}

function releaseFollowupStatements(
  db: D1Database,
  args: {
    releaseId: string;
    invitationId: string;
    now: string;
    contentHistoryId: string;
    galleryHistoryId: string;
    historyAction: "publish" | "restore";
  }
) {
  const { releaseId, invitationId, now, contentHistoryId, galleryHistoryId, historyAction } = args;
  return [
    db.prepare(`
      UPDATE invitation_content
      SET published_json = (SELECT content_json FROM invitation_releases WHERE id = ?),
          published_revision = (SELECT content_revision FROM invitation_releases WHERE id = ?),
          published_at = ?
      WHERE invitation_id = ? AND EXISTS (SELECT 1 FROM invitation_releases WHERE id = ?)
    `).bind(releaseId, releaseId, now, invitationId, releaseId),
    db.prepare(`
      UPDATE invitation_gallery
      SET published_json = (SELECT gallery_json FROM invitation_releases WHERE id = ?),
          published_revision = (SELECT gallery_revision FROM invitation_releases WHERE id = ?),
          published_at = ?
      WHERE invitation_id = ? AND EXISTS (SELECT 1 FROM invitation_releases WHERE id = ?)
    `).bind(releaseId, releaseId, now, invitationId, releaseId),
    db.prepare(`
      INSERT INTO invitation_content_versions (id, invitation_id, revision, action, content_json, created_at)
      SELECT ?, invitation_id, content_revision, ?, content_json, ?
      FROM invitation_releases WHERE id = ?
    `).bind(contentHistoryId, historyAction, now, releaseId),
    db.prepare(`
      INSERT INTO invitation_gallery_versions (id, invitation_id, revision, action, gallery_json, created_at)
      SELECT ?, invitation_id, gallery_revision, ?, gallery_json, ?
      FROM invitation_releases WHERE id = ?
    `).bind(galleryHistoryId, historyAction, now, releaseId),
    db.prepare(`
      DELETE FROM invitation_release_schedules
      WHERE invitation_id = ? AND EXISTS (SELECT 1 FROM invitation_releases WHERE id = ?)
    `).bind(invitationId, releaseId),
    db.prepare(`
      DELETE FROM invitation_content_versions
      WHERE invitation_id = ? AND id IN (
        SELECT id FROM invitation_content_versions WHERE invitation_id = ?
        ORDER BY created_at DESC, id DESC LIMIT -1 OFFSET 20
      )
    `).bind(invitationId, invitationId),
    db.prepare(`
      DELETE FROM invitation_gallery_versions
      WHERE invitation_id = ? AND id IN (
        SELECT id FROM invitation_gallery_versions WHERE invitation_id = ?
        ORDER BY created_at DESC, id DESC LIMIT -1 OFFSET 20
      )
    `).bind(invitationId, invitationId),
    db.prepare(`
      DELETE FROM invitation_releases
      WHERE invitation_id = ? AND id IN (
        SELECT id FROM invitation_releases WHERE invitation_id = ?
        ORDER BY release_number DESC LIMIT -1 OFFSET 30
      )
    `).bind(invitationId, invitationId)
  ];
}

export async function publishInvitationRelease(
  db: D1Database,
  args: {
    invitationId: string;
    expectedContentRevision: number;
    expectedGalleryRevision: number;
    releaseId: string;
    contentHistoryId: string;
    galleryHistoryId: string;
    now: string;
  }
): Promise<ReleaseWriteResult> {
  const source = await findReleaseSource(db, args.invitationId);
  if (!source) return { ok: false, reason: "not_found" };
  if (
    source.content_revision !== args.expectedContentRevision
    || source.gallery_revision !== args.expectedGalleryRevision
  ) return { ok: false, reason: "conflict" };
  const validation = validateSource(source);
  if (!validation.ok) return validation;

  const [insert] = await db.batch([
    releaseInsert(db, {
      id: args.releaseId,
      invitationId: args.invitationId,
      action: "publish",
      contentRevision: args.expectedContentRevision,
      galleryRevision: args.expectedGalleryRevision,
      now: args.now
    }),
    ...releaseFollowupStatements(db, {
      releaseId: args.releaseId,
      invitationId: args.invitationId,
      now: args.now,
      contentHistoryId: args.contentHistoryId,
      galleryHistoryId: args.galleryHistoryId,
      historyAction: "publish"
    })
  ]);
  if (insert.meta.changes === 0) return { ok: false, reason: "conflict" };
  const result = await getAdminInvitationRelease(db, args.invitationId);
  return result ? { ok: true, result } : { ok: false, reason: "not_found" };
}

export async function scheduleInvitationRelease(
  db: D1Database,
  args: {
    invitationId: string;
    expectedContentRevision: number;
    expectedGalleryRevision: number;
    scheduleId: string;
    scheduledFor: string;
    now: string;
  }
): Promise<ReleaseWriteResult> {
  const source = await findReleaseSource(db, args.invitationId);
  if (!source) return { ok: false, reason: "not_found" };
  if (
    source.content_revision !== args.expectedContentRevision
    || source.gallery_revision !== args.expectedGalleryRevision
  ) return { ok: false, reason: "conflict" };
  const validation = validateSource(source);
  if (!validation.ok) return validation;

  const saved = await db.prepare(`
    INSERT INTO invitation_release_schedules (
      invitation_id, id, content_json, content_revision, gallery_json, gallery_revision,
      scheduled_for, created_at, updated_at
    )
    SELECT content.invitation_id, ?, content.draft_json, content.draft_revision,
      gallery.draft_json, gallery.draft_revision, ?, ?, ?
    FROM invitation_content AS content
    JOIN invitation_gallery AS gallery ON gallery.invitation_id = content.invitation_id
    WHERE content.invitation_id = ?
      AND content.draft_revision = ?
      AND gallery.draft_revision = ?
    ON CONFLICT(invitation_id) DO UPDATE SET
      id = excluded.id,
      content_json = excluded.content_json,
      content_revision = excluded.content_revision,
      gallery_json = excluded.gallery_json,
      gallery_revision = excluded.gallery_revision,
      scheduled_for = excluded.scheduled_for,
      updated_at = excluded.updated_at
  `).bind(
    args.scheduleId,
    args.scheduledFor,
    args.now,
    args.now,
    args.invitationId,
    args.expectedContentRevision,
    args.expectedGalleryRevision
  ).run();
  if (saved.meta.changes === 0) return { ok: false, reason: "conflict" };
  const result = await getAdminInvitationRelease(db, args.invitationId);
  return result ? { ok: true, result } : { ok: false, reason: "not_found" };
}

export async function cancelInvitationReleaseSchedule(
  db: D1Database,
  invitationId: string
): Promise<ReleaseWriteResult> {
  const source = await findReleaseSource(db, invitationId);
  if (!source) return { ok: false, reason: "not_found" };
  await db.prepare("DELETE FROM invitation_release_schedules WHERE invitation_id = ?")
    .bind(invitationId).run();
  const result = await getAdminInvitationRelease(db, invitationId);
  return result ? { ok: true, result } : { ok: false, reason: "not_found" };
}

export async function restoreInvitationRelease(
  db: D1Database,
  args: {
    invitationId: string;
    sourceReleaseId: string;
    releaseId: string;
    contentHistoryId: string;
    galleryHistoryId: string;
    now: string;
  }
): Promise<ReleaseWriteResult> {
  const sourceRelease = await db.prepare(`
    SELECT id FROM invitation_releases WHERE invitation_id = ? AND id = ?
  `).bind(args.invitationId, args.sourceReleaseId).first<{ id: string }>();
  if (!sourceRelease) {
    return await findReleaseSource(db, args.invitationId)
      ? { ok: false, reason: "conflict" }
      : { ok: false, reason: "not_found" };
  }

  const insert = db.prepare(`
    INSERT INTO invitation_releases (
      id, invitation_id, release_number, action, source_release_id,
      content_json, content_revision, gallery_json, gallery_revision, created_at
    )
    SELECT ?, invitation_id,
      COALESCE((SELECT MAX(release_number) + 1 FROM invitation_releases WHERE invitation_id = ?), 1),
      'restore', id, content_json, content_revision, gallery_json, gallery_revision, ?
    FROM invitation_releases
    WHERE invitation_id = ? AND id = ?
  `).bind(args.releaseId, args.invitationId, args.now, args.invitationId, args.sourceReleaseId);
  const [insertResult] = await db.batch([
    insert,
    ...releaseFollowupStatements(db, {
      releaseId: args.releaseId,
      invitationId: args.invitationId,
      now: args.now,
      contentHistoryId: args.contentHistoryId,
      galleryHistoryId: args.galleryHistoryId,
      historyAction: "restore"
    })
  ]);
  if (insertResult.meta.changes === 0) return { ok: false, reason: "conflict" };
  const result = await getAdminInvitationRelease(db, args.invitationId);
  return result ? { ok: true, result } : { ok: false, reason: "not_found" };
}

async function publishScheduledRelease(
  db: D1Database,
  schedule: DueScheduleRow,
  now: string
): Promise<boolean> {
  const releaseId = `release_${crypto.randomUUID()}`;
  const insert = db.prepare(`
    INSERT INTO invitation_releases (
      id, invitation_id, release_number, action, source_release_id,
      content_json, content_revision, gallery_json, gallery_revision, created_at
    )
    SELECT ?, invitation_id,
      COALESCE((SELECT MAX(release_number) + 1 FROM invitation_releases WHERE invitation_id = ?), 1),
      'scheduled', NULL, content_json, content_revision, gallery_json, gallery_revision, ?
    FROM invitation_release_schedules
    WHERE invitation_id = ? AND id = ? AND scheduled_for <= ?
  `).bind(releaseId, schedule.invitation_id, now, schedule.invitation_id, schedule.id, now);
  const [insertResult] = await db.batch([
    insert,
    ...releaseFollowupStatements(db, {
      releaseId,
      invitationId: schedule.invitation_id,
      now,
      contentHistoryId: `content_${crypto.randomUUID()}`,
      galleryHistoryId: `gallery_${crypto.randomUUID()}`,
      historyAction: "publish"
    })
  ]);
  return insertResult.meta.changes > 0;
}

export async function publishDueInvitationReleases(
  db: D1Database,
  now: Date,
  limit = 25
): Promise<{ attempted: number; published: number; failed: number }> {
  const due = await db.prepare(`
    SELECT invitation_id, id, content_revision, gallery_revision, scheduled_for, created_at, updated_at
    FROM invitation_release_schedules
    WHERE scheduled_for <= ?
    ORDER BY scheduled_for ASC
    LIMIT ?
  `).bind(now.toISOString(), limit).all<DueScheduleRow>();
  let published = 0;
  let failed = 0;
  for (const schedule of due.results ?? []) {
    try {
      if (await publishScheduledRelease(db, schedule, now.toISOString())) published += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  return { attempted: due.results?.length ?? 0, published, failed };
}
