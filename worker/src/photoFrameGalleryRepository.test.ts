import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import {
  createPhotoFrameGallerySubmission,
  listAdminPhotoFrameGallery,
  listApprovedPhotoFrameGallery,
  moderatePhotoFrameGallerySubmission
} from "./photoFrameGalleryRepository";

type Statement = { get(...values: unknown[]): unknown; all(...values: unknown[]): unknown[]; run(...values: unknown[]): unknown };
type Database = { exec(sql: string): void; prepare(sql: string): Statement; close(): void };
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (path: string) => Database };

function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON; CREATE TABLE invitations (id TEXT PRIMARY KEY); INSERT INTO invitations VALUES ('sample-garden');");
  sqlite.exec(readFileSync(new URL("../migrations/0021_game_transfer_and_device_qa_detail.sql", import.meta.url), "utf8"));
  sqlite.exec(readFileSync(new URL("../migrations/0022_live_transfer_and_photo_frame_gallery.sql", import.meta.url), "utf8"));
  const db = {
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        first: async <T>() => (sqlite.prepare(sql).get(...values) ?? null) as T | null,
        all: async <T>() => ({ results: sqlite.prepare(sql).all(...values) as T[] }),
        run: async () => sqlite.prepare(sql).run(...values)
      })
    })
  } as unknown as D1Database;
  return { sqlite, db };
}

const design = {
  label: "정원 리본",
  photoTransform: { zoom: 1.2, offsetX: 0, offsetY: -0.2, rotation: 2 },
  stickerText: "오래 행복하세요",
  stickerStyle: { tone: "rose" as const, font: "hand" as const },
  stickerTransform: { x: 0.6, y: 0.3, scale: 1.1, rotation: -4 }
};

describe("photoFrameGalleryRepository", () => {
  it("하객 제출본은 승인 전까지 공개하지 않고 관리자 승인 뒤 공동 갤러리에 표시한다", async () => {
    const { sqlite, db } = database();
    try {
      const created = await createPhotoFrameGallerySubmission(db, {
        invitationId: "sample-garden",
        clientHash: "h".repeat(43),
        contributorName: "정원하객",
        design
      }, new Date("2026-07-31T01:00:00.000Z"));
      if (typeof created === "string") throw new Error(created);
      expect(created.status).toBe("pending");
      expect(await listApprovedPhotoFrameGallery(db, "sample-garden")).toEqual([]);
      expect(await listAdminPhotoFrameGallery(db, "sample-garden")).toMatchObject({
        counts: { pending: 1, approved: 0, rejected: 0 },
        items: [{ id: created.id, contributorName: "정원하객", status: "pending" }]
      });

      await moderatePhotoFrameGallerySubmission(db, {
        invitationId: "sample-garden",
        submissionId: created.id,
        status: "approved"
      }, new Date("2026-07-31T01:05:00.000Z"));
      expect(await listApprovedPhotoFrameGallery(db, "sample-garden")).toMatchObject([
        { id: created.id, status: "approved", design: { label: "정원 리본" } }
      ]);
    } finally {
      sqlite.close();
    }
  });
});
