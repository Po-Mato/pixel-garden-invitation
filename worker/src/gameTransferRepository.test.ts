import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { claimGameTransfer, createGameTransfer, loadGameTransfer, reportGameTransferProgress, revokeGameTransfer } from "./gameTransferRepository";

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

describe("gameTransferRepository", () => {
  it("수신 토큰은 한 번만 사용하고 관리 토큰과 권한을 분리한다", async () => {
    const { sqlite, db } = database();
    try {
      const now = new Date("2026-07-30T10:00:00.000Z");
      const created = await createGameTransfer(db, {
        invitationId: "sample-garden",
        clientHash: "h".repeat(43),
        entryCount: 5,
        expiresAt: "2026-07-30T10:15:00.000Z"
      }, now);
      expect(created).not.toBe("not_found");
      expect(created).not.toBe("rate_limited");
      if (typeof created === "string") return;
      expect((await loadGameTransfer(db, "sample-garden", created.id, created.claimToken, now))?.status).toBe("active");
      expect((await reportGameTransferProgress(db, "sample-garden", created.id, created.claimToken, "opened", now))?.state)
        .toMatchObject({ receiverPhase: "opened", receiverSeenAt: now.toISOString() });
      expect((await reportGameTransferProgress(db, "sample-garden", created.id, created.claimToken, "previewing", new Date(now.getTime() + 1_000)))?.state.receiverPhase)
        .toBe("previewing");
      expect((await reportGameTransferProgress(db, "sample-garden", created.id, created.claimToken, "opened", new Date(now.getTime() + 2_000)))?.state.receiverPhase)
        .toBe("previewing");
      expect((await claimGameTransfer(db, "sample-garden", created.id, created.claimToken, now))?.changed).toBe(true);
      expect((await claimGameTransfer(db, "sample-garden", created.id, created.claimToken, now))?.changed).toBe(false);
      expect((await revokeGameTransfer(db, "sample-garden", created.id, created.manageToken, now))?.changed).toBe(false);
    } finally {
      sqlite.close();
    }
  });

  it("15분이 지난 전송을 만료 상태로 읽고 수신하지 않는다", async () => {
    const { sqlite, db } = database();
    try {
      const created = await createGameTransfer(db, {
        invitationId: "sample-garden",
        clientHash: "x".repeat(43),
        entryCount: 2,
        expiresAt: "2026-07-30T10:15:00.000Z"
      }, new Date("2026-07-30T10:00:00.000Z"));
      if (typeof created === "string") throw new Error(created);
      const late = new Date("2026-07-30T10:16:00.000Z");
      expect((await loadGameTransfer(db, "sample-garden", created.id, created.claimToken, late))?.status).toBe("expired");
      expect((await claimGameTransfer(db, "sample-garden", created.id, created.claimToken, late))?.changed).toBe(false);
    } finally {
      sqlite.close();
    }
  });
});
