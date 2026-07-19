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
      venue: {
        name: "MJ컨벤션",
        hall: "5층 파티오볼룸",
        address: "경기 부천시 소사구 경인로 386"
      }
    });
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
