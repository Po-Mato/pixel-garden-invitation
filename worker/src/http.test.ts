import { describe, expect, it, vi } from "vitest";

import { handleApiRequest } from "./http";

type CreateDbOptions = {
  invitation?: { id: string } | null;
  guestbookRows?: Array<{ id: string; nickname: string; message: string; is_hidden: number; created_at: string }>;
  selectError?: Error;
  writeError?: Error;
};

function createDb(options: CreateDbOptions = {}) {
  const invitation = options.invitation === undefined ? { id: "sample-garden" } : options.invitation;
  const selectFirst = vi.fn();
  const all = vi.fn();
  const run = vi.fn();
  let guestbookListSql = "";

  if (options.selectError) {
    selectFirst.mockRejectedValue(options.selectError);
    all.mockRejectedValue(options.selectError);
  } else {
    selectFirst.mockResolvedValue(invitation);
    all.mockImplementation(() => ({
      results: guestbookListSql.match(/is_hidden\s*=\s*0/i)
        ? (options.guestbookRows ?? []).filter((row) => row.is_hidden === 0)
        : (options.guestbookRows ?? [])
    }));
  }

  if (options.writeError) {
    run.mockRejectedValue(options.writeError);
  } else {
    run.mockResolvedValue({ success: true });
  }

  const selectBind = vi.fn(() => ({ first: selectFirst }));
  const guestbookListBind = vi.fn(() => ({ all }));
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn((sql: string) => {
    if (sql.includes("SELECT id FROM invitations")) {
      return { bind: selectBind };
    }

    if (sql.includes("FROM guestbook_messages") && sql.includes("SELECT")) {
      guestbookListSql = sql;
      return { bind: guestbookListBind };
    }

    return { bind };
  });

  return { db: { prepare } as unknown as D1Database, prepare, selectBind, selectFirst, guestbookListBind, all, bind, run };
}

