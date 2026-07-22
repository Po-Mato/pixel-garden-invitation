import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveStoredInvitationInvite } from "../invitation/inviteLinkStorage";
import {
  createAdminInvitationInviteLinks,
  createRsvpWithInviteLink,
  fetchAdminInvitationInviteLinks,
  fetchPublicInvitationInvite,
  rotateAdminInvitationInviteLink,
  updateAdminInvitationInviteLink
} from "./invitationInviteLinksApi";
import { installMemoryLocalStorage } from "../test/memoryStorage";

const createRsvp = vi.hoisted(() => vi.fn());
vi.mock("./weddingApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("./weddingApi")>(),
  createRsvp
}));

const token = "A".repeat(43);

describe("invitation invite links API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.stubEnv("VITE_WORKER_URL", "https://worker.test");
    vi.stubEnv("VITE_INVITATION_ID", "sample-garden");
    installMemoryLocalStorage();
    global.fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      summary: { total: 0, active: 0, opened: 0, responded: 0 }, links: [], created: []
    }), { status: 200, headers: { "content-type": "application/json" } }));
  });

  it("uses encoded public and administrator routes", async () => {
    await fetchPublicInvitationInvite(token);
    expect(fetch).toHaveBeenLastCalledWith(
      `https://worker.test/api/invitations/sample-garden/invites/${token}`,
      expect.objectContaining({ method: "GET" })
    );
    await fetchAdminInvitationInviteLinks("admin");
    expect(fetch).toHaveBeenLastCalledWith(
      "https://worker.test/api/invitations/sample-garden/admin/invite-links",
      expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer admin" }) })
    );
  });

  it("sends create, update and rotate actions with administrator authorization", async () => {
    await createAdminInvitationInviteLinks("admin", [{ guestName: "김하객", side: "bride", groupLabel: "친구" }]);
    expect(fetch).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ links: [{ guestName: "김하객", side: "bride", groupLabel: "친구" }] })
    }));
    await updateAdminInvitationInviteLink("admin", "invite_one", { active: false });
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining("/invite_one"), expect.objectContaining({ method: "PATCH" }));
    await rotateAdminInvitationInviteLink("admin", "invite_one");
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining("/invite_one/rotate"), expect.objectContaining({ method: "POST" }));
  });

  it("adds the stored bearer token only to an invited RSVP", async () => {
    const payload = {
      side: "bride" as const,
      guestName: "김하객",
      phone: "01012345678",
      attendance: "yes" as const,
      partySize: 1,
      mealStatus: "yes" as const,
      note: "",
      consentVersion: "v1"
    };
    const botProtection = { turnstileToken: "bot-token", website: "" };
    createRsvp.mockResolvedValue({});
    await createRsvpWithInviteLink(payload, botProtection);
    expect(createRsvp).toHaveBeenCalledWith(payload, botProtection);

    saveStoredInvitationInvite("sample-garden", {
      token,
      invite: { guestName: "김하객", side: "bride", groupLabel: "친구" }
    });
    await createRsvpWithInviteLink(payload, botProtection);
    expect(fetch).toHaveBeenLastCalledWith(
      "https://worker.test/api/invitations/sample-garden/rsvps",
      expect.objectContaining({ headers: expect.objectContaining({ "x-invite-token": token }) })
    );
  });
});
