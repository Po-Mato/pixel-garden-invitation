import { describe, expect, it } from "vitest";
import { parseInviteLinkBulkInput } from "./inviteLinkBulkInput";

describe("invite link bulk input", () => {
  it("parses comma and tab separated Korean side labels", () => {
    expect(parseInviteLinkBulkInput("김하객, 신부측, 대학 친구\n이하객\t신랑\t직장")).toEqual({
      error: "",
      links: [
        { guestName: "김하객", side: "bride", groupLabel: "대학 친구" },
        { guestName: "이하객", side: "groom", groupLabel: "직장" }
      ]
    });
  });

  it("reports the exact malformed row", () => {
    expect(parseInviteLinkBulkInput("김하객,기타,친구").error).toContain("1번째 줄");
    expect(parseInviteLinkBulkInput("").error).toContain("없습니다");
  });
});
