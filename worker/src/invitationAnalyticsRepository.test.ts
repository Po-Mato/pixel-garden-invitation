import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import {
  getInvitationAnalytics,
  recordInvitationAnalytics
} from "./invitationAnalyticsRepository";

type SqliteStatement = {
  get(...values: unknown[]): unknown;
  all(...values: unknown[]): unknown[];
  run(...values: unknown[]): unknown;
};

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
};

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => SqliteDatabase;
};

function testDatabase(): { sqlite: SqliteDatabase; db: D1Database } {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE invitations (id TEXT PRIMARY KEY);
    CREATE TABLE rsvps (
      id TEXT PRIMARY KEY,
      invitation_id TEXT NOT NULL,
      attendance TEXT NOT NULL,
      party_size INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE guestbook_messages (
      id TEXT PRIMARY KEY,
      invitation_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    INSERT INTO invitations (id) VALUES ('sample-garden');
  `);
  sqlite.exec(readFileSync(new URL("../migrations/0012_invitation_analytics.sql", import.meta.url), "utf8"));

  const prepare = (sql: string) => ({
    bind: (...values: unknown[]) => ({
      first: async <T>() => (sqlite.prepare(sql).get(...values) ?? null) as T | null,
      all: async <T>() => ({ results: sqlite.prepare(sql).all(...values) as T[] }),
      run: async () => sqlite.prepare(sql).run(...values)
    })
  });
  const db = {
    prepare,
    async batch(statements: D1PreparedStatement[]) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    }
  } as unknown as D1Database;
  return { sqlite, db };
}

describe("invitation analytics repository", () => {
  it("개별 로그 없이 같은 날 행동을 합산하고 실제 RSVP·방명록을 결합한다", async () => {
    const { sqlite, db } = testDatabase();
    try {
      await recordInvitationAnalytics(db, "sample-garden", [
        { name: "visit", dimension: "entry:new:mobile" },
        { name: "visit", dimension: "entry:new:mobile" },
        { name: "mode_open", dimension: "simple" },
        { name: "rsvp_view", dimension: "simple" },
        { name: "rsvp_start", dimension: "simple" },
        { name: "rsvp_submit", dimension: "simple" },
        { name: "share_click", dimension: "copy" },
        { name: "page_load", dimension: "mobile", value: 1200 }
      ], new Date("2026-07-21T16:00:00.000Z"));
      sqlite.exec(`
        INSERT INTO rsvps VALUES ('rsvp_1', 'sample-garden', 'yes', 2, '2026-07-21T16:10:00.000Z');
        INSERT INTO guestbook_messages VALUES ('guestbook_1', 'sample-garden', '2026-07-21T17:00:00.000Z');
      `);

      const result = await getInvitationAnalytics(db, "sample-garden", {
        from: "2026-07-22",
        to: "2026-07-22",
        now: new Date("2026-07-22T03:00:00.000Z")
      });
      expect(result).not.toBeNull();
      expect(result?.totals).toMatchObject({
        visits: 2,
        simpleEntries: 1,
        rsvpViews: 1,
        rsvpStarts: 1,
        rsvpSubmits: 1,
        rsvpResponses: 1,
        attendingGuests: 2,
        guestbookMessages: 1,
        shareClicks: 1,
        averagePageLoadMs: 1200
      });
      expect(result?.daily).toEqual([expect.objectContaining({
        date: "2026-07-22",
        visits: 2,
        rsvpResponses: 1,
        guestbookMessages: 1
      })]);
      expect(result?.breakdowns.devices).toEqual([{ key: "mobile", count: 2 }]);
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM invitation_analytics_daily").get()).toEqual({ count: 7 });
    } finally {
      sqlite.close();
    }
  });

  it("존재하지 않는 초대장 이벤트는 저장하지 않는다", async () => {
    const { sqlite, db } = testDatabase();
    try {
      await expect(recordInvitationAnalytics(db, "missing", [
        { name: "visit", dimension: "entry:new:desktop" }
      ])).resolves.toBe(false);
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM invitation_analytics_daily").get()).toEqual({ count: 0 });
    } finally {
      sqlite.close();
    }
  });
});
