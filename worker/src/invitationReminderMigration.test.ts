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

describe("invitation reminder migration", () => {
  it("단계와 채널 제약이 있는 리마인드 이력 테이블을 생성한다", () => {
    const database = new DatabaseSync(":memory:");
    try {
      for (const name of ["0001_init.sql", "0013_invitation_invite_links.sql", "0014_invitation_invite_delivery_history.sql", "0015_attendance_operations.sql", "0017_invitation_reminders.sql"]) {
        database.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
      }
      database.exec(`
        INSERT INTO invitation_invite_links (
          id, invitation_id, token_hash, guest_name, side, group_label, active,
          open_count, created_at, updated_at
        ) VALUES ('invite_test', 'sample-garden', '${"a".repeat(43)}', '김하객', 'bride', '친구', 1, 0, 'now', 'now')
      `);
      database.exec(`
        INSERT INTO invitation_invite_reminder_events (
          id, invitation_id, link_id, stage, channel, note, sent_at
        ) VALUES ('reminder_test', 'sample-garden', 'invite_test', 'd14', 'kakao', '', 'now')
      `);
      expect(database.prepare("SELECT stage, channel FROM invitation_invite_reminder_events").all()).toEqual([{ stage: "d14", channel: "kakao" }]);
      expect(() => database.exec(`
        INSERT INTO invitation_invite_reminder_events (
          id, invitation_id, link_id, stage, channel, note, sent_at
        ) VALUES ('reminder_bad', 'sample-garden', 'invite_test', 'week', 'email', '', 'now')
      `)).toThrow(/CHECK constraint failed/);
    } finally {
      database.close();
    }
  });
});
