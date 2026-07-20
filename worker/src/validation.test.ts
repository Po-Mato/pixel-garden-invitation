import { describe, expect, it } from "vitest";
import { parseGuestbookPayload, parseRsvpPayload } from "./validation";

describe("parseRsvpPayload", () => {
  const consentVersion = "2026-07-20";
  const base = {
    side: "groom",
    guestName: " 이승재 ",
    phone: "010-1234-5678",
    attendance: "yes",
    partySize: 2,
    mealStatus: "yes",
    note: " 창가 자리 ",
    consentVersion
  };

  it("accepts the canonical attending RSVP", () => {
    expect(
      parseRsvpPayload(base, consentVersion)
    ).toEqual({
      side: "groom",
      guestName: "이승재",
      phone: "01012345678",
      attendance: "yes",
      partySize: 2,
      mealStatus: "yes",
      note: "창가 자리",
      consentVersion
    });
  });

  it("accepts the canonical declined RSVP", () => {
    expect(
      parseRsvpPayload({ ...base, attendance: "no", partySize: 0, mealStatus: "not_applicable" }, consentVersion)
    ).toEqual({
      ...base,
      guestName: "이승재",
      phone: "01012345678",
      note: "창가 자리",
      attendance: "no",
      partySize: 0,
      mealStatus: "not_applicable"
    });
  });

  it("accepts the canonical unsure RSVP", () => {
    expect(
      parseRsvpPayload({ ...base, attendance: "unsure", mealStatus: "unsure" }, consentVersion)
    ).toEqual({
      ...base,
      guestName: "이승재",
      phone: "01012345678",
      note: "창가 자리",
      attendance: "unsure",
      mealStatus: "unsure"
    });
  });

  it("rejects an invalid contact number", () => {
    expect(parseRsvpPayload({ ...base, phone: "010-12" }, consentVersion)).toBeNull();
  });

  it("rejects a stale consent version", () => {
    expect(parseRsvpPayload({ ...base, consentVersion: "old" }, consentVersion)).toBeNull();
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
