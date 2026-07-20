import { hashClientKey, issueAdminToken, verifyPassword } from "./security";

const LOGIN_WINDOW_MS = 10 * 60 * 1_000;
const MAX_LOGIN_FAILURES = 5;
const SESSION_TTL_MS = 60 * 60 * 1_000;

export type AdminLoginInput = {
  invitationId: string;
  clientKey: string;
  password: string;
  passwordHash: string;
  sessionSecret: string;
  clientKeySecret: string;
  now: number;
};

export type AdminLoginResult =
  | { ok: true; token: string; expiresAt: number }
  | { ok: false; reason: "invalid_credentials" | "rate_limited" };

type AttemptRow = {
  window_started_at: string;
  attempts: number;
};

export async function attemptAdminLogin(db: D1Database, input: AdminLoginInput): Promise<AdminLoginResult> {
  const clientHash = await hashClientKey(input.clientKey, input.clientKeySecret);
  const now = new Date(input.now).toISOString();
  const cutoff = new Date(input.now - LOGIN_WINDOW_MS).toISOString();
  const existing = await db
    .prepare(`
      SELECT window_started_at, attempts
      FROM admin_login_attempts
      WHERE invitation_id = ? AND client_hash = ?
    `)
    .bind(input.invitationId, clientHash)
    .first<AttemptRow>();

  if (existing && existing.window_started_at >= cutoff && existing.attempts >= MAX_LOGIN_FAILURES) {
    return { ok: false, reason: "rate_limited" };
  }

  if (await verifyPassword(input.password, input.passwordHash)) {
    const expiresAt = input.now + SESSION_TTL_MS;
    const token = await issueAdminToken({ invitationId: input.invitationId, expiresAt }, input.sessionSecret);
    await db
      .prepare("DELETE FROM admin_login_attempts WHERE invitation_id = ? AND client_hash = ?")
      .bind(input.invitationId, clientHash)
      .run();
    return { ok: true, token, expiresAt };
  }

  const recorded = await db
    .prepare(`
      INSERT INTO admin_login_attempts (
        invitation_id, client_hash, window_started_at, attempts
      ) VALUES (?, ?, ?, 1)
      ON CONFLICT(invitation_id, client_hash) DO UPDATE SET
        attempts = CASE
          WHEN window_started_at < ? THEN 1
          ELSE attempts + 1
        END,
        window_started_at = CASE
          WHEN window_started_at < ? THEN excluded.window_started_at
          ELSE window_started_at
        END
      RETURNING attempts
    `)
    .bind(input.invitationId, clientHash, now, cutoff, cutoff)
    .first<{ attempts: number }>();

  if (!recorded) throw new Error("D1 did not record the admin login attempt");
  return recorded.attempts > MAX_LOGIN_FAILURES
    ? { ok: false, reason: "rate_limited" }
    : { ok: false, reason: "invalid_credentials" };
}
