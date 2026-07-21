export type CleanupResult = {
  rsvps: number;
  guestbookMessages: number;
  notifications: number;
  attempts: number;
};

function changes(result: D1Result): number {
  return Number(result.meta?.changes ?? 0);
}

export async function cleanupExpiredInvitationData(db: D1Database, now: Date): Promise<CleanupResult> {
  const nowIso = now.toISOString();
  const attemptCutoff = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

  const rsvpResult = await db.prepare(`
    DELETE FROM rsvps
    WHERE invitation_id IN (
      SELECT id FROM invitations
      WHERE rsvp_delete_at IS NOT NULL AND rsvp_delete_at <= ?
    )
  `).bind(nowIso).run();

  const guestbookResult = await db.prepare(`
    DELETE FROM guestbook_messages
    WHERE invitation_id IN (
      SELECT id FROM invitations
      WHERE guestbook_delete_at IS NOT NULL AND guestbook_delete_at <= ?
    )
  `).bind(nowIso).run();

  const notificationResult = await db.prepare(`
    DELETE FROM admin_notifications
    WHERE expires_at <= ?
  `).bind(nowIso).run();

  const attemptResult = await db.prepare(`
    DELETE FROM admin_login_attempts
    WHERE window_started_at < ?
  `).bind(attemptCutoff).run();

  return {
    rsvps: changes(rsvpResult),
    guestbookMessages: changes(guestbookResult),
    notifications: changes(notificationResult),
    attempts: changes(attemptResult)
  };
}
