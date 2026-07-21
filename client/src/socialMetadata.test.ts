import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("index.html", "utf8");
const document = new DOMParser().parseFromString(html, "text/html");

function meta(property: string): string | null {
  return document.querySelector(`meta[property="${property}"]`)?.getAttribute("content") ?? null;
}

function namedMeta(name: string): string | null {
  return document.querySelector(`meta[name="${name}"]`)?.getAttribute("content") ?? null;
}

describe("청첩장 링크 미리보기 메타데이터", () => {
  it("신랑신부 이름과 예식 정보를 문서 제목과 설명에 제공한다", () => {
    expect(document.title).toBe("이승재 · 이건희 결혼식 | 2027.05.01");
    expect(namedMeta("description")).toBe(
      "2027년 5월 1일 토요일 오후 5시 10분, MJ컨벤션 5층 파티오볼룸에서 만나요."
    );
  });

  it("공개 주소와 대표 사진을 포함한 Open Graph 계약을 제공한다", () => {
    expect(meta("og:type")).toBe("website");
    expect(meta("og:locale")).toBe("ko_KR");
    expect(meta("og:site_name")).toBe("이승재 · 이건희 모바일 청첩장");
    expect(meta("og:title")).toBe("이승재 · 이건희 결혼식");
    expect(meta("og:description")).toBe(
      "2027년 5월 1일 토요일 오후 5시 10분 · MJ컨벤션 5층 파티오볼룸"
    );
    expect(meta("og:url")).toBe("https://po-mato.github.io/pixel-garden-invitation/");
    expect(meta("og:image")).toBe(
      "https://po-mato.github.io/pixel-garden-invitation/images/wedding-gallery/01-cover-1024.webp"
    );
    expect(meta("og:image:secure_url")).toBe(meta("og:image"));
    expect(meta("og:image:type")).toBe("image/webp");
    expect(meta("og:image:width")).toBe("1024");
    expect(meta("og:image:height")).toBe("683");
    expect(meta("og:image:alt")).toContain("신랑신부");
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(meta("og:url"));
  });

  it("큰 이미지형 Twitter 카드에도 같은 예식 정보를 제공한다", () => {
    expect(namedMeta("twitter:card")).toBe("summary_large_image");
    expect(namedMeta("twitter:title")).toBe(meta("og:title"));
    expect(namedMeta("twitter:description")).toBe(meta("og:description"));
    expect(namedMeta("twitter:image")).toBe(meta("og:image"));
    expect(namedMeta("twitter:image:alt")).toBe(meta("og:image:alt"));
  });

  it("계좌 및 간편송금 정보는 링크 미리보기 메타데이터에 포함하지 않는다", () => {
    const metadata = Array.from(document.querySelectorAll("meta"))
      .map((element) => element.getAttribute("content") ?? "")
      .join(" ");

    expect(metadata).not.toMatch(/계좌|예금주|카카오페이|토스|혼주|연락처|010-/);
  });
});
