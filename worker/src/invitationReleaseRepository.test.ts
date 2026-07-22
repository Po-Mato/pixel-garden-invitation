import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildDefaultEditableInvitationContent,
  buildDefaultEditableInvitationGallery,
  invitationContent,
  weddingContent
} from "@wedding-game/shared";
import { saveInvitationContentDraft } from "./invitationContentRepository";
import { saveInvitationGalleryDraft } from "./invitationGalleryRepository";
import {
  getAdminInvitationRelease,
  getPublicInvitationRelease,
  publishDueInvitationReleases,
  publishInvitationRelease,
  restoreInvitationRelease,
  scheduleInvitationRelease
} from "./invitationReleaseRepository";

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
type LocalBoundStatement = D1PreparedStatement & { batchRun(): D1Result };

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => SqliteDatabase;
};
const migrations = [
  "0001_init.sql",
  "0009_invitation_content_management.sql",
  "0010_invitation_gallery_management.sql",
  "0011_invitation_release_management.sql"
];
const openDatabases: SqliteDatabase[] = [];

function testDb(): { db: D1Database; sqlite: SqliteDatabase } {
  const sqlite = new DatabaseSync(":memory:");
  migrations.forEach((filename) => sqlite.exec(readFileSync(new URL(`../migrations/${filename}`, import.meta.url), "utf8")));
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          const execute = () => sqlite.prepare(sql).run(...values);
          return {
            first: async <T>() => (sqlite.prepare(sql).get(...values) ?? null) as T | null,
            all: async <T>() => ({ results: sqlite.prepare(sql).all(...values) as T[] }),
            run: async () => ({ meta: { changes: execute().changes } }),
            batchRun: () => ({ meta: { changes: execute().changes } }) as D1Result
          } as unknown as LocalBoundStatement;
        }
      };
    },
    async batch(statements: D1PreparedStatement[]) {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map((statement) => (statement as LocalBoundStatement).batchRun());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    }
  } as unknown as D1Database;
  openDatabases.push(sqlite);
  return { db, sqlite };
}

function completeContent(label = "첫 초안") {
  const content = buildDefaultEditableInvitationContent(invitationContent.event, invitationContent.content);
  content.coupleIntroduction.together = label;
  content.familyContacts.contacts.forEach((contact, index) => {
    contact.name ||= `가족 ${index}`;
    contact.phone = `010-1234-12${index}0`;
  });
  content.giftAccounts.accounts.forEach((account, index) => {
    account.name ||= `가족 ${index}`;
    account.bank = "은행";
    account.accountNumber = `123-${index}`;
    account.holder = `예금주 ${index}`;
  });
  return content;
}

function completeGallery() {
  const gallery = buildDefaultEditableInvitationGallery(weddingContent);
  gallery.photos.forEach((photo, index) => {
    photo.assetId = `12345678-1234-4${String(index).padStart(3, "0")}-8123-123456789abc`;
  });
  return gallery;
}

async function seedCandidate(db: D1Database) {
  await saveInvitationContentDraft(db, {
    invitationId: "sample-garden",
    content: completeContent(),
    expectedRevision: 0,
    historyId: "content_save_1",
    now: "2026-07-22T00:00:00.000Z"
  });
  await saveInvitationGalleryDraft(db, {
    invitationId: "sample-garden",
    gallery: completeGallery(),
    expectedRevision: 0,
    historyId: "gallery_save_1",
    now: "2026-07-22T00:00:00.000Z"
  });
}

