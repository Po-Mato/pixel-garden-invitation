import { describe, expect, it } from "vitest";

import { parseGuestbookSubmission } from "./guestbook";

describe("parseGuestbookSubmission", () => {
  it("정리된 닉네임과 축하 메시지를 반환한다", () => {
    expect(parseGuestbookSubmission({
      nickname: "  하객\u0000  ",
      message: "  결혼을 축하합니다!  "
    })).toEqual({ nickname: "하객", message: "결혼을 축하합니다!" });
  });

  it("빈 값과 잘못된 형식을 거부한다", () => {
    expect(parseGuestbookSubmission({ nickname: "하객", message: "   " })).toBeNull();
    expect(parseGuestbookSubmission({ nickname: "", message: "축하합니다" })).toBeNull();
    expect(parseGuestbookSubmission(null)).toBeNull();
  });

  it("공개 계약 길이에 맞게 값을 제한한다", () => {
    const parsed = parseGuestbookSubmission({ nickname: "가".repeat(30), message: "나".repeat(300) });
    expect(parsed?.nickname).toHaveLength(16);
    expect(parsed?.message).toHaveLength(240);
  });
});
