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

function createDb(options: CreateDbOptions = {}) {
  const invitation = options.invitation === undefined ? { id: "sample-garden" } : options.invitation;
  const consentVersion = options.consentVersion ?? "2026-07-20";
  const rows = new Map<string, RsvpRow>();
  const prepare = vi.fn((sql: string) => ({
    bind: (...values: unknown[]) => {
      bindCalls.push({ sql, values });

      return {
        first: async () => {
          if (options.selectError) throw options.selectError;

          if (/SELECT config_json, rsvp_deadline, rsvp_delete_at\s+FROM invitations/i.test(sql)) {
            return invitation && {
              config_json: JSON.stringify({ rsvp: { consentVersion } }),
              rsvp_deadline: "2027-04-24T14:59:59.000Z",
              rsvp_delete_at: "2027-05-31T14:59:59.000Z"
            };
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
              editTokenHash
            ] = values as [string, string, string, string, string, string, number, string, string, string, string, string];
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
              created_at: consentedAt,
              updated_at: consentedAt
            };
            rows.set(id, row);
            return row;
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
          const visibleRows = (options.guestbookRows ?? []).filter((row) => row.is_hidden === 0);
          return { results: visibleRows };
        },
        run: async () => {
          if (options.writeError) throw options.writeError;
          runCount += 1;
          return { success: true };
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
    get runCount() {
      return runCount;
    }
  };
}

function apiEnv(db: D1Database): Env {
  return { DB: db } as Env;
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

describe("handleApiRequest", () => {
  it("returns the existing CORS headers for preflight requests", async () => {
    const { db, prepare } = createDb();
    const request = new Request("https://worker.test/api/invitations/sample-garden/rsvps", { method: "OPTIONS" });

    const response = await handleApiRequest(request, apiEnv(db), "preflight-client");

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toBe("GET,POST,OPTIONS");
    expect(response.headers.get("access-control-allow-headers")).toBe("content-type");
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
        { id: "guestbook_new", nickname: "하객2", message: "새 축하", createdAt: "2026-06-12T00:00:00.000Z" },
        { id: "guestbook_old", nickname: "하객1", message: "오래된 축하", createdAt: "2026-06-11T00:00:00.000Z" }
      ]
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
    await expect(response.json()).resolves.toEqual({ error: "rate_limited" });
    expect(limiter.allow).toHaveBeenCalledWith("injected-limit-client");
    expect(bindCalls.some(({ sql }) => /INSERT INTO rsvps/i.test(sql))).toBe(false);
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
