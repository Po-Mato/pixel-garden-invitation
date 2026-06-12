import { afterEach, describe, expect, it, vi } from "vitest";

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
});
