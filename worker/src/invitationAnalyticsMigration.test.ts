import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): {
    all(): Array<Record<string, unknown>>;
    get(...values: unknown[]): unknown;
  };
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

  it("기존 합계를 보존하면서 성능·기기 점검 이벤트 제약을 확장한다", () => {
    const database = new DatabaseSync(":memory:");
    try {
      database.exec("CREATE TABLE invitations (id TEXT PRIMARY KEY); INSERT INTO invitations VALUES ('sample-garden');");
      database.exec(readFileSync(new URL("../migrations/0012_invitation_analytics.sql", import.meta.url), "utf8"));
      database.exec("INSERT INTO invitation_analytics_daily VALUES ('sample-garden', '2026-07-30', 'visit', 'entry:new:mobile', 3, 0, '2026-07-30T00:00:00.000Z');");
      database.exec(readFileSync(new URL("../migrations/0020_device_qa_analytics.sql", import.meta.url), "utf8"));
      expect(database.prepare("SELECT event_count FROM invitation_analytics_daily WHERE event_name = 'visit'").get()).toEqual({ event_count: 3 });
      expect(() => database.exec("INSERT INTO invitation_analytics_daily VALUES ('sample-garden', '2026-07-30', 'device_qa', 'ios:warning', 1, 0, '2026-07-30T00:00:00.000Z');")).not.toThrow();
      expect(() => database.exec("INSERT INTO invitation_analytics_daily VALUES ('sample-garden', '2026-07-30', 'unknown', 'x', 1, 0, '2026-07-30T00:00:00.000Z');")).toThrow(/CHECK constraint failed/);
    } finally {
      database.close();
    }
  });
});
