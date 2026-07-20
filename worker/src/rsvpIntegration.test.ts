import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import { handleApiRequest } from "./http";
import type { Env } from "./index";

type SqliteStatement = {
  all(...parameters: unknown[]): unknown[];
  get(...parameters: unknown[]): unknown;
  run(...parameters: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
};

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
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
  "0004_rsvp_consent_policy.sql"
] as const;

function applyMigrations(database: SqliteDatabase): void {
  for (const filename of migrationFiles) {
    database.exec(readFileSync(new URL(`../migrations/${filename}`, import.meta.url), "utf8"));
  }
}

function createD1Adapter(database: SqliteDatabase): D1Database {
  return {
    prepare(sql: string) {
      const statement = database.prepare(sql);
      return {
        bind(...values: unknown[]) {
          return {
            first: async <T>() => (statement.get(...values) ?? null) as T | null,
            all: async <T>() => ({ results: statement.all(...values) as T[] }),
            run: async () => {
              const result = statement.run(...values);
              return { success: true, meta: { changes: Number(result.changes) } };
            }
          } as unknown as D1PreparedStatement;
        }
      } as D1PreparedStatement;
    }
  } as D1Database;
}

const submission = {
  side: "groom",
  guestName: "이승재",
  phone: "010-1234-5678",
  attendance: "yes",
  partySize: 2,
  mealStatus: "yes",
  note: "통합 테스트",
  consentVersion: "2026-07-20"
};

describe("RSVP API with migrated SQLite through a D1 adapter", () => {
  it("creates and updates an RSVP with the migrated policy and ISO timestamps", async () => {
    const database = new DatabaseSync(":memory:");

    try {
      database.exec("PRAGMA foreign_keys = ON");
      applyMigrations(database);
      const env = { DB: createD1Adapter(database) } as Env;

      const createResponse = await handleApiRequest(new Request(
        "https://worker.test/api/invitations/sample-garden/rsvps",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(submission)
        }
      ), env, "sqlite-integration-create");
      const created = await createResponse.json() as {
        response: { id: string; revision: number; createdAt: string; updatedAt: string };
        credential: { rsvpId: string; editToken: string };
      };

      expect(createResponse.status).toBe(201);
      expect(created.response.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(created.response.updatedAt).toBe(created.response.createdAt);
      expect(database.prepare("SELECT created_at, updated_at FROM rsvps WHERE id = ?").get(created.response.id)).toEqual({
        created_at: created.response.createdAt,
        updated_at: created.response.updatedAt
      });

      const updateResponse = await handleApiRequest(new Request(
        `https://worker.test/api/invitations/sample-garden/rsvps/${created.credential.rsvpId}`,
        {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${created.credential.editToken}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({ ...submission, side: "bride", revision: created.response.revision })
        }
      ), env, "sqlite-integration-update");
      const updated = await updateResponse.json() as { revision: number; updatedAt: string };

      expect(updateResponse.status).toBe(200);
      expect(updated.revision).toBe(2);
      expect(updated.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    } finally {
      database.close();
    }
  });
});
