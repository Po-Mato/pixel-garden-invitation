import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): { all(...values: unknown[]): unknown[] };
    close(): void;
  };
};

describe("guest information migration", () => {
  it("공지·FAQ 테이블과 기본 FAQ를 안전하게 생성한다", () => {
    const database = new DatabaseSync(":memory:");
    try {
      database.exec(readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8"));
      database.exec(readFileSync(new URL("../migrations/0016_guest_information.sql", import.meta.url), "utf8"));

      expect(database.prepare("SELECT id, category FROM invitation_faqs ORDER BY sort_order").all()).toEqual([
        { id: "faq_seed_parking", category: "교통·주차" },
        { id: "faq_seed_transit", category: "교통·주차" },
        { id: "faq_seed_hall", category: "예식 안내" },
        { id: "faq_seed_arrival", category: "예식 안내" }
      ]);
      expect(() => database.exec(`
        INSERT INTO invitation_announcements (
          id, invitation_id, title, body, tone, active, pinned, action_kind, action_label,
          sort_order, created_at, updated_at
        ) VALUES ('notice_bad', 'sample-garden', '제목', '내용', 'invalid', 1, 0, 'none', '', 1, 'now', 'now')
      `)).toThrow(/CHECK constraint failed/);
    } finally {
      database.close();
    }
  });
});
