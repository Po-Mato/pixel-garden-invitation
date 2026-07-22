import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): { all(): Array<Record<string, unknown>> };
  close(): void;
};

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => SqliteDatabase;
};

describe("invitation analytics migration", () => {
  it("개인 식별자 없이 일별 집계 테이블만 생성한다", () => {
    const database = new DatabaseSync(":memory:");
    try {
      database.exec("PRAGMA foreign_keys = ON; CREATE TABLE invitations (id TEXT PRIMARY KEY);");
      database.exec(readFileSync(new URL("../migrations/0012_invitation_analytics.sql", import.meta.url), "utf8"));
      const columns = database.prepare("PRAGMA table_info(invitation_analytics_daily)").all();
      expect(columns.map(({ name }) => name)).toEqual([
        "invitation_id",
        "local_date",
        "event_name",
        "dimension",
        "event_count",
        "value_sum",
        "updated_at"
      ]);
      expect(columns.some(({ name }) => /ip|visitor|session|user/i.test(String(name)))).toBe(false);
      expect(() => database.exec(`
        INSERT INTO invitation_analytics_daily
          (invitation_id, local_date, event_name, dimension, event_count, value_sum, updated_at)
        VALUES ('missing', '2026-07-22', 'visit', 'entry:new:mobile', 1, 0, '2026-07-22T00:00:00.000Z')
      `)).toThrow(/FOREIGN KEY constraint failed/);
    } finally {
      database.close();
    }
  });
});
