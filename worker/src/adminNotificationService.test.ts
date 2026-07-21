import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

import type { Env } from "./index";
import {
  publishAdminNotification,
  retryPendingAdminNotificationEmails
} from "./adminNotificationService";

type SqliteStatement = {
  all(...parameters: unknown[]): unknown[];
  get(...parameters: unknown[]): unknown;
  run(...parameters: unknown[]): { changes: number | bigint };
};

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
};

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => SqliteDatabase;
};

const migrations = [
  "0001_init.sql",
  "0002_update_invitation_details.sql",
  "0003_production_rsvp.sql",
  "0004_rsvp_consent_policy.sql",
  "0005_production_guestbook.sql",
  "0006_admin_notifications.sql",
  "0007_admin_notification_email_queue.sql"
] as const;

function createD1Adapter(database: SqliteDatabase): D1Database {
  return {
    prepare(sql: string) {
      const statement = database.prepare(sql);
      return {
        bind(...values: unknown[]) {
          return {
            first: async <T>() => (statement.get(...values) ?? null) as T | null,
            all: async <T>() => ({ results: statement.all(...values) as T[] }),
            run: async () => {
              const result = statement.run(...values);
              return { success: true, meta: { changes: Number(result.changes) } };
            }
          } as unknown as D1PreparedStatement;
        }
      } as D1PreparedStatement;
    }
  } as D1Database;
}

function setup(send = vi.fn().mockResolvedValue({ messageId: "message_1" })) {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  for (const migration of migrations) {
    database.exec(readFileSync(new URL(`../migrations/${migration}`, import.meta.url), "utf8"));
  }
  const env = {
    DB: createD1Adapter(database),
    EMAIL: { send },
    ADMIN_NOTIFICATION_EMAIL_TO: "admin@example.com",
    ADMIN_NOTIFICATION_EMAIL_FROM: "invitation@example.test",
    ADMIN_NOTIFICATION_BASE_URL: "https://example.test/invitation"
  } as unknown as Env;
  return { database, env, send };
}

const event = {
  invitationId: "sample-garden",
  eventKey: "rsvp_created:rsvp_1:1",
  kind: "rsvp_created" as const,
  sourceId: "rsvp_1",
  title: "새 참석 답변",
  body: "김하객 · 신부측 · 참석 · 2명",
  expiresAt: "2027-05-31T14:59:59.000Z"
};

describe("admin notification email queue", () => {
  it("동일 이벤트를 한 번만 저장·발송하고 성공 상태를 기록한다", async () => {
    const { database, env, send } = setup();
    try {
      await publishAdminNotification(env, event);
      await publishAdminNotification(env, event);

      expect(send).toHaveBeenCalledOnce();
      expect(send).toHaveBeenCalledWith(expect.objectContaining({
        to: "admin@example.com",
        from: { email: "invitation@example.test", name: "건희·승재 모바일 청첩장" },
        text: expect.stringContaining("관리자 화면에서 확인"),
        html: expect.stringContaining("https://example.test/invitation/?admin=rsvp")
      }));
      expect(database.prepare(`
        SELECT COUNT(*) AS count, MAX(email_attempts) AS attempts,
               COUNT(emailed_at) AS sent_count
        FROM admin_notifications
      `).get()).toEqual({ count: 1, attempts: 1, sent_count: 1 });
    } finally {
      database.close();
    }
  });

  it("일시 오류를 예약 시각에 재시도해 성공 처리한다", async () => {
    const transient = Object.assign(new Error("temporary"), { code: "E_INTERNAL_SERVER_ERROR" });
    const send = vi.fn().mockRejectedValueOnce(transient).mockResolvedValueOnce({ messageId: "message_2" });
    const { database, env } = setup(send);
    try {
      await publishAdminNotification(env, event);
      const failed = database.prepare(`
        SELECT email_attempts, email_next_attempt_at, email_error, emailed_at
        FROM admin_notifications
      `).get() as {
        email_attempts: number;
        email_next_attempt_at: string;
        email_error: string;
        emailed_at: string | null;
      };
      expect(failed).toMatchObject({
        email_attempts: 1,
        email_error: "E_INTERNAL_SERVER_ERROR: temporary",
        emailed_at: null
      });
      expect(failed.email_next_attempt_at).toEqual(expect.any(String));

      const retried = await retryPendingAdminNotificationEmails(env, new Date(failed.email_next_attempt_at));
      expect(retried).toEqual({ attempted: 1, sent: 1, failed: 0 });
      expect(send).toHaveBeenCalledTimes(2);
      expect(database.prepare(`
        SELECT email_attempts, email_next_attempt_at, email_error, emailed_at
        FROM admin_notifications
      `).get()).toMatchObject({
        email_attempts: 2,
        email_next_attempt_at: null,
        email_error: null,
        emailed_at: expect.any(String)
      });
    } finally {
      database.close();
    }
  });

  it("설정 오류는 재시도하지 않고 최종 실패로 기록한다", async () => {
    const permanent = Object.assign(new Error("sender is not verified"), { code: "E_SENDER_NOT_VERIFIED" });
    const { database, env, send } = setup(vi.fn().mockRejectedValue(permanent));
    try {
      await publishAdminNotification(env, event);
      expect(database.prepare(`
        SELECT email_attempts, email_next_attempt_at, email_error
        FROM admin_notifications
      `).get()).toEqual({
        email_attempts: 5,
        email_next_attempt_at: null,
        email_error: "E_SENDER_NOT_VERIFIED: sender is not verified"
      });

      await expect(retryPendingAdminNotificationEmails(env, new Date("2027-01-01T00:00:00.000Z")))
        .resolves.toEqual({ attempted: 0, sent: 0, failed: 0 });
      expect(send).toHaveBeenCalledOnce();
    } finally {
      database.close();
    }
  });

  it("이메일 미연결 상태에서도 알림을 큐에 안전하게 보관한다", async () => {
    const { database, env } = setup();
    delete env.EMAIL;
    delete env.ADMIN_NOTIFICATION_EMAIL_TO;
    delete env.ADMIN_NOTIFICATION_EMAIL_FROM;
    try {
      await publishAdminNotification(env, event);
      expect(database.prepare(`
        SELECT email_attempts, emailed_at, email_error FROM admin_notifications
      `).get()).toEqual({ email_attempts: 0, emailed_at: null, email_error: null });
      await expect(retryPendingAdminNotificationEmails(env))
        .resolves.toEqual({ attempted: 0, sent: 0, failed: 0 });
    } finally {
      database.close();
    }
  });
});
