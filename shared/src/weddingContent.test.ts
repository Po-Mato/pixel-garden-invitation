import { describe, expect, it } from "vitest";
import { invitationContent } from "./content";
import { parseWeddingGalleryManifest, weddingContent } from "./weddingContent";

describe("weddingContent", () => {
  it("에디토리얼 갤러리 사진 10장을 고유한 ID로 포함한다", () => {
    expect(weddingContent.gallery).toHaveLength(10);
    expect(new Set(weddingContent.gallery.map((photo) => photo.id)).size).toBe(10);
    expect(weddingContent.gallery[0]).toMatchObject({ id: "01-cover", layout: "hero" });
    expect(weddingContent.gallery.every((photo) => photo.alt.trim().length > 0)).toBe(true);
    expect(weddingContent.gallery.flatMap((photo) => photo.sources).map((source) => source.width))
      .toEqual(Array.from({ length: 10 }, () => [640, 1024]).flat());
  });

  it("승인된 프로필과 공동 인사말을 포함한다", () => {
    expect(weddingContent.coupleProfiles.map(({ role, name }) => ({ role, name }))).toEqual([
      { role: "groom", name: "이승재" },
      { role: "bride", name: "이건희" }
    ]);
    expect(weddingContent.coupleMessage).toBe(
      "저희 두 사람의 새로운 시작에 함께해 주시면 더없는 기쁨이겠습니다."
    );
    expect(weddingContent.coupleProfiles.map((profile) => profile.name)).toEqual([
      invitationContent.event.couple.groom,
      invitationContent.event.couple.bride
    ]);
  });

  it("승인된 네 단계 스토리 순서를 유지한다", () => {
    expect(weddingContent.storyTimeline.map((step) => step.id)).toEqual([
      "hello", "seasons", "promise", "wedding"
    ]);
  });

  it("중복 ID와 잘못된 방향을 거부한다", () => {
    const valid = weddingContent.gallery.map(({ assetPath: _assetPath, sources: _sources, ...photo }) => photo);
    expect(() => parseWeddingGalleryManifest([...valid, valid[0]])).toThrow(/10장/);
    expect(() => parseWeddingGalleryManifest(valid.map((photo, index) =>
      index === 0 ? { ...photo, orientation: "portrait" } : photo
    ))).toThrow(/방향/);
  });
});
