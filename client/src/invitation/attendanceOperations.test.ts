import { describe, expect, it } from "vitest";
import type { InvitationInviteLinkAdminResult, RsvpAdminResult } from "@wedding-game/shared";
import { buildAttendanceOperations } from "./attendanceOperations";

const linkBase = {
  active: true,
  deliveryChannel: "kakao" as const,
  sendCount: 1,
  firstSentAt: "2027-04-01T00:00:00.000Z",
  lastSentAt: "2027-04-01T00:00:00.000Z",
  deliveryNote: "",
  openCount: 1,
  firstOpenedAt: "2027-04-02T00:00:00.000Z",
  lastOpenedAt: "2027-04-02T00:00:00.000Z",
  respondedAt: null,
  rsvpId: null,
  followUpCompletedAt: null,
  createdAt: "2027-04-01T00:00:00.000Z",
  updatedAt: "2027-04-02T00:00:00.000Z"
};

const invites: InvitationInviteLinkAdminResult = {
  summary: { total: 3, active: 3, delivered: 2, opened: 2, responded: 1 },
  links: [
    { ...linkBase, id: "invite_1", guestName: "김하객", side: "bride", groupLabel: "대학", respondedAt: "2027-04-03T00:00:00.000Z", rsvpId: "rsvp_1" },
    { ...linkBase, id: "invite_2", guestName: "박하객", side: "bride", groupLabel: "대학", sendCount: 0, firstSentAt: null, lastSentAt: null, openCount: 0, firstOpenedAt: null, lastOpenedAt: null },
    { ...linkBase, id: "invite_3", guestName: "이하객", side: "groom", groupLabel: "직장", followUpCompletedAt: "2027-04-10T00:00:00.000Z" }
  ]
};

const rsvps: RsvpAdminResult = {
  summary: { responseCount: 2, attendingResponseCount: 2, attendingPartySize: 5, mealPartySize: 3, declinedResponseCount: 0, unsureResponseCount: 0, unsurePartySize: 0, deleteAt: "2027-05-31T00:00:00.000Z" },
  responses: [
    { id: "rsvp_1", side: "bride", guestName: "김하객", phone: "01012345678", attendance: "yes", partySize: 3, childCount: 1, mealStatus: "yes", note: "유아 의자", consentVersion: "v1", revision: 1, createdAt: "2027-04-03T00:00:00.000Z", updatedAt: "2027-04-03T00:00:00.000Z" },
    { id: "rsvp_2", side: "groom", guestName: "초대 없는 하객", phone: "01099998888", attendance: "yes", partySize: 2, childCount: 0, mealStatus: "no", note: "", consentVersion: "v1", revision: 1, createdAt: "2027-04-04T00:00:00.000Z", updatedAt: "2027-04-04T00:00:00.000Z" }
  ]
};

describe("attendance operations", () => {
  it("joins only explicit invite RSVP ids and calculates group headcounts", () => {
    const operations = buildAttendanceOperations(invites, rsvps);
    expect(operations.summary).toMatchObject({
      invited: 3,
      responded: 1,
      attendingPartySize: 5,
      adultPartySize: 4,
      childPartySize: 1,
      mealPartySize: 3,
      followUpNeeded: 1,
      unsent: 1,
      unopened: 0,
      unresponded: 1,
      unmatchedResponses: 1
    });
    expect(operations.groups.find(({ key }) => key === "bride:대학")).toMatchObject({
      invited: 2, responded: 1, attendingPartySize: 3, adultPartySize: 2, childPartySize: 1
    });
    expect(operations.entries.find(({ key }) => key === "invite_2")?.stage).toBe("unsent");
    expect(operations.entries.find(({ key }) => key === "invite_3")?.stage).toBe("contacted");
  });

  it("reports orphaned and mismatched data without merging by name", () => {
    const operations = buildAttendanceOperations({
      ...invites,
      links: [{ ...invites.links[0], guestName: "다른 이름", side: "groom" }]
    }, rsvps);
    expect(operations.issues).toEqual(expect.arrayContaining([
      expect.stringContaining("이름 또는 대상이 다릅니다"),
      expect.stringContaining("연결되지 않은 RSVP")
    ]));
    expect(operations.entries).toHaveLength(2);
  });
});
