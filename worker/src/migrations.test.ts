import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): { get(...parameters: string[]): unknown };
  close(): void;
};

type SqliteDatabaseConstructor = new (path: string) => SqliteDatabase;

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: SqliteDatabaseConstructor;
};

const migrationFiles = ["0001_init.sql", "0002_update_invitation_details.sql", "0003_production_rsvp.sql"] as const;

const expectedInvitation = {
  id: "sample-garden",
  slug: "sample-garden",
  title: "이승재 & 이건희의 정원",
  wedding_date: "2027-05-01",
  venue_name: "MJ컨벤션 5층 파티오볼룸",
  venue_address: "경기 부천시 소사구 경인로 386",
  config_json: "{}"
};

function readMigration(filename: typeof migrationFiles[number]): string {
  return readFileSync(new URL(`../migrations/${filename}`, import.meta.url), "utf8");
}

function querySampleGarden(database: SqliteDatabase) {
  return database.prepare("SELECT * FROM invitations WHERE id = ?").get("sample-garden") as Record<string, unknown> | undefined;
}

describe("invitation migrations", () => {
  it("applies every migration and seeds the complete confirmed sample-garden row", () => {
    const database = new DatabaseSync(":memory:");

    try {
      for (const filename of migrationFiles) {
        database.exec(readMigration(filename));
      }

      expect(querySampleGarden(database)).toMatchObject({
        ...expectedInvitation,
        created_at: expect.any(String),
        rsvp_deadline: "2027-04-24T14:59:59.000Z",
        rsvp_delete_at: "2027-05-31T14:59:59.000Z"
      });
    } finally {
      database.close();
    }
  });

  it("maps every confirmed field when 0002 updates an existing sample-garden row", () => {
    const database = new DatabaseSync(":memory:");

    try {
      database.exec(readMigration("0001_init.sql"));
      database.exec(`
        UPDATE invitations
        SET title = 'stale title', wedding_date = '2000-01-01', venue_name = 'stale venue', venue_address = 'stale address'
        WHERE id = 'sample-garden'
      `);
      database.exec(readMigration("0002_update_invitation_details.sql"));

      expect(querySampleGarden(database)).toEqual({
        ...expectedInvitation,
        created_at: expect.any(String)
      });
    } finally {
      database.close();
    }
  });

  it("preserves legacy RSVPs and enforces attendance-specific RSVP constraints", () => {
    const database = new DatabaseSync(":memory:");

    try {
      database.exec(readMigration("0001_init.sql"));
      database.exec(readMigration("0002_update_invitation_details.sql"));
      database.exec(`
        INSERT INTO rsvps (id, invitation_id, guest_name, attendance, party_size, note)
        VALUES ('rsvp_old', 'sample-garden', '기존 하객', 'yes', 2, '기존 응답')
      `);
      database.exec(readMigration("0003_production_rsvp.sql"));

      expect(database.prepare("SELECT side, phone, meal_status, revision FROM rsvps WHERE id = ?").get("rsvp_old")).toEqual({
        side: "legacy",
        phone: null,
        meal_status: "unsure",
        revision: 1
      });

      expect(querySampleGarden(database)).toMatchObject({
        rsvp_deadline: "2027-04-24T14:59:59.000Z",
        rsvp_delete_at: "2027-05-31T14:59:59.000Z"
      });

      expect(() => database.exec(`
        INSERT INTO rsvps (id, invitation_id, side, guest_name, attendance, party_size, meal_status, note)
        VALUES ('rsvp_absent', 'sample-garden', 'groom', '불참 하객', 'no', 0, 'not_applicable', '')
      `)).not.toThrow();

      expect(() => database.exec(`
        INSERT INTO rsvps (id, invitation_id, side, guest_name, attendance, party_size, meal_status, note)
        VALUES ('rsvp_attending_zero', 'sample-garden', 'groom', '참석 하객', 'yes', 0, 'yes', '')
      `)).toThrow(/CHECK constraint failed/);

      expect(() => database.exec(`
        INSERT INTO rsvps (id, invitation_id, side, guest_name, attendance, party_size, meal_status, note)
        VALUES ('rsvp_absent_meal', 'sample-garden', 'bride', '불참 하객', 'no', 0, 'yes', '')
      `)).toThrow(/CHECK constraint failed/);
    } finally {
      database.close();
    }
  });
});
