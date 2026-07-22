import { describe, expect, it } from "vitest";
import { invitationContent, type InvitationInviteLinkRecord, type RsvpRecord } from "@wedding-game/shared";
import { buildAttendanceOperations } from "./attendanceOperations";
import { buildReminderQueue, buildReminderSchedules, recommendedReminderStage } from "./reminderOperations";

function link(overrides: Partial<InvitationInviteLinkRecord> = {}): InvitationInviteLinkRecord {
  return {
    id: "invite_a",
    guestName: "김하객",
    side: "bride",
    groupLabel: "대학 친구",
    active: true,
    deliveryChannel: "kakao",
    sendCount: 1,
    firstSentAt: "2027-03-01T00:00:00.000Z",
    lastSentAt: "2027-03-01T00:00:00.000Z",
    deliveryNote: "",
    openCount: 1,
    firstOpenedAt: "2027-03-01T00:00:00.000Z",
    lastOpenedAt: "2027-03-01T00:00:00.000Z",
    respondedAt: null,
    rsvpId: null,
    followUpCompletedAt: null,
    createdAt: "2027-03-01T00:00:00.000Z",
    updatedAt: "2027-03-01T00:00:00.000Z",
    ...overrides
  };
}

function response(overrides: Partial<RsvpRecord> = {}): RsvpRecord {
  return {
    id: "rsvp_a",
    side: "bride",
    guestName: "김하객",
    phone: "01012345678",
    attendance: "yes",
    partySize: 2,
    childCount: 0,
    mealStatus: "yes",
    note: "",
    consentVersion: "2027-01",
    revision: 1,
    createdAt: "2027-03-02T00:00:00.000Z",
    updatedAt: "2027-03-02T00:00:00.000Z",
    ...overrides
  };
}

function operations(links: InvitationInviteLinkRecord[], responses: RsvpRecord[]) {
  return buildAttendanceOperations(
    { summary: { total: links.length, active: links.length, delivered: links.length, opened: links.length, responded: responses.length }, links },
    { summary: { responseCount: responses.length, attendingResponseCount: responses.length, attendingPartySize: 2, mealPartySize: 2, declinedResponseCount: 0, unsureResponseCount: 0, unsurePartySize: 0, deleteAt: "2027-05-31T00:00:00.000Z" }, responses }
  );
}

describe("reminder operations", () => {
  it("응답 완료 하객을 RSVP 재안내에서 제외하고 하루 전 안내에 포함한다", () => {
    const linked = link({ rsvpId: "rsvp_a", respondedAt: "2027-03-02T00:00:00.000Z" });
    const result = operations([linked], [response()]);
    expect(buildReminderQueue("d14", result, [])).toHaveLength(0);
    expect(buildReminderQueue("d1", result, [])[0]?.status).toBe("attending");
  });

  it("같은 단계의 발송 이력을 완료로 표시한다", () => {
    const result = operations([link()], []);
    expect(buildReminderQueue("d7", result, [{
      id: "reminder_a",
      linkId: "invite_a",
      guestName: "김하객",
      side: "bride",
      groupLabel: "대학 친구",
      stage: "d7",
      channel: "kakao",
      note: "",
      sentAt: "2027-04-24T00:00:00.000Z"
    }])[0]?.status).toBe("sent");
  });

  it("예식일 기준 일정과 현재 권장 단계를 계산한다", () => {
    const result = operations([link()], []);
    const schedules = buildReminderSchedules(invitationContent.event, result, []);
    expect(schedules.find(({ stage }) => stage === "d30")?.scheduledAt).toBe("2027-04-01T08:10:00.000Z");
    expect(recommendedReminderStage(invitationContent.event, new Date("2027-04-20T00:00:00.000Z"))).toBe("d14");
  });
});
