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
});
