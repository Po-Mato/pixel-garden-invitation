import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "./index";
import { issueAdminToken } from "./security";
import {
  handleAdminGuestInformationRequest,
  handlePublicGuestInformationRequest
} from "./guestInformationHttp";

const repository = vi.hoisted(() => ({
  createGuestAnnouncement: vi.fn(),
  createGuestFaq: vi.fn(),
  deleteGuestInformationItem: vi.fn(),
  getGuestInformationAdmin: vi.fn(),
  getPublishedGuestInformation: vi.fn(),
  recordGuestAnnouncementViews: vi.fn(),
  updateGuestAnnouncement: vi.fn(),
  updateGuestFaq: vi.fn()
}));

vi.mock("./guestInformationRepository", () => repository);

const secret = "guest-information-test-secret";
const env = {
  DB: {} as D1Database,
  RSVP_ADMIN_SESSION_SECRET: secret
} as Env;

const announcement = {
  title: "긴급 안내",
  body: "주차장이 혼잡합니다.",
  tone: "urgent",
  active: true,
  pinned: true,
  startsAt: null,
  endsAt: null,
  actionKind: "directions",
  actionLabel: "길 찾기",
  actionUrl: null,
  sortOrder: 1
};

async function adminRequest(method: string, body?: unknown): Promise<Request> {
  const token = await issueAdminToken({ invitationId: "sample-garden", expiresAt: Date.now() + 60_000 }, secret);
  return new Request("https://worker.test/api", {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

describe("guest information HTTP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.getGuestInformationAdmin.mockResolvedValue({ summary: {}, announcements: [], faqs: [] });
    repository.getPublishedGuestInformation.mockResolvedValue({ announcements: [], faqs: [], generatedAt: "now" });
    repository.createGuestAnnouncement.mockResolvedValue({ id: "notice_1", ...announcement });
    repository.updateGuestAnnouncement.mockResolvedValue({ id: "notice_1", ...announcement });
    repository.deleteGuestInformationItem.mockResolvedValue(true);
  });

  it("관리자 인증과 공지 생성·수정·삭제를 적용한다", async () => {
    const unauthorized = await handleAdminGuestInformationRequest(
      new Request("https://worker.test/api"), env, "sample-garden"
    );
    expect(unauthorized.status).toBe(401);

    const created = await handleAdminGuestInformationRequest(
      await adminRequest("POST", { kind: "announcement", input: announcement }),
      env,
      "sample-garden"
    );
    expect(created.status).toBe(201);
    expect(repository.createGuestAnnouncement).toHaveBeenCalledWith(env.DB, "sample-garden", expect.objectContaining({ title: "긴급 안내" }));

    const updated = await handleAdminGuestInformationRequest(
      await adminRequest("PATCH", announcement), env, "sample-garden", "announcements", "notice_1"
    );
    expect(updated.status).toBe(200);
    expect(repository.updateGuestAnnouncement).toHaveBeenCalled();

    const deleted = await handleAdminGuestInformationRequest(
      await adminRequest("DELETE"), env, "sample-garden", "announcements", "notice_1"
    );
    expect(deleted.status).toBe(204);
  });

  it("공개 목록을 캐시하고 유효한 공지 조회만 기록한다", async () => {
    const response = await handlePublicGuestInformationRequest(
      new Request("https://worker.test/api"), env, "sample-garden"
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("max-age=60");

    const viewed = await handlePublicGuestInformationRequest(new Request("https://worker.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ announcementIds: ["notice_1"] })
    }), env, "sample-garden", "views");
    expect(viewed.status).toBe(204);
    expect(repository.recordGuestAnnouncementViews).toHaveBeenCalledWith(env.DB, "sample-garden", ["notice_1"]);

    const invalid = await handlePublicGuestInformationRequest(new Request("https://worker.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ announcementIds: ["invalid"] })
    }), env, "sample-garden", "views");
    expect(invalid.status).toBe(400);
  });
});
