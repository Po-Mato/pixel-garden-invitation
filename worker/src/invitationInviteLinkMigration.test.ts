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

describe("invitation invite link migration", () => {
  it("stores only hashed bearer tokens and enforces recipient constraints", () => {
    const database = new DatabaseSync(":memory:");
    try {
      database.exec(readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8"));
      database.exec(readFileSync(new URL("../migrations/0013_invitation_invite_links.sql", import.meta.url), "utf8"));
      database.exec(`
        INSERT INTO invitation_invite_links (
          id, invitation_id, token_hash, guest_name, side, group_label, created_at, updated_at
        ) VALUES (
          'invite_one', 'sample-garden', '${"A".repeat(43)}', '김하객', 'bride', '대학 친구',
          '2026-07-22T00:00:00.000Z', '2026-07-22T00:00:00.000Z'
        )
      `);
      expect(database.prepare("SELECT guest_name, token_hash, active, open_count FROM invitation_invite_links").get())
        .toEqual({ guest_name: "김하객", token_hash: "A".repeat(43), active: 1, open_count: 0 });
      expect(() => database.exec(`
        INSERT INTO invitation_invite_links (
          id, invitation_id, token_hash, guest_name, side, created_at, updated_at
        ) VALUES ('invite_bad', 'sample-garden', '${"B".repeat(43)}', '', 'both', 'now', 'now')
      `)).toThrow(/CHECK constraint failed/);
    } finally {
      database.close();
    }
  });
});
