import {
  parsePhotoFrameGalleryDesign,
  type PhotoFrameGalleryAdminResult,
  type PhotoFrameGalleryDesign,
  type PhotoFrameGalleryItem,
  type PhotoFrameGalleryStatus,
  type PhotoFrameGallerySubmissionInput
} from "@wedding-game/shared";

type Row = {
  id: string;
  contributor_name: string;
  design_json: string;
  status: PhotoFrameGalleryStatus;
  created_at: string;
  reviewed_at: string | null;
};

function item(row: Row): PhotoFrameGalleryItem {
  const design = parsePhotoFrameGalleryDesign(JSON.parse(row.design_json) as unknown);
  if (!design) throw new Error("Stored photo frame design is invalid");
  return {
    id: row.id,
    contributorName: row.contributor_name,
    design,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at
  };
}

const columns = "id, contributor_name, design_json, status, created_at, reviewed_at";

export async function createPhotoFrameGallerySubmission(
  db: D1Database,
  input: PhotoFrameGallerySubmissionInput & { invitationId: string; clientHash: string },
  now = new Date()
): Promise<PhotoFrameGalleryItem | "not_found" | "rate_limited"> {
  const invitation = await db.prepare("SELECT id FROM invitations WHERE id = ?").bind(input.invitationId).first();
  if (!invitation) return "not_found";
  const createdAt = now.toISOString();
  const recent = await db.prepare(`
    SELECT COUNT(*) AS count FROM photo_frame_gallery_submissions
    WHERE invitation_id = ? AND client_hash = ? AND created_at >= ?
  `).bind(input.invitationId, input.clientHash, new Date(now.getTime() - 24 * 60 * 60_000).toISOString()).first<{ count: number }>();
  if (Number(recent?.count ?? 0) >= 5) return "rate_limited";
  const id = `frame_${crypto.randomUUID()}`;
  const row = await db.prepare(`
    INSERT INTO photo_frame_gallery_submissions (
      id, invitation_id, client_hash, contributor_name, design_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    RETURNING ${columns}
  `).bind(
    id,
    input.invitationId,
    input.clientHash,
    input.contributorName,
    JSON.stringify(input.design),
    createdAt,
    createdAt
  ).first<Row>();
  if (!row) return "not_found";
  return item(row);
}

export async function listApprovedPhotoFrameGallery(
  db: D1Database,
  invitationId: string,
  limit = 24
): Promise<PhotoFrameGalleryItem[] | null> {
  const invitation = await db.prepare("SELECT id FROM invitations WHERE id = ?").bind(invitationId).first();
  if (!invitation) return null;
  const rows = await db.prepare(`
    SELECT ${columns} FROM photo_frame_gallery_submissions
    WHERE invitation_id = ? AND status = 'approved'
    ORDER BY reviewed_at DESC, created_at DESC LIMIT ?
  `).bind(invitationId, limit).all<Row>();
  return (rows.results ?? []).map(item);
}

export async function listAdminPhotoFrameGallery(
  db: D1Database,
  invitationId: string,
  limit = 100,
  now = new Date()
): Promise<PhotoFrameGalleryAdminResult | null> {
  const invitation = await db.prepare("SELECT id FROM invitations WHERE id = ?").bind(invitationId).first();
  if (!invitation) return null;
  const rows = await db.prepare(`
    SELECT ${columns} FROM photo_frame_gallery_submissions
    WHERE invitation_id = ?
    ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, created_at DESC
    LIMIT ?
  `).bind(invitationId, limit).all<Row>();
  const items = (rows.results ?? []).map(item);
  return {
    items,
    generatedAt: now.toISOString(),
    counts: {
      pending: items.filter(({ status }) => status === "pending").length,
      approved: items.filter(({ status }) => status === "approved").length,
      rejected: items.filter(({ status }) => status === "rejected").length
    }
  };
}

export async function moderatePhotoFrameGallerySubmission(
  db: D1Database,
  input: { invitationId: string; submissionId: string; status: Exclude<PhotoFrameGalleryStatus, "pending"> },
  now = new Date()
): Promise<PhotoFrameGalleryItem | null> {
  const reviewedAt = now.toISOString();
  const row = await db.prepare(`
    UPDATE photo_frame_gallery_submissions
    SET status = ?, reviewed_at = ?, updated_at = ?
    WHERE invitation_id = ? AND id = ?
    RETURNING ${columns}
  `).bind(input.status, reviewedAt, reviewedAt, input.invitationId, input.submissionId).first<Row>();
  return row ? item(row) : null;
}

export function photoFrameGalleryDesignJson(design: PhotoFrameGalleryDesign): string {
  return JSON.stringify(design);
}
