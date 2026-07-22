import { describe, expect, it } from "vitest";
import { buildAttendanceOperationsCsv } from "./attendanceOperationsCsv";
import type { AttendanceOperations } from "./attendanceOperations";

describe("attendance operations CSV", () => {
  it("exports operational fields and neutralizes spreadsheet formulas", () => {
    const operations = {
      summary: {
        invited: 1, delivered: 1, opened: 1, responded: 1,
        attendingPartySize: 3, adultPartySize: 2, childPartySize: 1, mealPartySize: 3,
        unsurePartySize: 0, followUpNeeded: 0, unsent: 0, unopened: 0, unresponded: 0, unmatchedResponses: 0
      }, groups: [], issues: [],
      entries: [{
        key: "invite_1",
        stage: "responded",
        issues: ["확인 필요"],
        link: {
          id: "invite_1", guestName: "=FORMULA", side: "bride", groupLabel: "대학", active: true,
          deliveryChannel: "kakao", sendCount: 1, firstSentAt: "2027-04-01", lastSentAt: "2027-04-01", deliveryNote: "",
          openCount: 1, firstOpenedAt: "2027-04-02", lastOpenedAt: "2027-04-02", respondedAt: "2027-04-03", rsvpId: "rsvp_1",
          followUpCompletedAt: null, createdAt: "2027-04-01", updatedAt: "2027-04-03"
        },
        response: {
          id: "rsvp_1", side: "bride", guestName: "=FORMULA", phone: "01012345678", attendance: "yes", partySize: 3,
          childCount: 1, mealStatus: "yes", note: "유아 의자", consentVersion: "v1", revision: 1, createdAt: "2027-04-03", updatedAt: "2027-04-03"
        }
      }]
    } satisfies AttendanceOperations;
    const csv = buildAttendanceOperationsCsv(operations);
    expect(csv.startsWith("\uFEFF대상,관계그룹,이름")).toBe(true);
    expect(csv).toContain("어린이인원");
    expect(csv).toContain("신부측,대학,\"'=FORMULA\"");
    expect(csv).not.toContain("token");
  });
});
