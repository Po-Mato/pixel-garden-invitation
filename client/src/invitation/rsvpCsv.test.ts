import { describe, expect, it, vi } from "vitest";
import type { RsvpAdminResult } from "@wedding-game/shared";
import { buildRsvpCsv, downloadRsvpCsv } from "./rsvpCsv";

const result: RsvpAdminResult = {
  summary: {
    responseCount: 1,
    attendingResponseCount: 1,
    attendingPartySize: 2,
    mealPartySize: 2,
    declinedResponseCount: 0,
    unsureResponseCount: 0,
    unsurePartySize: 0,
    deleteAt: "2027-05-31T14:59:59.000Z"
  },
  responses: [{
    id: "rsvp_1",
    side: "groom",
    guestName: "=HYPERLINK(\"https://example.test\")",
    phone: "01012345678",
    attendance: "yes",
    partySize: 2,
    mealStatus: "yes",
    note: "쉼표, 따옴표 \"와 줄바꿈\n포함",
    consentVersion: "2026-07-20",
    revision: 1,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T01:00:00.000Z"
  }]
};

describe("rsvpCsv", () => {
  it("creates a BOM-prefixed RFC 4180 CSV and neutralizes spreadsheet formulas", () => {
    const csv = buildRsvpCsv(result);

    expect(csv.startsWith("\uFEFF대상,이름,연락처")).toBe(true);
    expect(csv).toContain("\r\n");
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("\"쉼표, 따옴표 \"\"와 줄바꿈\n포함\"");
    expect(csv).not.toContain("editToken");
  });

  it("downloads the generated CSV as a UTF-8 text file", () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:test");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    downloadRsvpCsv(result);

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
    click.mockRestore();
    vi.unstubAllGlobals();
  });
});
