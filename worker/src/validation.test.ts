import { describe, expect, it } from "vitest";
import { parseGuestbookPayload, parseRsvpPayload } from "./validation";

describe("parseRsvpPayload", () => {
  it("accepts a valid RSVP", () => {
    expect(
      parseRsvpPayload({
        guestName: "이승재",
        attendance: "yes",
        partySize: 2,
        note: "주차 필요",
      }),
    ).toEqual({
      guestName: "이승재",
      attendance: "yes",
      partySize: 2,
      note: "주차 필요",
    });
  });

  it("rejects invalid RSVP data", () => {
    expect(parseRsvpPayload({ guestName: "", attendance: "bad", partySize: 99 })).toBeNull();
  });
});

describe("parseGuestbookPayload", () => {
  it("accepts a valid guestbook message", () => {
    expect(parseGuestbookPayload({ nickname: "하객1", message: "축하합니다" })).toEqual({
      nickname: "하객1",
      message: "축하합니다",
    });
  });

  it("rejects empty messages", () => {
    expect(parseGuestbookPayload({ nickname: "하객1", message: "   " })).toBeNull();
  });
});
