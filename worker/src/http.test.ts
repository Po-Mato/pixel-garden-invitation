import { describe, expect, it, vi } from "vitest";

import { handleApiRequest } from "./http";

function createDb() {
  const run = vi.fn().mockResolvedValue({ success: true });
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn(() => ({ bind }));
  return { db: { prepare } as unknown as D1Database, prepare, bind, run };
}

describe("handleApiRequest", () => {
  it("stores RSVP submissions", async () => {
    const { db, prepare, run } = createDb();
    const request = new Request("https://worker.test/api/invitations/sample-garden/rsvps", {
      method: "POST",
      body: JSON.stringify({ guestName: "이승재", attendance: "yes", partySize: 2, note: "" }),
      headers: { "content-type": "application/json" }
    });

    const response = await handleApiRequest(request, db, "127.0.0.1");

    expect(response.status).toBe(201);
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO rsvps"));
    expect(run).toHaveBeenCalled();
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
});
