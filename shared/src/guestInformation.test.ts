import { describe, expect, it } from "vitest";
import {
  parseGuestAnnouncementInput,
  parseGuestAnnouncementViewIds,
  parseGuestFaqInput,
  parseGuestInformationCreateInput
} from "./guestInformation";

const announcement = {
  title: "주차장 혼잡 안내",
  body: "현재 지하 주차장이 혼잡합니다.",
  tone: "urgent",
  active: true,
  pinned: true,
  startsAt: "2027-05-01T08:00:00+09:00",
  endsAt: "2027-05-01T20:00:00+09:00",
  actionKind: "directions",
  actionLabel: "지도 열기",
  actionUrl: null,
  sortOrder: 1
};

describe("guest information validation", () => {
  it("공지 입력을 정규화하고 예약 시각을 ISO 문자열로 변환한다", () => {
    expect(parseGuestAnnouncementInput(announcement)).toMatchObject({
      title: "주차장 혼잡 안내",
      startsAt: "2027-04-30T23:00:00.000Z",
      endsAt: "2027-05-01T11:00:00.000Z",
      actionUrl: null
    });
  });

  it("종료가 시작보다 빠르거나 안전하지 않은 외부 링크를 거부한다", () => {
    expect(parseGuestAnnouncementInput({ ...announcement, endsAt: announcement.startsAt })).toBeNull();
    expect(parseGuestAnnouncementInput({
      ...announcement,
      actionKind: "external",
      actionUrl: "http://example.com"
    })).toBeNull();
  });

  it("FAQ와 생성 요청을 검증한다", () => {
    const faq = {
      category: "교통·주차",
      question: "주차는 가능한가요?",
      answer: "2시간 무료 주차가 가능합니다.",
      active: true,
      featured: true,
      sortOrder: 10
    };
    expect(parseGuestFaqInput(faq)).toEqual(faq);
    expect(parseGuestInformationCreateInput({ kind: "faq", input: faq })).toEqual({ kind: "faq", input: faq });
    expect(parseGuestFaqInput({ ...faq, question: "" })).toBeNull();
  });

  it("공지 조회 식별자를 중복 제거하고 허용 개수를 제한한다", () => {
    expect(parseGuestAnnouncementViewIds({ announcementIds: ["notice_a", "notice_a", "notice_b-1"] }))
      .toEqual(["notice_a", "notice_b-1"]);
    expect(parseGuestAnnouncementViewIds({ announcementIds: [] })).toBeNull();
    expect(parseGuestAnnouncementViewIds({ announcementIds: ["faq_wrong"] })).toBeNull();
  });
});
