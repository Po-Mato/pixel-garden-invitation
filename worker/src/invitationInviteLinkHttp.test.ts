import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "./index";
import {
  handleAdminInvitationInviteLinkRequest,
  handlePublicInvitationInviteLinkRequest
} from "./invitationInviteLinkHttp";

const repository = vi.hoisted(() => ({
  listInvitationInviteLinks: vi.fn(),
  createInvitationInviteLinks: vi.fn(),
  updateInvitationInviteLink: vi.fn(),
  rotateInvitationInviteLink: vi.fn(),
  deleteInvitationInviteLink: vi.fn(),
  openInvitationInviteLink: vi.fn()
}));
const verifyAdminToken = vi.hoisted(() => vi.fn());

vi.mock("./invitationInviteLinkRepository", () => repository);
vi.mock("./security", async (importOriginal) => ({
  ...await importOriginal<typeof import("./security")>(),
  verifyAdminToken
}));

const token = "A".repeat(43);
const link = {
  id: "invite_00000000-0000-4000-8000-000000000001",
  guestName: "김하객",
  side: "bride" as const,
  groupLabel: "친구",
  active: true,
  openCount: 0,
  firstOpenedAt: null,
  lastOpenedAt: null,
  respondedAt: null,
  rsvpId: null,
  createdAt: "2026-07-22T00:00:00.000Z",
  updatedAt: "2026-07-22T00:00:00.000Z"
};
const result = { summary: { total: 1, active: 1, opened: 0, responded: 0 }, links: [link] };
const env = {
  DB: {} as D1Database,
  RSVP_ADMIN_SESSION_SECRET: "session-secret"
} as Env;

function adminRequest(method: string, body?: unknown): Request {
  return new Request("https://worker.test/api/invitations/sample-garden/admin/invite-links", {
    method,
    headers: {
      authorization: "Bearer admin-token",
      ...(body === undefined ? {} : { "content-type": "application/json" })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

describe("invitation invite link HTTP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAdminToken.mockResolvedValue({ invitationId: "sample-garden", expiresAt: Date.now() + 1_000 });
    repository.listInvitationInviteLinks.mockResolvedValue(result);
    repository.createInvitationInviteLinks.mockResolvedValue([{ link, token }]);
    repository.updateInvitationInviteLink.mockResolvedValue(link);
    repository.rotateInvitationInviteLink.mockResolvedValue({ link, token });
    repository.deleteInvitationInviteLink.mockResolvedValue(true);
    repository.openInvitationInviteLink.mockResolvedValue({ guestName: "김하객", side: "bride", groupLabel: "친구" });
  });

  it("requires the shared administrator session", async () => {
    verifyAdminToken.mockResolvedValue(null);
    const response = await handleAdminInvitationInviteLinkRequest(adminRequest("GET"), env, "sample-garden");
    expect(response.status).toBe(401);
    expect(repository.listInvitationInviteLinks).not.toHaveBeenCalled();
  });

  it("lists and batch-creates links", async () => {
    const listed = await handleAdminInvitationInviteLinkRequest(adminRequest("GET"), env, "sample-garden");
    expect(await listed.json()).toEqual(result);

    const created = await handleAdminInvitationInviteLinkRequest(adminRequest("POST", {
      links: [{ guestName: " 김하객 ", side: "bride", groupLabel: " 친구 " }]
    }), env, "sample-garden");
    expect(created.status).toBe(201);
    expect(repository.createInvitationInviteLinks).toHaveBeenCalledWith(env.DB, "sample-garden", [{
      guestName: "김하객", side: "bride", groupLabel: "친구"
    }]);
    expect(await created.json()).toMatchObject({ created: [{ token }], summary: result.summary });
  });

  it("rejects malformed creation and update bodies", async () => {
    const created = await handleAdminInvitationInviteLinkRequest(adminRequest("POST", { links: [] }), env, "sample-garden");
    expect(created.status).toBe(400);
    const updated = await handleAdminInvitationInviteLinkRequest(
      adminRequest("PATCH", {}), env, "sample-garden", link.id
    );
    expect(updated.status).toBe(400);
  });

  it("updates, rotates and deletes a link", async () => {
    const updated = await handleAdminInvitationInviteLinkRequest(
      adminRequest("PATCH", { active: false }), env, "sample-garden", link.id
    );
    expect(updated.status).toBe(200);
    expect(repository.updateInvitationInviteLink).toHaveBeenCalledWith(
      env.DB, "sample-garden", link.id, { active: false }
    );

    const rotated = await handleAdminInvitationInviteLinkRequest(
      adminRequest("POST"), env, "sample-garden", link.id, "rotate"
    );
    expect(await rotated.json()).toMatchObject({ created: [{ token }] });

    const deleted = await handleAdminInvitationInviteLinkRequest(
      adminRequest("DELETE"), env, "sample-garden", link.id
    );
    expect(deleted.status).toBe(204);
  });

  it("resolves only active fixed-format public tokens", async () => {
    const response = await handlePublicInvitationInviteLinkRequest(
      new Request(`https://worker.test/api/invitations/sample-garden/invites/${token}`),
      env,
      "sample-garden",
      token
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ guestName: "김하객", side: "bride", groupLabel: "친구" });
    const invalid = await handlePublicInvitationInviteLinkRequest(
      new Request("https://worker.test/"), env, "sample-garden", "short"
    );
    expect(invalid.status).toBe(404);
    expect(repository.openInvitationInviteLink).toHaveBeenCalledTimes(1);
  });
});
