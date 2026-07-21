import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...parameters: unknown[]): unknown;
    run(...parameters: unknown[]): unknown;
  };
  close(): void;
};

type SqliteDatabaseConstructor = new (path: string) => SqliteDatabase;

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: SqliteDatabaseConstructor;
};

const migrationFiles = [
  "0001_init.sql",
  "0002_update_invitation_details.sql",
  "0003_production_rsvp.sql",
  "0004_rsvp_consent_policy.sql",
  "0005_production_guestbook.sql"
] as const;

const expectedInvitation = {
  id: "sample-garden",
  slug: "sample-garden",
  title: "이승재 & 이건희의 정원",
  wedding_date: "2027-05-01",
  venue_name: "MJ컨벤션 5층 파티오볼룸",
  venue_address: "경기 부천시 소사구 경인로 386",
  config_json: JSON.stringify({ rsvp: { consentVersion: "2026-07-20" } })
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
        rsvp_delete_at: "2027-05-31T14:59:59.000Z",
        guestbook_delete_at: "2027-05-31T14:59:59.000Z"
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
        config_json: "{}",
        created_at: expect.any(String)
      });
    } finally {
      database.close();
    }
  });

  it("adds the RSVP consent policy without replacing existing config keys", () => {
    const database = new DatabaseSync(":memory:");

    try {
      for (const filename of migrationFiles.slice(0, 3)) {
        database.exec(readMigration(filename));
      }
      database.exec(`
        UPDATE invitations
        SET config_json = '{"theme":"garden","rsvp":{"collectPhone":true}}'
        WHERE id = 'sample-garden'
      `);

      database.exec(readMigration("0004_rsvp_consent_policy.sql"));

      const invitation = querySampleGarden(database);
      expect(JSON.parse(invitation?.config_json as string)).toEqual({
        theme: "garden",
        rsvp: { collectPhone: true, consentVersion: "2026-07-20" }
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
        INSERT INTO rsvps (id, invitation_id, guest_name, attendance, party_size, note, created_at)
        VALUES ('rsvp_old', 'sample-garden', '기존 하객', 'yes', 2, '기존 응답', '2025-01-02T03:04:05.000Z')
      `);
      database.exec(readMigration("0003_production_rsvp.sql"));

      expect(database.prepare(`
        SELECT id, invitation_id, side, guest_name, phone, attendance, party_size,
               meal_status, note, consent_version, consented_at, edit_token_hash,
               revision, created_at, updated_at
        FROM rsvps WHERE id = ?
      `).get("rsvp_old")).toEqual({
        id: "rsvp_old",
        invitation_id: "sample-garden",
        side: "legacy",
        guest_name: "기존 하객",
        phone: null,
        attendance: "yes",
        party_size: 2,
        meal_status: "unsure",
        note: "기존 응답",
        consent_version: null,
        consented_at: null,
        edit_token_hash: null,
        revision: 1,
        created_at: "2025-01-02T03:04:05.000Z",
        updated_at: "2025-01-02T03:04:05.000Z"
      });

      expect(querySampleGarden(database)).toMatchObject({
        rsvp_deadline: "2027-04-24T14:59:59.000Z",
        rsvp_delete_at: "2027-05-31T14:59:59.000Z"
      });

      expect(() => database.exec(`
        INSERT INTO rsvps (id, invitation_id, side, guest_name, phone, attendance, party_size, meal_status, note, consent_version, consented_at, edit_token_hash)
        VALUES ('rsvp_absent', 'sample-garden', 'groom', '불참 하객', '01012345678', 'no', 0, 'not_applicable', '', '2026-07-20', '2027-04-20T00:00:00.000Z', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
      `)).not.toThrow();

      expect(() => database.exec(`
        INSERT INTO rsvps (id, invitation_id, side, guest_name, phone, attendance, party_size, meal_status, note, consent_version, consented_at, edit_token_hash)
        VALUES ('rsvp_attending_zero', 'sample-garden', 'groom', '참석 하객', '01012345678', 'yes', 0, 'yes', '', '2026-07-20', '2027-04-20T00:00:00.000Z', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
      `)).toThrow(/CHECK constraint failed/);

      expect(() => database.exec(`
        INSERT INTO rsvps (id, invitation_id, side, guest_name, phone, attendance, party_size, meal_status, note, consent_version, consented_at, edit_token_hash)
        VALUES ('rsvp_absent_meal', 'sample-garden', 'bride', '불참 하객', '01012345678', 'no', 0, 'yes', '', '2026-07-20', '2027-04-20T00:00:00.000Z', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
      `)).toThrow(/CHECK constraint failed/);

      expect(() => database.exec(`
        INSERT INTO rsvps (id, invitation_id, side, guest_name, attendance, party_size, meal_status, note)
        VALUES ('rsvp_legacy_old_shape', 'sample-garden', 'legacy', '기존 불참 하객', 'no', 10, 'unsure', '')
      `)).not.toThrow();

      expect(() => database.exec(`
        INSERT INTO rsvps (id, invitation_id, side, guest_name, phone, attendance, party_size, meal_status, note)
        VALUES ('rsvp_legacy_phone', 'sample-garden', 'legacy', '변조된 기존 하객', '010-0000-0000', 'yes', 2, 'unsure', '')
      `)).toThrow(/CHECK constraint failed/);

      expect(() => database.exec(`
        INSERT INTO rsvps (id, invitation_id, side, guest_name, attendance, party_size, meal_status, note, consent_version)
        VALUES ('rsvp_legacy_consent', 'sample-garden', 'legacy', '변조된 기존 하객', 'yes', 2, 'unsure', '', 'v1')
      `)).toThrow(/CHECK constraint failed/);

      expect(() => database.exec(`
        INSERT INTO rsvps (id, invitation_id, side, guest_name, attendance, party_size, meal_status, note, consented_at)
        VALUES ('rsvp_legacy_consented_at', 'sample-garden', 'legacy', '변조된 기존 하객', 'yes', 2, 'unsure', '', '2025-01-01T00:00:00.000Z')
      `)).toThrow(/CHECK constraint failed/);

      expect(() => database.exec(`
        INSERT INTO rsvps (id, invitation_id, side, guest_name, attendance, party_size, meal_status, note, edit_token_hash)
        VALUES ('rsvp_legacy_token', 'sample-garden', 'legacy', '변조된 기존 하객', 'yes', 2, 'unsure', '', 'hash')
      `)).toThrow(/CHECK constraint failed/);

      expect(() => database.exec(`
        INSERT INTO rsvps (id, invitation_id, side, guest_name, attendance, party_size, meal_status, note)
        VALUES ('rsvp_legacy_meal', 'sample-garden', 'legacy', '변조된 기존 하객', 'yes', 2, 'yes', '')
      `)).toThrow(/CHECK constraint failed/);

      expect(() => database.exec(`
        INSERT INTO rsvps (id, invitation_id, side, guest_name, attendance, party_size, meal_status, note, revision)
        VALUES ('rsvp_legacy_revision', 'sample-garden', 'legacy', '변조된 기존 하객', 'yes', 2, 'unsure', '', 2)
      `)).toThrow(/CHECK constraint failed/);

      expect(() => database.exec(`
        INSERT INTO rsvps (id, invitation_id, side, guest_name, phone, attendance, party_size, meal_status, note, consent_version, consented_at, edit_token_hash)
        VALUES ('rsvp_attending_integer', 'sample-garden', 'groom', '참석 하객', '01012345678', 'yes', 1, 'yes', '', '2026-07-20', '2027-04-20T00:00:00.000Z', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
      `)).not.toThrow();

      expect(() => database.exec(`
        INSERT INTO rsvps (id, invitation_id, side, guest_name, phone, attendance, party_size, meal_status, note, consent_version, consented_at, edit_token_hash)
        VALUES ('rsvp_attending_fraction', 'sample-garden', 'groom', '참석 하객', '01012345678', 'yes', 1.5, 'yes', '', '2026-07-20', '2027-04-20T00:00:00.000Z', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
      `)).toThrow(/CHECK constraint failed/);
    } finally {
      database.close();
    }
  });

  it("requires canonical ownership and consent fields for every new RSVP", () => {
    const database = new DatabaseSync(":memory:");
    const validHash = "A".repeat(43);

    try {
      for (const filename of migrationFiles.slice(0, 3)) {
        database.exec(readMigration(filename));
      }

      const insert = database.prepare(`
        INSERT INTO rsvps (
          id, invitation_id, side, guest_name, phone, attendance, party_size,
          meal_status, note, consent_version, consented_at, edit_token_hash
        ) VALUES (?, 'sample-garden', 'groom', '신규 하객', ?, 'yes', 1, 'yes', '', ?, ?, ?)
      `);
      const insertValues = (
        id: string,
        phone: string | null = "01012345678",
        consentVersion: string | null = "2026-07-20",
        consentedAt: string | null = "2027-04-20T00:00:00.000Z",
        editTokenHash: string | null = validHash
      ) => insert.run(id, phone, consentVersion, consentedAt, editTokenHash);

      expect(() => insertValues("rsvp_canonical")).not.toThrow();

      for (const [label, phone] of [
        ["missing", null],
        ["empty", ""],
        ["short", "1234567"],
        ["long", "1".repeat(16)],
        ["formatted", "010-1234-5678"],
        ["letters", "0101234abcd"]
      ] as const) {
        expect(() => insertValues(`rsvp_phone_${label}`, phone)).toThrow(/CHECK constraint failed/);
      }

      for (const [label, consentVersion] of [["missing", null], ["empty", ""], ["blank", "   "]] as const) {
        expect(() => insertValues(`rsvp_consent_version_${label}`, undefined, consentVersion)).toThrow(/CHECK constraint failed/);
      }

      for (const [label, consentedAt] of [["missing", null], ["empty", ""], ["blank", "   "]] as const) {
        expect(() => insertValues(`rsvp_consented_at_${label}`, undefined, undefined, consentedAt)).toThrow(/CHECK constraint failed/);
      }

      for (const [label, hash] of [
        ["missing", null],
        ["empty", ""],
        ["short", "A".repeat(42)],
        ["long", "A".repeat(44)],
        ["padding", `${"A".repeat(42)}=`],
        ["invalid", `${"A".repeat(42)}+`]
      ] as const) {
        expect(() => insertValues(`rsvp_hash_${label}`, undefined, undefined, undefined, hash)).toThrow(/CHECK constraint failed/);
      }
    } finally {
      database.close();
    }
  });

  it("기존 방명록을 보존하고 신규 메시지의 소유권 필드를 강제한다", () => {
    const database = new DatabaseSync(":memory:");
    const validHash = "A".repeat(43);

    try {
      for (const filename of migrationFiles.slice(0, 4)) {
        database.exec(readMigration(filename));
      }
      database.exec(`
        INSERT INTO guestbook_messages (id, invitation_id, nickname, message, is_hidden, created_at)
        VALUES ('guestbook_old', 'sample-garden', '기존 하객', '기존 축하', 1, '2026-07-01T00:00:00.000Z')
      `);

      database.exec(readMigration("0005_production_guestbook.sql"));

      expect(database.prepare(`
        SELECT id, invitation_id, nickname, message, is_hidden, client_hash,
               edit_token_hash, revision, created_at, updated_at
        FROM guestbook_messages WHERE id = ?
      `).get("guestbook_old")).toEqual({
        id: "guestbook_old",
        invitation_id: "sample-garden",
        nickname: "기존 하객",
        message: "기존 축하",
        is_hidden: 1,
        client_hash: null,
        edit_token_hash: null,
        revision: 1,
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z"
      });
      expect(querySampleGarden(database)).toMatchObject({
        guestbook_delete_at: "2027-05-31T14:59:59.000Z"
      });

      expect(() => database.exec(`
        INSERT INTO guestbook_messages (
          id, invitation_id, nickname, message, client_hash, edit_token_hash,
          created_at, updated_at
        ) VALUES (
          'guestbook_new', 'sample-garden', '신규 하객', '새 축하',
          '${validHash}', '${validHash}', '2026-07-02T00:00:00.000Z', '2026-07-02T00:00:00.000Z'
        )
      `)).not.toThrow();

      expect(() => database.exec(`
        INSERT INTO guestbook_messages (id, invitation_id, nickname, message, client_hash)
        VALUES ('guestbook_partial_owner', 'sample-garden', '하객', '축하', '${validHash}')
      `)).toThrow(/CHECK constraint failed/);

      expect(() => database.exec(`
        INSERT INTO guestbook_messages (id, invitation_id, nickname, message, client_hash, edit_token_hash)
        VALUES ('guestbook_bad_hash', 'sample-garden', '하객', '축하', 'short', 'short')
      `)).toThrow(/CHECK constraint failed/);

      expect(() => database.exec(`
        INSERT INTO guestbook_messages (id, invitation_id, nickname, message, is_hidden)
        VALUES ('guestbook_bad_hidden', 'sample-garden', '하객', '축하', 2)
      `)).toThrow(/CHECK constraint failed/);
    } finally {
      database.close();
    }
  });
});
