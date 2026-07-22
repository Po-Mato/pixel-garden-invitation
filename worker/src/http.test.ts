import { describe, expect, it, vi } from "vitest";

import type { Env } from "./index";
import { handleApiRequest } from "./http";

type RsvpRow = {
  id: string;
  invitation_id: string;
  side: string;
  guest_name: string;
  phone: string;
  attendance: string;
  party_size: number;
  meal_status: string;
  note: string;
  consent_version: string;
  consented_at: string;
  edit_token_hash: string;
  revision: number;
  created_at: string;
  updated_at: string;
};

type CreateDbOptions = {
  invitation?: { id: string } | null;
  consentVersion?: string;
  guestbookRows?: Array<{ id: string; nickname: string; message: string; is_hidden: number; created_at: string }>;
  deleteOnUpdate?: boolean;
  selectError?: Error;
  writeError?: Error;
};

type GuestbookTestRow = {
  id: string;
  nickname: string;
  message: string;
  is_hidden: number;
  edit_token_hash: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
};

const adminPasswordHash = "pbkdf2-sha256$100000$MTIzNDU2Nzg5MDEyMzQ1Ng$YEAsDXNqEF4BcOvVtfmXmFhoK-UtjKo4y180j0n9IgU";

function createDb(options: CreateDbOptions = {}) {
  const invitation = options.invitation === undefined ? { id: "sample-garden" } : options.invitation;
  const consentVersion = options.consentVersion ?? "2026-07-20";
  const rows = new Map<string, RsvpRow>();
  const adminAttempts = new Map<string, { window_started_at: string; attempts: number }>();
  const prepare = vi.fn((sql: string) => ({
    bind: (...values: unknown[]) => {
      bindCalls.push({ sql, values });

      return {
        first: async () => {
          if (options.selectError) throw options.selectError;

          if (/SELECT window_started_at, attempts\s+FROM admin_login_attempts/i.test(sql)) {
            return adminAttempts.get(`${String(values[0])}:${String(values[1])}`) ?? null;
          }

          if (/INSERT INTO admin_login_attempts/i.test(sql)) {
            if (options.writeError) throw options.writeError;
            const key = `${String(values[0])}:${String(values[1])}`;
            const now = String(values[2]);
            const cutoff = String(values[3]);
            const existing = adminAttempts.get(key);
            const next = !existing || existing.window_started_at <= cutoff
              ? { window_started_at: now, attempts: 1 }
              : { ...existing, attempts: existing.attempts + 1 };
            adminAttempts.set(key, next);
            return { attempts: next.attempts, window_started_at: next.window_started_at };
          }

          if (/SELECT config_json, rsvp_deadline, rsvp_delete_at\s+FROM invitations/i.test(sql)) {
            return invitation && {
              config_json: JSON.stringify({ rsvp: { consentVersion } }),
              rsvp_deadline: "2027-04-24T14:59:59.000Z",
              rsvp_delete_at: "2027-05-31T14:59:59.000Z"
            };
          }

          if (/SELECT rsvp_delete_at\s+FROM invitations/i.test(sql)) {
            return invitation && { rsvp_delete_at: "2027-05-31T14:59:59.000Z" };
          }

          if (/SELECT guestbook_delete_at\s+FROM invitations/i.test(sql)) {
            return invitation && { guestbook_delete_at: "2027-05-31T14:59:59.000Z" };
          }

          if (/COUNT\(\*\) AS write_count[\s\S]+FROM guestbook_messages/i.test(sql)) {
            return { write_count: 0, oldest_created_at: null };
          }

          if (/SELECT id FROM invitations/i.test(sql)) return invitation;

          if (/INSERT INTO rsvps/i.test(sql)) {
            if (options.writeError) throw options.writeError;
            const [
              id,
              invitationId,
              side,
              guestName,
              phone,
              attendance,
              partySize,
              mealStatus,
              note,
              storedConsentVersion,
              consentedAt,
              editTokenHash,
              createdAt,
              updatedAt
            ] = values as [
              string, string, string, string, string, string, number,
              string, string, string, string, string, string, string
            ];
            const row: RsvpRow = {
              id,
              invitation_id: invitationId,
              side,
              guest_name: guestName,
              phone,
              attendance,
              party_size: partySize,
              meal_status: mealStatus,
              note,
              consent_version: storedConsentVersion,
              consented_at: consentedAt,
              edit_token_hash: editTokenHash,
              revision: 1,
              created_at: createdAt,
              updated_at: updatedAt
            };
            rows.set(id, row);
            return row;
          }

          if (/INSERT INTO guestbook_messages/i.test(sql)) {
            if (options.writeError) throw options.writeError;
            const [id, , nickname, message, , editTokenHash, createdAt] = values as string[];
            return {
              id,
              nickname,
              message,
              is_hidden: 0,
              edit_token_hash: editTokenHash,
              revision: 1,
              created_at: createdAt,
              updated_at: createdAt
            } satisfies GuestbookTestRow;
          }

          if (/UPDATE rsvps/i.test(sql)) {
            if (options.writeError) throw options.writeError;
            const [
              side,
              guestName,
              phone,
              attendance,
              partySize,
              mealStatus,
              note,
              storedConsentVersion,
              updatedAt,
              invitationId,
              rsvpId,
              expectedRevision
            ] = values as [string, string, string, string, number, string, string, string, string, string, string, number];
            const existing = rows.get(rsvpId);
            if (options.deleteOnUpdate) {
              rows.delete(rsvpId);
              return null;
            }
            if (!existing || existing.invitation_id !== invitationId || existing.revision !== expectedRevision) return null;
            const updated = {
              ...existing,
              side,
              guest_name: guestName,
              phone,
              attendance,
              party_size: partySize,
              meal_status: mealStatus,
              note,
              consent_version: storedConsentVersion,
              revision: existing.revision + 1,
              updated_at: updatedAt
            };
            rows.set(rsvpId, updated);
            return updated;
          }

          if (/FROM rsvps/i.test(sql)) {
            const [invitationId, rsvpId] = values as [string, string];
            const row = rows.get(rsvpId);
            return row?.invitation_id === invitationId ? row : null;
          }

          return null;
        },
        all: async () => {
          if (options.selectError) throw options.selectError;
          if (/FROM rsvps/i.test(sql)) {
            const invitationId = String(values[0]);
            return {
              results: [...rows.values()]
                .filter((row) => row.invitation_id === invitationId)
                .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
            };
          }
          const visibleRows = (options.guestbookRows ?? [])
            .filter((row) => row.is_hidden === 0)
            .map((row) => ({
              ...row,
              edit_token_hash: null,
              revision: 1,
              updated_at: row.created_at
            } satisfies GuestbookTestRow));
          return { results: visibleRows };
        },
        run: async () => {
          if (options.writeError) throw options.writeError;
          runCount += 1;
          if (/DELETE FROM admin_login_attempts/i.test(sql)) {
            const deleted = adminAttempts.delete(`${String(values[0])}:${String(values[1])}`);
            return { success: true, meta: { changes: deleted ? 1 : 0 } };
          }
          if (/DELETE FROM rsvps/i.test(sql)) {
            const [invitationId, rsvpId] = values as [string, string];
            const existing = rows.get(rsvpId);
            const deleted = existing?.invitation_id === invitationId && rows.delete(rsvpId);
            return { success: true, meta: { changes: deleted ? 1 : 0 } };
          }
          return { success: true, meta: { changes: 1 } };
        }
      };
    }
  }));
  const bindCalls: Array<{ sql: string; values: unknown[] }> = [];
  let runCount = 0;

  return {
    db: { prepare } as unknown as D1Database,
    prepare,
    bindCalls,
    rows,
    adminAttempts,
    get runCount() {
      return runCount;
    }
  };
}

