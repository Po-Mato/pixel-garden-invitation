import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAdminInviteLinkTokens,
  loadAdminInviteLinkTokens,
  removeAdminInviteLinkToken,
  saveAdminInviteLinkTokens
} from "./inviteLinkAdminTokens";

describe("administrator invite link tokens", () => {
  beforeEach(() => sessionStorage.clear());

  it("keeps generated bearer tokens only in the current browser tab", () => {
    const created = [{
      token: "A".repeat(43),
      link: {
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
        createdAt: "now",
        updatedAt: "now"
      }
    }];
    const saved = saveAdminInviteLinkTokens("sample-garden", {}, created);
    expect(loadAdminInviteLinkTokens("sample-garden")).toEqual(saved);
    expect(removeAdminInviteLinkToken("sample-garden", saved, created[0].link.id)).toEqual({});
    clearAdminInviteLinkTokens("sample-garden");
    expect(loadAdminInviteLinkTokens("sample-garden")).toEqual({});
  });
});
