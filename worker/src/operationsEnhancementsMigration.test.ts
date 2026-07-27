import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

type SqliteStatement = {
  get(...values: unknown[]): unknown;
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

describe("journey progress and operations migration", () => {
  it("여정 동기화, RSVP 복원 사유, 성능 운영 모드를 함께 제약한다", () => {
    const database = new DatabaseSync(":memory:");
    try {
      database.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE invitations (id TEXT PRIMARY KEY);
        CREATE TABLE invitation_invite_links (
          id TEXT PRIMARY KEY,
          invitation_id TEXT NOT NULL,
          FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE
        );
        CREATE TABLE rsvps (
          id TEXT PRIMARY KEY,
          invitation_id TEXT NOT NULL,
          side TEXT NOT NULL,
          guest_name TEXT NOT NULL,
          phone TEXT,
          attendance TEXT NOT NULL,
          party_size INTEGER NOT NULL,
          child_count INTEGER NOT NULL DEFAULT 0,
          meal_status TEXT NOT NULL,
          note TEXT NOT NULL,
          consent_version TEXT,
          revision INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE
        );
        INSERT INTO invitations (id) VALUES ('sample-garden');
        INSERT INTO invitation_invite_links (id, invitation_id) VALUES ('invite-1', 'sample-garden');
      `);
      database.exec(readFileSync(new URL("../migrations/0018_rsvp_revision_history.sql", import.meta.url), "utf8"));
      database.exec(readFileSync(new URL("../migrations/0019_journey_progress_and_operations.sql", import.meta.url), "utf8"));

      database.prepare(`
        INSERT INTO invitation_journey_progress (invitation_id, invite_link_id, completed_json, updated_at)
        VALUES (?, ?, ?, ?)
      `).run("sample-garden", "invite-1", '["directions"]', "2026-07-28T00:00:00.000Z");
      database.prepare(`
        INSERT INTO invitation_performance_settings (invitation_id, force_default, updated_at)
        VALUES (?, ?, ?)
      `).run("sample-garden", 1, "2026-07-28T00:00:00.000Z");

      const columns = database.prepare("PRAGMA table_info(rsvp_revision_history)") as SqliteStatement & {
        all(): Array<{ name: string }>;
      };
      expect(columns.all().map((column) => column.name)).toContain("change_reason");
      expect(() => database.prepare(`
        INSERT INTO invitation_performance_settings (invitation_id, force_default, updated_at)
        VALUES (?, ?, ?)
      `).run("missing", 2, "2026-07-28T00:00:00.000Z")).toThrow();
    } finally {
      database.close();
    }
  });
});
