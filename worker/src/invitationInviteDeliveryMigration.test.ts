import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): { get(...values: unknown[]): unknown };
    close(): void;
  };
};

describe("invitation invite delivery migration", () => {
  it("adds bounded delivery history fields to existing invite links", () => {
    const database = new DatabaseSync(":memory:");
    try {
      database.exec(readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8"));
      database.exec(readFileSync(new URL("../migrations/0013_invitation_invite_links.sql", import.meta.url), "utf8"));
      database.exec(`
        INSERT INTO invitation_invite_links (
          id, invitation_id, token_hash, guest_name, side, group_label, created_at, updated_at
        ) VALUES (
          'invite_existing', 'sample-garden', '${"A".repeat(43)}', '기존 하객', 'bride', '', 'now', 'now'
        )
      `);
      database.exec(readFileSync(new URL("../migrations/0014_invitation_invite_delivery_history.sql", import.meta.url), "utf8"));

      expect(database.prepare(`
        SELECT delivery_channel, send_count, first_sent_at, last_sent_at, delivery_note
        FROM invitation_invite_links WHERE id = 'invite_existing'
      `).get()).toEqual({
        delivery_channel: null,
        send_count: 0,
        first_sent_at: null,
        last_sent_at: null,
        delivery_note: ""
      });
      expect(() => database.exec(`
        UPDATE invitation_invite_links SET delivery_channel = 'email' WHERE id = 'invite_existing'
      `)).toThrow(/CHECK constraint failed/);
    } finally {
      database.close();
    }
  });
});
