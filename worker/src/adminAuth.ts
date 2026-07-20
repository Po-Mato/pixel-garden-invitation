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
  | { ok: false; reason: "invalid_credentials" }
  | { ok: false; reason: "rate_limited"; retryAfterSeconds: number };

export async function attemptAdminLogin(db: D1Database, input: AdminLoginInput): Promise<AdminLoginResult> {
  const clientHash = await hashClientKey(input.clientKey, input.clientKeySecret);
  const now = new Date(input.now).toISOString();
  const cutoff = new Date(input.now - LOGIN_WINDOW_MS).toISOString();
  const reservation = await db
    .prepare(`
      INSERT INTO admin_login_attempts (
        invitation_id, client_hash, window_started_at, attempts
      ) VALUES (?, ?, ?, 1)
      ON CONFLICT(invitation_id, client_hash) DO UPDATE SET
        attempts = CASE
          WHEN window_started_at <= ? THEN 1
          ELSE attempts + 1
        END,
        window_started_at = CASE
          WHEN window_started_at <= ? THEN excluded.window_started_at
          ELSE window_started_at
        END
      RETURNING attempts, window_started_at
    `)
    .bind(input.invitationId, clientHash, now, cutoff, cutoff)
    .first<{ attempts: number; window_started_at: string }>();

  if (!reservation) throw new Error("D1 did not reserve the admin login attempt");
  if (reservation.attempts > MAX_LOGIN_FAILURES) {
    const windowStartedAt = Date.parse(reservation.window_started_at);
    if (!Number.isFinite(windowStartedAt)) throw new Error("D1 returned an invalid admin login window");
    return {
      ok: false,
      reason: "rate_limited",
      retryAfterSeconds: Math.max(1, Math.ceil((windowStartedAt + LOGIN_WINDOW_MS - input.now) / 1_000))
    };
  }
  if (!(await verifyPassword(input.password, input.passwordHash))) {
    return { ok: false, reason: "invalid_credentials" };
  }

  const expiresAt = input.now + SESSION_TTL_MS;
  const token = await issueAdminToken({ invitationId: input.invitationId, expiresAt }, input.sessionSecret);
  await db
    .prepare("DELETE FROM admin_login_attempts WHERE invitation_id = ? AND client_hash = ?")
    .bind(input.invitationId, clientHash)
    .run();
  return { ok: true, token, expiresAt };
}
