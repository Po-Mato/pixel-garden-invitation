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
  email_attempts: number;
  emailed_at: string | null;
  email_error: string | null;
};

export type CreateAdminNotificationArgs = {
  id: string;
  invitationId: string;
  eventKey: string;
  kind: AdminNotificationKind;
  sourceId: string;
  title: string;
  body: string;
  createdAt: string;
  expiresAt: string;
};

const notificationColumns = `
  id, kind, source_id, title, body, created_at, read_at,
  email_attempts, emailed_at, email_error
`;

export const MAX_ADMIN_NOTIFICATION_EMAIL_ATTEMPTS = 5;

function toNotification(row: NotificationRow): AdminNotification {
  const emailStatus = row.emailed_at
    ? "sent"
    : row.email_attempts >= MAX_ADMIN_NOTIFICATION_EMAIL_ATTEMPTS
      ? "failed"
      : row.email_attempts > 0 && row.email_error ? "retrying" : "pending";
  return {
    id: row.id,
    kind: row.kind,
    sourceId: row.source_id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
    emailStatus,
    emailAttempts: row.email_attempts,
    emailSentAt: row.emailed_at
  };
}

export async function createAdminNotification(
  db: D1Database,
  args: CreateAdminNotificationArgs
): Promise<AdminNotification | null> {
  const row = await db.prepare(`
    INSERT INTO admin_notifications (
      id, invitation_id, event_key, kind, source_id, title, body, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(invitation_id, event_key) DO NOTHING
    RETURNING ${notificationColumns}
  `).bind(
    args.id,
    args.invitationId,
    args.eventKey,
    args.kind,
    args.sourceId,
    args.title,
    args.body,
    args.createdAt,
    args.expiresAt
  ).first<NotificationRow>();

  return row ? toNotification(row) : null;
}

export async function listAdminNotifications(
  db: D1Database,
  invitationId: string,
  emailConfigured: boolean
): Promise<AdminNotificationResult> {
  const [rows, unread, emailSummary] = await Promise.all([
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
    `).bind(invitationId).first<{ count: number }>(),
    db.prepare(`
      SELECT
        SUM(CASE WHEN emailed_at IS NULL AND email_attempts < ? THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN emailed_at IS NULL AND email_attempts >= ? THEN 1 ELSE 0 END) AS failed_count,
        MAX(emailed_at) AS last_sent_at
      FROM admin_notifications
      WHERE invitation_id = ?
    `).bind(
      MAX_ADMIN_NOTIFICATION_EMAIL_ATTEMPTS,
      MAX_ADMIN_NOTIFICATION_EMAIL_ATTEMPTS,
      invitationId
    ).first<{ pending_count: number | null; failed_count: number | null; last_sent_at: string | null }>()
  ]);

  return {
    notifications: (rows.results ?? []).map(toNotification),
    unreadCount: Number(unread?.count ?? 0),
    emailConfigured,
    emailPendingCount: Number(emailSummary?.pending_count ?? 0),
    emailFailedCount: Number(emailSummary?.failed_count ?? 0),
    lastEmailSentAt: emailSummary?.last_sent_at ?? null
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

export async function listPendingAdminNotificationEmailIds(
  db: D1Database,
  now: string,
  limit = 20
): Promise<string[]> {
  const rows = await db.prepare(`
    SELECT id
    FROM admin_notifications
    WHERE emailed_at IS NULL
      AND email_attempts < ?
      AND expires_at > ?
      AND (email_next_attempt_at IS NULL OR email_next_attempt_at <= ?)
    ORDER BY created_at ASC, id ASC
    LIMIT ?
  `).bind(MAX_ADMIN_NOTIFICATION_EMAIL_ATTEMPTS, now, now, limit).all<{ id: string }>();
  return (rows.results ?? []).map(({ id }) => id);
}

export async function claimAdminNotificationEmail(
  db: D1Database,
  notificationId: string,
  attemptedAt: string,
  leaseUntil: string
): Promise<AdminNotification | null> {
  const row = await db.prepare(`
    UPDATE admin_notifications
    SET email_attempts = email_attempts + 1,
        email_last_attempt_at = ?,
        email_next_attempt_at = ?,
        email_error = NULL
    WHERE id = ?
      AND emailed_at IS NULL
      AND email_attempts < ?
      AND (email_next_attempt_at IS NULL OR email_next_attempt_at <= ?)
    RETURNING ${notificationColumns}
  `).bind(
    attemptedAt,
    leaseUntil,
    notificationId,
    MAX_ADMIN_NOTIFICATION_EMAIL_ATTEMPTS,
    attemptedAt
  ).first<NotificationRow>();
  return row ? toNotification(row) : null;
}

export async function recordAdminNotificationEmailSuccess(
  db: D1Database,
  notificationId: string,
  sentAt: string
): Promise<void> {
  await db.prepare(`
    UPDATE admin_notifications
    SET emailed_at = ?, email_error = NULL, email_next_attempt_at = NULL
    WHERE id = ?
  `).bind(sentAt, notificationId).run();
}

export async function recordAdminNotificationEmailFailure(
  db: D1Database,
  notificationId: string,
  error: string,
  nextAttemptAt: string | null,
  terminal: boolean
): Promise<void> {
  await db.prepare(`
    UPDATE admin_notifications
    SET email_error = ?,
        email_next_attempt_at = ?,
        email_attempts = CASE WHEN ? THEN ? ELSE email_attempts END
    WHERE id = ? AND emailed_at IS NULL
  `).bind(
    error,
    nextAttemptAt,
    terminal ? 1 : 0,
    MAX_ADMIN_NOTIFICATION_EMAIL_ATTEMPTS,
    notificationId
  ).run();
}

export async function resetFailedAdminNotificationEmails(
  db: D1Database,
  invitationId: string
): Promise<number> {
  const result = await db.prepare(`
    UPDATE admin_notifications
    SET email_attempts = 0,
        email_last_attempt_at = NULL,
        email_next_attempt_at = NULL,
        email_error = NULL
    WHERE invitation_id = ?
      AND emailed_at IS NULL
      AND email_attempts >= ?
  `).bind(invitationId, MAX_ADMIN_NOTIFICATION_EMAIL_ATTEMPTS).run();
  return Number(result.meta?.changes ?? 0);
}
