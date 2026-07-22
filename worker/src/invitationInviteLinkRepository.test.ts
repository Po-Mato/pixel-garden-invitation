import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createInvitationInviteLinks,
  deleteInvitationInviteLink,
  listInvitationInviteLinks,
  markInvitationInviteLinkResponded,
  openInvitationInviteLink,
  recordInvitationInviteLinkDeliveries,
  rotateInvitationInviteLink,
  updateInvitationInviteLink
} from "./invitationInviteLinkRepository";

type SqliteStatement = {
  all(...values: unknown[]): unknown[];
  get(...values: unknown[]): unknown;
  run(...values: unknown[]): { changes: number | bigint };
};

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
};

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => SqliteDatabase;
};

function d1(database: SqliteDatabase): D1Database {
  const prepare = (sql: string) => ({
    bind: (...values: unknown[]) => ({
      first: async <T>() => (database.prepare(sql).get(...values) ?? null) as T | null,
      all: async <T>() => ({ results: database.prepare(sql).all(...values) as T[] }),
      run: async () => {
        const result = database.prepare(sql).run(...values);
        return { success: true, meta: { changes: Number(result.changes) } };
      }
    })
  }) as unknown as D1PreparedStatement;
  return {
    prepare,
    batch: async (statements: D1PreparedStatement[]) => Promise.all(statements.map((statement) => statement.run()))
  } as unknown as D1Database;
}

function setup(): { database: SqliteDatabase; db: D1Database } {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  database.exec(readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8"));
  database.exec(readFileSync(new URL("../migrations/0013_invitation_invite_links.sql", import.meta.url), "utf8"));
  database.exec(readFileSync(new URL("../migrations/0014_invitation_invite_delivery_history.sql", import.meta.url), "utf8"));
  return { database, db: d1(database) };
}

describe("invitation invite link repository", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates, opens, updates, responds, rotates and deletes invite links", async () => {
    const { database, db } = setup();
    const now = new Date("2026-07-22T00:00:00.000Z");
    try {
      vi.spyOn(crypto, "randomUUID")
        .mockReturnValueOnce("00000000-0000-4000-8000-000000000001")
        .mockReturnValueOnce("00000000-0000-4000-8000-000000000002");
      const created = await createInvitationInviteLinks(db, "sample-garden", [
        { guestName: "김하객", side: "bride", groupLabel: "대학 친구" },
        { guestName: "이하객", side: "groom", groupLabel: "직장" }
      ], now);
      expect(created).toHaveLength(2);
      expect(created?.[0].token).not.toBe(created?.[1].token);
      expect(database.prepare("SELECT token_hash FROM invitation_invite_links WHERE id = ?")
        .get(created![0].link.id)).not.toEqual({ token_hash: created![0].token });

      expect(await listInvitationInviteLinks(db, "sample-garden")).toMatchObject({
        summary: { total: 2, active: 2, delivered: 0, opened: 0, responded: 0 }
      });

      await expect(recordInvitationInviteLinkDeliveries(db, "sample-garden", {
        linkIds: created!.map(({ link }) => link.id),
        channel: "kakao",
        note: "친구 단체방"
      }, now)).resolves.toBe(true);
      await expect(recordInvitationInviteLinkDeliveries(db, "sample-garden", {
        linkIds: [created![0].link.id],
        channel: "sms",
        note: "개별 재발송"
      }, new Date(now.getTime() + 2_000))).resolves.toBe(true);
      const deliveryLinks = (await listInvitationInviteLinks(db, "sample-garden"))!.links;
      expect(deliveryLinks.find(({ id }) => id === created![0].link.id)).toMatchObject({
        deliveryChannel: "sms",
        sendCount: 2,
        firstSentAt: now.toISOString(),
        lastSentAt: new Date(now.getTime() + 2_000).toISOString(),
        deliveryNote: "개별 재발송"
      });
      expect((await listInvitationInviteLinks(db, "sample-garden"))?.summary.delivered).toBe(2);
      await expect(recordInvitationInviteLinkDeliveries(db, "sample-garden", {
        linkIds: ["invite_missing"], channel: "other", note: ""
      }, now)).resolves.toBe(false);
      await expect(openInvitationInviteLink(db, "sample-garden", created![0].token, now)).resolves.toEqual({
        guestName: "김하객", side: "bride", groupLabel: "대학 친구"
      });
      await openInvitationInviteLink(db, "sample-garden", created![0].token, new Date(now.getTime() + 1_000));
      expect((await listInvitationInviteLinks(db, "sample-garden"))?.links.find(({ id }) => id === created![0].link.id))
        .toMatchObject({ openCount: 2, firstOpenedAt: now.toISOString() });

      database.exec(`
        INSERT INTO rsvps (id, invitation_id, guest_name, attendance, party_size, note, created_at)
        VALUES ('rsvp_invited', 'sample-garden', '김하객', 'yes', 1, '', '${now.toISOString()}')
      `);
      await expect(markInvitationInviteLinkResponded(
        db, "sample-garden", created![0].token, "rsvp_invited", now
      )).resolves.toBe(true);
      expect((await listInvitationInviteLinks(db, "sample-garden"))?.summary.responded).toBe(1);

      await expect(updateInvitationInviteLink(db, "sample-garden", created![0].link.id, {
        groupLabel: "친구",
        active: false
      }, now)).resolves.toMatchObject({ groupLabel: "친구", active: false });
      await expect(openInvitationInviteLink(db, "sample-garden", created![0].token, now)).resolves.toBeNull();

      const rotated = await rotateInvitationInviteLink(db, "sample-garden", created![0].link.id, now);
      expect(rotated?.token).not.toBe(created![0].token);
      expect(rotated?.link.active).toBe(true);
      await expect(openInvitationInviteLink(db, "sample-garden", created![0].token, now)).resolves.toBeNull();
      await expect(openInvitationInviteLink(db, "sample-garden", rotated!.token, now)).resolves.toMatchObject({
        guestName: "김하객"
      });

      await expect(deleteInvitationInviteLink(db, "sample-garden", created![1].link.id)).resolves.toBe(true);
      expect((await listInvitationInviteLinks(db, "sample-garden"))?.summary.total).toBe(1);
    } finally {
      database.close();
    }
  });

  it("does not disclose a missing invitation or invalid token", async () => {
    const { database, db } = setup();
    try {
      await expect(listInvitationInviteLinks(db, "missing")).resolves.toBeNull();
      await expect(createInvitationInviteLinks(db, "missing", [
        { guestName: "하객", side: "groom", groupLabel: "" }
      ])).resolves.toBeNull();
      await expect(openInvitationInviteLink(db, "sample-garden", "A".repeat(43))).resolves.toBeNull();
    } finally {
      database.close();
    }
  });
});
