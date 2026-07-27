import { invitationContent } from "@wedding-game/shared";
import { describe, expect, it } from "vitest";
import { invitationPriorityActions } from "./invitationPriorityActions";

describe("invitationPriorityActions", () => {
  const event = invitationContent.event;

  it("답변 전에는 참석 답변을 가장 먼저 제안한다", () => {
    expect(invitationPriorityActions(event, false, new Date("2027-04-01T12:00:00+09:00"))[0]).toMatchObject({
      id: "rsvp",
      label: "참석 답변"
    });
  });

  it("답변한 하객에게 일정과 길 안내를 먼저 제안한다", () => {
    expect(invitationPriorityActions(event, true, new Date("2027-04-01T12:00:00+09:00")).map(({ id }) => id)).toEqual([
      "schedule",
      "directions",
      "rsvp"
    ]);
  });

  it("예식 당일에는 오시는 길을 가장 먼저 제안한다", () => {
    expect(invitationPriorityActions(event, true, new Date("2027-05-01T16:30:00+09:00"))[0].id).toBe("directions");
  });

  it("예식 후에는 축하 메시지와 사진을 먼저 제안한다", () => {
    expect(invitationPriorityActions(event, true, new Date("2027-05-02T12:00:00+09:00")).map(({ id }) => id)).toEqual([
      "guestbook",
      "gallery",
      "directions"
    ]);
  });
});
