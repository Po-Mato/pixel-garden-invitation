import { describe, expect, it } from "vitest";
import type { GuestbookAdminResult } from "@wedding-game/shared";

import { buildGuestbookCsv } from "./guestbookCsv";

const result: GuestbookAdminResult = {
  summary: { totalCount: 2, visibleCount: 1, hiddenCount: 1, deleteAt: "2027-05-31T14:59:59.000Z" },
  messages: [
    {
      id: "1",
      nickname: "하객, 하나",
      message: "축하합니다\n행복하세요",
      isHidden: false,
      revision: 1,
      createdAt: "2027-01-01T00:00:00.000Z",
      updatedAt: "2027-01-01T00:00:00.000Z"
    },
    {
      id: "2",
      nickname: "=SUM(A1)",
      message: "+위험한 수식",
      isHidden: true,
      revision: 2,
      createdAt: "2027-01-02T00:00:00.000Z",
      updatedAt: "2027-01-03T00:00:00.000Z"
    }
  ]
};

describe("buildGuestbookCsv", () => {
  it("BOM과 전체 메시지를 포함하고 CSV 수식 실행을 방지한다", () => {
    const csv = buildGuestbookCsv(result);

    expect(csv.startsWith("\uFEFF작성자,메시지,공개 상태")).toBe(true);
    expect(csv).toContain('"하객, 하나"');
    expect(csv).toContain('"축하합니다\n행복하세요"');
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).toContain("'+위험한 수식");
    expect(csv).toContain("비공개");
  });
});
