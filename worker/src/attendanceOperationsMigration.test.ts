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

describe("attendance operations migration", () => {
  it("adds safe defaults and bounded child and follow-up fields", () => {
    const database = new DatabaseSync(":memory:");
    try {
      database.exec(readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8"));
      database.exec(readFileSync(new URL("../migrations/0013_invitation_invite_links.sql", import.meta.url), "utf8"));
      database.exec(readFileSync(new URL("../migrations/0014_invitation_invite_delivery_history.sql", import.meta.url), "utf8"));
      database.exec(`
        INSERT INTO rsvps (id, invitation_id, guest_name, attendance, party_size, note, created_at)
        VALUES ('rsvp_existing', 'sample-garden', '기존 하객', 'yes', 2, '', 'now');
        INSERT INTO invitation_invite_links (
          id, invitation_id, token_hash, guest_name, side, group_label, created_at, updated_at
        ) VALUES ('invite_existing', 'sample-garden', '${"A".repeat(43)}', '기존 하객', 'bride', '', 'now', 'now');
      `);
      database.exec(readFileSync(new URL("../migrations/0015_attendance_operations.sql", import.meta.url), "utf8"));

      expect(database.prepare("SELECT child_count FROM rsvps WHERE id = 'rsvp_existing'").get())
        .toEqual({ child_count: 0 });
      expect(database.prepare("SELECT follow_up_completed_at FROM invitation_invite_links WHERE id = 'invite_existing'").get())
        .toEqual({ follow_up_completed_at: null });
      expect(() => database.exec("UPDATE rsvps SET child_count = 3 WHERE id = 'rsvp_existing'"))
        .toThrow(/CHECK constraint failed/);
    } finally {
      database.close();
    }
  });
});
