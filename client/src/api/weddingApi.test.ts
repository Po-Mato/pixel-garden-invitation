import { afterEach, describe, expect, it, vi } from "vitest";

const submission = {
  side: "groom" as const,
  guestName: "이승재",
  phone: "01012345678",
  attendance: "yes" as const,
  partySize: 2,
  mealStatus: "yes" as const,
  note: "축하해 주세요",
  consentVersion: "2026-07-20"
};

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers }
  });
}

describe("weddingApi", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("페이지 단위로 공개 방명록 메시지를 조회한다", async () => {
    vi.stubEnv("VITE_WORKER_URL", "https://worker.test/");
    vi.stubEnv("VITE_INVITATION_ID", "sample-garden");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          messages: [
            {
              id: "guestbook_1",
              nickname: "하객1",
              message: "축하합니다",
              revision: 1,
              createdAt: "2026-06-12T00:00:00.000Z",
              updatedAt: "2026-06-12T00:00:00.000Z"
            }
          ],
          nextCursor: "next-page"
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const { fetchGuestbookPage } = await import("./weddingApi");

    await expect(fetchGuestbookPage()).resolves.toMatchObject({
      messages: [{ id: "guestbook_1", revision: 1 }],
      nextCursor: "next-page"
    });
    expect(fetchMock).toHaveBeenCalledWith("https://worker.test/api/invitations/sample-garden/guestbook", {
      method: "GET"
    });
  });

  it("소유 방명록을 생성·조회·수정·삭제한다", async () => {
    vi.stubEnv("VITE_WORKER_URL", "https://worker.test");
    vi.stubEnv("VITE_INVITATION_ID", "sample-garden");
    const credential = { guestbookId: "guestbook_1", editToken: "edit-token" };
    const message = {
      id: "guestbook_1",
      nickname: "하객1",
      message: "축하합니다",
      isHidden: false,
      revision: 1,
      createdAt: "2026-07-21T00:00:00.000Z",
      updatedAt: "2026-07-21T00:00:00.000Z"
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ response: message, credential }, 201))
      .mockResolvedValueOnce(jsonResponse(message))
      .mockResolvedValueOnce(jsonResponse({ ...message, message: "수정 축하", revision: 2 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const {
      createGuestbook,
      deleteOwnedGuestbook,
      fetchOwnedGuestbook,
      updateOwnedGuestbook
    } = await import("./weddingApi");

    const created = await createGuestbook({ nickname: "하객1", message: "축하합니다" });
    await fetchOwnedGuestbook(created.credential);
    await updateOwnedGuestbook(created.credential, { nickname: "하객1", message: "수정 축하", revision: 1 });
    await deleteOwnedGuestbook(created.credential);

    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://worker.test/api/invitations/sample-garden/guestbook/guestbook_1", {
      method: "GET",
      headers: { authorization: "Bearer edit-token" }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, "https://worker.test/api/invitations/sample-garden/guestbook/guestbook_1", {
      method: "DELETE",
      headers: { authorization: "Bearer edit-token" }
    });
  });

  it("creates, fetches, and updates an owned RSVP with its edit token", async () => {
    vi.stubEnv("VITE_WORKER_URL", "https://worker.test/");
    vi.stubEnv("VITE_INVITATION_ID", "sample-garden");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        response: { id: "rsvp_1", ...submission, phone: submission.phone, revision: 1, createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T00:00:00.000Z" },
        credential: { rsvpId: "rsvp_1", editToken: "edit-token" }
      }, 201))
      .mockResolvedValueOnce(jsonResponse({
        id: "rsvp_1", ...submission, phone: submission.phone, revision: 1, createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T00:00:00.000Z"
      }))
      .mockResolvedValueOnce(jsonResponse({
        id: "rsvp_1", ...submission, phone: submission.phone, revision: 2, createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T01:00:00.000Z"
      }));
    vi.stubGlobal("fetch", fetchMock);

    const { createRsvp, fetchOwnedRsvp, updateOwnedRsvp } = await import("./weddingApi");
    const created = await createRsvp(submission);
    const fetched = await fetchOwnedRsvp(created.credential);
    const updated = await updateOwnedRsvp(created.credential, { ...submission, revision: fetched.revision });

    expect(updated.revision).toBe(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://worker.test/api/invitations/sample-garden/rsvps", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submission)
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://worker.test/api/invitations/sample-garden/rsvps/rsvp_1", {
      method: "GET",
      headers: { authorization: "Bearer edit-token" }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "https://worker.test/api/invitations/sample-garden/rsvps/rsvp_1", {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: "Bearer edit-token" },
      body: JSON.stringify({ ...submission, revision: 1 })
    });
  });

  it("preserves structured API errors and Retry-After values", async () => {
    vi.stubEnv("VITE_WORKER_URL", "https://worker.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(
      { error: "conflict" },
      409,
      { "retry-after": "12" }
    )));

    const { createRsvp, WeddingApiError } = await import("./weddingApi");

    await expect(createRsvp(submission)).rejects.toEqual(expect.objectContaining({
      status: 409,
      code: "conflict",
      retryAfterSeconds: 12
    }));
    await expect(createRsvp(submission)).rejects.toBeInstanceOf(WeddingApiError);
  });

  it("uses request_failed for empty or non-JSON error bodies and only accepts integer Retry-After delays", async () => {
    vi.stubEnv("VITE_WORKER_URL", "https://worker.test");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { "retry-after": "3.5" } }))
      .mockResolvedValueOnce(new Response("temporarily unavailable", { status: 503, headers: { "retry-after": "-1" } })));

    const { createRsvp } = await import("./weddingApi");

    await expect(createRsvp(submission)).rejects.toEqual(expect.objectContaining({
      status: 429,
      code: "request_failed",
      retryAfterSeconds: undefined
    }));
    await expect(createRsvp(submission)).rejects.toEqual(expect.objectContaining({
      status: 503,
      code: "request_failed",
      retryAfterSeconds: undefined
    }));
  });

  it("uses Bearer auth for admin session data, updates, and deletes", async () => {
    vi.stubEnv("VITE_WORKER_URL", "https://worker.test");
    vi.stubEnv("VITE_INVITATION_ID", "sample-garden");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ token: "admin-token", expiresAt: 1_784_592_000_000 }))
      .mockResolvedValueOnce(jsonResponse({ summary: {}, responses: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: "rsvp_1", revision: 2 }))
      .mockResolvedValueOnce(jsonResponse({ id: "guestbook_1", revision: 2 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const {
      createAdminSession,
      fetchAdminRsvps,
      updateAdminRsvp,
      updateAdminGuestbook,
      deleteAdminRsvp
    } = await import("./weddingApi");
    const session = await createAdminSession("password");
    await fetchAdminRsvps(session.token);
    await updateAdminRsvp(session.token, "rsvp_1", {
      side: "bride",
      guestName: "관리자 수정",
      phone: "01099998888",
      attendance: "yes",
      partySize: 2,
      mealStatus: "yes",
      note: "수정",
      revision: 1
    });
    await updateAdminGuestbook(session.token, "guestbook_1", {
      nickname: "수정 하객",
      message: "수정 메시지",
      revision: 1
    });
    await deleteAdminRsvp(session.token, "rsvp_1");

    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://worker.test/api/invitations/sample-garden/admin/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "password" })
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://worker.test/api/invitations/sample-garden/admin/rsvps", {
      method: "GET",
      headers: { authorization: "Bearer admin-token" }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "https://worker.test/api/invitations/sample-garden/admin/rsvps/rsvp_1", {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: "Bearer admin-token" },
      body: JSON.stringify({
        side: "bride",
        guestName: "관리자 수정",
        phone: "01099998888",
        attendance: "yes",
        partySize: 2,
        mealStatus: "yes",
        note: "수정",
        revision: 1
      })
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, "https://worker.test/api/invitations/sample-garden/admin/guestbook/guestbook_1", {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: "Bearer admin-token" },
      body: JSON.stringify({ nickname: "수정 하객", message: "수정 메시지", revision: 1 })
    });
    expect(fetchMock).toHaveBeenNthCalledWith(5, "https://worker.test/api/invitations/sample-garden/admin/rsvps/rsvp_1", {
      method: "DELETE",
      headers: { authorization: "Bearer admin-token" }
    });
  });

  it("exposes the Worker's integer Retry-After contract for admin login", async () => {
    vi.stubEnv("VITE_WORKER_URL", "https://worker.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(
      { error: "rate_limited" },
      429,
      { "retry-after": "570" }
    )));

    const { createAdminSession } = await import("./weddingApi");

    await expect(createAdminSession("password")).rejects.toEqual(expect.objectContaining({
      status: 429,
      code: "rate_limited",
      retryAfterSeconds: 570
    }));
  });

  it("exposes the Worker's 60-second RSVP create and update retry delay", async () => {
    vi.stubEnv("VITE_WORKER_URL", "https://worker.test");
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(
      { error: "rate_limited" },
      429,
      { "retry-after": "60" }
    ))));

    const { createRsvp, updateOwnedRsvp } = await import("./weddingApi");
    await expect(createRsvp(submission)).rejects.toEqual(expect.objectContaining({
      status: 429,
      code: "rate_limited",
      retryAfterSeconds: 60
    }));
    await expect(updateOwnedRsvp({ rsvpId: "rsvp_1", editToken: "edit-token" }, {
      ...submission,
      revision: 1
    })).rejects.toEqual(expect.objectContaining({
      status: 429,
      code: "rate_limited",
      retryAfterSeconds: 60
    }));
  });
});
