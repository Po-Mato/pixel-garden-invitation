import { describe, expect, it, vi } from "vitest";
import type { Env } from "./index";
import { handleApiRequest } from "./http";

const handler = vi.hoisted(() => vi.fn().mockResolvedValue(new Response("reminders")));
vi.mock("./invitationReminderHttp", () => ({ handleAdminInvitationReminderRequest: handler }));

describe("invitation reminder routing", () => {
  it("관리자 리마인드 경로를 전용 처리기로 전달한다", async () => {
    const env = { RSVP_ALLOWED_ORIGINS: "" } as Env;
    const request = new Request("https://worker.test/api/invitations/sample-garden/admin/reminders", { method: "POST" });
    const response = await handleApiRequest(request, env, "client");
    expect(await response.text()).toBe("reminders");
    expect(handler).toHaveBeenCalledWith(request, env, "sample-garden");
  });
});
