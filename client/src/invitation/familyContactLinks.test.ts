import { describe, expect, it } from "vitest";
import { buildFamilyContactLinks } from "./familyContactLinks";

describe("혼주 연락처 링크", () => {
  it("휴대전화 번호로 전화와 문자 링크를 만든다", () => {
    expect(buildFamilyContactLinks("010-1234-5678")).toEqual({
      telephone: "tel:01012345678",
      sms: "sms:01012345678"
    });
  });

  it("유선전화에는 전화 링크만 제공한다", () => {
    expect(buildFamilyContactLinks("032-347-5500")).toEqual({
      telephone: "tel:0323475500",
      sms: null
    });
  });

  it("미입력 또는 잘못된 번호를 공개 링크로 만들지 않는다", () => {
    expect(buildFamilyContactLinks("")).toEqual({ telephone: null, sms: null });
    expect(buildFamilyContactLinks("1234")).toEqual({ telephone: null, sms: null });
  });
});
