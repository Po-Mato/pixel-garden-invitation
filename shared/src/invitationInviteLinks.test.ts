import { describe, expect, it } from "vitest";
import {
  parseInvitationInviteLinkBatch,
  parseInvitationInviteLinkInput,
  parseInvitationInviteLinkUpdate,
  validInvitationInviteToken
} from "./invitationInviteLinks";

describe("invitation invite links", () => {
  it("normalizes a guest link without exposing contact details", () => {
    expect(parseInvitationInviteLinkInput({
      guestName: "  김   하객 ",
      side: "bride",
      groupLabel: "  대학   친구 "
    })).toEqual({ guestName: "김 하객", side: "bride", groupLabel: "대학 친구" });
  });

  it("rejects malformed links and oversized batches", () => {
    expect(parseInvitationInviteLinkInput({ guestName: "", side: "bride", groupLabel: "친구" })).toBeNull();
    expect(parseInvitationInviteLinkInput({ guestName: "하객", side: "both", groupLabel: "친구" })).toBeNull();
    expect(parseInvitationInviteLinkBatch({ links: [] })).toBeNull();
    expect(parseInvitationInviteLinkBatch({ links: Array.from({ length: 101 }, () => ({
      guestName: "하객",
      side: "groom",
      groupLabel: "친구"
    })) })).toBeNull();
  });

  it("accepts partial updates only when at least one valid field exists", () => {
    expect(parseInvitationInviteLinkUpdate({ active: false })).toEqual({ active: false });
    expect(parseInvitationInviteLinkUpdate({ groupLabel: "" })).toEqual({ groupLabel: "" });
    expect(parseInvitationInviteLinkUpdate({})).toBeNull();
    expect(parseInvitationInviteLinkUpdate({ active: "yes" })).toBeNull();
  });

  it("accepts only fixed-length base64url bearer tokens", () => {
    expect(validInvitationInviteToken("A".repeat(43))).toBe(true);
    expect(validInvitationInviteToken("A".repeat(42))).toBe(false);
    expect(validInvitationInviteToken(`${"A".repeat(42)}=`)).toBe(false);
  });
});
