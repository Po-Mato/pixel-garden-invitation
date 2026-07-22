import { describe, expect, it, vi } from "vitest";
import type { Env } from "./index";
import { handleApiRequest } from "./http";

const handlers = vi.hoisted(() => ({
  handleAdminGuestInformationRequest: vi.fn().mockResolvedValue(new Response("admin")),
  handlePublicGuestInformationRequest: vi.fn().mockResolvedValue(new Response("public"))
}));

vi.mock("./guestInformationHttp", () => handlers);

const env = { RSVP_ALLOWED_ORIGINS: "" } as Env;

describe("guest information routing", () => {
  it("관리자 항목과 공개 조회 경로를 정확히 전달한다", async () => {
    const adminRequest = new Request("https://worker.test/api/invitations/sample-garden/admin/guest-information/faqs/faq_seed_parking", { method: "PATCH" });
    await handleApiRequest(adminRequest, env, "client");
    expect(handlers.handleAdminGuestInformationRequest).toHaveBeenCalledWith(
      adminRequest, env, "sample-garden", "faqs", "faq_seed_parking"
    );

    const publicRequest = new Request("https://worker.test/api/invitations/sample-garden/guest-information/views", { method: "POST" });
    await handleApiRequest(publicRequest, env, "client");
    expect(handlers.handlePublicGuestInformationRequest).toHaveBeenCalledWith(
      publicRequest, env, "sample-garden", "views"
    );
  });
});
