import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { invitationContent } from "@wedding-game/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WeddingGallery } from "./WeddingGallery";

afterEach(cleanup);

describe("에디토리얼 웨딩 갤러리", () => {
  it("공유 메타데이터 순서대로 10장의 사진 버튼과 캡션을 렌더링한다", () => {
    render(<WeddingGallery />);

    const photos = invitationContent.content.gallery;
    const buttons = screen.getAllByRole("button", { name: /사진 \d+:/ });
    expect(buttons).toHaveLength(10);
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(
      photos.map((photo, index) => `사진 ${index + 1}: ${photo.alt}`)
    );
    const images = screen.getAllByRole("img");
    expect(images[0]).toHaveAttribute("loading", "eager");
    expect(images[0]).toHaveAttribute("fetchpriority", "high");
    images.slice(1).forEach((image) => {
      expect(image).toHaveAttribute("loading", "lazy");
      expect(image).toHaveAttribute("fetchpriority", "auto");
      expect(image).toHaveAttribute("decoding", "async");
    });

    photos.forEach((photo, index) => {
      const item = buttons[index].closest("figure");
      expect(item).toHaveClass("wedding-gallery__item", `wedding-gallery__item--${photo.layout}`);
      if (photo.caption) {
        expect(item).toHaveTextContent(photo.caption);
      }
    });
  });

  it("선택한 사진의 메타데이터 인덱스를 열기 콜백으로 전달한다", () => {
    const onPhotoOpen = vi.fn();
    render(<WeddingGallery onPhotoOpen={onPhotoOpen} />);

    fireEvent.click(screen.getAllByRole("button", { name: /사진 \d+:/ })[4]);

    expect(onPhotoOpen).toHaveBeenCalledWith(4);
  });
});
