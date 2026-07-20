import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

import { attemptAdminLogin, type AdminLoginInput } from "./adminAuth";
import * as security from "./security";

const passwordHash = "pbkdf2-sha256$100000$MTIzNDU2Nzg5MDEyMzQ1Ng$YEAsDXNqEF4BcOvVtfmXmFhoK-UtjKo4y180j0n9IgU";

type SqliteStatement = {
  get(...parameters: unknown[]): unknown;
  run(...parameters: unknown[]): { changes: number | bigint };
};

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
};

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => SqliteDatabase;
};

type AttemptRow = { window_started_at: string; attempts: number };

function createDb() {
  const attempts = new Map<string, AttemptRow>();
  const reservedAttempts: number[] = [];
  const bindCalls: Array<{ sql: string; values: unknown[] }> = [];
  const prepare = vi.fn((sql: string) => ({
    bind: (...values: unknown[]) => {
      bindCalls.push({ sql, values });
      const key = `${String(values[0])}:${String(values[1])}`;

      return {
        first: async () => {
          if (/SELECT window_started_at, attempts/i.test(sql)) return attempts.get(key) ?? null;
          if (/INSERT INTO admin_login_attempts/i.test(sql)) {
            const now = String(values[2]);
            const cutoff = String(values[3]);
            const existing = attempts.get(key);
            const next = !existing || existing.window_started_at <= cutoff
              ? { window_started_at: now, attempts: 1 }
              : { ...existing, attempts: existing.attempts + 1 };
            attempts.set(key, next);
            reservedAttempts.push(next.attempts);
            return { attempts: next.attempts, window_started_at: next.window_started_at };
          }
          return null;
        },
        run: async () => {
          if (/DELETE FROM admin_login_attempts/i.test(sql)) attempts.delete(key);
          return { success: true };
        }
      };
    }
  }));

  return { db: { prepare } as unknown as D1Database, attempts, bindCalls, reservedAttempts };
}

function createD1Adapter(database: SqliteDatabase): D1Database {
  return {
    prepare(sql: string) {
      const statement = database.prepare(sql);
      return {
        bind(...values: unknown[]) {
          return {
            first: async <T>() => (statement.get(...values) ?? null) as T | null,
            run: async () => {
              const result = statement.run(...values);
              return { success: true, meta: { changes: Number(result.changes) } };
            }
          } as unknown as D1PreparedStatement;
        }
      } as D1PreparedStatement;
    }
  } as D1Database;
}

function loginInput(overrides: Partial<AdminLoginInput> = {}): AdminLoginInput {
  return {
    invitationId: "sample-garden",
    clientKey: "203.0.113.10",
    password: "correct horse battery staple",
    passwordHash,
    sessionSecret: "session-secret",
    clientKeySecret: "client-key-secret",
    now: Date.parse("2026-07-20T10:00:00.000Z"),
    ...overrides
  };
}