function apiEnv(db: D1Database, overrides: Partial<Env> = {}): Env {
  return {
    DB: db,
    RSVP_ADMIN_PASSWORD_HASH: adminPasswordHash,
    RSVP_ADMIN_SESSION_SECRET: "session-secret",
    RSVP_CLIENT_KEY_SECRET: "client-key-secret",
    RSVP_ALLOWED_ORIGINS: "https://example.test",
    ...overrides
  } as Env;
}

const canonicalRsvp = {
  side: "groom",
  guestName: "이승재",
  phone: "010-1234-5678",
  attendance: "yes",
  partySize: 2,
  mealStatus: "yes",
  note: "",
  consentVersion: "2026-07-20"
};

function rsvpRequest(invitationId = "sample-garden", payload: Record<string, unknown> = canonicalRsvp) {
  return new Request(`https://worker.test/api/invitations/${invitationId}/rsvps`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json" }
  });
}

function guestbookRequest(invitationId = "sample-garden") {
  return new Request(`https://worker.test/api/invitations/${invitationId}/guestbook`, {
    method: "POST",
    body: JSON.stringify({ nickname: "하객1", message: "축하합니다" }),
    headers: { "content-type": "application/json" }
  });
}

async function createOwnedRsvp(db: D1Database) {
  const response = await handleApiRequest(rsvpRequest(), apiEnv(db), "owner-client");
  const body = await response.json() as {
    response: { id: string; revision: number };
    credential: { rsvpId: string; editToken: string };
  };
  return { response, body };
}

