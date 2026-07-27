import { describe, expect, it, vi } from "vitest";
import { issueAdminToken } from "./security";
import { handleAdminRsvpHistoryRequest } from "./rsvpHistoryHttp";
import { handleApiRequest } from "./http";
import type { Env } from "./index";

describe("admin RSVP history HTTP", () => {
  it("관리자 세션으로만 변경 이력을 조회한다", async () => {
    const secret = "rsvp-history-session-secret";
    const token = await issueAdminToken({ invitationId: "sample-garden", expiresAt: Date.now() + 60_000 }, secret);
    const all = vi.fn().mockResolvedValue({ results: [{
      id: 1,
      rsvp_id: "rsvp_1",
      revision: 1,
      action: "created",
      snapshot_json: JSON.stringify({ id: "rsvp_1", revision: 1 }),
      occurred_at: "2027-04-01T00:00:00.000Z"
    }] });
    const env = {
      RSVP_ADMIN_SESSION_SECRET: secret,
      DB: { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ all })) })) }
    } as unknown as Env;

    const response = await handleAdminRsvpHistoryRequest(new Request("https://worker.test/history", {
      headers: { authorization: `Bearer ${token}` }
    }), env, "sample-garden", "rsvp_1");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ rsvpId: "rsvp_1", entries: [{ revision: 1 }] });

    const unauthorized = await handleAdminRsvpHistoryRequest(
      new Request("https://worker.test/history"),
      env,
      "sample-garden",
      "rsvp_1"
    );
    expect(unauthorized.status).toBe(401);
  });

  it("통합 API 라우터가 답변별 history 경로를 전용 처리기로 연결한다", async () => {
    const secret = "rsvp-history-route-secret";
    const token = await issueAdminToken({ invitationId: "sample-garden", expiresAt: Date.now() + 60_000 }, secret);
    const env = {
      RSVP_ADMIN_SESSION_SECRET: secret,
      DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            all: vi.fn().mockResolvedValue({ results: [{
              id: 1,
              rsvp_id: "rsvp_1",
              revision: 1,
              action: "created",
              snapshot_json: JSON.stringify({ id: "rsvp_1", revision: 1 }),
              occurred_at: "2027-04-01T00:00:00.000Z"
            }] })
          }))
        }))
      }
    } as unknown as Env;

    const response = await handleApiRequest(new Request(
      "https://worker.test/api/invitations/sample-garden/admin/rsvps/rsvp_1/history",
      { headers: { authorization: `Bearer ${token}` } }
    ), env, "route-test");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ rsvpId: "rsvp_1" });
  });
});
