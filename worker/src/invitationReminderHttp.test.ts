import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "./index";
import { issueAdminToken } from "./security";
import { handleAdminInvitationReminderRequest } from "./invitationReminderHttp";

const repository = vi.hoisted(() => ({
  listInvitationReminders: vi.fn(),
  recordInvitationReminders: vi.fn()
}));
vi.mock("./invitationReminderRepository", () => repository);

const secret = "reminder-test-secret";
const env = { DB: {} as D1Database, RSVP_ADMIN_SESSION_SECRET: secret } as Env;
const result = { summary: { totalSent: 0, uniqueGuests: 0, lastSentAt: null, byStage: { d30: 0, d14: 0, d7: 0, d1: 0, manual: 0 } }, events: [] };

async function request(method: string, value?: unknown): Promise<Request> {
  const token = await issueAdminToken({ invitationId: "sample-garden", expiresAt: Date.now() + 60_000 }, secret);
  return new Request("https://worker.test/api", {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(value === undefined ? {} : { body: JSON.stringify(value) })
  });
}

describe("invitation reminder HTTP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.listInvitationReminders.mockResolvedValue(result);
    repository.recordInvitationReminders.mockResolvedValue(true);
  });

  it("관리자 인증 후 이력을 조회하고 발송을 기록한다", async () => {
    expect((await handleAdminInvitationReminderRequest(new Request("https://worker.test/api"), env, "sample-garden")).status).toBe(401);
    expect((await handleAdminInvitationReminderRequest(await request("GET"), env, "sample-garden")).status).toBe(200);
    const response = await handleAdminInvitationReminderRequest(await request("POST", {
      linkIds: ["invite_abc"], stage: "d7", channel: "kakao", note: "마감 전 안내"
    }), env, "sample-garden");
    expect(response.status).toBe(201);
    expect(repository.recordInvitationReminders).toHaveBeenCalledWith(env.DB, "sample-garden", {
      linkIds: ["invite_abc"], stage: "d7", channel: "kakao", note: "마감 전 안내"
    });
  });

  it("잘못된 입력과 존재하지 않는 대상을 거부한다", async () => {
    expect((await handleAdminInvitationReminderRequest(await request("POST", {
      linkIds: ["bad"], stage: "d7", channel: "kakao", note: ""
    }), env, "sample-garden")).status).toBe(400);
    repository.recordInvitationReminders.mockResolvedValue(false);
    expect((await handleAdminInvitationReminderRequest(await request("POST", {
      linkIds: ["invite_abc"], stage: "d7", channel: "kakao", note: ""
    }), env, "sample-garden")).status).toBe(404);
  });
});
