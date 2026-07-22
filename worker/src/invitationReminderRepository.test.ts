import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { listInvitationReminders, recordInvitationReminders } from "./invitationReminderRepository";

type SqliteStatement = {
  all(...parameters: unknown[]): unknown[];
  get(...parameters: unknown[]): unknown;
  run(...parameters: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
};
type SqliteDatabase = { exec(sql: string): void; prepare(sql: string): SqliteStatement; close(): void };
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (path: string) => SqliteDatabase };

function d1(database: SqliteDatabase): D1Database {
  const prepare = (sql: string) => ({
    bind(...values: unknown[]) {
      const statement = database.prepare(sql);
      return {
        first: async <T>() => (statement.get(...values) ?? null) as T | null,
        all: async <T>() => ({ results: statement.all(...values) as T[] }),
        run: async () => ({ success: true, meta: { changes: Number(statement.run(...values).changes) } })
      } as unknown as D1PreparedStatement;
    }
  } as D1PreparedStatement);
  return { prepare, batch: async (statements: D1PreparedStatement[]) => Promise.all(statements.map((statement) => statement.run())) } as D1Database;
}

describe("invitation reminder repository", () => {
  it("활성 하객의 누적 발송 상태와 개별 리마인드 이력을 함께 기록한다", async () => {
    const database = new DatabaseSync(":memory:");
    try {
      for (const name of ["0001_init.sql", "0013_invitation_invite_links.sql", "0014_invitation_invite_delivery_history.sql", "0015_attendance_operations.sql", "0017_invitation_reminders.sql"]) {
        database.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
      }
      database.exec(`
        INSERT INTO invitation_invite_links (
          id, invitation_id, token_hash, guest_name, side, group_label, active,
          open_count, created_at, updated_at
        ) VALUES
          ('invite_active', 'sample-garden', '${"a".repeat(43)}', '김하객', 'bride', '대학 친구', 1, 1, 'now', 'now'),
          ('invite_inactive', 'sample-garden', '${"b".repeat(43)}', '이하객', 'groom', '직장', 0, 0, 'now', 'now')
      `);
      const db = d1(database);
      const now = new Date("2027-04-17T09:00:00.000Z");
      await expect(recordInvitationReminders(db, "sample-garden", {
        linkIds: ["invite_active"], stage: "d14", channel: "kakao", note: "대학 친구 재안내"
      }, now)).resolves.toBe(true);
      await expect(recordInvitationReminders(db, "sample-garden", {
        linkIds: ["invite_inactive"], stage: "d14", channel: "sms", note: ""
      }, now)).resolves.toBe(false);

      expect(database.prepare("SELECT send_count, delivery_channel, delivery_note FROM invitation_invite_links WHERE id = 'invite_active'").get()).toEqual({
        send_count: 1,
        delivery_channel: "kakao",
        delivery_note: "대학 친구 재안내"
      });
      await expect(listInvitationReminders(db, "sample-garden")).resolves.toEqual({
        summary: {
          totalSent: 1,
          uniqueGuests: 1,
          lastSentAt: "2027-04-17T09:00:00.000Z",
          byStage: { d30: 0, d14: 1, d7: 0, d1: 0, manual: 0 }
        },
        events: [{
          id: expect.stringMatching(/^reminder_/),
          linkId: "invite_active",
          guestName: "김하객",
          side: "bride",
          groupLabel: "대학 친구",
          stage: "d14",
          channel: "kakao",
          note: "대학 친구 재안내",
          sentAt: "2027-04-17T09:00:00.000Z"
        }]
      });
      await expect(listInvitationReminders(db, "missing")).resolves.toBeNull();
    } finally {
      database.close();
    }
  });
});
