import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildDefaultEditableInvitationContent,
  invitationContent
} from "@wedding-game/shared";
import {
  getAdminInvitationContent,
  getPublicInvitationContent,
  publishInvitationContent,
  restoreInvitationContentVersion,
  saveInvitationContentDraft
} from "./invitationContentRepository";

type SqliteStatement = {
  get(...values: unknown[]): unknown;
  all(...values: unknown[]): unknown[];
  run(...values: unknown[]): { changes: number };
};

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
};

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => SqliteDatabase;
};

const migrationFiles = [
  "0001_init.sql",
  "0002_update_invitation_details.sql",
  "0003_production_rsvp.sql",
  "0004_rsvp_consent_policy.sql",
  "0005_production_guestbook.sql",
  "0006_admin_notifications.sql",
  "0007_admin_notification_email_queue.sql",
  "0009_invitation_content_management.sql"
] as const;

function createDb(): { sqlite: SqliteDatabase; d1: D1Database } {
  const sqlite = new DatabaseSync(":memory:");
  for (const filename of migrationFiles) {
    sqlite.exec(readFileSync(new URL(`../migrations/${filename}`, import.meta.url), "utf8"));
  }
  const d1 = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          const statement = sqlite.prepare(sql);
          return {
            first: async <T>() => (statement.get(...values) ?? null) as T | null,
            all: async <T>() => ({ results: statement.all(...values) as T[] }),
            run: async () => ({ meta: { changes: statement.run(...values).changes } })
          };
        }
      };
    }
  } as unknown as D1Database;
  return { sqlite, d1 };
}

const openDatabases: SqliteDatabase[] = [];

function testDb(): D1Database {
  const { sqlite, d1 } = createDb();
  openDatabases.push(sqlite);
  return d1;
}

function completeContent() {
  const content = buildDefaultEditableInvitationContent(invitationContent.event, invitationContent.content);
  content.familyContacts.contacts.forEach((contact, index) => {
    contact.name ||= `혼주 ${index}`;
    contact.phone = `010-1234-12${index}0`;
  });
  content.giftAccounts.accounts.forEach((account, index) => {
    account.name ||= `혼주 ${index}`;
    account.bank = "은행";
    account.accountNumber = `123-${index}`;
    account.holder = `예금주 ${index}`;
  });
  return content;
}

describe("invitation content repository", () => {
  afterEach(() => {
    for (const database of openDatabases.splice(0)) database.close();
  });

  it("초안을 저장하고 공개하기 전에는 공개 API에 노출하지 않는다", async () => {
    const db = testDb();
    const draft = completeContent();
    const saved = await saveInvitationContentDraft(db, {
      invitationId: "sample-garden",
      content: draft,
      expectedRevision: 0,
      historyId: "content_save_1",
      now: "2026-07-22T01:00:00.000Z"
    });

    expect(saved).toMatchObject({ ok: true, result: { revision: 1, publishedRevision: null } });
    expect(await getPublicInvitationContent(db, "sample-garden")).toEqual({
      content: null,
      revision: null,
      publishedAt: null
    });
  });

  it("공개본과 후속 초안을 분리하고 낙관적 잠금 충돌을 거부한다", async () => {
    const db = testDb();
    const first = completeContent();
    await saveInvitationContentDraft(db, {
      invitationId: "sample-garden",
      content: first,
      expectedRevision: 0,
      historyId: "content_save_1",
      now: "2026-07-22T01:00:00.000Z"
    });
    const published = await publishInvitationContent(db, {
      invitationId: "sample-garden",
      expectedRevision: 1,
      historyId: "content_publish_1",
      now: "2026-07-22T01:05:00.000Z"
    });
    expect(published).toMatchObject({ ok: true, result: { publishedRevision: 1 } });

    const second = completeContent();
    second.coupleIntroduction.together = "새 초안";
    expect(await saveInvitationContentDraft(db, {
      invitationId: "sample-garden",
      content: second,
      expectedRevision: 1,
      historyId: "content_save_2",
      now: "2026-07-22T01:10:00.000Z"
    })).toMatchObject({ ok: true, result: { revision: 2, publishedRevision: 1 } });
    expect((await getPublicInvitationContent(db, "sample-garden"))?.content?.coupleIntroduction.together)
      .toBe(first.coupleIntroduction.together);
    expect(await saveInvitationContentDraft(db, {
      invitationId: "sample-garden",
      content: second,
      expectedRevision: 1,
      historyId: "content_conflict",
      now: "2026-07-22T01:11:00.000Z"
    })).toEqual({ ok: false, reason: "conflict" });
  });

  it("이전 버전을 새 초안으로 복구하고 공개본은 유지한다", async () => {
    const db = testDb();
    const first = completeContent();
    await saveInvitationContentDraft(db, { invitationId: "sample-garden", content: first, expectedRevision: 0, historyId: "content_save_1", now: "2026-07-22T01:00:00.000Z" });
    await publishInvitationContent(db, { invitationId: "sample-garden", expectedRevision: 1, historyId: "content_publish_1", now: "2026-07-22T01:01:00.000Z" });
    const second = completeContent();
    second.share.description = "두 번째 초안";
    await saveInvitationContentDraft(db, { invitationId: "sample-garden", content: second, expectedRevision: 1, historyId: "content_save_2", now: "2026-07-22T01:02:00.000Z" });

    const restored = await restoreInvitationContentVersion(db, {
      invitationId: "sample-garden",
      versionId: "content_save_1",
      expectedRevision: 2,
      historyId: "content_restore_3",
      now: "2026-07-22T01:03:00.000Z"
    });

    expect(restored).toMatchObject({ ok: true, result: { revision: 3, publishedRevision: 1 } });
    const admin = await getAdminInvitationContent(db, "sample-garden");
    expect(admin?.draft?.share.description).toBe(first.share.description);
    expect(admin?.history[0]).toMatchObject({ action: "restore", revision: 3 });
    expect((await getPublicInvitationContent(db, "sample-garden"))?.revision).toBe(1);
  });
});
