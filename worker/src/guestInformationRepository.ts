import type {
  GuestAnnouncementInput,
  GuestAnnouncementRecord,
  GuestFaqInput,
  GuestFaqRecord,
  GuestInformationAdminResult,
  GuestInformationPublicResult
} from "@wedding-game/shared";

type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  tone: GuestAnnouncementRecord["tone"];
  active: number;
  pinned: number;
  starts_at: string | null;
  ends_at: string | null;
  action_kind: GuestAnnouncementRecord["actionKind"];
  action_label: string;
  action_url: string | null;
  sort_order: number;
  view_count: number;
  created_at: string;
  updated_at: string;
};

type FaqRow = {
  id: string;
  category: string;
  question: string;
  answer: string;
  active: number;
  featured: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function announcement(row: AnnouncementRow): GuestAnnouncementRecord {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    tone: row.tone,
    active: row.active === 1,
    pinned: row.pinned === 1,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    actionKind: row.action_kind,
    actionLabel: row.action_label,
    actionUrl: row.action_url,
    sortOrder: row.sort_order,
    viewCount: row.view_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function faq(row: FaqRow): GuestFaqRecord {
  return {
    id: row.id,
    category: row.category,
    question: row.question,
    answer: row.answer,
    active: row.active === 1,
    featured: row.featured === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function invitationExists(db: D1Database, invitationId: string): Promise<boolean> {
  return Boolean(await db.prepare("SELECT id FROM invitations WHERE id = ?")
    .bind(invitationId)
    .first<{ id: string }>());
}

function currentlyVisible(item: GuestAnnouncementRecord, now: Date): boolean {
  const time = now.getTime();
  return item.active
    && (!item.startsAt || Date.parse(item.startsAt) <= time)
    && (!item.endsAt || Date.parse(item.endsAt) > time);
}

const announcementColumns = `
  id, title, body, tone, active, pinned, starts_at, ends_at, action_kind,
  action_label, action_url, sort_order, view_count, created_at, updated_at
`;

const faqColumns = `
  id, category, question, answer, active, featured, sort_order, created_at, updated_at
`;

export async function getGuestInformationAdmin(
  db: D1Database,
  invitationId: string,
  now = new Date()
): Promise<GuestInformationAdminResult | null> {
  if (!(await invitationExists(db, invitationId))) return null;
  const [announcementRows, faqRows] = await Promise.all([
    db.prepare(`
      SELECT ${announcementColumns}
      FROM invitation_announcements
      WHERE invitation_id = ?
      ORDER BY pinned DESC,
        CASE tone WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END,
        sort_order ASC, created_at DESC
    `).bind(invitationId).all<AnnouncementRow>(),
    db.prepare(`
      SELECT ${faqColumns}
      FROM invitation_faqs
      WHERE invitation_id = ?
      ORDER BY featured DESC, category ASC, sort_order ASC, created_at ASC
    `).bind(invitationId).all<FaqRow>()
  ]);
  const announcements = announcementRows.results.map(announcement);
  const faqs = faqRows.results.map(faq);
  const activeAnnouncements = announcements.filter((item) => currentlyVisible(item, now));
  return {
    summary: {
      totalAnnouncements: announcements.length,
      activeAnnouncements: activeAnnouncements.length,
      urgentAnnouncements: activeAnnouncements.filter(({ tone }) => tone === "urgent").length,
      totalFaqs: faqs.length,
      activeFaqs: faqs.filter(({ active }) => active).length,
      announcementViews: announcements.reduce((total, item) => total + item.viewCount, 0)
    },
    announcements,
    faqs,
    generatedAt: now.toISOString()
  };
}

export async function getPublishedGuestInformation(
  db: D1Database,
  invitationId: string,
  now = new Date()
): Promise<GuestInformationPublicResult | null> {
  if (!(await invitationExists(db, invitationId))) return null;
  const timestamp = now.toISOString();
  const [announcementRows, faqRows] = await Promise.all([
    db.prepare(`
      SELECT ${announcementColumns}
      FROM invitation_announcements
      WHERE invitation_id = ? AND active = 1
        AND (starts_at IS NULL OR starts_at <= ?)
        AND (ends_at IS NULL OR ends_at > ?)
      ORDER BY pinned DESC,
        CASE tone WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END,
        sort_order ASC, created_at DESC
    `).bind(invitationId, timestamp, timestamp).all<AnnouncementRow>(),
    db.prepare(`
      SELECT ${faqColumns}
      FROM invitation_faqs
      WHERE invitation_id = ? AND active = 1
      ORDER BY featured DESC, category ASC, sort_order ASC, created_at ASC
    `).bind(invitationId).all<FaqRow>()
  ]);
  return {
    announcements: announcementRows.results.map(announcement),
    faqs: faqRows.results.map(faq),
    generatedAt: timestamp
  };
}

export async function createGuestAnnouncement(
  db: D1Database,
  invitationId: string,
  input: GuestAnnouncementInput,
  now = new Date()
): Promise<GuestAnnouncementRecord | null> {
  if (!(await invitationExists(db, invitationId))) return null;
  const id = `notice_${crypto.randomUUID()}`;
  const timestamp = now.toISOString();
  const row = await db.prepare(`
    INSERT INTO invitation_announcements (
      id, invitation_id, title, body, tone, active, pinned, starts_at, ends_at,
      action_kind, action_label, action_url, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING ${announcementColumns}
  `).bind(
    id, invitationId, input.title, input.body, input.tone, Number(input.active), Number(input.pinned),
    input.startsAt, input.endsAt, input.actionKind, input.actionLabel, input.actionUrl,
    input.sortOrder, timestamp, timestamp
  ).first<AnnouncementRow>();
  return row ? announcement(row) : null;
}

export async function updateGuestAnnouncement(
  db: D1Database,
  invitationId: string,
  itemId: string,
  input: GuestAnnouncementInput,
  now = new Date()
): Promise<GuestAnnouncementRecord | null> {
  const row = await db.prepare(`
    UPDATE invitation_announcements SET
      title = ?, body = ?, tone = ?, active = ?, pinned = ?, starts_at = ?, ends_at = ?,
      action_kind = ?, action_label = ?, action_url = ?, sort_order = ?, updated_at = ?
    WHERE invitation_id = ? AND id = ?
    RETURNING ${announcementColumns}
  `).bind(
    input.title, input.body, input.tone, Number(input.active), Number(input.pinned),
    input.startsAt, input.endsAt, input.actionKind, input.actionLabel, input.actionUrl,
    input.sortOrder, now.toISOString(), invitationId, itemId
  ).first<AnnouncementRow>();
  return row ? announcement(row) : null;
}

export async function createGuestFaq(
  db: D1Database,
  invitationId: string,
  input: GuestFaqInput,
  now = new Date()
): Promise<GuestFaqRecord | null> {
  if (!(await invitationExists(db, invitationId))) return null;
  const id = `faq_${crypto.randomUUID()}`;
  const timestamp = now.toISOString();
  const row = await db.prepare(`
    INSERT INTO invitation_faqs (
      id, invitation_id, category, question, answer, active, featured, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING ${faqColumns}
  `).bind(
    id, invitationId, input.category, input.question, input.answer, Number(input.active),
    Number(input.featured), input.sortOrder, timestamp, timestamp
  ).first<FaqRow>();
  return row ? faq(row) : null;
}

export async function updateGuestFaq(
  db: D1Database,
  invitationId: string,
  itemId: string,
  input: GuestFaqInput,
  now = new Date()
): Promise<GuestFaqRecord | null> {
  const row = await db.prepare(`
    UPDATE invitation_faqs SET
      category = ?, question = ?, answer = ?, active = ?, featured = ?, sort_order = ?, updated_at = ?
    WHERE invitation_id = ? AND id = ?
    RETURNING ${faqColumns}
  `).bind(
    input.category, input.question, input.answer, Number(input.active), Number(input.featured),
    input.sortOrder, now.toISOString(), invitationId, itemId
  ).first<FaqRow>();
  return row ? faq(row) : null;
}

export async function deleteGuestInformationItem(
  db: D1Database,
  invitationId: string,
  kind: "announcements" | "faqs",
  itemId: string
): Promise<boolean> {
  const table = kind === "announcements" ? "invitation_announcements" : "invitation_faqs";
  const result = await db.prepare(`DELETE FROM ${table} WHERE invitation_id = ? AND id = ?`)
    .bind(invitationId, itemId)
    .run();
  return Number(result.meta.changes ?? 0) > 0;
}

export async function recordGuestAnnouncementViews(
  db: D1Database,
  invitationId: string,
  announcementIds: readonly string[]
): Promise<void> {
  await db.batch(announcementIds.map((itemId) => db.prepare(`
    UPDATE invitation_announcements
    SET view_count = view_count + 1
    WHERE invitation_id = ? AND id = ? AND active = 1
  `).bind(invitationId, itemId)));
}
