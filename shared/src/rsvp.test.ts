import { describe, expect, it } from "vitest";
import { normalizeRsvpPhone, parseRsvpSubmission } from "./rsvp";

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

describe("parseRsvpSubmission", () => {
  it("normalizes a valid attending response", () => {
    expect(parseRsvpSubmission(base, consentVersion)).toEqual({
      ...base,
      guestName: "이승재",
      phone: "01012345678",
      note: "창가 자리"
    });
  });

  it.each([
    [{ ...base, attendance: "no", partySize: 1, mealStatus: "not_applicable" }],
    [{ ...base, attendance: "no", partySize: 0, mealStatus: "yes" }],
    [{ ...base, attendance: "unsure", partySize: 2, mealStatus: "yes" }],
    [{ ...base, consentVersion: "old" }]
  ])("rejects invalid conditional data %#", (value) => {
    expect(parseRsvpSubmission(value, consentVersion)).toBeNull();
  });

  it("accepts canonical no and unsure responses", () => {
    expect(parseRsvpSubmission({ ...base, attendance: "no", partySize: 0, mealStatus: "not_applicable" }, consentVersion)).not.toBeNull();
    expect(parseRsvpSubmission({ ...base, attendance: "unsure", partySize: 2, mealStatus: "unsure" }, consentVersion)).not.toBeNull();
  });

  it("accepts a bounded child count and keeps legacy payloads compatible", () => {
    expect(parseRsvpSubmission({ ...base, partySize: 3, childCount: 1 }, consentVersion))
      .toMatchObject({ partySize: 3, childCount: 1 });
    expect(parseRsvpSubmission(base, consentVersion)).not.toHaveProperty("childCount");
    expect(parseRsvpSubmission({ ...base, childCount: 3 }, consentVersion)).toBeNull();
    expect(parseRsvpSubmission({ ...base, childCount: -1 }, consentVersion)).toBeNull();
  });
});

it("normalizes domestic and international separators", () => {
  expect(normalizeRsvpPhone("+82 10-1234-5678")).toBe("821012345678");
});
