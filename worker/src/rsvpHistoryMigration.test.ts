import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...values: unknown[]): unknown[];
    get(...values: unknown[]): unknown;
  };
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
  "0013_invitation_invite_links.sql",
  "0014_invitation_invite_delivery_history.sql",
  "0015_attendance_operations.sql"
] as const;

function migration(filename: string): string {
  return readFileSync(new URL(`../migrations/${filename}`, import.meta.url), "utf8");
}

function insertRsvp(database: SqliteDatabase, id: string, createdAt: string) {
  database.exec(`
    INSERT INTO rsvps (
      id, invitation_id, side, guest_name, phone, attendance, party_size, child_count,
      meal_status, note, consent_version, consented_at, edit_token_hash, created_at, updated_at
    ) VALUES (
      '${id}', 'sample-garden', 'bride', '김하객', '01012345678', 'yes', 2, 1,
      'yes', '', '2026-07-20', '${createdAt}', '${"A".repeat(43)}', '${createdAt}', '${createdAt}'
    )
  `);
}

describe("RSVP revision history migration", () => {
  it("기존 상태를 보존하고 이후 생성·수정을 자동 기록하며 원본 삭제 시 함께 제거한다", () => {
    const database = new DatabaseSync(":memory:");
    try {
      database.exec("PRAGMA foreign_keys = ON");
      for (const filename of migrations) database.exec(migration(filename));
      insertRsvp(database, "rsvp_existing", "2027-04-01T00:00:00.000Z");
      database.exec(migration("0018_rsvp_revision_history.sql"));

      expect(database.prepare(`
        SELECT action, revision FROM rsvp_revision_history WHERE rsvp_id = ?
      `).get("rsvp_existing")).toEqual({ action: "snapshot", revision: 1 });

      insertRsvp(database, "rsvp_new", "2027-04-02T00:00:00.000Z");
      database.exec(`
        UPDATE rsvps
        SET note = '휠체어 좌석 요청', revision = 2, updated_at = '2027-04-03T00:00:00.000Z'
        WHERE id = 'rsvp_new'
      `);
      const history = database.prepare(`
        SELECT action, revision, snapshot_json FROM rsvp_revision_history
        WHERE rsvp_id = ? ORDER BY revision
      `).all("rsvp_new") as Array<{ action: string; revision: number; snapshot_json: string }>;
      expect(history.map(({ action, revision }) => ({ action, revision }))).toEqual([
        { action: "created", revision: 1 },
        { action: "updated", revision: 2 }
      ]);
      expect(JSON.parse(history[1].snapshot_json)).toMatchObject({
        id: "rsvp_new",
        note: "휠체어 좌석 요청",
        childCount: 1,
        revision: 2
      });

      database.exec("DELETE FROM rsvps WHERE id = 'rsvp_new'");
      expect(database.prepare("SELECT COUNT(*) AS count FROM rsvp_revision_history WHERE rsvp_id = ?").get("rsvp_new"))
        .toEqual({ count: 0 });
    } finally {
      database.close();
    }
  });
});
