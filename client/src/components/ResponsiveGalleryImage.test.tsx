import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { invitationContent } from "@wedding-game/shared";
import { afterEach, describe, expect, it } from "vitest";
import { ViewPreferencesProvider } from "../accessibility/ViewPreferencesContext";
import { defaultViewPreferences } from "../accessibility/viewPreferences";
import { buildGallerySrcSet } from "../invitation/galleryAssets";
import { ResponsiveGalleryImage } from "./ResponsiveGalleryImage";

const photo = invitationContent.content.gallery[0];

afterEach(cleanup);

describe("반응형 갤러리 이미지", () => {
  it("대표 사진에는 우선 로드 속성과 반응형 소스를 제공한다", () => {
    const { container } = render(<ResponsiveGalleryImage photo={photo} priority sizes="88vw" />);

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
    expect(container.querySelector('source[type="image/avif"]')).toHaveAttribute("srcset", expect.stringContaining("-1024.avif"));
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

    fireEvent(window, new Event("online"));
    expect(screen.getByRole("img", { name: secondaryPhoto.alt })).toHaveAttribute("data-retry-count", "1");
  });

  it("데이터 절약 모드에서는 640px 소스만 요청한다", () => {
    render(
      <ViewPreferencesProvider initialPreferences={{ ...defaultViewPreferences, dataSaver: true }}>
        <ResponsiveGalleryImage photo={photo} priority sizes="88vw" />
      </ViewPreferencesProvider>
    );

    const image = screen.getByRole("img", { name: photo.alt });
    expect(image).toHaveAttribute("src", expect.stringContaining("-640.webp"));
    expect(image).not.toHaveAttribute("srcset");
    expect(image).toHaveAttribute("data-network-mode", "economy");
  });

  it("사용자가 고화질을 요청하면 데이터 절약 중에도 반응형 원본을 제공한다", () => {
    render(
      <ViewPreferencesProvider initialPreferences={{ ...defaultViewPreferences, dataSaver: true }}>
        <ResponsiveGalleryImage photo={photo} priority quality="full" sizes="100vw" />
      </ViewPreferencesProvider>
    );

    const image = screen.getByRole("img", { name: photo.alt });
    expect(image).toHaveAttribute("data-network-mode", "full");
    expect(image).toHaveAttribute("srcset", expect.stringContaining("1024w"));
  });

  it("Worker 절대 URL에는 존재하지 않는 AVIF 소스를 만들지 않는다", () => {
    const remotePhoto = {
      ...photo,
      assetPath: "https://worker.test/photo-1024.webp",
      sources: photo.sources.map((source) => ({ ...source, assetPath: `https://worker.test/photo-${source.width}.webp` }))
    };
    const { container } = render(<ResponsiveGalleryImage photo={remotePhoto} sizes="88vw" />);
    expect(container.querySelector('source[type="image/avif"]')).toBeNull();
  });
});
