import { describe, expect, it } from "vitest";
import { invitationContent } from "./content";

describe("invitationContent", () => {
  it("contains every MVP world spot", () => {
    expect(invitationContent.spots.map((spot) => spot.id)).toEqual([
      "wedding-info",
      "directions",
      "rsvp",
      "guestbook",
      "couple",
      "gallery",
      "story"
    ]);
  });

  it("contains the confirmed wedding event", () => {
    expect(invitationContent.event).toEqual({
      couple: { groom: "이승재", bride: "이건희" },
      title: "이승재 · 이건희 결혼식",
      startAt: "2027-05-01T17:10:00+09:00",
      endAt: "2027-05-01T18:40:00+09:00",
      timeZone: "Asia/Seoul",
      rsvp: {
        responseDeadline: "2027-04-24T23:59:59+09:00",
        deleteAt: "2027-05-31T23:59:59+09:00",
        consentVersion: "2026-07-20"
      },
      guestbook: {
        deleteAt: "2027-05-31T23:59:59+09:00"
      },
      familyContacts: {
        notice: "축하와 문의 연락은 편하신 쪽으로 전해주세요.",
        contacts: expect.arrayContaining([
          expect.objectContaining({ id: "groom", side: "groom", relation: "신랑", name: "이승재" }),
          expect.objectContaining({ id: "bride", side: "bride", relation: "신부", name: "이건희" })
        ])
      },
      giftAccounts: {
        notice: "축하의 마음만으로도 충분히 감사드립니다.",
        accounts: expect.arrayContaining([
          expect.objectContaining({ id: "groom", side: "groom", relation: "신랑", name: "이승재" }),
          expect.objectContaining({ id: "bride", side: "bride", relation: "신부", name: "이건희" })
        ])
      },
      venue: {
        name: "MJ컨벤션",
        hall: "5층 파티오볼룸",
        address: "경기 부천시 소사구 경인로 386",
        directions: {
          mapSearchName: "MJ컨벤션",
          phone: "032-347-5500",
          transit: "1호선·서해선 소사역 1번 출구에서 도보 약 3분",
          parking: "주차 2시간 무료 · 약 500대 이상 주차 가능"
        }
      }
    });
  });

  it("신랑·신부와 양가 부모님 연락처 자리를 각각 마련한다", () => {
    const contacts = invitationContent.event.familyContacts.contacts;

    expect(contacts.map((contact) => contact.id)).toEqual([
      "groom",
      "groom-father",
      "groom-mother",
      "bride",
      "bride-father",
      "bride-mother"
    ]);
    expect(contacts.filter((contact) => contact.side === "groom")).toHaveLength(3);
    expect(contacts.filter((contact) => contact.side === "bride")).toHaveLength(3);
    expect(contacts.every((contact) => contact.phone === "")).toBe(true);
  });

  it("신랑·신부와 양가 부모님 계좌 및 간편송금 자리를 각각 마련한다", () => {
    const accounts = invitationContent.event.giftAccounts.accounts;

    expect(accounts.map((account) => account.id)).toEqual([
      "groom",
      "groom-father",
      "groom-mother",
      "bride",
      "bride-father",
      "bride-mother"
    ]);
    expect(accounts.filter((account) => account.side === "groom")).toHaveLength(3);
    expect(accounts.filter((account) => account.side === "bride")).toHaveLength(3);
    expect(accounts.every((account) => (
      account.bank === ""
      && account.accountNumber === ""
      && account.holder === ""
      && account.kakaoPayUrl === ""
      && account.tossUrl === ""
    ))).toBe(true);
  });

  it("contains the confirmed wedding directions", () => {
    expect(invitationContent.event.venue).toEqual({
      name: "MJ컨벤션",
      hall: "5층 파티오볼룸",
      address: "경기 부천시 소사구 경인로 386",
      directions: {
        mapSearchName: "MJ컨벤션",
        phone: "032-347-5500",
        transit: "1호선·서해선 소사역 1번 출구에서 도보 약 3분",
        parking: "주차 2시간 무료 · 약 500대 이상 주차 가능"
      }
    });
  });

  it("keeps the directions spot consistent with the venue", () => {
    const directions = invitationContent.spots.find((spot) => spot.id === "directions");
    const venue = invitationContent.event.venue;

    expect(directions?.body).toContain(venue.name);
    expect(directions?.body).toContain(venue.address);
  });

  it("defines an exact 90 minute event", () => {
    const start = new Date(invitationContent.event.startAt).getTime();
    const end = new Date(invitationContent.event.endAt).getTime();

    expect(end - start).toBe(90 * 60 * 1000);
  });

  it("keeps the wedding information spot consistent with the event", () => {
    const weddingInfo = invitationContent.spots.find((spot) => spot.id === "wedding-info");

    expect(weddingInfo?.body).toContain("2027년 5월 1일 토요일 오후 5시 10분");
    expect(weddingInfo?.body).toContain("MJ컨벤션 5층 파티오볼룸");
  });
});
