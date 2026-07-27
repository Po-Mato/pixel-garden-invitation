import type { RsvpHistoryEntry, RsvpRecord } from "@wedding-game/shared";
import { describe, expect, it } from "vitest";
import { getRsvpHistoryChanges } from "./rsvpHistoryChanges";

const baseResponse: RsvpRecord = {
  id: "rsvp-1",
  side: "bride",
  guestName: "김하객",
  phone: "01012345678",
  attendance: "yes",
  partySize: 1,
  childCount: 0,
  mealStatus: "yes",
  note: "",
  consentVersion: "2026-07-20",
  revision: 1,
  createdAt: "2027-04-01T00:00:00.000Z",
  updatedAt: "2027-04-01T00:00:00.000Z"
};

function history(response: RsvpRecord, revision: number): RsvpHistoryEntry {
  return {
    id: `history-${revision}`,
    action: revision === 1 ? "created" : "updated",
    revision,
    response,
    occurredAt: response.updatedAt
  };
}

describe("getRsvpHistoryChanges", () => {
  it("변경 전후 값을 한국어로 표현하고 연락처를 가린다", () => {
    const previous = history(baseResponse, 1);
    const current = history({
      ...baseResponse,
      phone: "01099994321",
      partySize: 3,
      childCount: 1,
      note: "창가 자리",
      revision: 2
    }, 2);

    expect(getRsvpHistoryChanges(current, previous)).toEqual([
      { field: "phone", label: "연락처", before: "***-****-5678", after: "***-****-4321" },
      { field: "partySize", label: "인원", before: "1명", after: "3명" },
      { field: "childCount", label: "어린이", before: "0명", after: "1명" },
      { field: "note", label: "전달사항", before: "없음", after: "창가 자리" }
    ]);
  });

  it("이전 이력이 없으면 비교 행을 만들지 않는다", () => {
    expect(getRsvpHistoryChanges(history(baseResponse, 1))).toEqual([]);
  });
});
