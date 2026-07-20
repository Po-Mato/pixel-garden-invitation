import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { invitationContent } from "@wedding-game/shared";
import { afterEach, describe, expect, it } from "vitest";
import { buildGallerySrcSet } from "../invitation/galleryAssets";
import { ResponsiveGalleryImage } from "./ResponsiveGalleryImage";

const photo = invitationContent.content.gallery[0];

afterEach(cleanup);

describe("반응형 갤러리 이미지", () => {
  it("대표 사진에는 우선 로드 속성과 반응형 소스를 제공한다", () => {
    render(<ResponsiveGalleryImage photo={photo} priority sizes="88vw" />);

    const image = screen.getByRole("img", { name: photo.alt });
    expect(image).toHaveAttribute("src", expect.stringContaining(photo.assetPath));
    expect(image).toHaveAttribute("srcset", expect.stringContaining("640w"));
    expect(image).toHaveAttribute("srcset", expect.stringContaining("1024w"));
    expect(image).toHaveAttribute("sizes", "88vw");
    expect(image).toHaveAttribute("width", String(photo.width));
    expect(image).toHaveAttribute("height", String(photo.height));
    expect(image).toHaveAttribute("loading", "eager");
    expect(image).toHaveAttribute("fetchpriority", "high");
    expect(image).toHaveAttribute("decoding", "async");
    expect(buildGallerySrcSet(photo.sources, "/pixel-garden-invitation")).toContain(
      "/pixel-garden-invitation/images/wedding-gallery/01-cover-640.webp 640w"
    );
  });

  it("나머지 사진은 지연 로드하고 실패해도 선언된 비율과 대체 설명을 유지한다", () => {
    const secondaryPhoto = invitationContent.content.gallery[1];
    render(<ResponsiveGalleryImage photo={secondaryPhoto} sizes="44vw" />);

    const image = screen.getByRole("img", { name: secondaryPhoto.alt });
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("fetchpriority", "auto");
    expect(image).toHaveAttribute("decoding", "async");

    fireEvent.error(image);

    const fallback = screen.getByRole("img", { name: secondaryPhoto.alt });
    expect(fallback).toHaveClass("responsive-gallery-image--fallback");
    expect(fallback).toHaveStyle({ aspectRatio: `${secondaryPhoto.width} / ${secondaryPhoto.height}` });
  });
});