describe("attemptAdminLogin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects a wrong password and stores only the HMAC client hash", async () => {
    const { db, attempts, bindCalls } = createDb();
    const input = loginInput({ password: "wrong password" });

    await expect(attemptAdminLogin(db, input)).resolves.toEqual({ ok: false, reason: "invalid_credentials" });

    const clientHash = await security.hashClientKey(input.clientKey, input.clientKeySecret);
    expect(attempts.get(`sample-garden:${clientHash}`)).toEqual({
      window_started_at: "2026-07-20T10:00:00.000Z",
      attempts: 1
    });
    const attemptValues = bindCalls
      .filter(({ sql }) => /admin_login_attempts/i.test(sql))
      .flatMap(({ values }) => values);
    expect(attemptValues).toContain(clientHash);
    expect(attemptValues).not.toContain(input.clientKey);
    expect(attemptValues).not.toContain(input.password);
  });

  it("issues a one-hour invitation-scoped token for the correct password", async () => {
    const { db } = createDb();
    const input = loginInput();

    const result = await attemptAdminLogin(db, input);

    expect(result).toMatchObject({ ok: true, expiresAt: input.now + 60 * 60 * 1_000 });
    if (!result.ok) throw new Error("Expected a successful login");
    await expect(security.verifyAdminToken(
      result.token,
      input.sessionSecret,
      input.invitationId,
      input.now
    )).resolves.toEqual({ invitationId: input.invitationId, expiresAt: result.expiresAt });
    await expect(security.verifyAdminToken(
      result.token,
      input.sessionSecret,
      "other-garden",
      input.now
    )).resolves.toBeNull();
  });

  it("blocks a sixth attempt in ten minutes without blocking a different client", async () => {
    const { db } = createDb();
    const wrong = loginInput({ password: "wrong password" });

    for (let index = 0; index < 5; index += 1) {
      await expect(attemptAdminLogin(db, wrong)).resolves.toEqual({ ok: false, reason: "invalid_credentials" });
    }

    await expect(attemptAdminLogin(db, loginInput({ now: wrong.now + 30_001 }))).resolves.toEqual({
      ok: false,
      reason: "rate_limited",
      retryAfterSeconds: 570
    });
    await expect(attemptAdminLogin(db, loginInput({ clientKey: "198.51.100.20" }))).resolves.toMatchObject({ ok: true });
  });

  it("atomically reserves unique slots before limiting parallel password verification", async () => {
    const { db, bindCalls, reservedAttempts } = createDb();
    const verifyPassword = vi.spyOn(security, "verifyPassword");
    const issueAdminToken = vi.spyOn(security, "issueAdminToken");

    const results = await Promise.all(
      Array.from({ length: 8 }, () => attemptAdminLogin(db, loginInput()))
    );

    expect(reservedAttempts).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(results.filter(({ ok }) => ok)).toHaveLength(5);
    expect(results.filter((result) => !result.ok && result.reason === "rate_limited")).toHaveLength(3);
    expect(verifyPassword).toHaveBeenCalledTimes(5);
    expect(issueAdminToken).toHaveBeenCalledTimes(5);
    const reservationSql = bindCalls
      .filter(({ sql }) => /admin_login_attempts/i.test(sql))
      .map(({ sql }) => sql);
    expect(reservationSql).toHaveLength(13);
    expect(reservationSql.filter((sql) => /INSERT INTO admin_login_attempts/i.test(sql))).toHaveLength(8);
    expect(reservationSql.filter((sql) => /SELECT window_started_at, attempts/i.test(sql))).toHaveLength(0);
    expect(reservationSql.every((sql) =>
      /INSERT INTO admin_login_attempts/i.test(sql)
      ? /ON CONFLICT[\s\S]*RETURNING attempts, window_started_at/i.test(sql)
      : /DELETE FROM admin_login_attempts/i.test(sql)
    )).toBe(true);
  });

  it("clears prior failures after a successful login", async () => {
    const { db } = createDb();

    await attemptAdminLogin(db, loginInput({ password: "wrong password" }));
    await expect(attemptAdminLogin(db, loginInput())).resolves.toMatchObject({ ok: true });

    for (let index = 0; index < 5; index += 1) {
      await expect(attemptAdminLogin(db, loginInput({ password: "wrong again" })))
        .resolves.toEqual({ ok: false, reason: "invalid_credentials" });
    }
    await expect(attemptAdminLogin(db, loginInput())).resolves.toEqual({
      ok: false,
      reason: "rate_limited",
      retryAfterSeconds: 600
    });
  });

  it("starts a new half-open window exactly ten minutes after the prior start", async () => {
    const { db } = createDb();
    const start = loginInput({ password: "wrong password" });

    for (let index = 0; index < 5; index += 1) await attemptAdminLogin(db, start);

    await expect(attemptAdminLogin(db, loginInput({ now: start.now + 10 * 60 * 1_000 })))
      .resolves.toMatchObject({ ok: true });
  });

  it("records and clears attempts through the production SQLite statements", async () => {
    const database = new DatabaseSync(":memory:");
    database.exec(`
      CREATE TABLE invitations (id TEXT PRIMARY KEY);
      INSERT INTO invitations (id) VALUES ('sample-garden');
      CREATE TABLE admin_login_attempts (
        invitation_id TEXT NOT NULL,
        client_hash TEXT NOT NULL,
        window_started_at TEXT NOT NULL,
        attempts INTEGER NOT NULL CHECK (attempts >= 1),
        PRIMARY KEY (invitation_id, client_hash),
        FOREIGN KEY (invitation_id) REFERENCES invitations(id)
      );
    `);

    try {
      const db = createD1Adapter(database);
      await attemptAdminLogin(db, loginInput({ password: "wrong password" }));
      await attemptAdminLogin(db, loginInput({ password: "wrong password" }));

      expect(database.prepare("SELECT attempts FROM admin_login_attempts").get()).toEqual({ attempts: 2 });

      await expect(attemptAdminLogin(db, loginInput())).resolves.toMatchObject({ ok: true });
      expect(database.prepare("SELECT COUNT(*) AS count FROM admin_login_attempts").get()).toEqual({ count: 0 });
    } finally {
      database.close();
    }
  });
});
