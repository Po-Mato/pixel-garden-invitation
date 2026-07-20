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

  it("normalizes a trailing slash in the worker URL", async () => {
    vi.stubEnv("VITE_WORKER_URL", "https://worker.test/");
    vi.stubEnv("VITE_INVITATION_ID", "sample-garden");

    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const { submitRsvp } = await import("./weddingApi");

    await submitRsvp({
      guestName: "이승재",
      attendance: "yes",
      partySize: 2,
      note: ""
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://worker.test/api/invitations/sample-garden/rsvps",
      expect.objectContaining({
        method: "POST"
      })
    );
  });

  it("fetches visible guestbook messages for the invitation", async () => {
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
              createdAt: "2026-06-12T00:00:00.000Z"
            }
          ]
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const { fetchGuestbookMessages } = await import("./weddingApi");

    await expect(fetchGuestbookMessages()).resolves.toEqual([
      {
        id: "guestbook_1",
        nickname: "하객1",
        message: "축하합니다",
        createdAt: "2026-06-12T00:00:00.000Z"
      }
    ]);
    expect(fetchMock).toHaveBeenCalledWith("https://worker.test/api/invitations/sample-garden/guestbook", {
      method: "GET"
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

  it("uses Bearer auth for admin session data and deletes", async () => {
    vi.stubEnv("VITE_WORKER_URL", "https://worker.test");
    vi.stubEnv("VITE_INVITATION_ID", "sample-garden");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ token: "admin-token", expiresAt: "2026-07-21T00:00:00.000Z" }))
      .mockResolvedValueOnce(jsonResponse({ summary: {}, responses: [] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const { createAdminSession, fetchAdminRsvps, deleteAdminRsvp } = await import("./weddingApi");
    const session = await createAdminSession("password");
    await fetchAdminRsvps(session.token);
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
      method: "DELETE",
      headers: { authorization: "Bearer admin-token" }
    });
  });
});
