import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): { get(...values: unknown[]): unknown };
  close(): void;
};

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => SqliteDatabase;
};

describe("invitation release migration", () => {
  it("통합 공개본과 공개 예약에 유효한 스냅샷만 저장한다", () => {
    const database = new DatabaseSync(":memory:");
    try {
      for (const filename of [
        "0001_init.sql",
        "0009_invitation_content_management.sql",
        "0010_invitation_gallery_management.sql",
        "0011_invitation_release_management.sql"
      ]) database.exec(readFileSync(new URL(`../migrations/${filename}`, import.meta.url), "utf8"));

      database.exec(`
        INSERT INTO invitation_releases (
          id, invitation_id, release_number, action, content_json, content_revision,
          gallery_json, gallery_revision, created_at
        ) VALUES ('release_1', 'sample-garden', 1, 'publish', '{}', 1, '{}', 1, '2026-07-22T00:00:00.000Z')
      `);
      expect(database.prepare("SELECT action, release_number FROM invitation_releases").get())
        .toEqual({ action: "publish", release_number: 1 });
      expect(() => database.exec(`
        INSERT INTO invitation_releases (
          id, invitation_id, release_number, action, content_json, content_revision,
          gallery_json, gallery_revision, created_at
        ) VALUES ('release_bad', 'sample-garden', 2, 'invalid', '{}', 1, '{}', 1, '2026-07-22T00:00:00.000Z')
      `)).toThrow(/CHECK constraint failed/);
      expect(() => database.exec(`
        INSERT INTO invitation_release_schedules (
          invitation_id, id, content_json, content_revision, gallery_json,
          gallery_revision, scheduled_for, created_at, updated_at
        ) VALUES ('sample-garden', 'schedule_bad', 'not-json', 1, '{}', 1, '2026-07-23T00:00:00.000Z', '2026-07-22T00:00:00.000Z', '2026-07-22T00:00:00.000Z')
      `)).toThrow(/CHECK constraint failed/);
    } finally {
      database.close();
    }
  });
});
