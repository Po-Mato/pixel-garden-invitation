import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InvitationReleaseAdminResult } from "@wedding-game/shared";

vi.mock("./security", () => ({ verifyAdminToken: vi.fn() }));
vi.mock("./invitationReleaseRepository", () => ({
  getAdminInvitationRelease: vi.fn(),
  getPublicInvitationRelease: vi.fn(),
  publishInvitationRelease: vi.fn(),
  scheduleInvitationRelease: vi.fn(),
  cancelInvitationReleaseSchedule: vi.fn(),
  restoreInvitationRelease: vi.fn()
}));

import {
  handleAdminInvitationReleaseRequest,
  handlePublicInvitationReleaseRequest
} from "./invitationReleaseHttp";
import * as repository from "./invitationReleaseRepository";
import { verifyAdminToken } from "./security";
import type { Env } from "./index";

const mockedRepository = vi.mocked(repository);
const mockedVerify = vi.mocked(verifyAdminToken);

function result(): InvitationReleaseAdminResult {
  return {
    content: { draftRevision: 2, publishedRevision: 1, updatedAt: null, publishedAt: null, ready: true, changed: true, issues: [] },
    gallery: { draftRevision: 3, publishedRevision: 2, updatedAt: null, publishedAt: null, ready: true, changed: true, issues: [] },
    schedule: null,
    latestRelease: null,
    history: []
  };
}

function request(path: string, body?: unknown) {
  return new Request(`https://worker.test${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: "Bearer admin-token",
      ...(body === undefined ? {} : { "content-type": "application/json" })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

describe("invitation release HTTP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedVerify.mockResolvedValue({ invitationId: "sample-garden", expiresAt: Date.now() + 60_000 });
    mockedRepository.getAdminInvitationRelease.mockResolvedValue(result());
    mockedRepository.getPublicInvitationRelease.mockResolvedValue({
      content: null,
      gallery: null,
      releaseNumber: null,
      contentRevision: null,
      galleryRevision: null,
      publishedAt: null
    });
    mockedRepository.publishInvitationRelease.mockResolvedValue({ ok: true, result: result() });
    mockedRepository.scheduleInvitationRelease.mockResolvedValue({ ok: true, result: result() });
    mockedRepository.cancelInvitationReleaseSchedule.mockResolvedValue({ ok: true, result: result() });
    mockedRepository.restoreInvitationRelease.mockResolvedValue({ ok: true, result: result() });
  });

  it("관리자 인증 후 통합 공개 상태를 반환한다", async () => {
    const response = await handleAdminInvitationReleaseRequest(
      request("/api/invitations/sample-garden/admin/releases"),
      { DB: {} as D1Database, RSVP_ADMIN_SESSION_SECRET: "secret" } as Env,
      "sample-garden",
      "releases"
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ content: { draftRevision: 2 } });
  });

  it("공개 화면에는 문구와 사진을 하나의 캐시 응답으로 반환한다", async () => {
    const response = await handlePublicInvitationReleaseRequest(
      new Request("https://worker.test/api/invitations/sample-garden/release"),
      { DB: {} as D1Database } as Env,
      "sample-garden"
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=60, stale-while-revalidate=300");
    expect(mockedVerify).not.toHaveBeenCalled();
  });

  it("두 초안 리비전을 함께 전달해 즉시 공개한다", async () => {
    const response = await handleAdminInvitationReleaseRequest(
      request("/api/invitations/sample-garden/admin/releases/publish", { contentRevision: 2, galleryRevision: 3 }),
      { DB: {} as D1Database, RSVP_ADMIN_SESSION_SECRET: "secret" } as Env,
      "sample-garden",
      "publish"
    );
    expect(response.status).toBe(200);
    expect(mockedRepository.publishInvitationRelease).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        invitationId: "sample-garden",
        expectedContentRevision: 2,
        expectedGalleryRevision: 3
      })
    );
  });

  it("잘못된 예약 시간과 복원 ID를 거부한다", async () => {
    const env = { DB: {} as D1Database, RSVP_ADMIN_SESSION_SECRET: "secret" } as Env;
    const schedule = await handleAdminInvitationReleaseRequest(
      request("/api/invitations/sample-garden/admin/releases/schedule", {
        contentRevision: 2,
        galleryRevision: 3,
        scheduledFor: "invalid"
      }),
      env,
      "sample-garden",
      "schedule"
    );
    const restore = await handleAdminInvitationReleaseRequest(
      request("/api/invitations/sample-garden/admin/releases/restore", { releaseId: "bad" }),
      env,
      "sample-garden",
      "restore"
    );
    expect(schedule.status).toBe(400);
    expect(restore.status).toBe(400);
    expect(mockedRepository.scheduleInvitationRelease).not.toHaveBeenCalled();
    expect(mockedRepository.restoreInvitationRelease).not.toHaveBeenCalled();
  });

  it("인증 실패와 저장소 충돌을 구분한다", async () => {
    mockedVerify.mockResolvedValueOnce(null);
    const unauthorized = await handleAdminInvitationReleaseRequest(
      request("/api/invitations/sample-garden/admin/releases"),
      { DB: {} as D1Database, RSVP_ADMIN_SESSION_SECRET: "secret" } as Env,
      "sample-garden",
      "releases"
    );
    mockedRepository.cancelInvitationReleaseSchedule.mockResolvedValueOnce({ ok: false, reason: "conflict" });
    const conflict = await handleAdminInvitationReleaseRequest(
      request("/api/invitations/sample-garden/admin/releases/cancel", {}),
      { DB: {} as D1Database, RSVP_ADMIN_SESSION_SECRET: "secret" } as Env,
      "sample-garden",
      "cancel"
    );
    expect(unauthorized.status).toBe(401);
    expect(conflict.status).toBe(409);
  });
});
