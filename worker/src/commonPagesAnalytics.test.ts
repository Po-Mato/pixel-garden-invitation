import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { recordBlogVisit, readCommonPages, cleanupPagesReceipts, handleCommonPages } from "./commonPagesAnalytics";
import { issueAdminToken } from "./security";
import type { Env } from "./index";

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
  sqlite.exec(readFileSync(new URL("../migrations/0020_device_qa_analytics.sql", import.meta.url), "utf8"));
  sqlite.exec(readFileSync(new URL("../migrations/0023_character_asset_fallback_analytics.sql", import.meta.url), "utf8"));
  sqlite.exec(readFileSync(new URL("../migrations/0024_anonymous_experience_quality.sql", import.meta.url), "utf8"));

  sqlite.exec(readFileSync(new URL("../migrations/0027_common_pages_analytics.sql", import.meta.url), "utf8"));
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

describe('common Pages analytics', () => {
  it('counts retry only once, preserves invitation history, and distinguishes missing collection', async () => {
    const { sqlite, db } = testDatabase();
    try {
      sqlite.exec("UPDATE pages_analytics_config SET enabled_at='2026-10-05T00:00:00.000Z'; INSERT INTO invitation_analytics_daily VALUES('sample-garden','2026-10-04','visit','entry:new:mobile',5,0,'2026-10-04T00:00:00Z')");
      const now = new Date('2026-10-05T00:00:00Z');
      await recordBlogVisit(db,'test-receipt',now); await recordBlogVisit(db,'test-receipt',now);
      await recordBlogVisit(db,'second-receipt',now);
      const r = await readCommonPages(db,'2026-10-04','2026-10-05');
      expect(r.days[0]).toMatchObject({blog:null,wedding:5,recordedTotal:5,complete:false});
      expect(r.days[1]).toMatchObject({blog:2,wedding:0,recordedTotal:2,complete:true});
      expect(r.totals.recordedTotal).toBe(7);
      await cleanupPagesReceipts(db,new Date('2026-10-06T00:01:00Z'));
      expect(sqlite.prepare('SELECT COUNT(*) AS n FROM pages_analytics_receipts').get()).toEqual({n:0});
      expect((await readCommonPages(db,'2026-10-04','2026-10-05')).totals.recordedTotal).toBe(7);
    } finally { sqlite.close(); }
  });
  it('accepts only minimal blog events and rejects private fields and other origins', async () => {
    const {sqlite,db}=testDatabase();const env={DB:db} as Env;
    try {
      const event={site:'blog',event:'visit',eventId:'01234567-89ab-4def-8123-456789abcdef'};
      const request=(body:unknown,origin='https://po-mato.github.io')=>new Request('https://worker.test/api/pages/visits',{method:'POST',headers:{origin},body:JSON.stringify(body)});
      expect((await handleCommonPages(request(event),env)).status).toBe(204);
      expect((await handleCommonPages(request(event),env)).status).toBe(204);
      expect((await handleCommonPages(request({...event,url:'?nickname=private'}),env)).status).toBe(400);
      expect((await handleCommonPages(request(event,'https://evil.test'),env)).status).toBe(403);
      expect((await handleCommonPages(request({...event,eventId:'invalid'}),env)).status).toBe(400);
      expect((await handleCommonPages(request({...event,extra:'x'.repeat(300)}),env)).status).toBe(400);
      expect(sqlite.prepare('SELECT SUM(visits) AS n FROM pages_analytics_daily').get()).toEqual({n:1});
    } finally {sqlite.close();}
  });
  it('requires the existing owner admin token and validates range before querying', async () => {
    const {sqlite,db}=testDatabase();const env={DB:db,RSVP_ADMIN_SESSION_SECRET:'local-test-only'} as Env;
    try {
      const url='https://worker.test/api/invitations/sample-garden/admin/pages-analytics';
      expect((await handleCommonPages(new Request(url),env,'sample-garden')).status).toBe(401);
      const token=await issueAdminToken({invitationId:'sample-garden',expiresAt:Date.now()+60000},env.RSVP_ADMIN_SESSION_SECRET);
      const request=(suffix='')=>new Request(url+suffix,{headers:{authorization:`Bearer ${token}`}});
      expect((await handleCommonPages(request(),env,'other')).status).toBe(401);
      expect((await handleCommonPages(request('?to=bad'),env,'sample-garden')).status).toBe(400);
      expect((await handleCommonPages(request('?from=2020-01-01'),env,'sample-garden')).status).toBe(400);
      expect((await handleCommonPages(request(),env,'sample-garden')).status).toBe(200);
    } finally {sqlite.close();}
  });
});
