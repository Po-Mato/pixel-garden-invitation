import { invitationContent } from "@wedding-game/shared";
import { describe, expect, it } from "vitest";
import {
  buildInvitationShareData,
  invitationPublicUrl,
  normalizeInvitationShareUrl
} from "./shareInvitation";

describe("초대장 공유 데이터", () => {
  it("예식 공통 데이터로 공유 제목과 본문을 생성한다", () => {
    expect(buildInvitationShareData(invitationContent.event)).toEqual({
      title: "이승재 · 이건희 결혼식",
      text: [
        "이승재 · 이건희의 결혼식에 초대합니다.",
        "2027년 5월 1일 토요일 오후 5시 10분",
        "MJ컨벤션 5층 파티오볼룸"
      ].join("\n"),
      url: invitationPublicUrl
    });
  });

  it("미리보기·관리자 쿼리와 해시를 공유 URL에서 제거한다", () => {
    expect(normalizeInvitationShareUrl(
      `${invitationPublicUrl}?preview=wedding-day&admin=rsvp#private`
    )).toBe(invitationPublicUrl);
  });
});
