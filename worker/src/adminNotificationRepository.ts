import type {
  AdminNotification,
  AdminNotificationKind,
  AdminNotificationResult
} from "@wedding-game/shared";

type NotificationRow = {
  id: string;
  kind: AdminNotificationKind;
  source_id: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export type CreateAdminNotificationArgs = {
  id: string;
  invitationId: string;
  kind: AdminNotificationKind;
  sourceId: string;
  title: string;
  body: string;
  createdAt: string;
  expiresAt: string;
};

const notificationColumns = `
  id, kind, source_id, title, body, created_at, read_at
`;

function toNotification(row: NotificationRow): AdminNotification {
  return {
    id: row.id,
    kind: row.kind,
    sourceId: row.source_id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at
  };
}

export async function createAdminNotification(
  db: D1Database,
  args: CreateAdminNotificationArgs
): Promise<AdminNotification> {
  const row = await db.prepare(`
    INSERT INTO admin_notifications (
      id, invitation_id, kind, source_id, title, body, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING ${notificationColumns}
  `).bind(
    args.id,
    args.invitationId,
    args.kind,
    args.sourceId,
    args.title,
    args.body,
    args.createdAt,
    args.expiresAt
  ).first<NotificationRow>();

  if (!row) throw new Error("D1 did not return the created admin notification");
  return toNotification(row);
}

export async function listAdminNotifications(
  db: D1Database,
  invitationId: string,
  emailConfigured: boolean
): Promise<AdminNotificationResult> {
  const [rows, unread] = await Promise.all([
    db.prepare(`
      SELECT ${notificationColumns}
      FROM admin_notifications
      WHERE invitation_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 30
    `).bind(invitationId).all<NotificationRow>(),
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM admin_notifications
      WHERE invitation_id = ? AND read_at IS NULL
    `).bind(invitationId).first<{ count: number }>()
  ]);

  return {
    notifications: (rows.results ?? []).map(toNotification),
    unreadCount: Number(unread?.count ?? 0),
    emailConfigured
  };
}

export async function markAdminNotificationsRead(
  db: D1Database,
  invitationId: string,
  notificationIds: string[] | null,
  readAt: string
): Promise<number> {
  const result = notificationIds === null
    ? await db.prepare(`
      UPDATE admin_notifications
      SET read_at = ?
      WHERE invitation_id = ? AND read_at IS NULL
    `).bind(readAt, invitationId).run()
    : notificationIds.length === 0
      ? null
      : await db.prepare(`
        UPDATE admin_notifications
        SET read_at = ?
        WHERE invitation_id = ?
          AND read_at IS NULL
          AND id IN (${notificationIds.map(() => "?").join(", ")})
      `).bind(readAt, invitationId, ...notificationIds).run();

  return Number(result?.meta?.changes ?? 0);
}

export async function recordAdminNotificationEmailResult(
  db: D1Database,
  notificationId: string,
  sentAt: string | null,
  error: string | null
): Promise<void> {
  await db.prepare(`
    UPDATE admin_notifications
    SET emailed_at = ?, email_error = ?
    WHERE id = ?
  `).bind(sentAt, error, notificationId).run();
}
