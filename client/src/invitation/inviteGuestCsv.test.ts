import { describe, expect, it } from "vitest";
import { buildInviteGuestCsv, parseInviteGuestCsv } from "./inviteGuestCsv";

const record = {
  id: "invite_1",
  guestName: "=위험한 이름",
  side: "bride" as const,
  groupLabel: "대학, 친구",
  active: true,
  deliveryChannel: "kakao" as const,
  sendCount: 2,
  firstSentAt: "2026-07-22T00:00:00.000Z",
  lastSentAt: "2026-07-22T01:00:00.000Z",
  deliveryNote: "재발송",
  openCount: 1,
  firstOpenedAt: "2026-07-22T02:00:00.000Z",
  lastOpenedAt: "2026-07-22T02:00:00.000Z",
  respondedAt: null,
  rsvpId: null,
  followUpCompletedAt: null,
  createdAt: "2026-07-22T00:00:00.000Z",
  updatedAt: "2026-07-22T02:00:00.000Z"
};

describe("invite guest CSV", () => {
  it("imports Excel-compatible headers, quoted commas and BOM", () => {
    expect(parseInviteGuestCsv('\uFEFF이름,측,그룹\r\n김하객,신부측,"대학, 친구"')).toEqual({
      links: [{ guestName: "김하객", side: "bride", groupLabel: "대학, 친구" }],
      error: ""
    });
  });

  it("rejects malformed and oversized recipient rows", () => {
    expect(parseInviteGuestCsv("이름,측,그룹\n김하객,양가,친구").error).toContain("확인");
    expect(parseInviteGuestCsv(Array.from({ length: 101 }, (_, index) => `하객${index},신부측,친구`).join("\n")).error)
      .toContain("최대 100명");
  });

  it("exports delivery state without contact data and escapes spreadsheet formulas", () => {
    const csv = buildInviteGuestCsv([record], { [record.id]: "A".repeat(43) });
    expect(csv).toContain("발송상태");
    expect(csv).toContain("재발송");
    expect(csv).toContain("'=위험한 이름");
    expect(csv).not.toContain("연락처");
    expect(csv).toContain("?invite=");
  });
});
