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

describe("invitation gallery migration", () => {
  it("사진 초안·공개본과 제한된 이력 제약을 생성한다", () => {
    const database = new DatabaseSync(":memory:");
    try {
      for (const filename of ["0001_init.sql", "0010_invitation_gallery_management.sql"]) {
        database.exec(readFileSync(new URL(`../migrations/${filename}`, import.meta.url), "utf8"));
      }
      database.exec(`
        INSERT INTO invitation_gallery (invitation_id, draft_json, draft_revision, updated_at)
        VALUES ('sample-garden', '{"photos":[]}', 1, '2026-07-22T03:00:00.000Z')
      `);
      expect(database.prepare("SELECT draft_revision FROM invitation_gallery").get()).toEqual({ draft_revision: 1 });
      expect(() => database.exec(`
        INSERT INTO invitation_gallery_versions (id, invitation_id, revision, action, gallery_json, created_at)
        VALUES ('bad', 'sample-garden', 1, 'unknown', '{}', '2026-07-22T03:00:00.000Z')
      `)).toThrow(/CHECK constraint failed/);
    } finally {
      database.close();
    }
  });
});
