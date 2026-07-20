import { invitationContent } from "@wedding-game/shared";
import { describe, expect, it } from "vitest";
import { buildDirectionsLinks, buildTelephoneHref } from "./directions";

const venue = invitationContent.event.venue;
const destination = `${venue.directions.mapSearchName} ${venue.address}`;

describe("오시는 길 링크", () => {
  it("공유 장소 정보로 세 지도 서비스의 HTTPS 목적지 링크를 만든다", () => {
    const links = buildDirectionsLinks(venue);
    const naver = new URL(links.naver ?? "");
    const kakao = new URL(links.kakao ?? "");
    const google = new URL(links.google ?? "");

    expect(naver.protocol).toBe("https:");
    expect(naver.hostname).toBe("map.naver.com");
    expect(naver.pathname).toBe(`/p/search/${encodeURIComponent(destination)}`);
    expect(decodeURIComponent(naver.pathname)).toContain(destination);

    expect(kakao.protocol).toBe("https:");
    expect(kakao.hostname).toBe("map.kakao.com");
    expect(kakao.pathname).toBe("/");
    expect(kakao.searchParams.get("q")).toBe(destination);

    expect(google.protocol).toBe("https:");
    expect(google.hostname).toBe("www.google.com");
    expect(google.pathname).toBe("/maps/dir/");
    expect(google.searchParams.get("api")).toBe("1");
    expect(google.searchParams.get("destination")).toBe(destination);
  });

  it("표시용 전화번호에서 숫자만 추출해 전화 링크를 만든다", () => {
    expect(buildTelephoneHref(venue.directions.phone)).toBe("tel:0323475500");
    expect(buildTelephoneHref("02) 1234-5678 내선 9")).toBe("tel:02123456789");
  });

  it("장소명 또는 주소가 비어 있으면 지도 링크만 비활성화한다", () => {
    expect(buildDirectionsLinks({ ...venue, address: "   " })).toEqual({
      naver: null,
      kakao: null,
      google: null,
      telephone: "tel:0323475500"
    });

    expect(buildDirectionsLinks({
      ...venue,
      directions: { ...venue.directions, mapSearchName: "\t" }
    })).toEqual({
      naver: null,
      kakao: null,
      google: null,
      telephone: "tel:0323475500"
    });
  });

  it("유효하지 않은 전화번호는 전화 링크를 만들지 않는다", () => {
    expect(buildTelephoneHref("번호 없음")).toBeNull();
    expect(buildTelephoneHref("1234-5678-9012")).toBeNull();
  });
});