describe("invitation release repository", () => {
  afterEach(() => {
    for (const database of openDatabases.splice(0)) database.close();
  });

  it("문구와 사진 초안을 하나의 통합 공개본으로 전환한다", async () => {
    const { db, sqlite } = testDb();
    await seedCandidate(db);

    const published = await publishInvitationRelease(db, {
      invitationId: "sample-garden",
      expectedContentRevision: 1,
      expectedGalleryRevision: 1,
      releaseId: "release_12345678-1234-4000-8123-123456789abc",
      contentHistoryId: "content_release_1",
      galleryHistoryId: "gallery_release_1",
      now: "2026-07-22T00:01:00.000Z"
    });

    expect(published).toMatchObject({
      ok: true,
      result: {
        content: { publishedRevision: 1, changed: false },
        gallery: { publishedRevision: 1, changed: false },
        latestRelease: { releaseNumber: 1, action: "publish" }
      }
    });
    expect(sqlite.prepare("SELECT published_at FROM invitation_content WHERE invitation_id = 'sample-garden'").get())
      .toEqual({ published_at: "2026-07-22T00:01:00.000Z" });
    expect(sqlite.prepare("SELECT published_at FROM invitation_gallery WHERE invitation_id = 'sample-garden'").get())
      .toEqual({ published_at: "2026-07-22T00:01:00.000Z" });
    expect(await getPublicInvitationRelease(db, "sample-garden")).toMatchObject({
      releaseNumber: 1,
      contentRevision: 1,
      galleryRevision: 1,
      content: { coupleIntroduction: { together: "첫 초안" } }
    });
  });

  it("예약 시점의 스냅샷을 이후 초안 변경과 무관하게 자동 공개한다", async () => {
    const { db, sqlite } = testDb();
    await seedCandidate(db);
    await scheduleInvitationRelease(db, {
      invitationId: "sample-garden",
      expectedContentRevision: 1,
      expectedGalleryRevision: 1,
      scheduleId: "schedule_12345678-1234-4000-8123-123456789abc",
      scheduledFor: "2026-07-22T00:10:00.000Z",
      now: "2026-07-22T00:02:00.000Z"
    });
    await saveInvitationContentDraft(db, {
      invitationId: "sample-garden",
      content: completeContent("예약 후 수정한 초안"),
      expectedRevision: 1,
      historyId: "content_save_2",
      now: "2026-07-22T00:03:00.000Z"
    });

    await expect(publishDueInvitationReleases(db, new Date("2026-07-22T00:11:00.000Z")))
      .resolves.toEqual({ attempted: 1, published: 1, failed: 0 });
    const publishedContent = sqlite.prepare(`
      SELECT json_extract(published_json, '$.coupleIntroduction.together') AS together,
             published_revision
      FROM invitation_content WHERE invitation_id = 'sample-garden'
    `).get();
    expect(publishedContent).toEqual({ together: "첫 초안", published_revision: 1 });
    expect(await getAdminInvitationRelease(db, "sample-garden")).toMatchObject({
      schedule: null,
      content: { draftRevision: 2, publishedRevision: 1, changed: true },
      latestRelease: { action: "scheduled" }
    });
  });

  it("이전 통합 공개본을 새 버전으로 복원하고 현재 초안은 유지한다", async () => {
    const { db, sqlite } = testDb();
    await seedCandidate(db);
    const firstId = "release_12345678-1234-4000-8123-123456789abc";
    await publishInvitationRelease(db, {
      invitationId: "sample-garden",
      expectedContentRevision: 1,
      expectedGalleryRevision: 1,
      releaseId: firstId,
      contentHistoryId: "content_release_1",
      galleryHistoryId: "gallery_release_1",
      now: "2026-07-22T00:01:00.000Z"
    });
    await saveInvitationContentDraft(db, {
      invitationId: "sample-garden",
      content: completeContent("두 번째 공개본"),
      expectedRevision: 1,
      historyId: "content_save_2",
      now: "2026-07-22T00:02:00.000Z"
    });
    await publishInvitationRelease(db, {
      invitationId: "sample-garden",
      expectedContentRevision: 2,
      expectedGalleryRevision: 1,
      releaseId: "release_22345678-1234-4000-8123-123456789abc",
      contentHistoryId: "content_release_2",
      galleryHistoryId: "gallery_release_2",
      now: "2026-07-22T00:03:00.000Z"
    });

    await restoreInvitationRelease(db, {
      invitationId: "sample-garden",
      sourceReleaseId: firstId,
      releaseId: "release_32345678-1234-4000-8123-123456789abc",
      contentHistoryId: "content_restore_release_1",
      galleryHistoryId: "gallery_restore_release_1",
      now: "2026-07-22T00:04:00.000Z"
    });

    expect(sqlite.prepare(`
      SELECT json_extract(draft_json, '$.coupleIntroduction.together') AS draft,
             json_extract(published_json, '$.coupleIntroduction.together') AS published
      FROM invitation_content WHERE invitation_id = 'sample-garden'
    `).get()).toEqual({ draft: "두 번째 공개본", published: "첫 초안" });
    expect(await getAdminInvitationRelease(db, "sample-garden")).toMatchObject({
      latestRelease: { releaseNumber: 3, action: "restore", sourceReleaseId: firstId }
    });
  });
});