function rsvpRequest(invitationId = "sample-garden") {
  return new Request(`https://worker.test/api/invitations/${invitationId}/rsvps`, {
    method: "POST",
    body: JSON.stringify({ guestName: "이승재", attendance: "yes", partySize: 2, note: "" }),
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

describe("handleApiRequest", () => {
  it("returns CORS headers for preflight requests", async () => {
    const { db, prepare } = createDb();
    const request = new Request("https://worker.test/api/invitations/sample-garden/rsvps", {
      method: "OPTIONS"
    });

    const response = await handleApiRequest(request, db, "preflight-client");

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toBe("GET,POST,OPTIONS");
    expect(response.headers.get("access-control-allow-headers")).toBe("content-type");
    expect(prepare).not.toHaveBeenCalled();
  });

  it("rejects unsupported methods without touching the database", async () => {
    const { db, prepare } = createDb();
    const request = new Request("https://worker.test/api/invitations/sample-garden/rsvps", {
      method: "GET"
    });

    const response = await handleApiRequest(request, db, "method-client");

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({ error: "method_not_allowed" });
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
        db,
        clientKey
      );

      expect(response.status).toBe(404);
    }

    const response = await handleApiRequest(rsvpRequest(), db, clientKey);

    expect(response.status).toBe(201);
  });

  it("stores RSVP submissions", async () => {
    const { db, prepare, selectBind, run } = createDb();
    const request = rsvpRequest();

    const response = await handleApiRequest(request, db, "127.0.0.1");

    expect(response.status).toBe(201);
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("SELECT id FROM invitations"));
    expect(selectBind).toHaveBeenCalledWith("sample-garden");
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO rsvps"));
    expect(run).toHaveBeenCalled();
  });

  it("stores guestbook submissions with validated bind values", async () => {
    const { db, bind, run } = createDb();

    const response = await handleApiRequest(guestbookRequest(), db, "guestbook-client");

    expect(response.status).toBe(201);
    expect(bind).toHaveBeenCalledWith(
      expect.stringMatching(/^guestbook_[\da-f-]+$/),
      "sample-garden",
      "하객1",
      "축하합니다"
    );
    expect(run).toHaveBeenCalled();
  });

  it("lists visible guestbook messages newest-first", async () => {
    const { db, prepare, guestbookListBind } = createDb({
      guestbookRows: [
        {
          id: "guestbook_new",
          nickname: "하객2",
          message: "새 축하",
          is_hidden: 0,
          created_at: "2026-06-12T00:00:00.000Z"
        },
        {
          id: "guestbook_old",
          nickname: "하객1",
          message: "오래된 축하",
          is_hidden: 0,
          created_at: "2026-06-11T00:00:00.000Z"
        },
        {
          id: "guestbook_hidden",
          nickname: "숨김",
          message: "숨겨진 축하",
          is_hidden: 1,
          created_at: "2026-06-13T00:00:00.000Z"
        }
      ]
    });

    const response = await handleApiRequest(
      new Request("https://worker.test/api/invitations/sample-garden/guestbook", {
        method: "GET"
      }),
      db,
      "guestbook-list-client"
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(prepare).toHaveBeenCalledWith(expect.stringMatching(/is_hidden\s*=\s*0/i));
    expect(prepare).toHaveBeenCalledWith(expect.stringMatching(/ORDER BY created_at DESC/i));
    expect(guestbookListBind).toHaveBeenCalledWith("sample-garden");
    await expect(response.json()).resolves.toEqual({
      messages: [
        {
          id: "guestbook_new",
          nickname: "하객2",
          message: "새 축하",
          createdAt: "2026-06-12T00:00:00.000Z"
        },
        {
          id: "guestbook_old",
          nickname: "하객1",
          message: "오래된 축하",
          createdAt: "2026-06-11T00:00:00.000Z"
        }
      ]
    });
  });

  it("rejects malformed guestbook submissions", async () => {
    const { db } = createDb();
    const request = new Request("https://worker.test/api/invitations/sample-garden/guestbook", {
      method: "POST",
      body: JSON.stringify({ nickname: "하객1", message: "" }),
      headers: { "content-type": "application/json" }
    });

    const response = await handleApiRequest(request, db, "127.0.0.1");

    expect(response.status).toBe(400);
  });

  it("rejects invalid JSON without touching the database", async () => {
    const { db, prepare } = createDb();
    const request = new Request("https://worker.test/api/invitations/sample-garden/rsvps", {
      method: "POST",
      body: "{",
      headers: { "content-type": "application/json" }
    });

    const response = await handleApiRequest(request, db, "invalid-json-client");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_request" });
    expect(prepare).not.toHaveBeenCalled();
  });

  it("returns 404 without writing when the invitation does not exist", async () => {
    const { db, selectFirst, run } = createDb({ invitation: null });

    const response = await handleApiRequest(rsvpRequest("missing-garden"), db, "missing-client");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
    expect(selectFirst).toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("uses an injected limiter for test isolation", async () => {
    const { db, run } = createDb();
    const limiter = { allow: vi.fn().mockReturnValue(false) };

    const response = await handleApiRequest(rsvpRequest(), db, "injected-limit-client", { limiter });

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "rate_limited" });
    expect(limiter.allow).toHaveBeenCalledWith("injected-limit-client");
    expect(run).not.toHaveBeenCalled();
  });

  it("rate limits valid writes", async () => {
    const { db, run } = createDb();
    const clientKey = "default-limit-client";

    for (let index = 0; index < 10; index += 1) {
      const response = await handleApiRequest(rsvpRequest(), db, clientKey);
      expect(response.status).toBe(201);
    }

    const response = await handleApiRequest(rsvpRequest(), db, clientKey);

    expect(response.status).toBe(429);
    expect(run).toHaveBeenCalledTimes(10);
  });

  it("can reset the default limiter for isolated tests", async () => {
    const { db } = createDb();
    const clientKey = "reset-limit-client";

    for (let index = 0; index < 10; index += 1) {
      const response = await handleApiRequest(rsvpRequest(), db, clientKey);
      expect(response.status).toBe(201);
    }

    const limitedResponse = await handleApiRequest(rsvpRequest(), db, clientKey);
    expect(limitedResponse.status).toBe(429);

    const http = await import("./http");
    expect(http.resetHttpRateLimiterForTest).toEqual(expect.any(Function));
    http.resetHttpRateLimiterForTest();

    const response = await handleApiRequest(rsvpRequest(), db, clientKey);

    expect(response.status).toBe(201);
  });

  it("returns controlled JSON when D1 rejects writes", async () => {
    const { db } = createDb({ writeError: new Error("db unavailable") });

    const response = await handleApiRequest(rsvpRequest(), db, "d1-error-client");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "internal_error" });
  });
});
