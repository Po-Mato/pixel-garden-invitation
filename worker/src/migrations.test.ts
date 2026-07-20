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

const migrationFiles = ["0001_init.sql", "0002_update_invitation_details.sql"] as const;

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

      expect(querySampleGarden(database)).toEqual({
        ...expectedInvitation,
        created_at: expect.any(String)
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
});
