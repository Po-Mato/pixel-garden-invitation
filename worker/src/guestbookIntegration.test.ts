import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import { handleApiRequest } from "./http";
import type { Env } from "./index";
import { issueAdminToken } from "./security";

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

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => SqliteDatabase;
};

const migrationFiles = [
  "0001_init.sql",
  "0002_update_invitation_details.sql",
  "0003_production_rsvp.sql",
  "0004_rsvp_consent_policy.sql",
  "0005_production_guestbook.sql",
  "0006_admin_notifications.sql"
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

function createEnv(database: SqliteDatabase): Env {
  return {
    DB: createD1Adapter(database),
    RSVP_ADMIN_SESSION_SECRET: "guestbook-admin-session-secret",
    RSVP_CLIENT_KEY_SECRET: "guestbook-client-key-secret",
    RSVP_ALLOWED_ORIGINS: "https://example.test"
  } as Env;
}

function request(path: string, method = "GET", body?: unknown, token?: string): Request {
  return new Request(`https://worker.test/api/invitations/sample-garden${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function createMessage(env: Env, clientKey: string, nickname = "하객", message = "결혼을 축하합니다") {
  const response = await handleApiRequest(
    request("/guestbook", "POST", { nickname, message }),
    env,
    clientKey
  );
  return {
    response,
    body: await response.json() as {
      response: { id: string; revision: number; isHidden: boolean };
      credential: { guestbookId: string; editToken: string };
    }
  };
}

describe("production guestbook API with migrated SQLite", () => {
  it("소유자가 메시지를 생성·수정·삭제하고 잘못된 토큰은 존재 여부를 노출하지 않는다", async () => {
    const database = new DatabaseSync(":memory:");
    try {
      database.exec("PRAGMA foreign_keys = ON");
      applyMigrations(database);
      const env = createEnv(database);
      const created = await createMessage(env, "guestbook-owner-client");

      expect(created.response.status).toBe(201);
      expect(created.body.response).toMatchObject({ revision: 1, isHidden: false });
      expect(created.body.credential.guestbookId).toBe(created.body.response.id);

      const denied = await handleApiRequest(
        request(`/guestbook/${created.body.credential.guestbookId}`, "GET", undefined, "wrong-token"),
        env,
        "guestbook-owner-client"
      );
      expect(denied.status).toBe(401);

      const updated = await handleApiRequest(
        request(
          `/guestbook/${created.body.credential.guestbookId}`,
          "PATCH",
          { nickname: "수정 하객", message: "오래오래 행복하세요", revision: 1 },
          created.body.credential.editToken
        ),
        env,
        "guestbook-owner-client"
      );
      await expect(updated.json()).resolves.toMatchObject({
        nickname: "수정 하객",
        message: "오래오래 행복하세요",
        revision: 2
      });
      expect(database.prepare(`
        SELECT kind, source_id FROM admin_notifications ORDER BY created_at, kind
      `).all()).toEqual([
        { kind: "guestbook_created", source_id: created.body.response.id },
        { kind: "guestbook_updated", source_id: created.body.response.id }
      ]);

      const deleted = await handleApiRequest(
        request(
          `/guestbook/${created.body.credential.guestbookId}`,
          "DELETE",
          undefined,
          created.body.credential.editToken
        ),
        env,
        "guestbook-owner-client"
      );
      expect(deleted.status).toBe(204);
      expect(database.prepare("SELECT id FROM guestbook_messages WHERE id = ?").get(created.body.response.id)).toBeUndefined();
    } finally {
      database.close();
    }
  });

  it("공개 목록을 20개씩 안정적으로 페이지 조회한다", async () => {
    const database = new DatabaseSync(":memory:");
    try {
      applyMigrations(database);
      const validHash = "A".repeat(43);
      const insert = database.prepare(`
        INSERT INTO guestbook_messages (
          id, invitation_id, nickname, message, client_hash, edit_token_hash,
          created_at, updated_at
        ) VALUES (?, 'sample-garden', ?, ?, ?, ?, ?, ?)
      `);
      for (let index = 0; index < 21; index += 1) {
        const timestamp = new Date(Date.UTC(2026, 6, 21, 0, 0, index)).toISOString();
        insert.run(`guestbook_page_${String(index).padStart(2, "0")}`, `하객${index}`, `축하${index}`, validHash, validHash, timestamp, timestamp);
      }
      const env = createEnv(database);

      const firstResponse = await handleApiRequest(request("/guestbook"), env, "guestbook-page-client");
      const first = await firstResponse.json() as { messages: Array<{ id: string }>; nextCursor: string | null };
      expect(firstResponse.status).toBe(200);
      expect(first.messages).toHaveLength(20);
      expect(first.messages[0].id).toBe("guestbook_page_20");
      expect(first.nextCursor).toEqual(expect.any(String));

      const secondResponse = await handleApiRequest(
        request(`/guestbook?cursor=${encodeURIComponent(first.nextCursor!)}`),
        env,
        "guestbook-page-client"
      );
      await expect(secondResponse.json()).resolves.toMatchObject({
        messages: [{ id: "guestbook_page_00" }],
        nextCursor: null
      });
    } finally {
      database.close();
    }
  });

  it("관리자가 메시지를 수정·숨김·복원·삭제하고 공개 목록은 숨긴 메시지를 제외한다", async () => {
    const database = new DatabaseSync(":memory:");
    try {
      applyMigrations(database);
      const env = createEnv(database);
      const created = await createMessage(env, "guestbook-moderation-client");
      const adminToken = await issueAdminToken({
        invitationId: "sample-garden",
        expiresAt: Date.now() + 60_000
      }, env.RSVP_ADMIN_SESSION_SECRET);

      const editedResponse = await handleApiRequest(
        request(
          `/admin/guestbook/${created.body.response.id}`,
          "PATCH",
          { nickname: "관리자 수정", message: "수정한 축하 메시지", revision: 1 },
          adminToken
        ),
        env,
        "guestbook-admin-client"
      );
      expect(editedResponse.status).toBe(200);
      await expect(editedResponse.json()).resolves.toMatchObject({
        nickname: "관리자 수정",
        message: "수정한 축하 메시지",
        revision: 2
      });
      expect(database.prepare("SELECT COUNT(*) AS count FROM admin_notifications").get()).toEqual({ count: 1 });

      const hiddenResponse = await handleApiRequest(
        request(
          `/admin/guestbook/${created.body.response.id}`,
          "PATCH",
          { hidden: true, revision: 2 },
          adminToken
        ),
        env,
        "guestbook-admin-client"
      );
      const hidden = await hiddenResponse.json() as { revision: number; isHidden: boolean };
      expect(hidden).toMatchObject({ revision: 3, isHidden: true });

      const publicResponse = await handleApiRequest(request("/guestbook"), env, "guestbook-public-client");
      await expect(publicResponse.json()).resolves.toMatchObject({ messages: [] });

      const adminListResponse = await handleApiRequest(
        request("/admin/guestbook", "GET", undefined, adminToken),
        env,
        "guestbook-admin-client"
      );
      await expect(adminListResponse.json()).resolves.toMatchObject({
        summary: { totalCount: 1, visibleCount: 0, hiddenCount: 1 },
        messages: [{ id: created.body.response.id, isHidden: true }]
      });

      const restoredResponse = await handleApiRequest(
        request(
          `/admin/guestbook/${created.body.response.id}`,
          "PATCH",
          { hidden: false, revision: hidden.revision },
          adminToken
        ),
        env,
        "guestbook-admin-client"
      );
      expect(restoredResponse.status).toBe(200);

      const deletedResponse = await handleApiRequest(
        request(`/admin/guestbook/${created.body.response.id}`, "DELETE", undefined, adminToken),
        env,
        "guestbook-admin-client"
      );
      expect(deletedResponse.status).toBe(204);
    } finally {
      database.close();
    }
  });

  it("같은 클라이언트의 방명록 작성을 10분에 3회로 제한한다", async () => {
    const database = new DatabaseSync(":memory:");
    try {
      applyMigrations(database);
      const env = createEnv(database);
      for (let index = 0; index < 3; index += 1) {
        const created = await createMessage(env, "guestbook-rate-client", `하객${index}`, `축하${index}`);
        expect(created.response.status).toBe(201);
      }

      const limited = await handleApiRequest(
        request("/guestbook", "POST", { nickname: "하객4", message: "네 번째 축하" }),
        env,
        "guestbook-rate-client"
      );
      expect(limited.status).toBe(429);
      expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    } finally {
      database.close();
    }
  });
});
