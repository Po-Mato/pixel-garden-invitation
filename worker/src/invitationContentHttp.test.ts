import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDefaultEditableInvitationContent,
  invitationContent,
  type InvitationContentAdminResult
} from "@wedding-game/shared";
import { handleApiRequest } from "./http";
import { issueAdminToken } from "./security";
import type { Env } from "./index";

const repository = vi.hoisted(() => ({
  getAdminInvitationContent: vi.fn(),
  getPublicInvitationContent: vi.fn(),
  publishInvitationContent: vi.fn(),
  restoreInvitationContentVersion: vi.fn(),
  saveInvitationContentDraft: vi.fn()
}));

vi.mock("./invitationContentRepository", () => repository);

const sessionSecret = "content-admin-session-secret";

function completeContent() {
  const content = buildDefaultEditableInvitationContent(invitationContent.event, invitationContent.content);
  content.familyContacts.contacts.forEach((contact, index) => {
    contact.name ||= `혼주 ${index}`;
    contact.phone = `010-1234-12${index}0`;
  });
  content.giftAccounts.accounts.forEach((account, index) => {
    account.name ||= `혼주 ${index}`;
    account.bank = "은행";
    account.accountNumber = `123-${index}`;
    account.holder = `예금주 ${index}`;
  });
  return content;
}

function adminResult(content = completeContent()): InvitationContentAdminResult {
  return {
    draft: content,
    revision: 1,
    publishedRevision: null,
    updatedAt: "2026-07-22T01:00:00.000Z",
    publishedAt: null,
    history: []
  };
}

function env(): Env {
  return {
    DB: {} as D1Database,
    GARDEN_ROOM: {} as DurableObjectNamespace,
    RSVP_ADMIN_PASSWORD_HASH: "hash",
    RSVP_ADMIN_SESSION_SECRET: sessionSecret,
    RSVP_CLIENT_KEY_SECRET: "client-secret",
    RSVP_ALLOWED_ORIGINS: "https://po-mato.github.io"
  };
}

async function token() {
  return issueAdminToken({ invitationId: "sample-garden", expiresAt: Date.now() + 60_000 }, sessionSecret);
}

function request(path: string, init: RequestInit = {}) {
  return new Request(`https://worker.test${path}`, init);
}

describe("invitation content HTTP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.getPublicInvitationContent.mockResolvedValue({ content: null, revision: null, publishedAt: null });
    repository.getAdminInvitationContent.mockResolvedValue(adminResult());
    repository.saveInvitationContentDraft.mockResolvedValue({ ok: true, result: adminResult() });
    repository.publishInvitationContent.mockResolvedValue({ ok: true, result: { ...adminResult(), publishedRevision: 1 } });
    repository.restoreInvitationContentVersion.mockResolvedValue({ ok: true, result: adminResult() });
  });

  it("공개본 조회는 인증 없이 캐시 가능한 응답을 반환한다", async () => {
    const response = await handleApiRequest(
      request("/api/invitations/sample-garden/content"),
      env(),
      "client"
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("max-age=60");
    await expect(response.json()).resolves.toEqual({ content: null, revision: null, publishedAt: null });
  });

  it("관리자 콘텐츠 조회와 저장에는 초대장 범위의 관리자 토큰이 필요하다", async () => {
    const path = "/api/invitations/sample-garden/admin/content";
    expect((await handleApiRequest(request(path), env(), "client")).status).toBe(401);

    const authorization = `Bearer ${await token()}`;
    const loaded = await handleApiRequest(request(path, { headers: { authorization } }), env(), "client");
    expect(loaded.status).toBe(200);

    const content = completeContent();
    const saved = await handleApiRequest(request(path, {
      method: "PATCH",
      headers: { authorization, "content-type": "application/json" },
      body: JSON.stringify({ revision: 1, content })
    }), env(), "client");
    expect(saved.status).toBe(200);
    expect(repository.saveInvitationContentDraft).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ invitationId: "sample-garden", expectedRevision: 1, content })
    );
  });

  it("미완성 초안은 저장하되 공개 반영은 서버에서도 거부한다", async () => {
    const incomplete = buildDefaultEditableInvitationContent(invitationContent.event, invitationContent.content);
    repository.getAdminInvitationContent.mockResolvedValue(adminResult(incomplete));
    const response = await handleApiRequest(request(
      "/api/invitations/sample-garden/admin/content/publish",
      {
        method: "POST",
        headers: { authorization: `Bearer ${await token()}`, "content-type": "application/json" },
        body: JSON.stringify({ revision: 1 })
      }
    ), env(), "client");

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "content_incomplete",
      issues: ["family_contacts", "gift_accounts"]
    });
    expect(repository.publishInvitationContent).not.toHaveBeenCalled();
  });

  it("완성된 초안의 공개 반영과 이전 버전 복구를 구분한다", async () => {
    const authorization = `Bearer ${await token()}`;
    const publish = await handleApiRequest(request(
      "/api/invitations/sample-garden/admin/content/publish",
      { method: "POST", headers: { authorization }, body: JSON.stringify({ revision: 1 }) }
    ), env(), "client");
    const restore = await handleApiRequest(request(
      "/api/invitations/sample-garden/admin/content/restore",
      { method: "POST", headers: { authorization }, body: JSON.stringify({ revision: 1, versionId: "content_save_1" }) }
    ), env(), "client");

    expect(publish.status).toBe(200);
    expect(restore.status).toBe(200);
    expect(repository.publishInvitationContent).toHaveBeenCalledOnce();
    expect(repository.restoreInvitationContentVersion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ versionId: "content_save_1", expectedRevision: 1 })
    );
  });

  it("제한 크기를 넘는 초안 요청을 본문 파싱 전에 거부한다", async () => {
    const response = await handleApiRequest(request(
      "/api/invitations/sample-garden/admin/content",
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${await token()}`,
          "content-type": "application/json",
          "content-length": String(80 * 1024)
        },
        body: "{}"
      }
    ), env(), "client");

    expect(response.status).toBe(413);
    expect(repository.saveInvitationContentDraft).not.toHaveBeenCalled();
  });
});
