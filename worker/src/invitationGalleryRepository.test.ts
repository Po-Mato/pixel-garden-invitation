import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildDefaultEditableInvitationGallery,
  weddingContent
} from "@wedding-game/shared";
import {
  getAdminInvitationGallery,
  getPublicInvitationGallery,
  isPublishedGalleryAsset,
  publishInvitationGallery,
  restoreInvitationGalleryVersion,
  saveInvitationGalleryDraft
} from "./invitationGalleryRepository";

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
const migrations = ["0001_init.sql", "0009_invitation_content_management.sql", "0010_invitation_gallery_management.sql"];
const openDatabases: SqliteDatabase[] = [];

function testDb(): D1Database {
  const sqlite = new DatabaseSync(":memory:");
  migrations.forEach((filename) => sqlite.exec(readFileSync(new URL(`../migrations/${filename}`, import.meta.url), "utf8")));
  openDatabases.push(sqlite);
  return {
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
}

function completeGallery() {
  const gallery = buildDefaultEditableInvitationGallery(weddingContent);
  gallery.photos.forEach((photo, index) => {
    photo.assetId = `12345678-1234-4${String(index).padStart(3, "0")}-8123-123456789abc`;
  });
  return gallery;
}

describe("invitation gallery repository", () => {
  afterEach(() => {
    for (const database of openDatabases.splice(0)) database.close();
  });

  it("초안과 공개본을 분리하고 공개된 자산만 허용한다", async () => {
    const db = testDb();
    const gallery = completeGallery();
    expect(await saveInvitationGalleryDraft(db, {
      invitationId: "sample-garden",
      gallery,
      expectedRevision: 0,
      historyId: "gallery_save_1",
      now: "2026-07-22T03:00:00.000Z"
    })).toMatchObject({ ok: true, result: { revision: 1, publishedRevision: null } });
    expect(await getPublicInvitationGallery(db, "sample-garden")).toEqual({
      gallery: null,
      revision: null,
      publishedAt: null
    });
    expect(await isPublishedGalleryAsset(db, "sample-garden", gallery.photos[0].assetId!)).toBe(false);

    expect(await publishInvitationGallery(db, {
      invitationId: "sample-garden",
      expectedRevision: 1,
      historyId: "gallery_publish_1",
      now: "2026-07-22T03:01:00.000Z"
    })).toMatchObject({ ok: true, result: { publishedRevision: 1 } });
    expect((await getPublicInvitationGallery(db, "sample-garden"))?.gallery).toEqual(gallery);
    expect(await isPublishedGalleryAsset(db, "sample-garden", gallery.photos[0].assetId!)).toBe(true);
    expect(await isPublishedGalleryAsset(db, "sample-garden", crypto.randomUUID())).toBe(false);
  });

  it("낙관적 잠금과 이전 버전 복구를 적용한다", async () => {
    const db = testDb();
    const first = completeGallery();
    await saveInvitationGalleryDraft(db, { invitationId: "sample-garden", gallery: first, expectedRevision: 0, historyId: "gallery_save_1", now: "2026-07-22T03:00:00.000Z" });
    const second = completeGallery();
    second.photos[0].caption = "두 번째 초안";
    await saveInvitationGalleryDraft(db, { invitationId: "sample-garden", gallery: second, expectedRevision: 1, historyId: "gallery_save_2", now: "2026-07-22T03:01:00.000Z" });
    expect(await saveInvitationGalleryDraft(db, { invitationId: "sample-garden", gallery: second, expectedRevision: 1, historyId: "gallery_conflict", now: "2026-07-22T03:02:00.000Z" }))
      .toEqual({ ok: false, reason: "conflict" });

    expect(await restoreInvitationGalleryVersion(db, {
      invitationId: "sample-garden",
      versionId: "gallery_save_1",
      expectedRevision: 2,
      historyId: "gallery_restore_3",
      now: "2026-07-22T03:03:00.000Z"
    })).toMatchObject({ ok: true, result: { revision: 3 } });
    expect((await getAdminInvitationGallery(db, "sample-garden"))?.draft?.photos[0].caption)
      .toBe(first.photos[0].caption);
  });
});
