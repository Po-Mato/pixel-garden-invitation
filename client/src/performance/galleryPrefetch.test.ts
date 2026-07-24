import { invitationContent } from "@wedding-game/shared";
import { describe, expect, it } from "vitest";
import { galleryPrefetchUrl, nextGalleryPrefetchIndex } from "./galleryPrefetch";

describe("갤러리 방향 기반 사전 로딩", () => {
  it("넘기는 방향의 다음 한 장을 선택하고 끝에서는 반대편을 준비한다", () => {
    expect(nextGalleryPrefetchIndex(2, 1, 10)).toBe(3);
    expect(nextGalleryPrefetchIndex(2, 3, 10)).toBe(1);
    expect(nextGalleryPrefetchIndex(9, 8, 10)).toBe(8);
  });

  it("데이터 절약 중에는 사전 로딩하지 않는다", () => {
    const photo = invitationContent.content.gallery[0];
    expect(galleryPrefetchUrl(photo, "economy")).toBeNull();
    expect(galleryPrefetchUrl(photo, "balanced")).toContain("-1024.webp");
  });
});