function adminSessionRequest(password: unknown = "correct horse battery staple") {
  return new Request("https://worker.test/api/invitations/sample-garden/admin/session", {
    method: "POST",
    body: JSON.stringify({ password }),
    headers: { "content-type": "application/json" }
  });
}

async function createAdminSession(db: D1Database, env = apiEnv(db), clientKey = "admin-client") {
  const response = await handleApiRequest(adminSessionRequest(), env, clientKey);
  const body = await response.json() as { token: string; expiresAt: number };
  return { response, body };
}

describe("handleApiRequest", () => {
  it("rejects a wrong admin password and issues a no-store session for the correct password", async () => {
    const { db } = createDb();

    const wrong = await handleApiRequest(adminSessionRequest("wrong"), apiEnv(db), "admin-login-client");
    const correct = await handleApiRequest(adminSessionRequest(), apiEnv(db), "admin-login-client");

    expect(wrong.status).toBe(401);
    expect(wrong.headers.get("cache-control")).toBe("no-store");
    await expect(wrong.json()).resolves.toEqual({ error: "unauthorized" });
    expect(correct.status).toBe(200);
    expect(correct.headers.get("cache-control")).toBe("no-store");
    await expect(correct.json()).resolves.toEqual({
      token: expect.any(String),
      expiresAt: expect.any(Number)
    });
  });

  it("returns the exact remaining login window as an integer Retry-After header", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-07-20T10:00:00.000Z"));
    try {
      const { db } = createDb();
      const env = apiEnv(db);
      for (let index = 0; index < 5; index += 1) {
        expect((await handleApiRequest(adminSessionRequest("wrong"), env, "limited-admin")).status).toBe(401);
      }

      vi.setSystemTime(Date.parse("2026-07-20T10:00:30.001Z"));
      const limitedRequest = adminSessionRequest();
      limitedRequest.headers.set("origin", "https://example.test");
      const limited = await handleApiRequest(limitedRequest, env, "limited-admin");

      expect(limited.status).toBe(429);
      expect(limited.headers.get("retry-after")).toBe("570");
      expect(limited.headers.get("access-control-expose-headers")).toBe("Retry-After");
      expect(limited.headers.get("cache-control")).toBe("no-store");
      await expect(limited.json()).resolves.toEqual({ error: "rate_limited" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns the full admin RSVP result only for a valid scoped token", async () => {
    const { db } = createDb();
    await createOwnedRsvp(db);
    const { body } = await createAdminSession(db);
    const url = "https://worker.test/api/invitations/sample-garden/admin/rsvps";

    const list = await handleApiRequest(new Request(url, {
      headers: { authorization: `Bearer ${body.token}` }
    }), apiEnv(db), "admin-list-client");
    const badToken = await handleApiRequest(new Request(url, {
      headers: { authorization: "Bearer bad-token" }
    }), apiEnv(db), "admin-list-client");

    expect(list.status).toBe(200);
    expect(list.headers.get("cache-control")).toBe("no-store");
    await expect(list.json()).resolves.toMatchObject({
      summary: { responseCount: 1, attendingPartySize: 2, mealPartySize: 2 },
      responses: [{ guestName: "이승재" }]
    });
    expect(badToken.status).toBe(401);
    expect(badToken.headers.get("cache-control")).toBe("no-store");
  });

  it("deletes one scoped admin RSVP and returns 404 when it is missing", async () => {
    const { db } = createDb();
    const { body: created } = await createOwnedRsvp(db);
    const { body: session } = await createAdminSession(db);
    const url = `https://worker.test/api/invitations/sample-garden/admin/rsvps/${created.response.id}`;
    const remove = () => handleApiRequest(new Request(url, {
      method: "DELETE",
      headers: { authorization: `Bearer ${session.token}` }
    }), apiEnv(db), "admin-delete-client");

    const deleted = await remove();
    const missing = await remove();

    expect(deleted.status).toBe(204);
    expect(deleted.headers.get("cache-control")).toBe("no-store");
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toBe("no-store");
  });

  it.each([
    "RSVP_ADMIN_PASSWORD_HASH",
    "RSVP_ADMIN_SESSION_SECRET",
    "RSVP_CLIENT_KEY_SECRET"
  ] as const)("returns a controlled no-store error when %s is missing", async (secretName) => {
    const { db } = createDb();
    const env = apiEnv(db) as unknown as Record<string, unknown>;
    delete env[secretName];

    const response = await handleApiRequest(adminSessionRequest(), env as unknown as Env, "missing-secret-client");
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toBe(JSON.stringify({ error: "internal_error" }));
    expect(body).not.toContain(secretName);
    expect(body).not.toContain(adminPasswordHash);
  });

  it("returns restricted CORS headers for an allowed preflight request", async () => {
    const { db, prepare } = createDb();
    const request = new Request("https://worker.test/api/invitations/sample-garden/rsvps", {
      method: "OPTIONS",
      headers: { origin: "https://po-mato.github.io" }
    });

    const response = await handleApiRequest(request, apiEnv(db, {
      RSVP_ALLOWED_ORIGINS: "https://po-mato.github.io,http://localhost:5173,http://127.0.0.1:5173"
    }), "preflight-client");

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://po-mato.github.io");
    expect(response.headers.get("access-control-allow-methods")).toBe("GET,POST,PATCH,PUT,DELETE,OPTIONS");
    expect(response.headers.get("access-control-allow-headers")).toBe("content-type,authorization,x-gallery-slot-id");
    expect(response.headers.get("vary")).toBe("Origin");
    expect(prepare).not.toHaveBeenCalled();
  });

  it("rejects disallowed preflight and actual origins before D1 access", async () => {
    const { db, prepare } = createDb();
    const env = apiEnv(db, { RSVP_ALLOWED_ORIGINS: "https://po-mato.github.io" });
    const url = "https://worker.test/api/invitations/sample-garden/rsvps";

    const preflight = await handleApiRequest(new Request(url, {
      method: "OPTIONS",
      headers: { origin: "https://evil.example" }
    }), env, "denied-preflight-client");
    const actual = await handleApiRequest(new Request(url, {
      method: "POST",
      body: JSON.stringify(canonicalRsvp),
      headers: { "content-type": "application/json", origin: "https://evil.example" }
    }), env, "denied-actual-client");

    expect(preflight.status).toBe(403);
    expect(actual.status).toBe(403);
    expect(preflight.headers.get("access-control-allow-origin")).toBeNull();
    expect(actual.headers.get("access-control-allow-origin")).toBeNull();
    expect(prepare).not.toHaveBeenCalled();
  });

  it("requires an exact origin match and preserves allowed guestbook writes", async () => {
    const { db, prepare } = createDb();
    const env = apiEnv(db, { RSVP_ALLOWED_ORIGINS: "https://po-mato.github.io" });
    const deceptive = new Request("https://worker.test/api/invitations/sample-garden/guestbook", {
      method: "POST",
      body: JSON.stringify({ nickname: "하객1", message: "축하합니다" }),
      headers: { "content-type": "application/json", origin: "https://po-mato.github.io.evil.example" }
    });

    const denied = await handleApiRequest(deceptive, env, "deceptive-origin-client");
    expect(denied.status).toBe(403);
    expect(prepare).not.toHaveBeenCalled();

    const allowed = await handleApiRequest(new Request(guestbookRequest(), {
      headers: { "content-type": "application/json", origin: "https://po-mato.github.io" }
    }), env, "allowed-guestbook-client");
    expect(allowed.status).toBe(201);
    expect(allowed.headers.get("access-control-allow-origin")).toBe("https://po-mato.github.io");
  });

  it("allows origin-less server requests without adding CORS headers", async () => {
    const { db } = createDb();

    const response = await handleApiRequest(rsvpRequest(), apiEnv(db), "server-client");

    expect(response.status).toBe(201);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(response.headers.get("vary")).toBe("Origin");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("does not add access-control headers to origin-less OPTIONS requests", async () => {
    const { db, prepare } = createDb();

    const response = await handleApiRequest(new Request(
      "https://worker.test/api/invitations/sample-garden/rsvps",
      { method: "OPTIONS" }
    ), apiEnv(db), "server-options-client");

    expect(response.status).toBe(204);
    expect(response.headers.get("vary")).toBe("Origin");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(response.headers.get("access-control-allow-methods")).toBeNull();
    expect(response.headers.get("access-control-allow-headers")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(prepare).not.toHaveBeenCalled();
  });

  it("marks admin preflight responses as no-store", async () => {
    const { db, prepare } = createDb();
    const request = new Request("https://worker.test/api/invitations/sample-garden/admin/rsvps", {
      method: "OPTIONS",
      headers: { origin: "https://example.test" }
    });

    const response = await handleApiRequest(request, apiEnv(db), "admin-preflight-client");

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe("https://example.test");
    expect(prepare).not.toHaveBeenCalled();
  });

  it("uses only the approved error codes for unsupported methods", async () => {
    const { db, prepare } = createDb();
    const request = new Request("https://worker.test/api/invitations/sample-garden/rsvps", { method: "DELETE" });

    const response = await handleApiRequest(request, apiEnv(db), "method-client");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
    expect(prepare).not.toHaveBeenCalled();
  });

  it("does not spend write quota on unknown API paths", async () => {
    const { db } = createDb();
    const clientKey = "bad-path-client";

    for (let index = 0; index < 10; index += 1) {
      const response = await handleApiRequest(
        new Request("https://worker.test/api/invitations/sample-garden/comments", {
          method: "POST",
          body: "{}",
          headers: { "content-type": "application/json" }
        }),
        apiEnv(db),
        clientKey
      );
      expect(response.status).toBe(404);
    }

    expect((await handleApiRequest(rsvpRequest(), apiEnv(db), clientKey)).status).toBe(201);
  });

  it("creates an RSVP with a hashed edit credential and the new response contract", async () => {
    const { db, bindCalls } = createDb();

    const { response, body } = await createOwnedRsvp(db);

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      response: { side: "groom", attendance: "yes", partySize: 2, revision: 1 },
      credential: { rsvpId: expect.stringMatching(/^rsvp_/), editToken: expect.any(String) }
    });
    expect(body.credential.rsvpId).toBe(body.response.id);
    const insert = bindCalls.find(({ sql }) => /INSERT INTO rsvps/i.test(sql));
    expect(insert?.values).not.toContain(body.credential.editToken);
    expect(insert?.values.at(-1)).toEqual(expect.any(String));
    expect(insert?.values.at(-1)).not.toBe(body.credential.editToken);
  });

  it("validates against the consent version loaded from the D1 invitation policy", async () => {
    const { db } = createDb({ consentVersion: "d1-policy-v2" });

    const stale = await handleApiRequest(rsvpRequest(), apiEnv(db), "stale-consent-client");
    const current = await handleApiRequest(
      rsvpRequest("sample-garden", { ...canonicalRsvp, consentVersion: "d1-policy-v2" }),
      apiEnv(db),
      "current-consent-client"
    );

    expect(stale.status).toBe(400);
    await expect(stale.json()).resolves.toEqual({ error: "invalid_request" });
    expect(current.status).toBe(201);
  });

  it("allows only the edit-token owner to read an RSVP", async () => {
    const { db } = createDb();
    const { body } = await createOwnedRsvp(db);
    const url = `https://worker.test/api/invitations/sample-garden/rsvps/${body.credential.rsvpId}`;

    const ownedGet = await handleApiRequest(new Request(url, {
      headers: { authorization: `Bearer ${body.credential.editToken}` }
    }), apiEnv(db), "owned-get-client");
    const missingTokenGet = await handleApiRequest(new Request(url), apiEnv(db), "missing-token-client");
    const wrongTokenGet = await handleApiRequest(new Request(url, {
      headers: { authorization: "Bearer wrong-token" }
    }), apiEnv(db), "wrong-token-client");

    expect(ownedGet.status).toBe(200);
    await expect(ownedGet.json()).resolves.toMatchObject({ id: body.credential.rsvpId, revision: 1 });
    expect(missingTokenGet.status).toBe(401);
    expect(wrongTokenGet.status).toBe(401);
  });

  it.each([
    ["missing", undefined],
    ["wrong scheme", "Basic token"],
    ["missing token", "Bearer"],
    ["extra token", "Bearer first second"]
  ])("rejects a %s authorization header before querying D1", async (_label, authorization) => {
    const { db, prepare } = createDb();
    const headers = authorization ? { authorization } : undefined;

    const response = await handleApiRequest(new Request(
      "https://worker.test/api/invitations/sample-garden/rsvps/rsvp_private",
      { headers }
    ), apiEnv(db), "invalid-auth-client");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(prepare).not.toHaveBeenCalled();
  });

  it("does not reveal missing or cross-invitation RSVP ownership", async () => {
    const { db } = createDb();
    const { body } = await createOwnedRsvp(db);
    const requests = [
      new Request("https://worker.test/api/invitations/sample-garden/rsvps/rsvp_missing", {
        headers: { authorization: `Bearer ${body.credential.editToken}` }
      }),
      new Request(`https://worker.test/api/invitations/other-garden/rsvps/${body.credential.rsvpId}`, {
        headers: { authorization: `Bearer ${body.credential.editToken}` }
      }),
      new Request(`https://worker.test/api/invitations/sample-garden/rsvps/${body.credential.rsvpId}`, {
        headers: { authorization: "Bearer wrong-token" }
      })
    ];

    for (const request of requests) {
      const response = await handleApiRequest(request, apiEnv(db), "private-owner-client");
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    }
  });

  it("updates an owned RSVP and distinguishes stale revisions", async () => {
    const { db } = createDb();
    const { body } = await createOwnedRsvp(db);
    const requestUrl = `https://worker.test/api/invitations/sample-garden/rsvps/${body.credential.rsvpId}`;
    const updateBody = { ...canonicalRsvp, side: "bride", revision: 1 };
    const update = () => handleApiRequest(new Request(requestUrl, {
      method: "PATCH",
      body: JSON.stringify(updateBody),
      headers: {
        authorization: `Bearer ${body.credential.editToken}`,
        "content-type": "application/json"
      }
    }), apiEnv(db), "update-client");

    const updateResponse = await update();
    const staleRevisionUpdate = await update();

    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({ side: "bride", revision: 2 });
    expect(staleRevisionUpdate.status).toBe(409);
    await expect(staleRevisionUpdate.json()).resolves.toEqual({ error: "conflict" });
  });

  it("returns 404 when an authenticated update target disappeared", async () => {
    const { db } = createDb({ deleteOnUpdate: true });
    const { body } = await createOwnedRsvp(db);
    const url = `https://worker.test/api/invitations/sample-garden/rsvps/${body.credential.rsvpId}`;

    const response = await handleApiRequest(new Request(url, {
      method: "PATCH",
      body: JSON.stringify({ ...canonicalRsvp, revision: 1 }),
      headers: {
        authorization: `Bearer ${body.credential.editToken}`,
        "content-type": "application/json"
      }
    }), apiEnv(db), "deleted-update-client");

    expect(response.status).toBe(404);
  });

  it("stores guestbook submissions with validated bind values", async () => {
    const { db, bindCalls } = createDb();

    const response = await handleApiRequest(guestbookRequest(), apiEnv(db), "guestbook-client");

    expect(response.status).toBe(201);
    expect(bindCalls.some(({ sql, values }) =>
      /INSERT INTO guestbook_messages/i.test(sql)
      && /^guestbook_[\da-f-]+$/.test(String(values[0]))
      && values[1] === "sample-garden"
      && values[2] === "하객1"
      && values[3] === "축하합니다"
    )).toBe(true);
  });

  it("lists visible guestbook messages newest-first", async () => {
    const { db, prepare } = createDb({
      guestbookRows: [
        { id: "guestbook_new", nickname: "하객2", message: "새 축하", is_hidden: 0, created_at: "2026-06-12T00:00:00.000Z" },
        { id: "guestbook_old", nickname: "하객1", message: "오래된 축하", is_hidden: 0, created_at: "2026-06-11T00:00:00.000Z" },
        { id: "guestbook_hidden", nickname: "숨김", message: "숨겨진 축하", is_hidden: 1, created_at: "2026-06-13T00:00:00.000Z" }
      ]
    });

    const response = await handleApiRequest(
      new Request("https://worker.test/api/invitations/sample-garden/guestbook", { method: "GET" }),
      apiEnv(db),
      "guestbook-list-client"
    );

    expect(response.status).toBe(200);
    expect(prepare).toHaveBeenCalledWith(expect.stringMatching(/is_hidden\s*=\s*0/i));
    expect(prepare).toHaveBeenCalledWith(expect.stringMatching(/ORDER BY created_at DESC/i));
    await expect(response.json()).resolves.toEqual({
      messages: [
        {
          id: "guestbook_new",
          nickname: "하객2",
          message: "새 축하",
          revision: 1,
          createdAt: "2026-06-12T00:00:00.000Z",
          updatedAt: "2026-06-12T00:00:00.000Z"
        },
        {
          id: "guestbook_old",
          nickname: "하객1",
          message: "오래된 축하",
          revision: 1,
          createdAt: "2026-06-11T00:00:00.000Z",
          updatedAt: "2026-06-11T00:00:00.000Z"
        }
      ],
      nextCursor: null
    });
  });

  it("rejects malformed guestbook submissions", async () => {
    const { db } = createDb();
    const response = await handleApiRequest(new Request(
      "https://worker.test/api/invitations/sample-garden/guestbook",
      { method: "POST", body: JSON.stringify({ nickname: "하객1", message: "" }) }
    ), apiEnv(db), "malformed-guestbook-client");

    expect(response.status).toBe(400);
  });

  it("rejects invalid RSVP JSON without touching the database", async () => {
    const { db, prepare } = createDb();
    const response = await handleApiRequest(new Request(
      "https://worker.test/api/invitations/sample-garden/rsvps",
      { method: "POST", body: "{" }
    ), apiEnv(db), "invalid-json-client");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_request" });
    expect(prepare).not.toHaveBeenCalled();
  });

  it("returns 404 without writing when the invitation does not exist", async () => {
    const { db, bindCalls } = createDb({ invitation: null });

    const response = await handleApiRequest(rsvpRequest("missing-garden"), apiEnv(db), "missing-client");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
    expect(bindCalls.some(({ sql }) => /INSERT INTO rsvps/i.test(sql))).toBe(false);
  });

  it("uses an injected limiter for test isolation", async () => {
    const { db, bindCalls } = createDb();
    const limiter = { allow: vi.fn().mockReturnValue(false) };

    const response = await handleApiRequest(rsvpRequest(), apiEnv(db), "injected-limit-client", { limiter });

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    await expect(response.json()).resolves.toEqual({ error: "rate_limited" });
    expect(limiter.allow).toHaveBeenCalledWith("injected-limit-client");
    expect(bindCalls.some(({ sql }) => /INSERT INTO rsvps/i.test(sql))).toBe(false);
  });

  it("returns and exposes a 60-second Retry-After for rate-limited RSVP creates and updates", async () => {
    const { db } = createDb();
    const env = apiEnv(db, { RSVP_ALLOWED_ORIGINS: "https://po-mato.github.io" });
    const limiter = { allow: vi.fn().mockReturnValue(false) };
    const createRequest = rsvpRequest();
    createRequest.headers.set("origin", "https://po-mato.github.io");

    const createResponse = await handleApiRequest(createRequest, env, "limited-create", { limiter });

    const { body } = await createOwnedRsvp(db);
    const updateResponse = await handleApiRequest(new Request(
      `https://worker.test/api/invitations/sample-garden/rsvps/${body.credential.rsvpId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ ...canonicalRsvp, revision: 1 }),
        headers: {
          authorization: `Bearer ${body.credential.editToken}`,
          "content-type": "application/json",
          origin: "https://po-mato.github.io"
        }
      }
    ), env, "limited-update", { limiter });

    for (const response of [createResponse, updateResponse]) {
      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBe("60");
      expect(response.headers.get("access-control-expose-headers")).toBe("Retry-After");
      await expect(response.json()).resolves.toEqual({ error: "rate_limited" });
    }
  });

  it("rate limits valid writes", async () => {
    const { db, bindCalls } = createDb();
    const clientKey = "default-limit-client";

    for (let index = 0; index < 10; index += 1) {
      expect((await handleApiRequest(rsvpRequest(), apiEnv(db), clientKey)).status).toBe(201);
    }
    const response = await handleApiRequest(rsvpRequest(), apiEnv(db), clientKey);

    expect(response.status).toBe(429);
    expect(bindCalls.filter(({ sql }) => /INSERT INTO rsvps/i.test(sql))).toHaveLength(10);
  });

  it("can reset the default limiter for isolated tests", async () => {
    const { db } = createDb();
    const clientKey = "reset-limit-client";

    for (let index = 0; index < 10; index += 1) {
      expect((await handleApiRequest(rsvpRequest(), apiEnv(db), clientKey)).status).toBe(201);
    }
    expect((await handleApiRequest(rsvpRequest(), apiEnv(db), clientKey)).status).toBe(429);

    const http = await import("./http");
    http.resetHttpRateLimiterForTest();

    expect((await handleApiRequest(rsvpRequest(), apiEnv(db), clientKey)).status).toBe(201);
  });

  it("returns controlled JSON when D1 rejects writes", async () => {
    const { db } = createDb({ writeError: new Error("db unavailable") });

    const response = await handleApiRequest(rsvpRequest(), apiEnv(db), "d1-error-client");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "internal_error" });
  });
});
