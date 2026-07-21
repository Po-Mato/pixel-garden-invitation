import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

import { cleanupExpiredInvitationData } from "./cleanup";

type Invitation = { id: string; rsvpDeleteAt: string | null; guestbookDeleteAt?: string | null };
type Attempt = { id: string; windowStartedAt: string };

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

function createD1Adapter(database: SqliteDatabase): D1Database {
  return {
    prepare(sql: string) {
      const statement = database.prepare(sql);
      return {
        bind(...values: unknown[]) {
          return {
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

function createDb(
  invitations: Invitation[],
  rsvpInvitationIds: string[],
  attempts: Attempt[],
  guestbookInvitationIds: string[] = []
) {
  const rsvps = [...rsvpInvitationIds];
  const guestbookMessages = [...guestbookInvitationIds];
  const loginAttempts = [...attempts];
  const prepare = vi.fn((sql: string) => ({
    bind: (...values: unknown[]) => ({
      run: async () => {
        const cutoff = String(values[0]);
        if (/DELETE FROM rsvps/i.test(sql)) {
          const expiredIds = new Set(invitations
            .filter(({ rsvpDeleteAt }) => rsvpDeleteAt !== null && rsvpDeleteAt <= cutoff)
            .map(({ id }) => id));
          const before = rsvps.length;
          for (let index = rsvps.length - 1; index >= 0; index -= 1) {
            if (expiredIds.has(rsvps[index])) rsvps.splice(index, 1);
          }
          return { success: true, meta: { changes: before - rsvps.length } };
        }

        if (/DELETE FROM guestbook_messages/i.test(sql)) {
          const expiredIds = new Set(invitations
            .filter(({ guestbookDeleteAt }) => guestbookDeleteAt !== null && guestbookDeleteAt !== undefined && guestbookDeleteAt <= cutoff)
            .map(({ id }) => id));
          const before = guestbookMessages.length;
          for (let index = guestbookMessages.length - 1; index >= 0; index -= 1) {
            if (expiredIds.has(guestbookMessages[index])) guestbookMessages.splice(index, 1);
          }
          return { success: true, meta: { changes: before - guestbookMessages.length } };
        }

        const before = loginAttempts.length;
        for (let index = loginAttempts.length - 1; index >= 0; index -= 1) {
          if (loginAttempts[index].windowStartedAt < cutoff) loginAttempts.splice(index, 1);
        }
        return { success: true, meta: { changes: before - loginAttempts.length } };
      }
    })
  }));

  return { db: { prepare } as unknown as D1Database, prepare, rsvps, guestbookMessages, loginAttempts };
}

describe("cleanupExpiredInvitationData", () => {
  it("deletes an RSVP when rsvp_delete_at exactly equals now in SQLite", async () => {
    const database = new DatabaseSync(":memory:");

    try {
      database.exec(`
        CREATE TABLE invitations (id TEXT PRIMARY KEY, rsvp_delete_at TEXT, guestbook_delete_at TEXT);
        CREATE TABLE rsvps (id TEXT PRIMARY KEY, invitation_id TEXT NOT NULL);
        CREATE TABLE guestbook_messages (id TEXT PRIMARY KEY, invitation_id TEXT NOT NULL);
        CREATE TABLE admin_login_attempts (window_started_at TEXT NOT NULL);
        INSERT INTO invitations VALUES
          ('boundary', '2027-06-01T00:00:00.000Z', '2027-06-01T00:00:00.000Z'),
          ('future', '2027-06-01T00:00:00.001Z', '2027-06-01T00:00:00.001Z');
        INSERT INTO rsvps VALUES ('rsvp_boundary', 'boundary'), ('rsvp_future', 'future');
        INSERT INTO guestbook_messages VALUES ('guestbook_boundary', 'boundary'), ('guestbook_future', 'future');
      `);

      await expect(cleanupExpiredInvitationData(
        createD1Adapter(database),
        new Date("2027-06-01T00:00:00.000Z")
      )).resolves.toEqual({ rsvps: 1, guestbookMessages: 1, attempts: 0 });

      expect(database.prepare("SELECT id FROM rsvps WHERE id = ?").get("rsvp_boundary")).toBeUndefined();
      expect(database.prepare("SELECT id FROM rsvps WHERE id = ?").get("rsvp_future")).toEqual({ id: "rsvp_future" });
      expect(database.prepare("SELECT id FROM guestbook_messages WHERE id = ?").get("guestbook_boundary")).toBeUndefined();
      expect(database.prepare("SELECT id FROM guestbook_messages WHERE id = ?").get("guestbook_future")).toEqual({ id: "guestbook_future" });
    } finally {
      database.close();
    }
  });

  it("keeps RSVP data immediately before its deletion time", async () => {
    const { db, rsvps } = createDb(
      [{ id: "sample-garden", rsvpDeleteAt: "2027-05-31T14:59:59.000Z" }],
      ["sample-garden"],
      []
    );

    const result = await cleanupExpiredInvitationData(db, new Date("2027-05-31T14:59:58.999Z"));

    expect(result).toEqual({ rsvps: 0, guestbookMessages: 0, attempts: 0 });
    expect(rsvps).toEqual(["sample-garden"]);
  });

  it("deletes RSVP data at the policy boundary and stale login attempts", async () => {
    const { db, rsvps, guestbookMessages, loginAttempts, prepare } = createDb(
      [
        { id: "expired", rsvpDeleteAt: "2027-05-31T14:59:59.000Z", guestbookDeleteAt: "2027-05-31T14:59:59.000Z" },
        { id: "active", rsvpDeleteAt: "2027-06-01T00:00:00.001Z", guestbookDeleteAt: "2027-06-01T00:00:00.001Z" },
        { id: "retained", rsvpDeleteAt: null, guestbookDeleteAt: null }
      ],
      ["expired", "active", "retained"],
      [
        { id: "stale", windowStartedAt: "2027-05-31T23:49:59.999Z" },
        { id: "boundary", windowStartedAt: "2027-05-31T23:50:00.000Z" }
      ],
      ["expired", "active", "retained"]
    );

    const result = await cleanupExpiredInvitationData(db, new Date("2027-06-01T00:00:00.000Z"));

    expect(result).toEqual({ rsvps: 1, guestbookMessages: 1, attempts: 1 });
    expect(rsvps).toEqual(["active", "retained"]);
    expect(guestbookMessages).toEqual(["active", "retained"]);
    expect(loginAttempts).toEqual([{ id: "boundary", windowStartedAt: "2027-05-31T23:50:00.000Z" }]);
    expect(prepare).toHaveBeenCalledWith(expect.stringMatching(/rsvp_delete_at\s*<=\s*\?/i));
    expect(prepare).toHaveBeenCalledWith(expect.stringMatching(/window_started_at\s*<\s*\?/i));
  });

  it("is idempotent when the same cleanup runs again", async () => {
    const { db } = createDb(
      [{ id: "expired", rsvpDeleteAt: "2027-05-31T14:59:59.000Z" }],
      ["expired"],
      [{ id: "stale", windowStartedAt: "2027-05-31T00:00:00.000Z" }]
    );
    const now = new Date("2027-06-01T00:00:00.000Z");

    await expect(cleanupExpiredInvitationData(db, now)).resolves.toEqual({ rsvps: 1, guestbookMessages: 0, attempts: 1 });
    await expect(cleanupExpiredInvitationData(db, now)).resolves.toEqual({ rsvps: 0, guestbookMessages: 0, attempts: 0 });
  });
});
